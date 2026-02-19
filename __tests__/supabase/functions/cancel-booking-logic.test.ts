/**
 * Tests for the cancel-booking edge function business logic.
 *
 * Since the edge function uses Deno's serve() and cannot be directly imported
 * in a Jest/Node environment, we extract the core business logic as pure
 * functions and test them here. Each function mirrors the logic in
 * supabase/functions/cancel-booking/index.ts.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Booking {
  id: string;
  user_id: string;
  status: string;
  sessions: Session;
}

interface Session {
  id: string;
  starts_at: string;
  price_cents: number;
  spots_remaining: number;
  status: string;
}

interface Order {
  id: string;
  booking_id: string;
  amount_cents: number;
  status: string;
  stripe_payment_intent_id: string | null;
}

interface UserProfile {
  role: string;
}

interface CancellationResult {
  refundAmountCents: number;
  refundPercent: number;
  bookingStatus: string;
  orderStatus: string | null;
}

// ---------------------------------------------------------------------------
// Pure functions extracted from the edge function
// ---------------------------------------------------------------------------

/**
 * Validates the booking_id input. Returns an error string or null if valid.
 */
function validateCancelInput(input: { booking_id?: string }): string | null {
  if (!input.booking_id) {
    return 'booking_id is required';
  }
  return null;
}

/**
 * Checks whether the booking can be cancelled.
 * Returns an error string or null if the booking is cancellable.
 */
function validateBookingForCancellation(
  booking: Booking | null,
): string | null {
  if (!booking) {
    return 'Booking not found';
  }
  if (booking.status === 'cancelled') {
    return 'Booking is already cancelled';
  }
  return null;
}

/**
 * Checks whether the user is authorized to cancel the booking.
 * The user must be the booking owner or an admin.
 */
function isAuthorizedToCancel(
  userId: string,
  booking: Booking,
  userProfile: UserProfile | null,
): boolean {
  const isAdmin = userProfile?.role === 'admin';
  const isOwner = booking.user_id === userId;
  return isOwner || isAdmin;
}

/**
 * Calculates the refund based on how many hours until the session starts.
 * - More than 24 hours: 100% refund
 * - More than 12 hours: 50% refund
 * - 12 hours or less: 0% refund (no refund)
 */
function calculateRefund(
  order: Order | null,
  hoursUntilSession: number,
): { refundAmountCents: number; refundPercent: number } {
  if (!order) {
    return { refundAmountCents: 0, refundPercent: 0 };
  }

  if (hoursUntilSession > 24) {
    return { refundAmountCents: order.amount_cents, refundPercent: 100 };
  }

  if (hoursUntilSession > 12) {
    return {
      refundAmountCents: Math.round(order.amount_cents * 0.5),
      refundPercent: 50,
    };
  }

  return { refundAmountCents: 0, refundPercent: 0 };
}

/**
 * Computes the number of hours between now and the session start time.
 */
function getHoursUntilSession(
  sessionStartsAt: string,
  now: Date = new Date(),
): number {
  const sessionStart = new Date(sessionStartsAt);
  return (sessionStart.getTime() - now.getTime()) / (1000 * 60 * 60);
}

/**
 * Determines the new order status after cancellation.
 * If 100% refund, the order status becomes 'refunded'.
 * Otherwise, the order status stays as it was.
 */
