/**
 * Tests for the stripe-webhook edge function business logic.
 *
 * Since the edge function uses Deno's serve() and cannot be directly imported
 * in a Jest/Node environment, we extract the core business logic as pure
 * functions and test them here. Each function mirrors the logic in
 * supabase/functions/stripe-webhook/index.ts.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PaymentIntentEvent {
  id: string;
  metadata: {
    booking_id?: string;
    session_id?: string;
    user_id?: string;
    split_group_id?: string;
    host_user_id?: string;
  };
}

interface SubscriptionEvent {
  id: string;
  status: string;
  metadata: {
    supabase_user_id?: string;
    tier?: string;
  };
  current_period_start: number;
  current_period_end: number;
}

interface InvoiceEvent {
  id: string;
  subscription: string | { id: string } | null;
}

// ---------------------------------------------------------------------------
// Constants from the edge function
// ---------------------------------------------------------------------------

const DISCOUNT_MAP: Record<string, number> = {
  local_player: 10,
  sand_regular: 20,
  founders: 30,
};

const PRIORITY_MAP: Record<string, number> = {
  local_player: 12,
  sand_regular: 24,
  founders: 48,
};

const GUEST_MAP: Record<string, number> = {
  local_player: 0,
  sand_regular: 1,
  founders: 999,
};

const SUBSCRIPTION_STATUS_MAP: Record<string, string> = {
  active: 'active',
  past_due: 'past_due',
  canceled: 'cancelled',
  unpaid: 'past_due',
};

// ---------------------------------------------------------------------------
// Pure functions extracted from the edge function
// ---------------------------------------------------------------------------

/**
 * Determines the database action for a given Stripe event type.
 */
type WebhookAction =
  | { type: 'payment_succeeded'; paymentIntentId: string; bookingId: string | null }
  | { type: 'payment_failed'; paymentIntentId: string }
  | { type: 'subscription_created'; subscription: SubscriptionEvent }
  | { type: 'subscription_updated'; subscription: SubscriptionEvent }
  | { type: 'subscription_deleted'; subscriptionId: string }
  | { type: 'invoice_paid'; subscriptionId: string | null }
  | { type: 'unhandled'; eventType: string };

function determineWebhookAction(
  eventType: string,
  eventData: Record<string, unknown>,
): WebhookAction {
  switch (eventType) {
    case 'payment_intent.succeeded': {
      const pi = eventData as unknown as PaymentIntentEvent;
      return {
        type: 'payment_succeeded',
        paymentIntentId: pi.id,
        bookingId: pi.metadata?.booking_id ?? null,
      };
    }

    case 'payment_intent.payment_failed': {
      const pi = eventData as unknown as PaymentIntentEvent;
      return {
        type: 'payment_failed',
        paymentIntentId: pi.id,
      };
    }

    case 'customer.subscription.created': {
      const sub = eventData as unknown as SubscriptionEvent;
      return {
        type: 'subscription_created',
        subscription: sub,
      };
    }

    case 'customer.subscription.updated': {
      const sub = eventData as unknown as SubscriptionEvent;
      return {
        type: 'subscription_updated',
        subscription: sub,
      };
    }

    case 'customer.subscription.deleted': {
      const sub = eventData as unknown as SubscriptionEvent;
      return {
        type: 'subscription_deleted',
        subscriptionId: sub.id,
      };
    }

    case 'invoice.paid': {
      const inv = eventData as unknown as InvoiceEvent;
      const subscriptionId =
        typeof inv.subscription === 'string'
          ? inv.subscription
          : inv.subscription?.id ?? null;
      return {
        type: 'invoice_paid',
        subscriptionId,
      };
    }

    default:
      return { type: 'unhandled', eventType };
  }
}

/**
 * Maps a Stripe subscription status to our internal membership status.
 */
function mapSubscriptionStatus(stripeStatus: string): string {
  return SUBSCRIPTION_STATUS_MAP[stripeStatus] || 'active';
}

/**
 * Builds the membership record for a new subscription.
 */
