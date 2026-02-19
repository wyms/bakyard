/**
 * Tests for the create-checkout edge function business logic.
 *
 * Since the edge function uses Deno's serve() and cannot be directly imported
 * in a Jest/Node environment, we extract the core business logic as pure
 * functions and test them here. Each function mirrors the logic in
 * supabase/functions/create-checkout/index.ts.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Session {
  id: string;
  price_cents: number;
  spots_remaining: number;
  status: string;
}

interface Membership {
  id: string;
  user_id: string;
  discount_percent: number;
  status: string;
}

interface BookingInput {
  session_id: string;
  guests: number;
  membership_id?: string;
  user_id: string;
}

interface OrderRecord {
  booking_id: string;
  user_id: string;
  amount_cents: number;
  discount_cents: number;
  membership_id: string | null;
  stripe_payment_intent_id: string;
  status: string;
}

// ---------------------------------------------------------------------------
// Pure functions extracted from the edge function
// ---------------------------------------------------------------------------

/**
 * Validates the booking input. Returns an error string or null if valid.
 */
function validateBookingInput(input: { session_id?: string }): string | null {
  if (!input.session_id) {
    return 'session_id is required';
  }
  return null;
}

/**
 * Calculates the total cost based on session price and number of spots (1 + guests).
 */
function calculateTotalCost(
  priceCents: number,
  guests: number,
): { totalSpots: number; amountCents: number } {
  const totalSpots = 1 + guests;
  const amountCents = priceCents * totalSpots;
  return { totalSpots, amountCents };
}

/**
 * Applies a membership discount to the total amount.
 * Returns the discounted amount and the discount in cents.
 */
function applyMembershipDiscount(
  amountCents: number,
  membership: Membership | null,
): { finalAmountCents: number; discountCents: number } {
  if (!membership || membership.status !== 'active') {
    return { finalAmountCents: amountCents, discountCents: 0 };
  }

  const discountCents = Math.round(
    amountCents * (membership.discount_percent / 100),
  );
  const finalAmountCents = amountCents - discountCents;

  return { finalAmountCents, discountCents };
}

/**
 * Builds the order record that would be inserted into the database.
 */
function buildOrderRecord(
  bookingId: string,
  userId: string,
  amountCents: number,
  discountCents: number,
  membershipId: string | null,
  stripePaymentIntentId: string,
): OrderRecord {
  return {
    booking_id: bookingId,
    user_id: userId,
    amount_cents: amountCents,
    discount_cents: discountCents,
    membership_id: membershipId || null,
    stripe_payment_intent_id: stripePaymentIntentId,
    status: 'pending',
  };
}

/**
 * Simulates the book_session validation logic. Returns an error string or null.
 * In production, the DB function book_session() handles this atomically.
 */
