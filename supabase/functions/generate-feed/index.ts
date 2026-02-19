import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createAdminClient, createUserClient } from "../_shared/supabase.ts";

// ---------- Constants ----------

const INTERACTION_WEIGHTS: Record<string, number> = {
  book: 10,
  tap: 5,
  view: 1,
  dismiss: -3,
};

const SKILL_LEVELS = ["beginner", "intermediate", "advanced", "pro"] as const;
type SkillLevel = (typeof SKILL_LEVELS)[number];

/**
 * Map product tags to canonical skill levels for matching purposes.
 * "competitive" is treated as equivalent to "pro".
 */
const TAG_TO_SKILL: Record<string, SkillLevel> = {
  beginner: "beginner",
  intermediate: "intermediate",
  advanced: "advanced",
  pro: "pro",
  competitive: "pro",
};

// ---------- Helpers ----------

/**
 * Returns a time-decay multiplier based on how many days ago the interaction occurred.
 */
function getTimeDecay(createdAt: string): number {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  if (ageDays <= 7) return 1.0;
  if (ageDays <= 30) return 0.5;
  if (ageDays <= 90) return 0.2;
  return 0.05;
}

/**
 * Computes a skill-match score between a user's skill level and a product's tags.
 * Exact match: +15, adjacent level: +5, otherwise 0.
 */
function getSkillMatchScore(
  userSkillLevel: SkillLevel | null,
  productTags: string[] | null
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
      return 15; // Exact match - can't do better, return immediately
    } else if (distance === 1 && bestScore < 5) {
      bestScore = 5; // Adjacent level
    }
  }

  return bestScore;
}

/**
 * Computes a recency score for newly created products.
 */
function getRecencyScore(createdAt: string): number {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  if (ageDays <= 7) return 10;
  if (ageDays <= 30) return 5;
  return 0;
}

/**
 * Computes an urgency score based on session availability and timing.
 */
function getUrgencyScore(
  sessions: Array<{ spots_remaining: number; starts_at: string }>
): number {
  let score = 0;
  const twentyFourHoursFromNow = Date.now() + 24 * 60 * 60 * 1000;

  for (const session of sessions) {
    // Almost full: fewer than 3 spots remaining
    if (session.spots_remaining !== null && session.spots_remaining < 3 && session.spots_remaining > 0) {
      score = Math.max(score, 8);
    }

    // Happening soon: starts within 24 hours and has spots
    const startsAt = new Date(session.starts_at).getTime();
    if (
      startsAt <= twentyFourHoursFromNow &&
      session.spots_remaining !== null &&
      session.spots_remaining > 0
    ) {
      score = Math.max(score, Math.max(score, 5));
    }

    // If we already have the max possible urgency score, stop early
    if (score >= 8) break;
  }

  return score;
}

