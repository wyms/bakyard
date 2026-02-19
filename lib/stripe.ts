const stripePublishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;

if (!stripePublishableKey && typeof window === 'undefined') {
  console.warn(
    'Missing EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY environment variable. Stripe payments will not work.'
  );
}

export const STRIPE_PUBLISHABLE_KEY = stripePublishableKey ?? '';
