/**
 * Tests for the generate-feed edge function business logic.
 *
 * Since the edge function uses Deno's serve() and cannot be directly imported
 * in a Jest/Node environment, we extract the core algorithms as pure functions
 * and test them here. Each function mirrors the logic in
 * supabase/functions/generate-feed/index.ts.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TestProduct {
  id: string;
  type: string;
  tags: string[] | null;
  is_active: boolean;
  created_at: string;
}

interface TestSession {
  id: string;
  product_id: string;
  starts_at: string;
  price_cents: number;
  spots_remaining: number;
  status: string;
}

interface TestInteraction {
  product_id: string;
  interaction_type: string;
  created_at: string;
}

interface TestPricingRule {
  days_of_week: number[] | null;
  start_time: string | null;
  end_time: string | null;
  multiplier: number;
  is_active: boolean;
}

type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'pro';

const SKILL_LEVELS: readonly SkillLevel[] = [
  'beginner',
  'intermediate',
  'advanced',
  'pro',
];

const TAG_TO_SKILL: Record<string, SkillLevel> = {
  beginner: 'beginner',
  intermediate: 'intermediate',
  advanced: 'advanced',
  pro: 'pro',
  competitive: 'pro',
};

// ---------------------------------------------------------------------------
// Pure functions extracted from the edge function
// ---------------------------------------------------------------------------

const INTERACTION_WEIGHTS: Record<string, number> = {
  book: 10,
  tap: 5,
  view: 1,
  dismiss: -3,
};

function getTimeDecay(createdAt: string, now: number = Date.now()): number {
  const ageMs = now - new Date(createdAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  if (ageDays <= 7) return 1.0;
  if (ageDays <= 30) return 0.5;
  if (ageDays <= 90) return 0.2;
  return 0.05;
}

function calculateInteractionScores(
  interactions: TestInteraction[],
  now: number = Date.now(),
): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const interaction of interactions) {
    const baseScore = INTERACTION_WEIGHTS[interaction.interaction_type] ?? 0;
    const decay = getTimeDecay(interaction.created_at, now);
    scores[interaction.product_id] =
      (scores[interaction.product_id] || 0) + baseScore * decay;
  }
  return scores;
}

function getSkillMatchScore(
  userSkillLevel: SkillLevel | null,
  productTags: string[] | null,
): number {
  if (!userSkillLevel || !productTags || productTags.length === 0) return 0;

  const userIndex = SKILL_LEVELS.indexOf(userSkillLevel);
  if (userIndex === -1) return 0;

  let bestScore = 0;

  for (const tag of productTags) {
    const tagSkill = TAG_TO_SKILL[tag.toLowerCase()];
    if (!tagSkill) continue;

    const tagIndex = SKILL_LEVELS.indexOf(tagSkill);
    const distance = Math.abs(userIndex - tagIndex);

    if (distance === 0) {
      return 15; // Exact match -- best possible
    } else if (distance === 1 && bestScore < 5) {
      bestScore = 5;
    }
  }

  return bestScore;
}

function getRecencyScore(
  createdAt: string,
  now: number = Date.now(),
): number {
  const ageMs = now - new Date(createdAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  if (ageDays <= 7) return 10;
  if (ageDays <= 30) return 5;
  return 0;
}

function getUrgencyScore(
  sessions: Array<{ spots_remaining: number; starts_at: string }>,
  now: number = Date.now(),
): number {
  let score = 0;
  const twentyFourHoursFromNow = now + 24 * 60 * 60 * 1000;

  for (const session of sessions) {
    if (
      session.spots_remaining !== null &&
      session.spots_remaining < 3 &&
      session.spots_remaining > 0
    ) {
      score = Math.max(score, 8);
    }

    const startsAt = new Date(session.starts_at).getTime();
    if (
      startsAt <= twentyFourHoursFromNow &&
      session.spots_remaining !== null &&
      session.spots_remaining > 0
    ) {
      score = Math.max(score, 5);
    }

    if (score >= 8) break;
  }

  return score;
}

function applyPricingRules(
  priceCents: number,
  sessionDate: Date,
  rules: TestPricingRule[],
): number {
  let price = priceCents;
  const dayOfWeek = sessionDate.getUTCDay();
  const hours = sessionDate.getUTCHours().toString().padStart(2, '0');
  const minutes = sessionDate.getUTCMinutes().toString().padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;

  for (const rule of rules) {
    if (!rule.is_active) continue;

    const matchesDay =
      !rule.days_of_week ||
      rule.days_of_week.length === 0 ||
      rule.days_of_week.includes(dayOfWeek);

    const matchesTime =
      (!rule.start_time || timeStr >= rule.start_time) &&
      (!rule.end_time || timeStr <= rule.end_time);

    if (matchesDay && matchesTime) {
      price = Math.round(price * Number(rule.multiplier));
    }
  }

  return price;
}

interface FeedItem {
  id: string;
  type: string;
  tags: string[] | null;
  is_active: boolean;
  created_at: string;
  sessions: TestSession[];
  nextSession: TestSession | null;
  relevance_score: number;
}

function buildFeedItems(
  products: TestProduct[],
  sessions: TestSession[],
  interactionScores: Record<string, number>,
  pricingRules: TestPricingRule[],
  userSkillLevel: SkillLevel | null = null,
  collaborativeScores: Record<string, number> = {},
  activeMembership: { discount_percent: number } | null = null,
  now: number = Date.now(),
): FeedItem[] {
  // Group sessions by product and apply pricing rules
  const sessionsByProduct: Record<string, TestSession[]> = {};

  for (const s of sessions) {
    if (!sessionsByProduct[s.product_id]) {
      sessionsByProduct[s.product_id] = [];
    }

    let displayPrice = s.price_cents;

    if (pricingRules.length > 0) {
      displayPrice = applyPricingRules(
        s.price_cents,
        new Date(s.starts_at),
        pricingRules,
      );
    }

    sessionsByProduct[s.product_id]!.push({
      ...s,
      price_cents: displayPrice,
    });
  }

  return products
    .map((product) => {
      const productSessions = sessionsByProduct[product.id] || [];
      const nextSession = productSessions[0] || null;

      const interactionScore = interactionScores[product.id] || 0;
      const skillMatchScore = getSkillMatchScore(userSkillLevel, product.tags);
      const collaborativeScore = collaborativeScores[product.id] || 0;
      const recencyScore = getRecencyScore(product.created_at, now);
      const urgencyScore = getUrgencyScore(productSessions, now);

      let membershipAffinity = 0;
      if (activeMembership && activeMembership.discount_percent > 0) {
        const hasDiscountableSessions = productSessions.some((s) => {
          const discountedPrice = Math.round(
            s.price_cents * (1 - activeMembership.discount_percent / 100),
          );
          return discountedPrice < s.price_cents;
        });
        if (hasDiscountableSessions) {
          membershipAffinity = 5;
        }
      }

      const relevanceScore =
        interactionScore +
        skillMatchScore +
        collaborativeScore +
        recencyScore +
        urgencyScore +
        membershipAffinity;

      return {
        ...product,
        sessions: productSessions.slice(0, 5),
        nextSession,
        relevance_score: Math.round(relevanceScore * 100) / 100,
      };
    })
    .filter((item) => item.sessions.length > 0)
    .sort((a, b) => {
      const scoreDiff = b.relevance_score - a.relevance_score;
      if (scoreDiff !== 0) return scoreDiff;

      const aTime = a.nextSession
        ? new Date(a.nextSession.starts_at).getTime()
        : Infinity;
      const bTime = b.nextSession
        ? new Date(b.nextSession.starts_at).getTime()
        : Infinity;

      return aTime - bTime;
    });
}

function paginateFeed(
  items: { id: string }[],
  cursor: string | null,
  pageSize: number,
): { page: { id: string }[]; nextCursor: string | null } {
  let startIndex = 0;
  if (cursor) {
    const idx = items.findIndex((i) => i.id === cursor);
    if (idx >= 0) startIndex = idx + 1;
  }
  const page = items.slice(startIndex, startIndex + pageSize);
  const nextCursor =
    startIndex + pageSize < items.length
      ? page[page.length - 1]?.id ?? null
      : null;
  return { page, nextCursor };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generate-feed logic', () => {
  // -----------------------------------------------------------------------
  // Time Decay
  // -----------------------------------------------------------------------
  describe('getTimeDecay', () => {
    const now = new Date('2026-02-17T12:00:00Z').getTime();

    it('returns 1.0 for interactions within the last 7 days', () => {
      const recentDate = new Date('2026-02-15T12:00:00Z').toISOString();
      expect(getTimeDecay(recentDate, now)).toBe(1.0);
    });

    it('returns 0.5 for interactions 8-30 days old', () => {
      const date = new Date('2026-01-25T12:00:00Z').toISOString();
      expect(getTimeDecay(date, now)).toBe(0.5);
    });

    it('returns 0.2 for interactions 31-90 days old', () => {
      const date = new Date('2025-12-01T12:00:00Z').toISOString();
      expect(getTimeDecay(date, now)).toBe(0.2);
    });

    it('returns 0.05 for interactions older than 90 days', () => {
      const date = new Date('2025-01-01T12:00:00Z').toISOString();
      expect(getTimeDecay(date, now)).toBe(0.05);
    });

    it('returns 1.0 for interactions exactly on the boundary (7 days)', () => {
      const date = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
      expect(getTimeDecay(date, now)).toBe(1.0);
    });
  });

  // -----------------------------------------------------------------------
  // Interaction Scoring
  // -----------------------------------------------------------------------
  describe('calculateInteractionScores', () => {
    const now = new Date('2026-02-17T12:00:00Z').getTime();
    const recentDate = new Date('2026-02-16T12:00:00Z').toISOString(); // within 7 days, decay=1.0

    it('assigns correct weight for a book interaction', () => {
      const interactions: TestInteraction[] = [
        { product_id: 'p1', interaction_type: 'book', created_at: recentDate },
      ];
      const scores = calculateInteractionScores(interactions, now);
      expect(scores['p1']).toBe(10);
    });

    it('assigns correct weight for a tap interaction', () => {
      const interactions: TestInteraction[] = [
        { product_id: 'p1', interaction_type: 'tap', created_at: recentDate },
      ];
      const scores = calculateInteractionScores(interactions, now);
      expect(scores['p1']).toBe(5);
    });

    it('assigns correct weight for a view interaction', () => {
      const interactions: TestInteraction[] = [
        { product_id: 'p1', interaction_type: 'view', created_at: recentDate },
      ];
      const scores = calculateInteractionScores(interactions, now);
      expect(scores['p1']).toBe(1);
    });

    it('assigns correct negative weight for a dismiss interaction', () => {
      const interactions: TestInteraction[] = [
        { product_id: 'p1', interaction_type: 'dismiss', created_at: recentDate },
      ];
      const scores = calculateInteractionScores(interactions, now);
      expect(scores['p1']).toBe(-3);
    });

    it('sums multiple interactions for the same product', () => {
      const interactions: TestInteraction[] = [
        { product_id: 'p1', interaction_type: 'book', created_at: recentDate },
        { product_id: 'p1', interaction_type: 'tap', created_at: recentDate },
        { product_id: 'p1', interaction_type: 'view', created_at: recentDate },
      ];
      const scores = calculateInteractionScores(interactions, now);
      // 10 + 5 + 1 = 16
      expect(scores['p1']).toBe(16);
    });

    it('scores multiple products independently', () => {
      const interactions: TestInteraction[] = [
        { product_id: 'p1', interaction_type: 'book', created_at: recentDate },
        { product_id: 'p2', interaction_type: 'dismiss', created_at: recentDate },
      ];
      const scores = calculateInteractionScores(interactions, now);
      expect(scores['p1']).toBe(10);
      expect(scores['p2']).toBe(-3);
    });

    it('returns an empty object when there are no interactions', () => {
      const scores = calculateInteractionScores([], now);
      expect(scores).toEqual({});
    });

    it('treats unknown interaction types as 0 weight', () => {
      const interactions: TestInteraction[] = [
        { product_id: 'p1', interaction_type: 'unknown_type', created_at: recentDate },
      ];
      const scores = calculateInteractionScores(interactions, now);
      expect(scores['p1']).toBe(0);
    });

    it('applies time decay to older interactions', () => {
      const oldDate = new Date('2026-02-01T12:00:00Z').toISOString(); // ~16 days ago, decay=0.5
      const interactions: TestInteraction[] = [
        { product_id: 'p1', interaction_type: 'book', created_at: oldDate },
      ];
      const scores = calculateInteractionScores(interactions, now);
      // 10 * 0.5 = 5
      expect(scores['p1']).toBe(5);
    });

    it('combines recent and old interactions with different decay rates', () => {
      const oldDate = new Date('2026-02-01T12:00:00Z').toISOString(); // ~16 days ago, decay=0.5
      const interactions: TestInteraction[] = [
        { product_id: 'p1', interaction_type: 'book', created_at: recentDate }, // 10 * 1.0 = 10
        { product_id: 'p1', interaction_type: 'tap', created_at: oldDate },     // 5 * 0.5 = 2.5
      ];
      const scores = calculateInteractionScores(interactions, now);
      expect(scores['p1']).toBe(12.5);
    });
  });

  // -----------------------------------------------------------------------
  // Skill Match Scoring
  // -----------------------------------------------------------------------
  describe('getSkillMatchScore', () => {
    it('returns 15 for an exact skill level match', () => {
      expect(getSkillMatchScore('intermediate', ['intermediate'])).toBe(15);
    });

    it('returns 5 for an adjacent skill level', () => {
      expect(getSkillMatchScore('intermediate', ['beginner'])).toBe(5);
      expect(getSkillMatchScore('intermediate', ['advanced'])).toBe(5);
    });

    it('returns 0 for a non-adjacent skill level', () => {
      expect(getSkillMatchScore('beginner', ['pro'])).toBe(0);
      expect(getSkillMatchScore('beginner', ['advanced'])).toBe(0);
    });

    it('returns 0 when user skill level is null', () => {
      expect(getSkillMatchScore(null, ['beginner'])).toBe(0);
    });

    it('returns 0 when product tags are null', () => {
      expect(getSkillMatchScore('beginner', null)).toBe(0);
    });

    it('returns 0 when product tags are empty', () => {
      expect(getSkillMatchScore('beginner', [])).toBe(0);
    });

    it('treats competitive tag as equivalent to pro', () => {
      expect(getSkillMatchScore('pro', ['competitive'])).toBe(15);
    });

    it('returns the best match among multiple tags', () => {
      // User is advanced, tags include beginner (distance 2) and pro (distance 1)
      expect(getSkillMatchScore('advanced', ['beginner', 'pro'])).toBe(5);
    });

    it('returns exact match immediately even with multiple tags', () => {
      expect(
        getSkillMatchScore('intermediate', ['beginner', 'intermediate', 'advanced']),
      ).toBe(15);
    });

    it('ignores non-skill tags', () => {
      expect(getSkillMatchScore('beginner', ['outdoor', 'evening'])).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Recency Score
  // -----------------------------------------------------------------------
  describe('getRecencyScore', () => {
    const now = new Date('2026-02-17T12:00:00Z').getTime();

    it('returns 10 for products created within 7 days', () => {
      const date = new Date('2026-02-14T12:00:00Z').toISOString();
      expect(getRecencyScore(date, now)).toBe(10);
    });

    it('returns 5 for products created 8-30 days ago', () => {
      const date = new Date('2026-01-25T12:00:00Z').toISOString();
      expect(getRecencyScore(date, now)).toBe(5);
    });

    it('returns 0 for products older than 30 days', () => {
      const date = new Date('2025-12-01T12:00:00Z').toISOString();
      expect(getRecencyScore(date, now)).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Urgency Score
  // -----------------------------------------------------------------------
  describe('getUrgencyScore', () => {
    const now = new Date('2026-02-17T12:00:00Z').getTime();

    it('returns 8 when a session has fewer than 3 spots remaining', () => {
      const sessions = [
        { spots_remaining: 2, starts_at: new Date(now + 48 * 60 * 60 * 1000).toISOString() },
      ];
      expect(getUrgencyScore(sessions, now)).toBe(8);
    });

    it('returns 5 when a session starts within 24 hours and has spots', () => {
      const sessions = [
        { spots_remaining: 10, starts_at: new Date(now + 12 * 60 * 60 * 1000).toISOString() },
      ];
      expect(getUrgencyScore(sessions, now)).toBe(5);
    });

    it('returns 0 when sessions have plenty of spots and are far away', () => {
      const sessions = [
        { spots_remaining: 10, starts_at: new Date(now + 72 * 60 * 60 * 1000).toISOString() },
      ];
      expect(getUrgencyScore(sessions, now)).toBe(0);
    });

    it('returns 0 for an empty sessions array', () => {
      expect(getUrgencyScore([], now)).toBe(0);
    });

    it('returns 0 when spots_remaining is 0 (even if session is soon)', () => {
      const sessions = [
        { spots_remaining: 0, starts_at: new Date(now + 1 * 60 * 60 * 1000).toISOString() },
      ];
      expect(getUrgencyScore(sessions, now)).toBe(0);
    });

    it('returns 8 when both conditions are true (almost full AND soon)', () => {
      const sessions = [
        { spots_remaining: 1, starts_at: new Date(now + 6 * 60 * 60 * 1000).toISOString() },
      ];
      // Almost full check (spots_remaining < 3 && > 0) gives 8
      expect(getUrgencyScore(sessions, now)).toBe(8);
    });

    it('picks the maximum urgency across multiple sessions', () => {
      const sessions = [
        { spots_remaining: 10, starts_at: new Date(now + 72 * 60 * 60 * 1000).toISOString() }, // 0
        { spots_remaining: 10, starts_at: new Date(now + 12 * 60 * 60 * 1000).toISOString() }, // 5
        { spots_remaining: 1, starts_at: new Date(now + 48 * 60 * 60 * 1000).toISOString() },  // 8
      ];
      expect(getUrgencyScore(sessions, now)).toBe(8);
    });
  });

  // -----------------------------------------------------------------------
  // Pricing Rule Application
  // -----------------------------------------------------------------------
  describe('applyPricingRules', () => {
    it('returns the original price when there are no rules', () => {
      expect(applyPricingRules(5000, new Date('2026-02-17T10:00:00Z'), [])).toBe(5000);
    });

    it('applies a multiplier when day and time match', () => {
      // 2026-02-17 is a Tuesday (day 2)
      const rules: TestPricingRule[] = [
        {
          days_of_week: [2],
          start_time: '09:00',
          end_time: '12:00',
          multiplier: 1.5,
          is_active: true,
        },
      ];
      // Session at 10:00 UTC on a Tuesday
      const result = applyPricingRules(
        5000,
        new Date('2026-02-17T10:00:00Z'),
        rules,
      );
      expect(result).toBe(7500);
    });

    it('does not apply a rule when the day does not match', () => {
      // 2026-02-17 is a Tuesday (day 2), rule targets Wednesday (day 3)
      const rules: TestPricingRule[] = [
        {
          days_of_week: [3],
          start_time: '09:00',
          end_time: '12:00',
          multiplier: 1.5,
          is_active: true,
        },
      ];
      const result = applyPricingRules(
        5000,
        new Date('2026-02-17T10:00:00Z'),
        rules,
      );
      expect(result).toBe(5000);
    });

    it('does not apply a rule when the time does not match', () => {
      const rules: TestPricingRule[] = [
        {
          days_of_week: [2],
          start_time: '14:00',
          end_time: '18:00',
          multiplier: 1.5,
          is_active: true,
        },
      ];
      // Session at 10:00 UTC on a Tuesday -- outside 14:00-18:00
      const result = applyPricingRules(
        5000,
        new Date('2026-02-17T10:00:00Z'),
        rules,
      );
      expect(result).toBe(5000);
    });

    it('applies a rule with null days_of_week (matches any day)', () => {
      const rules: TestPricingRule[] = [
        {
          days_of_week: null,
          start_time: '09:00',
          end_time: '12:00',
          multiplier: 2.0,
          is_active: true,
        },
      ];
      const result = applyPricingRules(
        5000,
        new Date('2026-02-17T10:00:00Z'),
        rules,
      );
      expect(result).toBe(10000);
    });

    it('applies a rule with empty days_of_week (matches any day)', () => {
      const rules: TestPricingRule[] = [
        {
          days_of_week: [],
          start_time: '09:00',
          end_time: '12:00',
          multiplier: 2.0,
          is_active: true,
        },
      ];
      const result = applyPricingRules(
        5000,
        new Date('2026-02-17T10:00:00Z'),
        rules,
      );
      expect(result).toBe(10000);
    });

    it('applies a rule with null start_time and end_time (matches any time)', () => {
      const rules: TestPricingRule[] = [
        {
          days_of_week: [2],
          start_time: null,
          end_time: null,
          multiplier: 0.8,
          is_active: true,
        },
      ];
      const result = applyPricingRules(
        5000,
        new Date('2026-02-17T10:00:00Z'),
        rules,
      );
      expect(result).toBe(4000);
    });

    it('skips inactive rules', () => {
      const rules: TestPricingRule[] = [
        {
          days_of_week: null,
          start_time: null,
          end_time: null,
          multiplier: 2.0,
          is_active: false,
        },
      ];
      const result = applyPricingRules(
        5000,
        new Date('2026-02-17T10:00:00Z'),
        rules,
      );
      expect(result).toBe(5000);
    });

    it('chains multiple matching rules (applies sequentially)', () => {
      const rules: TestPricingRule[] = [
        {
          days_of_week: null,
          start_time: null,
          end_time: null,
          multiplier: 1.5,
          is_active: true,
        },
        {
          days_of_week: null,
          start_time: null,
          end_time: null,
          multiplier: 2.0,
          is_active: true,
        },
      ];
      // 5000 * 1.5 = 7500, then 7500 * 2.0 = 15000
      const result = applyPricingRules(
        5000,
        new Date('2026-02-17T10:00:00Z'),
        rules,
      );
      expect(result).toBe(15000);
    });

    it('rounds to the nearest cent', () => {
      const rules: TestPricingRule[] = [
        {
          days_of_week: null,
          start_time: null,
          end_time: null,
          multiplier: 1.33,
          is_active: true,
        },
      ];
      // 333 * 1.33 = 442.89 -> Math.round -> 443
      const result = applyPricingRules(
        333,
        new Date('2026-02-17T10:00:00Z'),
        rules,
      );
      expect(result).toBe(443);
    });
  });

  // -----------------------------------------------------------------------
  // Feed Item Building
  // -----------------------------------------------------------------------
  describe('buildFeedItems', () => {
    const now = new Date('2026-02-17T12:00:00Z').getTime();
    const futureTime = new Date(now + 48 * 60 * 60 * 1000).toISOString();
    const soonerTime = new Date(now + 24 * 60 * 60 * 1000).toISOString();

    const baseProduct = (
      id: string,
      overrides: Partial<TestProduct> = {},
    ): TestProduct => ({
      id,
      type: 'open_play',
      tags: null,
      is_active: true,
      created_at: new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days ago (no recency boost)
      ...overrides,
    });

    const baseSession = (
      id: string,
      productId: string,
      overrides: Partial<TestSession> = {},
    ): TestSession => ({
      id,
      product_id: productId,
      starts_at: futureTime,
      price_cents: 5000,
      spots_remaining: 10,
      status: 'open',
      ...overrides,
    });

    it('excludes products that have no sessions', () => {
      const products = [baseProduct('p1'), baseProduct('p2')];
      const sessions = [baseSession('s1', 'p1')]; // only p1 has sessions

      const items = buildFeedItems(products, sessions, {}, [], null, {}, null, now);
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe('p1');
    });

    it('returns empty array when there are no products', () => {
      const items = buildFeedItems([], [], {}, [], null, {}, null, now);
      expect(items).toEqual([]);
    });

    it('returns empty array when no products have sessions', () => {
      const products = [baseProduct('p1')];
      const items = buildFeedItems(products, [], {}, [], null, {}, null, now);
      expect(items).toEqual([]);
    });

    it('sorts products by relevance_score descending', () => {
      const products = [baseProduct('p1'), baseProduct('p2')];
      const sessions = [
        baseSession('s1', 'p1'),
        baseSession('s2', 'p2'),
      ];
      // p2 has a higher interaction score
      const scores = { p1: 5, p2: 20 };

      const items = buildFeedItems(products, sessions, scores, [], null, {}, null, now);
      expect(items[0].id).toBe('p2');
      expect(items[1].id).toBe('p1');
    });

    it('uses next session time as tiebreaker when scores are equal', () => {
      const products = [baseProduct('p1'), baseProduct('p2')];
      const sessions = [
        baseSession('s1', 'p1', { starts_at: futureTime }),
        baseSession('s2', 'p2', { starts_at: soonerTime }),
      ];

      const items = buildFeedItems(products, sessions, {}, [], null, {}, null, now);
      // Scores are equal (0), so p2 with sooner session should come first
      expect(items[0].id).toBe('p2');
      expect(items[1].id).toBe('p1');
    });

    it('limits sessions per product to 5', () => {
      const products = [baseProduct('p1')];
      const sessions = Array.from({ length: 8 }, (_, i) =>
        baseSession(`s${i}`, 'p1', {
          starts_at: new Date(now + (i + 1) * 60 * 60 * 1000).toISOString(),
        }),
      );

      const items = buildFeedItems(products, sessions, {}, [], null, {}, null, now);
      expect(items[0].sessions).toHaveLength(5);
    });

    it('applies pricing rules to session prices', () => {
      const products = [baseProduct('p1')];
      const sessions = [baseSession('s1', 'p1', { price_cents: 5000 })];
      const rules: TestPricingRule[] = [
        {
          days_of_week: null,
          start_time: null,
          end_time: null,
          multiplier: 2.0,
          is_active: true,
        },
      ];

      const items = buildFeedItems(products, sessions, {}, rules, null, {}, null, now);
      expect(items[0].sessions[0].price_cents).toBe(10000);
    });

    it('includes interaction score in relevance_score', () => {
      const products = [baseProduct('p1')];
      const sessions = [baseSession('s1', 'p1')];
      const scores = { p1: 15 };

      const items = buildFeedItems(products, sessions, scores, [], null, {}, null, now);
      expect(items[0].relevance_score).toBe(15);
    });

    it('includes skill match score in relevance_score', () => {
      const products = [baseProduct('p1', { tags: ['intermediate'] })];
      const sessions = [baseSession('s1', 'p1')];

      const items = buildFeedItems(
        products,
        sessions,
        {},
        [],
        'intermediate',
        {},
        null,
        now,
      );
      // exact match = 15
      expect(items[0].relevance_score).toBe(15);
    });

    it('includes collaborative score in relevance_score', () => {
      const products = [baseProduct('p1')];
      const sessions = [baseSession('s1', 'p1')];
      const collabScores = { p1: 7 };

      const items = buildFeedItems(products, sessions, {}, [], null, collabScores, null, now);
      expect(items[0].relevance_score).toBe(7);
    });

    it('includes membership affinity in relevance_score', () => {
      const products = [baseProduct('p1')];
      const sessions = [baseSession('s1', 'p1', { price_cents: 5000 })];
      const membership = { discount_percent: 20 };

      const items = buildFeedItems(products, sessions, {}, [], null, {}, membership, now);
      // Membership affinity = 5 (has discountable sessions)
      expect(items[0].relevance_score).toBe(5);
    });

    it('does not add membership affinity when discount_percent is 0', () => {
      const products = [baseProduct('p1')];
      const sessions = [baseSession('s1', 'p1', { price_cents: 5000 })];
      const membership = { discount_percent: 0 };

      const items = buildFeedItems(products, sessions, {}, [], null, {}, membership, now);
      expect(items[0].relevance_score).toBe(0);
    });

    it('combines all scoring factors', () => {
      const products = [
        baseProduct('p1', {
          tags: ['intermediate'],
          created_at: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days old -> recency 10
        }),
      ];
      const sessions = [
        baseSession('s1', 'p1', {
          spots_remaining: 1, // urgency 8
          starts_at: new Date(now + 6 * 60 * 60 * 1000).toISOString(),
          price_cents: 5000,
        }),
      ];
      const interactionScores = { p1: 12 };
      const collabScores = { p1: 4 };
      const membership = { discount_percent: 20 };

      const items = buildFeedItems(
        products,
        sessions,
        interactionScores,
        [],
        'intermediate', // exact match = 15
        collabScores,
        membership,
        now,
      );

      // interaction(12) + skill(15) + collaborative(4) + recency(10) + urgency(8) + membership(5) = 54
      expect(items[0].relevance_score).toBe(54);
    });
  });

  // -----------------------------------------------------------------------
  // Pagination
  // -----------------------------------------------------------------------
  describe('paginateFeed', () => {
    const items = [
      { id: 'a' },
      { id: 'b' },
      { id: 'c' },
      { id: 'd' },
      { id: 'e' },
    ];

    it('returns the first page when cursor is null', () => {
      const result = paginateFeed(items, null, 2);
      expect(result.page).toEqual([{ id: 'a' }, { id: 'b' }]);
      expect(result.nextCursor).toBe('b');
    });

    it('returns the next page after the cursor', () => {
      const result = paginateFeed(items, 'b', 2);
      expect(result.page).toEqual([{ id: 'c' }, { id: 'd' }]);
      expect(result.nextCursor).toBe('d');
    });

    it('returns null nextCursor when on the last page', () => {
      const result = paginateFeed(items, 'd', 2);
      expect(result.page).toEqual([{ id: 'e' }]);
      expect(result.nextCursor).toBeNull();
    });

    it('returns null nextCursor when exact last page', () => {
      const result = paginateFeed(items, 'c', 2);
      expect(result.page).toEqual([{ id: 'd' }, { id: 'e' }]);
      expect(result.nextCursor).toBeNull();
    });

    it('returns all items when pageSize exceeds total items', () => {
      const result = paginateFeed(items, null, 100);
      expect(result.page).toEqual(items);
      expect(result.nextCursor).toBeNull();
    });

    it('returns empty page and null cursor for empty items', () => {
      const result = paginateFeed([], null, 20);
      expect(result.page).toEqual([]);
      expect(result.nextCursor).toBeNull();
    });

    it('starts from the beginning when cursor is not found', () => {
      const result = paginateFeed(items, 'nonexistent', 2);
      expect(result.page).toEqual([{ id: 'a' }, { id: 'b' }]);
      expect(result.nextCursor).toBe('b');
    });

    it('handles pageSize of 1', () => {
      const result = paginateFeed(items, null, 1);
      expect(result.page).toEqual([{ id: 'a' }]);
      expect(result.nextCursor).toBe('a');
    });

    it('returns empty page when cursor is the last item', () => {
      const result = paginateFeed(items, 'e', 2);
      expect(result.page).toEqual([]);
      expect(result.nextCursor).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Page size clamping (mirrors the edge function logic)
  // -----------------------------------------------------------------------
  describe('page size clamping', () => {
    function clampPageSize(limit: number): number {
      return Math.min(Math.max(limit, 1), 50);
    }

    it('clamps to 1 when limit is 0', () => {
      expect(clampPageSize(0)).toBe(1);
    });

    it('clamps to 1 when limit is negative', () => {
      expect(clampPageSize(-5)).toBe(1);
    });

    it('passes through a normal limit', () => {
      expect(clampPageSize(20)).toBe(20);
    });

    it('clamps to 50 when limit exceeds maximum', () => {
      expect(clampPageSize(100)).toBe(50);
    });

    it('allows the boundary value 50', () => {
      expect(clampPageSize(50)).toBe(50);
    });

    it('allows the boundary value 1', () => {
      expect(clampPageSize(1)).toBe(1);
    });
  });
});