function validateSessionForBooking(
  session: Session | null,
): string | null {
  if (!session) {
    return 'Session not found';
  }
  // The book_session RPC checks spots and status internally.
  // We test the surrounding logic that checks the result.
  return null;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('create-checkout logic', () => {
  // -----------------------------------------------------------------------
  // Input Validation
  // -----------------------------------------------------------------------
  describe('validateBookingInput', () => {
    it('returns null when session_id is provided', () => {
      expect(validateBookingInput({ session_id: 'sess-1' })).toBeNull();
    });

    it('returns an error when session_id is missing', () => {
      expect(validateBookingInput({})).toBe('session_id is required');
    });

    it('returns an error when session_id is an empty string', () => {
      expect(validateBookingInput({ session_id: '' })).toBe(
        'session_id is required',
      );
    });
  });

  // -----------------------------------------------------------------------
  // Total Cost Calculation
  // -----------------------------------------------------------------------
  describe('calculateTotalCost', () => {
    it('calculates cost for a single person (0 guests)', () => {
      const result = calculateTotalCost(5000, 0);
      expect(result.totalSpots).toBe(1);
      expect(result.amountCents).toBe(5000);
    });

    it('calculates cost for 1 guest', () => {
      const result = calculateTotalCost(5000, 1);
      expect(result.totalSpots).toBe(2);
      expect(result.amountCents).toBe(10000);
    });

    it('calculates cost for multiple guests', () => {
      const result = calculateTotalCost(3000, 3);
      expect(result.totalSpots).toBe(4);
      expect(result.amountCents).toBe(12000);
    });

    it('handles zero price', () => {
      const result = calculateTotalCost(0, 2);
      expect(result.totalSpots).toBe(3);
      expect(result.amountCents).toBe(0);
    });

    it('handles large guest counts', () => {
      const result = calculateTotalCost(2500, 9);
      expect(result.totalSpots).toBe(10);
      expect(result.amountCents).toBe(25000);
    });
  });

  // -----------------------------------------------------------------------
  // Membership Discount
  // -----------------------------------------------------------------------
  describe('applyMembershipDiscount', () => {
    it('returns the original amount when membership is null', () => {
      const result = applyMembershipDiscount(10000, null);
      expect(result.finalAmountCents).toBe(10000);
      expect(result.discountCents).toBe(0);
    });

    it('returns the original amount when membership is not active', () => {
      const membership: Membership = {
        id: 'm1',
        user_id: 'u1',
        discount_percent: 20,
        status: 'cancelled',
      };
      const result = applyMembershipDiscount(10000, membership);
      expect(result.finalAmountCents).toBe(10000);
      expect(result.discountCents).toBe(0);
    });

    it('applies a 10% discount', () => {
      const membership: Membership = {
        id: 'm1',
        user_id: 'u1',
        discount_percent: 10,
        status: 'active',
      };
      const result = applyMembershipDiscount(10000, membership);
      expect(result.discountCents).toBe(1000);
      expect(result.finalAmountCents).toBe(9000);
    });

    it('applies a 20% discount', () => {
      const membership: Membership = {
        id: 'm1',
        user_id: 'u1',
        discount_percent: 20,
        status: 'active',
      };
      const result = applyMembershipDiscount(10000, membership);
      expect(result.discountCents).toBe(2000);
      expect(result.finalAmountCents).toBe(8000);
    });

    it('applies a 30% discount (founders tier)', () => {
      const membership: Membership = {
        id: 'm1',
        user_id: 'u1',
        discount_percent: 30,
        status: 'active',
      };
      const result = applyMembershipDiscount(10000, membership);
      expect(result.discountCents).toBe(3000);
      expect(result.finalAmountCents).toBe(7000);
    });

    it('rounds the discount correctly for odd amounts', () => {
      const membership: Membership = {
        id: 'm1',
        user_id: 'u1',
        discount_percent: 15,
        status: 'active',
      };
      // 333 * (15/100) = 49.95 -> Math.round -> 50
      const result = applyMembershipDiscount(333, membership);
      expect(result.discountCents).toBe(50);
      expect(result.finalAmountCents).toBe(283);
    });

    it('handles 0% discount as active membership', () => {
      const membership: Membership = {
        id: 'm1',
        user_id: 'u1',
        discount_percent: 0,
        status: 'active',
      };
      const result = applyMembershipDiscount(10000, membership);
      expect(result.discountCents).toBe(0);
      expect(result.finalAmountCents).toBe(10000);
    });

    it('handles 100% discount', () => {
      const membership: Membership = {
        id: 'm1',
        user_id: 'u1',
        discount_percent: 100,
        status: 'active',
      };
      const result = applyMembershipDiscount(10000, membership);
      expect(result.discountCents).toBe(10000);
      expect(result.finalAmountCents).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Session Validation
  // -----------------------------------------------------------------------
  describe('validateSessionForBooking', () => {
    it('returns null for a valid session', () => {
      const session: Session = {
        id: 's1',
        price_cents: 5000,
        spots_remaining: 5,
        status: 'open',
      };
      expect(validateSessionForBooking(session)).toBeNull();
    });

    it('returns an error when session is null', () => {
      expect(validateSessionForBooking(null)).toBe('Session not found');
    });
  });

  // -----------------------------------------------------------------------
  // Order Record Building
  // -----------------------------------------------------------------------
  describe('buildOrderRecord', () => {
    it('creates an order record with correct fields', () => {
      const order = buildOrderRecord(
        'booking-1',
        'user-1',
        9000,
        1000,
        'membership-1',
        'pi_test123',
      );

      expect(order).toEqual({
        booking_id: 'booking-1',
        user_id: 'user-1',
        amount_cents: 9000,
        discount_cents: 1000,
        membership_id: 'membership-1',
        stripe_payment_intent_id: 'pi_test123',
        status: 'pending',
      });
    });

    it('sets membership_id to null when not provided', () => {
      const order = buildOrderRecord(
        'booking-1',
        'user-1',
        5000,
        0,
        null,
        'pi_test123',
      );

      expect(order.membership_id).toBeNull();
    });

    it('sets membership_id to null when empty string', () => {
      const order = buildOrderRecord(
        'booking-1',
        'user-1',
        5000,
        0,
        '',
        'pi_test123',
      );

      expect(order.membership_id).toBeNull();
    });

    it('always sets status to pending', () => {
      const order = buildOrderRecord(
        'booking-1',
        'user-1',
        5000,
        0,
        null,
        'pi_test123',
      );

      expect(order.status).toBe('pending');
    });
  });

  // -----------------------------------------------------------------------
  // End-to-end checkout flow (pure logic)
  // -----------------------------------------------------------------------
  describe('full checkout flow', () => {
    it('calculates the correct order for booking with guests and membership', () => {
      const session: Session = {
        id: 'sess-1',
        price_cents: 5000,
        spots_remaining: 5,
        status: 'open',
      };
      const membership: Membership = {
        id: 'mem-1',
        user_id: 'user-1',
        discount_percent: 20,
        status: 'active',
      };

      // Step 1: validate
      expect(validateSessionForBooking(session)).toBeNull();

      // Step 2: calculate cost
      const { totalSpots, amountCents } = calculateTotalCost(
        session.price_cents,
        2, // 2 guests
      );
      expect(totalSpots).toBe(3);
      expect(amountCents).toBe(15000); // 5000 * 3

      // Step 3: apply discount
      const { finalAmountCents, discountCents } = applyMembershipDiscount(
        amountCents,
        membership,
      );
      expect(discountCents).toBe(3000); // 15000 * 20% = 3000
      expect(finalAmountCents).toBe(12000);

      // Step 4: build order
      const order = buildOrderRecord(
        'booking-1',
        'user-1',
        finalAmountCents,
        discountCents,
        membership.id,
        'pi_test123',
      );
      expect(order.amount_cents).toBe(12000);
      expect(order.discount_cents).toBe(3000);
      expect(order.membership_id).toBe('mem-1');
      expect(order.status).toBe('pending');
    });

    it('calculates the correct order for booking without membership', () => {
      const session: Session = {
        id: 'sess-1',
        price_cents: 8000,
        spots_remaining: 3,
        status: 'open',
      };

      const { amountCents } = calculateTotalCost(session.price_cents, 0);
      expect(amountCents).toBe(8000);

      const { finalAmountCents, discountCents } = applyMembershipDiscount(
        amountCents,
        null,
      );
      expect(finalAmountCents).toBe(8000);
      expect(discountCents).toBe(0);

      const order = buildOrderRecord(
        'booking-2',
        'user-2',
        finalAmountCents,
        discountCents,
        null,
        'pi_test456',
      );
      expect(order.amount_cents).toBe(8000);
      expect(order.discount_cents).toBe(0);
      expect(order.membership_id).toBeNull();
    });

    it('handles a free session correctly', () => {
      const session: Session = {
        id: 'sess-free',
        price_cents: 0,
        spots_remaining: 20,
        status: 'open',
      };

      const { amountCents } = calculateTotalCost(session.price_cents, 3);
      expect(amountCents).toBe(0);

      const { finalAmountCents, discountCents } = applyMembershipDiscount(
        amountCents,
        {
          id: 'mem-1',
          user_id: 'user-1',
          discount_percent: 20,
          status: 'active',
        },
      );
      expect(finalAmountCents).toBe(0);
      expect(discountCents).toBe(0);
    });
  });
});
