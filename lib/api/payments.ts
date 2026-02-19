import { supabase } from '@/lib/supabase';

export interface CheckoutResponse {
  payment_intent_id: string;
  client_secret: string;
  amount_cents: number;
  discount_cents: number;
}

export interface SubscriptionResponse {
  subscription_id: string;
  client_secret: string;
  tier: string;
}

/**
 * Create a checkout / payment intent for a session booking.
 * Optionally applies membership discount if membershipId is provided.
 */
export async function createCheckout(
  sessionId: string,
  membershipId?: string
): Promise<CheckoutResponse> {
  const { data, error } = await supabase.functions.invoke('create-checkout', {
    body: {
      session_id: sessionId,
      membership_id: membershipId ?? null,
    },
  });

  if (error) throw new Error(error.message);
  return data as CheckoutResponse;
}

/**
 * Create a Stripe subscription for a membership tier.
 * Returns the client secret needed to confirm payment on the client.
 */
export async function createSubscription(
  tier: string
): Promise<SubscriptionResponse> {
  const { data, error } = await supabase.functions.invoke(
    'create-subscription',
    {
      body: { tier },
    }
  );

  if (error) throw new Error(error.message);
  return data as SubscriptionResponse;
}
