/**
 * Tests for the split-payment edge function business logic.
 *
 * Since the edge function uses Deno's serve() and cannot be directly imported
 * in a Jest/Node environment, we extract the core business logic as pure
 * functions and test them here. Each function mirrors the logic in
 * supabase/functions/split-payment/index.ts.
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

interface SplitOrderRecord {
  booking_id: string;
  user_id: string;
  amount_cents: number;
  discount_cents: number;
  stripe_payment_intent_id: string;
  status: string;
  is_split: boolean;
  split_group_id: string;
}

// ---------------------------------------------------------------------------
// Pure functions extracted from the edge function
// ---------------------------------------------------------------------------

/**
 * Validates the split payment input.
 */
function validateSplitInput(input: {
  session_id?: string;
  player_emails?: string[];
}): string | null {
  if (!input.session_id) {
    return 'session_id and player_emails (non-empty array) are required';
  }
  if (
    !input.player_emails ||
    !Array.isArray(input.player_emails) ||
    input.player_emails.length === 0
  ) {
    return 'session_id and player_emails (non-empty array) are required';
  }
  return null;
}

/**
 * Validates a session is available for split booking.
 */
function validateSessionForSplit(
  session: Session | null,
  playerCount: number,
): string | null {
  if (!session) {
    return 'Session not found';
  }
  if (session.status !== 'open') {
    return 'Session is not open for booking';
  }
  if (session.spots_remaining < playerCount) {
    return `Not enough spots. Need ${playerCount}, available: ${session.spots_remaining}`;
  }
  return null;
}

/**
 * Calculates the per-person cost for a split payment.
 * Uses Math.ceil to ensure the venue never loses money from rounding.
 */
function calculatePerPersonCost(
  totalPriceCents: number,
  playerCount: number,
): number {
  return Math.ceil(totalPriceCents / playerCount);
}

/**
 * Calculates the total collected from all players (may exceed the session
 * price by a few cents due to ceiling rounding).
 */
function calculateTotalCollected(
  perPersonCents: number,
  playerCount: number,
): number {
  return perPersonCents * playerCount;
}

/**
 * Builds a split order record for a single player.
 */
