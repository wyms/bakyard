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
    const { session_id, player_emails, host_user_id } = await req.json();

    if (!session_id || !player_emails || !Array.isArray(player_emails) || player_emails.length === 0) {
      return new Response(
        JSON.stringify({
          error: "session_id and player_emails (non-empty array) are required",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createAdminClient();

    // ---------- Step A: Look up session price ----------
    const { data: session, error: sessionError } = await adminClient
      .from("sessions")
      .select("price_cents, spots_remaining, status")
      .eq("id", session_id)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: "Session not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (session.status !== "open") {
      return new Response(
        JSON.stringify({ error: "Session is not open for booking" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (session.spots_remaining < player_emails.length) {
      return new Response(
        JSON.stringify({
          error: `Not enough spots. Need ${player_emails.length}, available: ${session.spots_remaining}`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const totalPlayers = player_emails.length;
    const perPersonCents = Math.ceil(session.price_cents / totalPlayers);

    // Generate a shared split group ID
    const splitGroupId = crypto.randomUUID();

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      throw new Error("Missing STRIPE_SECRET_KEY");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    // ---------- Step B: Process each player ----------
    const results: Array<{
      email: string;
      clientSecret: string | null;
      orderId: string;
      bookingId: string;
      error?: string;
    }> = [];

    for (const email of player_emails) {
      try {
        // Look up user by email in auth.users via admin client
        const { data: authUsers } = await adminClient.auth.admin.listUsers();
        const matchedUser = authUsers?.users?.find(
          (u) => u.email === email
        );

        if (!matchedUser) {
          results.push({
            email,
            clientSecret: null,
            orderId: "",
            bookingId: "",
            error: `User with email ${email} not found. They must sign up first.`,
          });
          continue;
        }

        const playerId = matchedUser.id;

        // Create booking for this player via book_session()
        const { data: booking, error: bookError } = await adminClient.rpc(
          "book_session",
          {
            p_session_id: session_id,
            p_user_id: playerId,
            p_guests: 0,
          }
        );

        if (bookError) {
          results.push({
            email,
            clientSecret: null,
            orderId: "",
            bookingId: "",
            error: bookError.message,
          });
          continue;
        }

        // Get or create Stripe customer
        const { data: profile } = await adminClient
          .from("users")
          .select("stripe_customer_id")
          .eq("id", playerId)
          .single();

        let customerId = profile?.stripe_customer_id;

        if (!customerId) {
          const customer = await stripe.customers.create({
            email,
            metadata: { supabase_user_id: playerId },
          });
          customerId = customer.id;

          await adminClient
            .from("users")
            .update({ stripe_customer_id: customerId })
            .eq("id", playerId);
        }

        // Create individual PaymentIntent
        const paymentIntent = await stripe.paymentIntents.create({
          amount: perPersonCents,
          currency: "usd",
          customer: customerId,
          metadata: {
            booking_id: booking.id,
            session_id,
            user_id: playerId,
            split_group_id: splitGroupId,
            host_user_id: host_user_id || user.id,
          },
        });

        // Create order record
        const { data: order, error: orderError } = await adminClient
          .from("orders")
          .insert({
            booking_id: booking.id,
            user_id: playerId,
            amount_cents: perPersonCents,
            discount_cents: 0,
            stripe_payment_intent_id: paymentIntent.id,
            status: "pending",
            is_split: true,
            split_group_id: splitGroupId,
          })
          .select()
          .single();

        if (orderError) {
          results.push({
            email,
            clientSecret: null,
            orderId: "",
            bookingId: booking.id,
            error: "Failed to create order: " + orderError.message,
          });
          continue;
        }

        results.push({
          email,
          clientSecret: paymentIntent.client_secret,
          orderId: order.id,
          bookingId: booking.id,
        });
      } catch (playerErr) {
        results.push({
          email,
          clientSecret: null,
          orderId: "",
          bookingId: "",
          error: playerErr.message,
        });
      }
    }

    // ---------- Response ----------
    return new Response(
      JSON.stringify({
        splitGroupId,
        perPersonCents,
        players: results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("split-payment error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
