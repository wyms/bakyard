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
    const { session_id, guests = 0, membership_id } = await req.json();

    if (!session_id) {
      return new Response(
        JSON.stringify({ error: "session_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createAdminClient();

    // ---------- Step A: Reserve spots via book_session() ----------
    const { data: booking, error: bookError } = await adminClient.rpc(
      "book_session",
      {
        p_session_id: session_id,
        p_user_id: user.id,
        p_guests: guests,
      }
    );

    if (bookError) {
      return new Response(
        JSON.stringify({ error: bookError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---------- Step B: Look up session price ----------
    const { data: session, error: sessionError } = await adminClient
      .from("sessions")
      .select("price_cents")
      .eq("id", session_id)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: "Session not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const totalSpots = 1 + guests;
    let amountCents = session.price_cents * totalSpots;
    let discountCents = 0;

    // ---------- Step C: Apply membership discount ----------
    if (membership_id) {
      const { data: membership, error: memError } = await adminClient
        .from("memberships")
        .select("discount_percent")
        .eq("id", membership_id)
        .eq("user_id", user.id)
        .eq("status", "active")
        .single();

      if (!memError && membership) {
        discountCents = Math.round(
          amountCents * (membership.discount_percent / 100)
        );
        amountCents = amountCents - discountCents;
      }
    }

    // ---------- Step D: Create Stripe PaymentIntent ----------
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      throw new Error("Missing STRIPE_SECRET_KEY");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Get or use existing Stripe customer
    const { data: profile } = await adminClient
      .from("users")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      await adminClient
        .from("users")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      customer: customerId,
      metadata: {
        booking_id: booking.id,
        session_id,
        user_id: user.id,
      },
    });

    // ---------- Step E: Create order record ----------
    const { data: order, error: orderError } = await adminClient
      .from("orders")
      .insert({
        booking_id: booking.id,
        user_id: user.id,
        amount_cents: amountCents,
        discount_cents: discountCents,
        membership_id: membership_id || null,
        stripe_payment_intent_id: paymentIntent.id,
        status: "pending",
      })
      .select()
      .single();

    if (orderError) {
      return new Response(
        JSON.stringify({ error: "Failed to create order: " + orderError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---------- Response ----------
    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        bookingId: booking.id,
        orderId: order.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("create-checkout error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