function getNewOrderStatus(
  order: Order | null,
  refundPercent: number,
): string | null {
  if (!order) return null;
  if (refundPercent === 100) return 'refunded';
  return order.status;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('cancel-booking logic', () => {
  // -----------------------------------------------------------------------
  // Input Validation
  // -----------------------------------------------------------------------
  describe('validateCancelInput', () => {
    it('returns null when booking_id is provided', () => {
      expect(validateCancelInput({ booking_id: 'bk-1' })).toBeNull();
    });

    it('returns an error when booking_id is missing', () => {
      expect(validateCancelInput({})).toBe('booking_id is required');
    });

    it('returns an error when booking_id is empty string', () => {
      expect(validateCancelInput({ booking_id: '' })).toBe(
        'booking_id is required',
      );
    });
  });

  // -----------------------------------------------------------------------
  // Booking Validation for Cancellation
  // -----------------------------------------------------------------------
  describe('validateBookingForCancellation', () => {
    const session: Session = {
      id: 's1',
      starts_at: '2026-02-20T10:00:00Z',
      price_cents: 5000,
      spots_remaining: 5,
      status: 'open',
    };

    it('returns null for a valid confirmed booking', () => {
      const booking: Booking = {
        id: 'bk-1',
        user_id: 'user-1',
        status: 'confirmed',
        sessions: session,
      };
      expect(validateBookingForCancellation(booking)).toBeNull();
    });

    it('returns null for a pending booking', () => {
      const booking: Booking = {
        id: 'bk-1',
        user_id: 'user-1',
        status: 'pending',
        sessions: session,
      };
      expect(validateBookingForCancellation(booking)).toBeNull();
    });

    it('returns an error when booking is null', () => {
      expect(validateBookingForCancellation(null)).toBe('Booking not found');
    });

    it('returns an error when booking is already cancelled', () => {
      const booking: Booking = {
        id: 'bk-1',
        user_id: 'user-1',
        status: 'cancelled',
        sessions: session,
      };
      expect(validateBookingForCancellation(booking)).toBe(
        'Booking is already cancelled',
      );
    });
  });

  // -----------------------------------------------------------------------
  // Authorization
  // -----------------------------------------------------------------------
  describe('isAuthorizedToCancel', () => {
    const session: Session = {
      id: 's1',
      starts_at: '2026-02-20T10:00:00Z',
      price_cents: 5000,
      spots_remaining: 5,
      status: 'open',
    };

    const booking: Booking = {
      id: 'bk-1',
      user_id: 'user-1',
      status: 'confirmed',
      sessions: session,
    };

    it('allows the booking owner to cancel', () => {
      const profile: UserProfile = { role: 'user' };
      expect(isAuthorizedToCancel('user-1', booking, profile)).toBe(true);
    });

    it('allows an admin to cancel any booking', () => {
      const profile: UserProfile = { role: 'admin' };
      expect(isAuthorizedToCancel('user-999', booking, profile)).toBe(true);
    });

    it('denies a non-owner non-admin user', () => {
      const profile: UserProfile = { role: 'user' };
      expect(isAuthorizedToCancel('user-2', booking, profile)).toBe(false);
    });

    it('denies when user profile is null and user is not the owner', () => {
      expect(isAuthorizedToCancel('user-2', booking, null)).toBe(false);
    });

    it('allows when user profile is null but user is the owner', () => {
      expect(isAuthorizedToCancel('user-1', booking, null)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Hours Until Session
  // -----------------------------------------------------------------------
  describe('getHoursUntilSession', () => {
    it('calculates hours correctly for a future session', () => {
      const now = new Date('2026-02-17T10:00:00Z');
      const sessionStart = '2026-02-18T10:00:00Z'; // 24 hours later
      expect(getHoursUntilSession(sessionStart, now)).toBe(24);
    });

    it('returns 0 for a session starting now', () => {
      const now = new Date('2026-02-17T10:00:00Z');
      expect(getHoursUntilSession('2026-02-17T10:00:00Z', now)).toBe(0);
    });

    it('returns negative hours for a past session', () => {
      const now = new Date('2026-02-17T10:00:00Z');
      const sessionStart = '2026-02-16T10:00:00Z'; // 24 hours ago
      expect(getHoursUntilSession(sessionStart, now)).toBe(-24);
    });

    it('handles fractional hours', () => {
      const now = new Date('2026-02-17T10:00:00Z');
      const sessionStart = '2026-02-17T10:30:00Z'; // 30 minutes later
      expect(getHoursUntilSession(sessionStart, now)).toBe(0.5);
    });
  });

  // -----------------------------------------------------------------------
  // Refund Calculation
  // -----------------------------------------------------------------------
  describe('calculateRefund', () => {
    const order: Order = {
      id: 'ord-1',
      booking_id: 'bk-1',
      amount_cents: 10000,
      status: 'paid',
      stripe_payment_intent_id: 'pi_test123',
    };

    it('gives a full refund when more than 24 hours before session', () => {
      const result = calculateRefund(order, 25);
      expect(result.refundPercent).toBe(100);
      expect(result.refundAmountCents).toBe(10000);
    });

    it('gives a full refund at exactly 24.01 hours before session', () => {
      const result = calculateRefund(order, 24.01);
      expect(result.refundPercent).toBe(100);
      expect(result.refundAmountCents).toBe(10000);
    });

    it('gives a 50% refund when between 12 and 24 hours before session', () => {
      const result = calculateRefund(order, 18);
      expect(result.refundPercent).toBe(50);
      expect(result.refundAmountCents).toBe(5000);
    });

    it('gives a 50% refund at exactly 24 hours (boundary)', () => {
      // hoursUntilSession === 24 -> not > 24 -> falls to next check -> > 12 -> 50%
      const result = calculateRefund(order, 24);
      expect(result.refundPercent).toBe(50);
      expect(result.refundAmountCents).toBe(5000);
    });

    it('gives a 50% refund at just over 12 hours', () => {
      const result = calculateRefund(order, 12.01);
      expect(result.refundPercent).toBe(50);
      expect(result.refundAmountCents).toBe(5000);
    });

    it('gives no refund at exactly 12 hours (boundary)', () => {
      // hoursUntilSession === 12 -> not > 24 -> not > 12 -> 0%
      const result = calculateRefund(order, 12);
      expect(result.refundPercent).toBe(0);
      expect(result.refundAmountCents).toBe(0);
    });

    it('gives no refund when less than 12 hours before session', () => {
      const result = calculateRefund(order, 6);
      expect(result.refundPercent).toBe(0);
      expect(result.refundAmountCents).toBe(0);
    });

    it('gives no refund when the session has already started', () => {
      const result = calculateRefund(order, -2);
      expect(result.refundPercent).toBe(0);
      expect(result.refundAmountCents).toBe(0);
    });

    it('returns 0 refund when there is no order', () => {
      const result = calculateRefund(null, 48);
      expect(result.refundPercent).toBe(0);
      expect(result.refundAmountCents).toBe(0);
    });

    it('rounds the 50% refund correctly for odd amounts', () => {
      const oddOrder: Order = {
        id: 'ord-2',
        booking_id: 'bk-2',
        amount_cents: 999,
        status: 'paid',
        stripe_payment_intent_id: 'pi_test456',
      };
      const result = calculateRefund(oddOrder, 18);
      expect(result.refundPercent).toBe(50);
      // 999 * 0.5 = 499.5 -> Math.round -> 500
      expect(result.refundAmountCents).toBe(500);
    });
  });

  // -----------------------------------------------------------------------
  // New Order Status After Cancellation
  // -----------------------------------------------------------------------
  describe('getNewOrderStatus', () => {
    const paidOrder: Order = {
      id: 'ord-1',
      booking_id: 'bk-1',
      amount_cents: 10000,
      status: 'paid',
      stripe_payment_intent_id: 'pi_test123',
    };

    it('returns "refunded" when refund is 100%', () => {
      expect(getNewOrderStatus(paidOrder, 100)).toBe('refunded');
    });

    it('returns the current order status when refund is 50%', () => {
      expect(getNewOrderStatus(paidOrder, 50)).toBe('paid');
    });

    it('returns the current order status when refund is 0%', () => {
      expect(getNewOrderStatus(paidOrder, 0)).toBe('paid');
    });

    it('returns null when there is no order', () => {
      expect(getNewOrderStatus(null, 100)).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // End-to-end cancellation flow (pure logic)
  // -----------------------------------------------------------------------
  describe('full cancellation flow', () => {
    const session: Session = {
      id: 's1',
      starts_at: '2026-02-20T10:00:00Z',
      price_cents: 5000,
      spots_remaining: 3,
      status: 'open',
    };

    const booking: Booking = {
      id: 'bk-1',
      user_id: 'user-1',
      status: 'confirmed',
      sessions: session,
    };

    const order: Order = {
      id: 'ord-1',
      booking_id: 'bk-1',
      amount_cents: 5000,
      status: 'paid',
      stripe_payment_intent_id: 'pi_test123',
    };

    it('processes a full refund cancellation (>24 hours before session)', () => {
      // Step 1: validate booking
      expect(validateBookingForCancellation(booking)).toBeNull();

      // Step 2: check authorization
      const profile: UserProfile = { role: 'user' };
      expect(isAuthorizedToCancel('user-1', booking, profile)).toBe(true);

      // Step 3: calculate hours until session
      const now = new Date('2026-02-18T09:00:00Z'); // ~49 hours before session
      const hours = getHoursUntilSession(session.starts_at, now);
      expect(hours).toBe(49);

      // Step 4: calculate refund
      const refund = calculateRefund(order, hours);
      expect(refund.refundPercent).toBe(100);
      expect(refund.refundAmountCents).toBe(5000);

      // Step 5: determine new order status
      const newStatus = getNewOrderStatus(order, refund.refundPercent);
      expect(newStatus).toBe('refunded');
    });

    it('processes a 50% refund cancellation (12-24 hours before session)', () => {
      const now = new Date('2026-02-19T20:00:00Z'); // 14 hours before session
      const hours = getHoursUntilSession(session.starts_at, now);
      expect(hours).toBe(14);

      const refund = calculateRefund(order, hours);
      expect(refund.refundPercent).toBe(50);
      expect(refund.refundAmountCents).toBe(2500);

      const newStatus = getNewOrderStatus(order, refund.refundPercent);
      expect(newStatus).toBe('paid'); // stays paid (partial refund, not fully refunded)
    });

    it('processes a no-refund cancellation (<12 hours before session)', () => {
      const now = new Date('2026-02-20T04:00:00Z'); // 6 hours before session
      const hours = getHoursUntilSession(session.starts_at, now);
      expect(hours).toBe(6);

      const refund = calculateRefund(order, hours);
      expect(refund.refundPercent).toBe(0);
      expect(refund.refundAmountCents).toBe(0);

      const newStatus = getNewOrderStatus(order, refund.refundPercent);
      expect(newStatus).toBe('paid');
    });

    it('rejects cancellation of an already cancelled booking', () => {
      const cancelledBooking: Booking = {
        ...booking,
        status: 'cancelled',
      };
      expect(validateBookingForCancellation(cancelledBooking)).toBe(
        'Booking is already cancelled',
      );
    });

    it('rejects cancellation by an unauthorized user', () => {
      const profile: UserProfile = { role: 'user' };
      expect(isAuthorizedToCancel('user-999', booking, profile)).toBe(false);
    });
  });
});