// ---------- Main handler ----------

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
    const body = req.method === "POST" ? await req.json() : {};
    const {
      filters = [],
      cursor = null,
      limit = 20,
    } = body as {
      filters?: string[];
      cursor?: string | null;
      limit?: number;
    };

    const pageSize = Math.min(Math.max(limit, 1), 50);
    const adminClient = createAdminClient();
    const now = new Date().toISOString();
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    // ---------- Step A: Fetch user profile for skill level and membership ----------
    const [userProfileResult, membershipResult] = await Promise.all([
      adminClient
        .from("users")
        .select("skill_level")
        .eq("id", user.id)
        .single(),
      adminClient
        .from("memberships")
        .select("tier, status, discount_percent")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle(),
    ]);

    const userSkillLevel: SkillLevel | null =
      userProfileResult.data?.skill_level ?? null;
    const activeMembership = membershipResult.data ?? null;

    // ---------- Step B: Query active products with upcoming sessions ----------
    let productsQuery = adminClient
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    // Apply type/tag filters
    if (filters.length > 0) {
      const productTypes = [
        "court_rental",
        "open_play",
        "coaching",
        "clinic",
        "tournament",
        "community_day",
        "food_addon",
      ];

      const typeFilters = filters.filter((f) => productTypes.includes(f));
      const tagFilters = filters.filter((f) => !productTypes.includes(f));

      if (typeFilters.length > 0) {
        productsQuery = productsQuery.in("type", typeFilters);
      }

      if (tagFilters.length > 0) {
        productsQuery = productsQuery.overlaps("tags", tagFilters);
      }
    }

    const { data: products, error: productsError } = await productsQuery;

    if (productsError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch products: " + productsError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!products || products.length === 0) {
      return new Response(
        JSON.stringify({ items: [], nextCursor: null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const productIds = products.map((p) => p.id);

    // ---------- Step C: Fetch sessions, interactions, pricing rules, and collaborative data in parallel ----------
    const [sessionsResult, interactionsResult, pricingRulesResult, userBookingsResult] =
      await Promise.all([
        // Upcoming sessions for these products
        adminClient
          .from("sessions")
          .select("*")
          .in("product_id", productIds)
          .gte("starts_at", now)
          .in("status", ["open", "full"])
          .order("starts_at", { ascending: true }),

        // User's interactions with these products (including created_at for time-decay)
        adminClient
          .from("feed_interactions")
          .select("product_id, interaction_type, created_at")
          .eq("user_id", user.id)
          .in("product_id", productIds),

        // Active pricing rules
        adminClient
          .from("pricing_rules")
          .select("*")
          .eq("is_active", true),

        // User's bookings from the last 90 days for collaborative filtering
        adminClient
          .from("bookings")
          .select("session_id, sessions!inner(product_id)")
          .eq("user_id", user.id)
          .eq("status", "confirmed")
          .gte("created_at", ninetyDaysAgo),
      ]);

    const sessions = sessionsResult.data || [];
    const interactions = interactionsResult.data || [];
    const pricingRules = pricingRulesResult.data || [];

    // ---------- Step D: Build interaction scores with time-decay ----------
    const interactionScores: Record<string, number> = {};

    for (const interaction of interactions) {
      const baseScore = INTERACTION_WEIGHTS[interaction.interaction_type] ?? 0;
      const decay = getTimeDecay(interaction.created_at);
      interactionScores[interaction.product_id] =
        (interactionScores[interaction.product_id] || 0) + baseScore * decay;
    }

    // ---------- Step E: Apply pricing rules and group sessions by product ----------
    const sessionsByProduct: Record<string, typeof sessions> = {};

    for (const s of sessions) {
      if (!sessionsByProduct[s.product_id]) {
        sessionsByProduct[s.product_id] = [];
      }

      let displayPrice = s.price_cents;

      if (pricingRules.length > 0) {
        const sessionDate = new Date(s.starts_at);
        const dayOfWeek = sessionDate.getDay(); // 0=Sunday
        const timeStr = sessionDate.toTimeString().slice(0, 5); // HH:MM

        for (const rule of pricingRules) {
          const matchesDay =
            !rule.days_of_week ||
            rule.days_of_week.length === 0 ||
            rule.days_of_week.includes(dayOfWeek);

          const matchesTime =
            (!rule.start_time || timeStr >= rule.start_time) &&
            (!rule.end_time || timeStr <= rule.end_time);

          if (matchesDay && matchesTime) {
            displayPrice = Math.round(displayPrice * Number(rule.multiplier));
          }
        }
      }

      sessionsByProduct[s.product_id]!.push({
        ...s,
        price_cents: displayPrice,
      });
    }

    // ---------- Step F: Collaborative filtering ----------
    const collaborativeScores: Record<string, number> = {};

    // Extract the product IDs the user has booked
    const userBookedProductIds = new Set<string>();
    const userBookings = userBookingsResult.data || [];

    for (const booking of userBookings) {
      // The join returns sessions as an object with product_id
      const session = (booking as Record<string, unknown>).sessions as
        | { product_id: string }
        | null;
      if (session?.product_id) {
        userBookedProductIds.add(session.product_id);
      }
    }

    if (userBookedProductIds.size > 0) {
      // Find sessions for the products the user has booked (to find similar users)
      const { data: sessionsForUserProducts } = await adminClient
        .from("sessions")
        .select("id, product_id")
        .in("product_id", Array.from(userBookedProductIds))
        .gte("created_at", ninetyDaysAgo);

      if (sessionsForUserProducts && sessionsForUserProducts.length > 0) {
        const sessionIdsForUserProducts = sessionsForUserProducts.map((s) => s.id);

        // Find other users who also booked these sessions (capped at 50)
        const { data: similarUserBookings } = await adminClient
          .from("bookings")
          .select("user_id, session_id")
          .in("session_id", sessionIdsForUserProducts)
          .neq("user_id", user.id)
          .eq("status", "confirmed")
          .gte("created_at", ninetyDaysAgo)
          .limit(200); // Fetch enough to get up to 50 unique users

        if (similarUserBookings && similarUserBookings.length > 0) {
          // Get unique similar user IDs, capped at 50
          const similarUserIds = [
            ...new Set(similarUserBookings.map((b) => b.user_id)),
          ].slice(0, 50);

          // Find what those similar users have booked (that the current user hasn't)
          const { data: similarUsersOtherBookings } = await adminClient
            .from("bookings")
            .select("sessions!inner(product_id)")
            .in("user_id", similarUserIds)
            .eq("status", "confirmed")
            .gte("created_at", ninetyDaysAgo)
            .limit(500);

          if (similarUsersOtherBookings) {
            for (const booking of similarUsersOtherBookings) {
              const session = (booking as Record<string, unknown>).sessions as
                | { product_id: string }
                | null;
              if (!session?.product_id) continue;

              const pid = session.product_id;

              // Only boost products the current user hasn't booked yet
              if (userBookedProductIds.has(pid)) continue;

              // Accumulate co-occurrence count as the collaborative score
              collaborativeScores[pid] = (collaborativeScores[pid] || 0) + 1;
            }
          }
        }
      }
    }

    // Normalize collaborative scores: cap at +10 points
    const maxCollab = Math.max(1, ...Object.values(collaborativeScores));
    for (const pid of Object.keys(collaborativeScores)) {
      collaborativeScores[pid] = Math.round(
        (collaborativeScores[pid] / maxCollab) * 10
      );
    }

    // ---------- Step G: Build feed items with combined scoring ----------
    const feedItems = products
      .map((product) => {
        const productSessions = sessionsByProduct[product.id] || [];
        const nextSession = productSessions[0] || null;

        // (a) Interaction score (already time-decayed)
        const interactionScore = interactionScores[product.id] || 0;

        // (b) Skill-level matching
        const skillMatchScore = getSkillMatchScore(
          userSkillLevel,
          product.tags
        );

        // (c) Collaborative filtering score
        const collaborativeScore = collaborativeScores[product.id] || 0;

        // (d) Recency boost for new products
        const recencyScore = getRecencyScore(product.created_at);

        // (e) Availability urgency
        const urgencyScore = getUrgencyScore(productSessions);

        // (f) Membership affinity
        let membershipAffinity = 0;
        if (activeMembership && activeMembership.discount_percent > 0) {
          // Boost products where sessions benefit from the membership discount.
          // Check if any session for this product has a price that would be
          // discounted by the user's membership.
          const hasDiscountableSessions = productSessions.some((s) => {
            const discountedPrice = Math.round(
              s.price_cents * (1 - activeMembership.discount_percent / 100)
            );
            return discountedPrice < s.price_cents;
          });
          if (hasDiscountableSessions) {
            membershipAffinity = 5;
          }
        }

        // (g) Combined score
        const relevanceScore =
          interactionScore +
          skillMatchScore +
          collaborativeScore +
          recencyScore +
          urgencyScore +
          membershipAffinity;

        return {
          ...product,
          sessions: productSessions.slice(0, 5), // Return up to 5 upcoming sessions
          nextSession,
          relevance_score: Math.round(relevanceScore * 100) / 100,
        };
      })
      // Only include products that have upcoming sessions
      .filter((item) => item.sessions.length > 0)
      // Sort: primary by relevance_score DESC, tiebreaker by next session time ASC
      .sort((a, b) => {
        const scoreDiff = b.relevance_score - a.relevance_score;
        if (scoreDiff !== 0) return scoreDiff;

        // Tiebreaker: sooner sessions first
        const aTime = a.nextSession
          ? new Date(a.nextSession.starts_at).getTime()
          : Infinity;
        const bTime = b.nextSession
          ? new Date(b.nextSession.starts_at).getTime()
          : Infinity;

        return aTime - bTime;
      });

    // ---------- Step H: Paginate with cursor ----------
    let startIndex = 0;
    if (cursor) {
      const cursorIndex = feedItems.findIndex((item) => item.id === cursor);
      if (cursorIndex >= 0) {
        startIndex = cursorIndex + 1;
      }
    }

    const pageItems = feedItems.slice(startIndex, startIndex + pageSize);
    const nextCursor =
      startIndex + pageSize < feedItems.length
        ? pageItems[pageItems.length - 1]?.id ?? null
        : null;

    // ---------- Response ----------
    return new Response(
      JSON.stringify({
        items: pageItems,
        nextCursor,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("generate-feed error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
