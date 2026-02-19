import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14?target=deno";
import { corsHeaders } from "../_shared/cors.ts";
import { createAdminClient, createUserClient } from "../_shared/supabase.ts";

const TIER_CONFIG: Record<
  string,
  { envVar: string; discount: number; priority: number; guests: number }
> = {
  local_player: {
    envVar: "STRIPE_PRICE_LOCAL",
    discount: 10,
    priority: 12,
    guests: 0,
  },
  sand_regular: {
    envVar: "STRIPE_PRICE_REGULAR",
    discount: 20,
    priority: 24,
    guests: 1,
  },
  founders: {
    envVar: "STRIPE_PRICE_FOUNDERS",
    discount: 30,
    priority: 48,
    guests: 999,
  },
};

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
    const { tier } = await req.json();

    if (!tier || !TIER_CONFIG[tier]) {
      return new Response(
        JSON.stringify({
          error: "Invalid tier. Must be one of: local_player, sand_regular, founders",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tierConfig = TIER_CONFIG[tier];
    const stripePriceId = Deno.env.get(tierConfig.envVar);

    if (!stripePriceId) {
      throw new Error(`Missing ${tierConfig.envVar} environment variable`);
    }

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      throw new Error("Missing STRIPE_SECRET_KEY");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const adminClient = createAdminClient();

    // ---------- Step A: Get or create Stripe customer ----------
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

    // ---------- Step B: Create Stripe subscription ----------
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: stripePriceId }],
      payment_behavior: "default_incomplete",
      payment_settings: {
        save_default_payment_method: "on_subscription",
      },
      expand: ["latest_invoice.payment_intent"],
      metadata: {
        supabase_user_id: user.id,
        tier,
      },
    });

    // Extract client secret from the expanded invoice's payment intent
    const invoice = subscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;

    // ---------- Step C: Create membership record ----------
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const { data: membership, error: memError } = await adminClient
      .from("memberships")
      .insert({
        user_id: user.id,
        tier,
        stripe_subscription_id: subscription.id,
        status: "active",
        discount_percent: tierConfig.discount,
        priority_booking_hours: tierConfig.priority,
        guest_passes_remaining: tierConfig.guests,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
      })
      .select()
      .single();

    if (memError) {
      return new Response(
        JSON.stringify({ error: "Failed to create membership: " + memError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---------- Response ----------
    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        subscriptionId: subscription.id,
        membershipId: membership.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("create-subscription error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
