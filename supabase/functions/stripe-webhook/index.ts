import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14?target=deno";
import { corsHeaders } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!stripeSecretKey || !webhookSecret) {
      throw new Error("Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    // ---------- Verify webhook signature ----------
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return new Response(
        JSON.stringify({ error: "Missing stripe-signature header" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        webhookSecret
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createAdminClient();

    // ---------- Handle events ----------
    switch (event.type) {
      // ---- Payment Intent Succeeded ----
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;

        // Update order status to 'paid'
        const { error: orderError } = await adminClient
          .from("orders")
          .update({ status: "paid" })
          .eq("stripe_payment_intent_id", paymentIntent.id);

        if (orderError) {
          console.error("Failed to update order:", orderError.message);
        }

        // The trg_order_paid trigger in Postgres will automatically
        // update the booking status to 'confirmed' when the order
        // status changes to 'paid'. We also update explicitly as a
        // safety measure.
        const bookingId = paymentIntent.metadata?.booking_id;
        if (bookingId) {
          const { error: bookingError } = await adminClient
            .from("bookings")
            .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
            .eq("id", bookingId);

          if (bookingError) {
            console.error("Failed to update booking:", bookingError.message);
          }
        }

        break;
      }

      // ---- Payment Intent Failed ----
      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;

        const { error } = await adminClient
          .from("orders")
          .update({ status: "failed" })
          .eq("stripe_payment_intent_id", paymentIntent.id);

        if (error) {
          console.error("Failed to update order to failed:", error.message);
        }

        break;
      }

      // ---- Subscription Created ----
      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id;

        if (!userId) {
          console.error("No supabase_user_id in subscription metadata");
          break;
        }

        // Check if membership already exists for this subscription
        const { data: existing } = await adminClient
          .from("memberships")
          .select("id")
          .eq("stripe_subscription_id", subscription.id)
          .maybeSingle();

        if (!existing) {
          const tier = subscription.metadata?.tier || "local_player";
          const discountMap: Record<string, number> = {
            local_player: 10,
            sand_regular: 20,
            founders: 30,
          };
          const priorityMap: Record<string, number> = {
            local_player: 12,
            sand_regular: 24,
            founders: 48,
          };
          const guestMap: Record<string, number> = {
            local_player: 0,
            sand_regular: 1,
            founders: 999,
          };

          const { error } = await adminClient.from("memberships").insert({
            user_id: userId,
            tier,
            stripe_subscription_id: subscription.id,
            status: "active",
            discount_percent: discountMap[tier] ?? 10,
            priority_booking_hours: priorityMap[tier] ?? 12,
            guest_passes_remaining: guestMap[tier] ?? 0,
            current_period_start: new Date(
              subscription.current_period_start * 1000
            ).toISOString(),
            current_period_end: new Date(
              subscription.current_period_end * 1000
            ).toISOString(),
          });

          if (error) {
            console.error("Failed to create membership:", error.message);
          }
        }

        break;
      }

      // ---- Subscription Updated ----
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;

        const statusMap: Record<string, string> = {
          active: "active",
          past_due: "past_due",
          canceled: "cancelled",
          unpaid: "past_due",
        };

        const mappedStatus = statusMap[subscription.status] || "active";

        const { error } = await adminClient
          .from("memberships")
          .update({
            status: mappedStatus,
            current_period_start: new Date(
              subscription.current_period_start * 1000
            ).toISOString(),
            current_period_end: new Date(
              subscription.current_period_end * 1000
            ).toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id);

        if (error) {
          console.error("Failed to update membership:", error.message);
        }

        break;
      }

      // ---- Subscription Deleted ----
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        const { error } = await adminClient
          .from("memberships")
          .update({ status: "cancelled" })
          .eq("stripe_subscription_id", subscription.id);

        if (error) {
          console.error("Failed to cancel membership:", error.message);
        }

        break;
      }

      // ---- Invoice Paid ----
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription?.id;

        if (subscriptionId) {
          // Fetch the subscription to get fresh period dates
          const subscription =
            await stripe.subscriptions.retrieve(subscriptionId);

          const { error } = await adminClient
            .from("memberships")
            .update({
              status: "active",
              current_period_start: new Date(
                subscription.current_period_start * 1000
              ).toISOString(),
              current_period_end: new Date(
                subscription.current_period_end * 1000
              ).toISOString(),
            })
            .eq("stripe_subscription_id", subscriptionId);

          if (error) {
            console.error(
              "Failed to update membership on invoice.paid:",
              error.message
            );
          }
        }

        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("stripe-webhook error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