function buildMembershipRecord(
  userId: string,
  subscription: SubscriptionEvent,
) {
  const tier = subscription.metadata?.tier || 'local_player';

  return {
    user_id: userId,
    tier,
    stripe_subscription_id: subscription.id,
    status: 'active',
    discount_percent: DISCOUNT_MAP[tier] ?? 10,
    priority_booking_hours: PRIORITY_MAP[tier] ?? 12,
    guest_passes_remaining: GUEST_MAP[tier] ?? 0,
    current_period_start: new Date(
      subscription.current_period_start * 1000,
    ).toISOString(),
    current_period_end: new Date(
      subscription.current_period_end * 1000,
    ).toISOString(),
  };
}

/**
 * Builds the update payload for a subscription update event.
 */
function buildMembershipUpdate(subscription: SubscriptionEvent) {
  return {
    status: mapSubscriptionStatus(subscription.status),
    current_period_start: new Date(
      subscription.current_period_start * 1000,
    ).toISOString(),
    current_period_end: new Date(
      subscription.current_period_end * 1000,
    ).toISOString(),
  };
}

/**
 * Extracts the subscription ID from an invoice event.
 */
function extractSubscriptionIdFromInvoice(
  invoice: InvoiceEvent,
): string | null {
  if (typeof invoice.subscription === 'string') {
    return invoice.subscription;
  }
  return invoice.subscription?.id ?? null;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('stripe-webhook logic', () => {
  // -----------------------------------------------------------------------
  // Webhook Action Determination
  // -----------------------------------------------------------------------
  describe('determineWebhookAction', () => {
    it('handles payment_intent.succeeded with booking_id', () => {
      const result = determineWebhookAction('payment_intent.succeeded', {
        id: 'pi_123',
        metadata: { booking_id: 'bk-1', user_id: 'u-1' },
      });
      expect(result).toEqual({
        type: 'payment_succeeded',
        paymentIntentId: 'pi_123',
        bookingId: 'bk-1',
      });
    });

    it('handles payment_intent.succeeded without booking_id', () => {
      const result = determineWebhookAction('payment_intent.succeeded', {
        id: 'pi_456',
        metadata: {},
      });
      expect(result).toEqual({
        type: 'payment_succeeded',
        paymentIntentId: 'pi_456',
        bookingId: null,
      });
    });

    it('handles payment_intent.payment_failed', () => {
      const result = determineWebhookAction('payment_intent.payment_failed', {
        id: 'pi_789',
        metadata: { booking_id: 'bk-2' },
      });
      expect(result).toEqual({
        type: 'payment_failed',
        paymentIntentId: 'pi_789',
      });
    });

    it('handles customer.subscription.created', () => {
      const sub: SubscriptionEvent = {
        id: 'sub_123',
        status: 'active',
        metadata: { supabase_user_id: 'u-1', tier: 'sand_regular' },
        current_period_start: 1700000000,
        current_period_end: 1702600000,
      };
      const result = determineWebhookAction(
        'customer.subscription.created',
        sub as unknown as Record<string, unknown>,
      );
      expect(result.type).toBe('subscription_created');
      if (result.type === 'subscription_created') {
        expect(result.subscription.id).toBe('sub_123');
      }
    });

    it('handles customer.subscription.updated', () => {
      const sub: SubscriptionEvent = {
        id: 'sub_456',
        status: 'past_due',
        metadata: { supabase_user_id: 'u-1' },
        current_period_start: 1700000000,
        current_period_end: 1702600000,
      };
      const result = determineWebhookAction(
        'customer.subscription.updated',
        sub as unknown as Record<string, unknown>,
      );
      expect(result.type).toBe('subscription_updated');
    });

    it('handles customer.subscription.deleted', () => {
      const sub: SubscriptionEvent = {
        id: 'sub_789',
        status: 'canceled',
        metadata: {},
        current_period_start: 1700000000,
        current_period_end: 1702600000,
      };
      const result = determineWebhookAction(
        'customer.subscription.deleted',
        sub as unknown as Record<string, unknown>,
      );
      expect(result).toEqual({
        type: 'subscription_deleted',
        subscriptionId: 'sub_789',
      });
    });

    it('handles invoice.paid with string subscription', () => {
      const result = determineWebhookAction('invoice.paid', {
        id: 'inv_123',
        subscription: 'sub_abc',
      });
      expect(result).toEqual({
        type: 'invoice_paid',
        subscriptionId: 'sub_abc',
      });
    });

    it('handles invoice.paid with object subscription', () => {
      const result = determineWebhookAction('invoice.paid', {
        id: 'inv_456',
        subscription: { id: 'sub_def' },
      });
      expect(result).toEqual({
        type: 'invoice_paid',
        subscriptionId: 'sub_def',
      });
    });

    it('handles invoice.paid with null subscription', () => {
      const result = determineWebhookAction('invoice.paid', {
        id: 'inv_789',
        subscription: null,
      });
      expect(result).toEqual({
        type: 'invoice_paid',
        subscriptionId: null,
      });
    });

    it('returns unhandled for unknown event types', () => {
      const result = determineWebhookAction('some.unknown.event', {});
      expect(result).toEqual({
        type: 'unhandled',
        eventType: 'some.unknown.event',
      });
    });

    it('returns unhandled for charge.succeeded (not handled by our webhook)', () => {
      const result = determineWebhookAction('charge.succeeded', {
        id: 'ch_123',
      });
      expect(result).toEqual({
        type: 'unhandled',
        eventType: 'charge.succeeded',
      });
    });
  });

  // -----------------------------------------------------------------------
  // Subscription Status Mapping
  // -----------------------------------------------------------------------
  describe('mapSubscriptionStatus', () => {
    it('maps active to active', () => {
      expect(mapSubscriptionStatus('active')).toBe('active');
    });

    it('maps past_due to past_due', () => {
      expect(mapSubscriptionStatus('past_due')).toBe('past_due');
    });

    it('maps canceled to cancelled (note spelling difference)', () => {
      expect(mapSubscriptionStatus('canceled')).toBe('cancelled');
    });

    it('maps unpaid to past_due', () => {
      expect(mapSubscriptionStatus('unpaid')).toBe('past_due');
    });

    it('defaults to active for unknown statuses', () => {
      expect(mapSubscriptionStatus('trialing')).toBe('active');
      expect(mapSubscriptionStatus('incomplete')).toBe('active');
      expect(mapSubscriptionStatus('unknown_status')).toBe('active');
    });
  });

  // -----------------------------------------------------------------------
  // Membership Record Building
  // -----------------------------------------------------------------------
  describe('buildMembershipRecord', () => {
    const baseSub: SubscriptionEvent = {
      id: 'sub_test',
      status: 'active',
      metadata: { supabase_user_id: 'user-1', tier: 'local_player' },
      current_period_start: 1700000000, // 2023-11-14T22:13:20.000Z
      current_period_end: 1702600000,   // 2023-12-15T04:26:40.000Z
    };

    it('builds correct record for local_player tier', () => {
      const record = buildMembershipRecord('user-1', baseSub);
      expect(record).toEqual({
        user_id: 'user-1',
        tier: 'local_player',
        stripe_subscription_id: 'sub_test',
        status: 'active',
        discount_percent: 10,
        priority_booking_hours: 12,
        guest_passes_remaining: 0,
        current_period_start: new Date(1700000000 * 1000).toISOString(),
        current_period_end: new Date(1702600000 * 1000).toISOString(),
      });
    });

    it('builds correct record for sand_regular tier', () => {
      const sub: SubscriptionEvent = {
        ...baseSub,
        metadata: { supabase_user_id: 'user-2', tier: 'sand_regular' },
      };
      const record = buildMembershipRecord('user-2', sub);
      expect(record.tier).toBe('sand_regular');
      expect(record.discount_percent).toBe(20);
      expect(record.priority_booking_hours).toBe(24);
      expect(record.guest_passes_remaining).toBe(1);
    });

    it('builds correct record for founders tier', () => {
      const sub: SubscriptionEvent = {
        ...baseSub,
        metadata: { supabase_user_id: 'user-3', tier: 'founders' },
      };
      const record = buildMembershipRecord('user-3', sub);
      expect(record.tier).toBe('founders');
      expect(record.discount_percent).toBe(30);
      expect(record.priority_booking_hours).toBe(48);
      expect(record.guest_passes_remaining).toBe(999);
    });

    it('defaults to local_player when tier is not in metadata', () => {
      const sub: SubscriptionEvent = {
        ...baseSub,
        metadata: { supabase_user_id: 'user-4' },
      };
      const record = buildMembershipRecord('user-4', sub);
      expect(record.tier).toBe('local_player');
      expect(record.discount_percent).toBe(10);
      expect(record.priority_booking_hours).toBe(12);
      expect(record.guest_passes_remaining).toBe(0);
    });

    it('defaults to fallback values for unknown tier', () => {
      const sub: SubscriptionEvent = {
        ...baseSub,
        metadata: { supabase_user_id: 'user-5', tier: 'unknown_tier' },
      };
      const record = buildMembershipRecord('user-5', sub);
      expect(record.tier).toBe('unknown_tier');
      expect(record.discount_percent).toBe(10);       // default
      expect(record.priority_booking_hours).toBe(12);  // default
      expect(record.guest_passes_remaining).toBe(0);   // default
    });

    it('always sets status to active', () => {
      const record = buildMembershipRecord('user-1', baseSub);
      expect(record.status).toBe('active');
    });

    it('converts Unix timestamps to ISO strings correctly', () => {
      const record = buildMembershipRecord('user-1', baseSub);
      // Verify the dates are valid ISO strings that parse back correctly
      expect(new Date(record.current_period_start).getTime()).toBe(
        1700000000 * 1000,
      );
      expect(new Date(record.current_period_end).getTime()).toBe(
        1702600000 * 1000,
      );
    });
  });

  // -----------------------------------------------------------------------
  // Membership Update Building
  // -----------------------------------------------------------------------
  describe('buildMembershipUpdate', () => {
    it('maps the subscription status correctly', () => {
      const sub: SubscriptionEvent = {
        id: 'sub_upd',
        status: 'past_due',
        metadata: {},
        current_period_start: 1700000000,
        current_period_end: 1702600000,
      };
      const update = buildMembershipUpdate(sub);
      expect(update.status).toBe('past_due');
    });

    it('maps canceled to cancelled', () => {
      const sub: SubscriptionEvent = {
        id: 'sub_upd',
        status: 'canceled',
        metadata: {},
        current_period_start: 1700000000,
        current_period_end: 1702600000,
      };
      const update = buildMembershipUpdate(sub);
      expect(update.status).toBe('cancelled');
    });

    it('includes updated period dates', () => {
      const sub: SubscriptionEvent = {
        id: 'sub_upd',
        status: 'active',
        metadata: {},
        current_period_start: 1710000000,
        current_period_end: 1712600000,
      };
      const update = buildMembershipUpdate(sub);
      expect(new Date(update.current_period_start).getTime()).toBe(
        1710000000 * 1000,
      );
      expect(new Date(update.current_period_end).getTime()).toBe(
        1712600000 * 1000,
      );
    });
  });

  // -----------------------------------------------------------------------
  // Invoice Subscription ID Extraction
  // -----------------------------------------------------------------------
  describe('extractSubscriptionIdFromInvoice', () => {
    it('extracts from a string subscription field', () => {
      const invoice: InvoiceEvent = {
        id: 'inv_1',
        subscription: 'sub_abc',
      };
      expect(extractSubscriptionIdFromInvoice(invoice)).toBe('sub_abc');
    });

    it('extracts from an object subscription field', () => {
      const invoice: InvoiceEvent = {
        id: 'inv_2',
        subscription: { id: 'sub_def' },
      };
      expect(extractSubscriptionIdFromInvoice(invoice)).toBe('sub_def');
    });

    it('returns null when subscription is null', () => {
      const invoice: InvoiceEvent = {
        id: 'inv_3',
        subscription: null,
      };
      expect(extractSubscriptionIdFromInvoice(invoice)).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Tier Configuration
  // -----------------------------------------------------------------------
  describe('tier configuration', () => {
    it('has the correct discount percentages for all tiers', () => {
      expect(DISCOUNT_MAP['local_player']).toBe(10);
      expect(DISCOUNT_MAP['sand_regular']).toBe(20);
      expect(DISCOUNT_MAP['founders']).toBe(30);
    });

    it('has the correct priority booking hours for all tiers', () => {
      expect(PRIORITY_MAP['local_player']).toBe(12);
      expect(PRIORITY_MAP['sand_regular']).toBe(24);
      expect(PRIORITY_MAP['founders']).toBe(48);
    });

    it('has the correct guest pass allocations for all tiers', () => {
      expect(GUEST_MAP['local_player']).toBe(0);
      expect(GUEST_MAP['sand_regular']).toBe(1);
      expect(GUEST_MAP['founders']).toBe(999);
    });
  });

  // -----------------------------------------------------------------------
  // End-to-end webhook processing flows
  // -----------------------------------------------------------------------
  describe('end-to-end webhook flows', () => {
    it('processes payment_intent.succeeded by confirming booking', () => {
      const action = determineWebhookAction('payment_intent.succeeded', {
        id: 'pi_success',
        metadata: { booking_id: 'bk-42', user_id: 'u-1' },
      });

      expect(action.type).toBe('payment_succeeded');
      if (action.type === 'payment_succeeded') {
        // The edge function would:
        // 1. Update orders table: status -> 'paid' where stripe_payment_intent_id = pi_success
        // 2. Update bookings table: status -> 'confirmed', confirmed_at = now for booking bk-42
        expect(action.paymentIntentId).toBe('pi_success');
        expect(action.bookingId).toBe('bk-42');
      }
    });

    it('processes payment_intent.payment_failed by marking order as failed', () => {
      const action = determineWebhookAction('payment_intent.payment_failed', {
        id: 'pi_fail',
        metadata: { booking_id: 'bk-43' },
      });

      expect(action.type).toBe('payment_failed');
      if (action.type === 'payment_failed') {
        // The edge function would update orders table: status -> 'failed'
        expect(action.paymentIntentId).toBe('pi_fail');
      }
    });

    it('processes subscription creation with full membership record', () => {
      const sub: SubscriptionEvent = {
        id: 'sub_new',
        status: 'active',
        metadata: { supabase_user_id: 'user-new', tier: 'founders' },
        current_period_start: 1700000000,
        current_period_end: 1702600000,
      };

      const action = determineWebhookAction(
        'customer.subscription.created',
        sub as unknown as Record<string, unknown>,
      );

      expect(action.type).toBe('subscription_created');
      if (action.type === 'subscription_created') {
        const userId = action.subscription.metadata?.supabase_user_id;
        expect(userId).toBe('user-new');

        const record = buildMembershipRecord(userId!, action.subscription);
        expect(record.tier).toBe('founders');
        expect(record.discount_percent).toBe(30);
        expect(record.priority_booking_hours).toBe(48);
        expect(record.guest_passes_remaining).toBe(999);
        expect(record.status).toBe('active');
      }
    });

    it('processes subscription cancellation by setting status to cancelled', () => {
      const action = determineWebhookAction('customer.subscription.deleted', {
        id: 'sub_cancel',
        status: 'canceled',
        metadata: {},
        current_period_start: 1700000000,
        current_period_end: 1702600000,
      });

      expect(action.type).toBe('subscription_deleted');
      if (action.type === 'subscription_deleted') {
        // The edge function would update memberships: status -> 'cancelled'
        expect(action.subscriptionId).toBe('sub_cancel');
      }
    });

    it('handles unknown event types gracefully', () => {
      const action = determineWebhookAction('checkout.session.completed', {
        id: 'cs_123',
      });
      expect(action.type).toBe('unhandled');
      if (action.type === 'unhandled') {
        expect(action.eventType).toBe('checkout.session.completed');
      }
    });

    it('processes subscription update with status change', () => {
      const sub: SubscriptionEvent = {
        id: 'sub_update',
        status: 'past_due',
        metadata: { supabase_user_id: 'user-pd' },
        current_period_start: 1710000000,
        current_period_end: 1712600000,
      };

      const action = determineWebhookAction(
        'customer.subscription.updated',
        sub as unknown as Record<string, unknown>,
      );

      expect(action.type).toBe('subscription_updated');
      if (action.type === 'subscription_updated') {
        const update = buildMembershipUpdate(action.subscription);
        expect(update.status).toBe('past_due');
        expect(new Date(update.current_period_start).getTime()).toBe(
          1710000000 * 1000,
        );
      }
    });

    it('processes invoice.paid to reactivate membership', () => {
      const action = determineWebhookAction('invoice.paid', {
        id: 'inv_reactivate',
        subscription: 'sub_reactivate',
      });

      expect(action.type).toBe('invoice_paid');
      if (action.type === 'invoice_paid') {
        // The edge function would:
        // 1. Retrieve the subscription from Stripe
        // 2. Update memberships: status -> 'active', update period dates
        expect(action.subscriptionId).toBe('sub_reactivate');
      }
    });
  });
});
