import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14?target=deno";
import { corsHeaders } from "../_shared/cors.ts";
import { createAdminClient, createUserClient } from "../_shared/supabase.ts";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ---------- Auth ----------
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userClient = createUserClient(authHeader);
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---------- Parse body ----------
    const { booking_id } = await req.json();

    if (!booking_id) {
      return new Response(
        JSON.stringify({ error: "booking_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createAdminClient();

    // ---------- Step A: Fetch booking + session + order ----------
    const { data: booking, error: bookingError } = await adminClient
      .from("bookings")
      .select("*, sessions(*)")
      .eq("id", booking_id)
      .single();

    if (bookingError || !booking) {
      return new Response(
        JSON.stringify({ error: "Booking not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (booking.status === "cancelled") {
      return new Response(
        JSON.stringify({ error: "Booking is already cancelled" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---------- Step B: Verify ownership or admin ----------
    const { data: userProfile } = await adminClient
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin = userProfile?.role === "admin";
    const isOwner = booking.user_id === user.id;

    if (!isOwner && !isAdmin) {
      return new Response(
        JSON.stringify({ error: "Forbidden: you do not own this booking" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---------- Step C: Calculate refund based on cancellation policy ----------
    const session = booking.sessions;
    const sessionStart = new Date(session.starts_at);
    const now = new Date();
    const hoursUntilSession =
      (sessionStart.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Fetch the order for this booking
    const { data: order } = await adminClient
      .from("orders")
      .select("*")
      .eq("booking_id", booking_id)
      .eq("status", "paid")
      .maybeSingle();

    let refundAmountCents = 0;
    let refundPercent = 0;

    if (order) {
      if (hoursUntilSession > 24) {
        // Full refund
        refundPercent = 100;
        refundAmountCents = order.amount_cents;
      } else if (hoursUntilSession > 12) {
        // 50% refund
        refundPercent = 50;
        refundAmountCents = Math.round(order.amount_cents * 0.5);
      } else {
        // No refund
        refundPercent = 0;
        refundAmountCents = 0;
      }
    }

    // ---------- Step D: Create Stripe refund if applicable ----------
    if (refundAmountCents > 0 && order?.stripe_payment_intent_id) {
      const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (!stripeSecretKey) {
        throw new Error("Missing STRIPE_SECRET_KEY");
      }

      const stripe = new Stripe(stripeSecretKey, {
        apiVersion: "2023-10-16",
        httpClient: Stripe.createFetchHttpClient(),
      });

      await stripe.refunds.create({
        payment_intent: order.stripe_payment_intent_id,
        amount: refundAmountCents,
      });
    }

    // ---------- Step E: Update booking status ----------
    // The trg_booking_cancelled trigger will automatically:
    //   - Set cancelled_at to now()
    //   - Increment spots_remaining on the session
    //   - Reopen the session if it was full
    const { error: cancelError } = await adminClient
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", booking_id);

    if (cancelError) {
      return new Response(
        JSON.stringify({ error: "Failed to cancel booking: " + cancelError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---------- Step F: Update order status ----------
    if (order) {
      const newOrderStatus = refundPercent === 100 ? "refunded" : order.status;
      if (newOrderStatus !== order.status) {
        await adminClient
          .from("orders")
          .update({ status: newOrderStatus })
          .eq("id", order.id);
      }
    }

    // ---------- Response ----------
    return new Response(
      JSON.stringify({
        refundAmount: refundAmountCents,
        refundPercent,
        bookingStatus: "cancelled",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("cancel-booking error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