function buildSplitOrderRecord(
  bookingId: string,
  userId: string,
  amountCents: number,
  stripePaymentIntentId: string,
  splitGroupId: string,
): SplitOrderRecord {
  return {
    booking_id: bookingId,
    user_id: userId,
    amount_cents: amountCents,
    discount_cents: 0,
    stripe_payment_intent_id: stripePaymentIntentId,
    status: 'pending',
    is_split: true,
    split_group_id: splitGroupId,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('split-payment logic', () => {
  // -----------------------------------------------------------------------
  // Input Validation
  // -----------------------------------------------------------------------
  describe('validateSplitInput', () => {
    it('returns null for valid input', () => {
      expect(
        validateSplitInput({
          session_id: 'sess-1',
          player_emails: ['a@b.com', 'c@d.com'],
        }),
      ).toBeNull();
    });

    it('returns an error when session_id is missing', () => {
      expect(
        validateSplitInput({ player_emails: ['a@b.com'] }),
      ).toBe('session_id and player_emails (non-empty array) are required');
    });

    it('returns an error when player_emails is missing', () => {
      expect(
        validateSplitInput({ session_id: 'sess-1' }),
      ).toBe('session_id and player_emails (non-empty array) are required');
    });

    it('returns an error when player_emails is empty', () => {
      expect(
        validateSplitInput({ session_id: 'sess-1', player_emails: [] }),
      ).toBe('session_id and player_emails (non-empty array) are required');
    });

    it('returns null for a single player email', () => {
      expect(
        validateSplitInput({
          session_id: 'sess-1',
          player_emails: ['a@b.com'],
        }),
      ).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Session Validation
  // -----------------------------------------------------------------------
  describe('validateSessionForSplit', () => {
    it('returns null for a valid open session with enough spots', () => {
      const session: Session = {
        id: 's1',
        price_cents: 10000,
        spots_remaining: 4,
        status: 'open',
      };
      expect(validateSessionForSplit(session, 4)).toBeNull();
    });

    it('returns an error when session is null', () => {
      expect(validateSessionForSplit(null, 2)).toBe('Session not found');
    });

    it('returns an error when session is not open', () => {
      const session: Session = {
        id: 's1',
        price_cents: 10000,
        spots_remaining: 4,
        status: 'full',
      };
      expect(validateSessionForSplit(session, 2)).toBe(
        'Session is not open for booking',
      );
    });

    it('returns an error when not enough spots remain', () => {
      const session: Session = {
        id: 's1',
        price_cents: 10000,
        spots_remaining: 2,
        status: 'open',
      };
      expect(validateSessionForSplit(session, 4)).toBe(
        'Not enough spots. Need 4, available: 2',
      );
    });

    it('accepts exactly as many players as spots remaining', () => {
      const session: Session = {
        id: 's1',
        price_cents: 10000,
        spots_remaining: 3,
        status: 'open',
      };
      expect(validateSessionForSplit(session, 3)).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Per-Person Cost Calculation
  // -----------------------------------------------------------------------
  describe('calculatePerPersonCost', () => {
    it('splits evenly among 2 players', () => {
      expect(calculatePerPersonCost(10000, 2)).toBe(5000);
    });

    it('splits evenly among 4 players', () => {
      expect(calculatePerPersonCost(10000, 4)).toBe(2500);
    });

    it('rounds up when the split is not even (3 players)', () => {
      // 10000 / 3 = 3333.33... -> Math.ceil -> 3334
      expect(calculatePerPersonCost(10000, 3)).toBe(3334);
    });

    it('rounds up for 7 players on a 10000 cent session', () => {
      // 10000 / 7 = 1428.57... -> Math.ceil -> 1429
      expect(calculatePerPersonCost(10000, 7)).toBe(1429);
    });

    it('handles single player (no split needed)', () => {
      expect(calculatePerPersonCost(5000, 1)).toBe(5000);
    });

    it('handles a free session', () => {
      expect(calculatePerPersonCost(0, 4)).toBe(0);
    });

    it('handles small amounts with many players', () => {
      // 1 cent split among 3 players: Math.ceil(1/3) = 1
      expect(calculatePerPersonCost(1, 3)).toBe(1);
    });

    it('handles 2 cents among 3 players', () => {
      // Math.ceil(2/3) = 1
      expect(calculatePerPersonCost(2, 3)).toBe(1);
    });

    it('handles 3 cents among 3 players', () => {
      expect(calculatePerPersonCost(3, 3)).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // Total Collected Calculation
  // -----------------------------------------------------------------------
  describe('calculateTotalCollected', () => {
    it('equals the session price when split is even', () => {
      const perPerson = calculatePerPersonCost(10000, 2);
      const total = calculateTotalCollected(perPerson, 2);
      expect(total).toBe(10000);
    });

    it('may exceed the session price due to ceiling rounding', () => {
      const perPerson = calculatePerPersonCost(10000, 3); // 3334
      const total = calculateTotalCollected(perPerson, 3); // 3334 * 3 = 10002
      expect(total).toBe(10002);
      expect(total).toBeGreaterThanOrEqual(10000);
    });

    it('never collects less than the session price', () => {
      for (const playerCount of [2, 3, 4, 5, 6, 7, 8, 9, 10]) {
        const totalPrice = 9999;
        const perPerson = calculatePerPersonCost(totalPrice, playerCount);
        const collected = calculateTotalCollected(perPerson, playerCount);
        expect(collected).toBeGreaterThanOrEqual(totalPrice);
      }
    });

    it('collects at most (playerCount - 1) extra cents from rounding', () => {
      for (const playerCount of [2, 3, 4, 5, 6, 7]) {
        const totalPrice = 10000;
        const perPerson = calculatePerPersonCost(totalPrice, playerCount);
        const collected = calculateTotalCollected(perPerson, playerCount);
        const overage = collected - totalPrice;
        expect(overage).toBeLessThan(playerCount);
        expect(overage).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Split Order Record Building
  // -----------------------------------------------------------------------
  describe('buildSplitOrderRecord', () => {
    it('creates a split order record with correct fields', () => {
      const order = buildSplitOrderRecord(
        'booking-1',
        'user-1',
        3334,
        'pi_test123',
        'split-group-abc',
      );

      expect(order).toEqual({
        booking_id: 'booking-1',
        user_id: 'user-1',
        amount_cents: 3334,
        discount_cents: 0,
        stripe_payment_intent_id: 'pi_test123',
        status: 'pending',
        is_split: true,
        split_group_id: 'split-group-abc',
      });
    });

    it('always sets is_split to true', () => {
      const order = buildSplitOrderRecord(
        'b1',
        'u1',
        5000,
        'pi_1',
        'sg-1',
      );
      expect(order.is_split).toBe(true);
    });

    it('always sets discount_cents to 0', () => {
      const order = buildSplitOrderRecord(
        'b1',
        'u1',
        5000,
        'pi_1',
        'sg-1',
      );
      expect(order.discount_cents).toBe(0);
    });

    it('always sets status to pending', () => {
      const order = buildSplitOrderRecord(
        'b1',
        'u1',
        5000,
        'pi_1',
        'sg-1',
      );
      expect(order.status).toBe('pending');
    });
  });

  // -----------------------------------------------------------------------
  // End-to-end split payment flow (pure logic)
  // -----------------------------------------------------------------------
  describe('full split payment flow', () => {
    it('splits a session among 3 players correctly', () => {
      const session: Session = {
        id: 'sess-1',
        price_cents: 10000,
        spots_remaining: 5,
        status: 'open',
      };
      const playerEmails = ['alice@test.com', 'bob@test.com', 'carol@test.com'];
      const splitGroupId = 'split-group-xyz';

      // Step 1: validate input
      expect(
        validateSplitInput({
          session_id: session.id,
          player_emails: playerEmails,
        }),
      ).toBeNull();

      // Step 2: validate session
      expect(validateSessionForSplit(session, playerEmails.length)).toBeNull();

      // Step 3: calculate per-person cost
      const perPersonCents = calculatePerPersonCost(
        session.price_cents,
        playerEmails.length,
      );
      expect(perPersonCents).toBe(3334);

      // Step 4: build orders for each player
      const orders = playerEmails.map((_, i) =>
        buildSplitOrderRecord(
          `booking-${i}`,
          `user-${i}`,
          perPersonCents,
          `pi_${i}`,
          splitGroupId,
        ),
      );

      expect(orders).toHaveLength(3);

      // All orders share the same split_group_id
      for (const order of orders) {
        expect(order.split_group_id).toBe(splitGroupId);
        expect(order.is_split).toBe(true);
        expect(order.amount_cents).toBe(3334);
        expect(order.status).toBe('pending');
      }

      // Total collected covers the session price
      const totalCollected = calculateTotalCollected(perPersonCents, 3);
      expect(totalCollected).toBe(10002);
      expect(totalCollected).toBeGreaterThanOrEqual(session.price_cents);
    });

    it('splits a session among 2 players with an even split', () => {
      const session: Session = {
        id: 'sess-2',
        price_cents: 8000,
        spots_remaining: 10,
        status: 'open',
      };
      const playerEmails = ['alice@test.com', 'bob@test.com'];
      const splitGroupId = 'split-group-even';

      const perPersonCents = calculatePerPersonCost(
        session.price_cents,
        playerEmails.length,
      );
      expect(perPersonCents).toBe(4000);

      const totalCollected = calculateTotalCollected(perPersonCents, 2);
      expect(totalCollected).toBe(8000); // exact split
    });

    it('splits a session among 4 players', () => {
      const session: Session = {
        id: 'sess-3',
        price_cents: 12000,
        spots_remaining: 6,
        status: 'open',
      };
      const playerEmails = ['a@t.com', 'b@t.com', 'c@t.com', 'd@t.com'];

      expect(validateSessionForSplit(session, 4)).toBeNull();

      const perPersonCents = calculatePerPersonCost(12000, 4);
      expect(perPersonCents).toBe(3000); // exact split

      const totalCollected = calculateTotalCollected(perPersonCents, 4);
      expect(totalCollected).toBe(12000);
    });

    it('rejects when there are not enough spots', () => {
      const session: Session = {
        id: 'sess-4',
        price_cents: 10000,
        spots_remaining: 2,
        status: 'open',
      };
      const result = validateSessionForSplit(session, 4);
      expect(result).toBe('Not enough spots. Need 4, available: 2');
    });

    it('rejects when session is closed', () => {
      const session: Session = {
        id: 'sess-5',
        price_cents: 10000,
        spots_remaining: 10,
        status: 'closed',
      };
      const result = validateSessionForSplit(session, 2);
      expect(result).toBe('Session is not open for booking');
    });
  });
});
