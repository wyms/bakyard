import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// ---------- Types ----------

interface NotificationPayload {
  user_id: string;
  title: string;
  body: string;
  type: "booking_confirm" | "payment_reminder" | "session_update" | "membership" | "promo";
  data?: Record<string, unknown>;
}

// ---------- Helpers ----------

/**
 * Inserts a notification record and attempts to send a push notification
 * via the user's Expo push token if available.
 */
async function sendNotification(
  adminClient: ReturnType<typeof createAdminClient>,
  payload: NotificationPayload,
  pushToken: string | null
): Promise<{ notificationId: string; pushSent: boolean }> {
  // Insert notification record
  const { data: notification, error: notifError } = await adminClient
    .from("notifications")
    .insert({
      user_id: payload.user_id,
      title: payload.title,
      body: payload.body,
      type: payload.type,
      data: payload.data || null,
      is_read: false,
    })
    .select("id")
    .single();

  if (notifError) {
    console.error(
      `Failed to insert notification for user ${payload.user_id}:`,
      notifError.message
    );
    throw notifError;
  }

  // Attempt push notification
  let pushSent = false;

  if (pushToken) {
    const isExpoToken =
      pushToken.startsWith("ExponentPushToken[") ||
      pushToken.startsWith("ExpoPushToken[");

    if (isExpoToken) {
      try {
        const pushPayload = {
          to: pushToken,
          title: payload.title,
          body: payload.body,
          data: {
            ...payload.data,
            notification_id: notification.id,
            type: payload.type,
          },
          sound: "default",
        };

        const pushResponse = await fetch(EXPO_PUSH_URL, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Accept-Encoding": "gzip, deflate",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(pushPayload),
        });

        if (pushResponse.ok) {
          pushSent = true;
        } else {
          console.error(
            `Push delivery failed for user ${payload.user_id}:`,
            await pushResponse.text()
          );
        }
      } catch (pushErr) {
        console.error(
          `Push send error for user ${payload.user_id}:`,
          pushErr
        );
      }
    }
  }

  return { notificationId: notification.id, pushSent };
}

/**
 * Checks if a notification of a given type was already sent to a user about a
 * specific entity (identified by a key in the data JSONB column) within a time window.
 */
async function wasNotificationAlreadySent(
  adminClient: ReturnType<typeof createAdminClient>,
  userId: string,
  type: string,
  dataKey: string,
  dataValue: string,
  sinceIso: string
): Promise<boolean> {
  // Query notifications matching user, type, and time window, then filter by data key
  const { data, error } = await adminClient
    .from("notifications")
    .select("id, data")
    .eq("user_id", userId)
    .eq("type", type)
    .gte("created_at", sinceIso)
    .limit(50);

  if (error || !data) return false;

  return data.some((n) => {
    const d = n.data as Record<string, unknown> | null;
    return d && d[dataKey] === dataValue;
  });
}

/**
 * Counts notifications of a given type sent to a user since a given time.
 */
async function countNotificationsSince(
  adminClient: ReturnType<typeof createAdminClient>,
  userId: string,
  type: string,
  sinceIso: string
): Promise<number> {
  const { count, error } = await adminClient
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("type", type)
    .gte("created_at", sinceIso);

  if (error) return 0;
  return count ?? 0;
}

// ---------- Notification Strategies ----------

/**
 * (a) Session Reminders
 * Find confirmed bookings where session starts in ~2 hours.
 * Window: 1h45m to 2h15m from now to avoid duplicates across 30-min cron intervals.
 */
async function processSessionReminders(
  adminClient: ReturnType<typeof createAdminClient>
): Promise<number> {
  const now = Date.now();
  const windowStart = new Date(now + 105 * 60 * 1000).toISOString(); // 1h 45m
  const windowEnd = new Date(now + 135 * 60 * 1000).toISOString(); // 2h 15m

  // Find confirmed bookings with sessions starting in the 2-hour window
  const { data: upcomingBookings, error } = await adminClient
    .from("bookings")
    .select(`
      id,
      user_id,
      session_id,
      sessions!inner (
        id,
        starts_at,
        court_id,
        product_id,
        products!inner (
          id,
          title
        )
      ),
      users!inner (
        id,
        push_token
      )
    `)
    .eq("status", "confirmed")
    .gte("sessions.starts_at", windowStart)
    .lte("sessions.starts_at", windowEnd);

  if (error) {
    console.error("Session reminders query error:", error.message);
    return 0;
  }

  if (!upcomingBookings || upcomingBookings.length === 0) return 0;

  let sentCount = 0;

  for (const booking of upcomingBookings) {
    const session = booking.sessions as unknown as {
      id: string;
      starts_at: string;
      court_id: string;
      product_id: string;
      products: { id: string; title: string };
    };
    const userRecord = booking.users as unknown as {
      id: string;
      push_token: string | null;
    };

    // Check if we already sent a reminder for this booking
    const alreadySent = await wasNotificationAlreadySent(
      adminClient,
      booking.user_id,
      "session_update",
      "booking_id",
      booking.id,
      new Date(now - 3 * 60 * 60 * 1000).toISOString() // Look back 3 hours
    );

    if (alreadySent) continue;

    // Fetch court name for the notification message
    const { data: court } = await adminClient
      .from("courts")
      .select("name")
      .eq("id", session.court_id)
      .single();

    const courtName = court?.name ?? "your court";
    const productTitle = session.products.title;

    try {
      await sendNotification(
        adminClient,
        {
          user_id: booking.user_id,
          title: "Session Starting Soon",
          body: `Your ${productTitle} starts in 2 hours at ${courtName}!`,
          type: "session_update",
          data: {
            booking_id: booking.id,
            session_id: session.id,
            product_id: session.product_id,
          },
        },
        userRecord.push_token
      );
      sentCount++;
    } catch (err) {
      console.error(`Failed to send session reminder for booking ${booking.id}:`, err);
    }
  }

  return sentCount;
}

/**
 * (b) Almost-Full Alerts
 * Find sessions with fewer than 3 spots remaining. Notify users who have
 * viewed/tapped the product but not booked it.
 */
async function processAlmostFullAlerts(
  adminClient: ReturnType<typeof createAdminClient>
): Promise<number> {
  const now = new Date().toISOString();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartIso = todayStart.toISOString();

  // Find sessions that are almost full (1-2 spots remaining), still upcoming
  const { data: almostFullSessions, error } = await adminClient
    .from("sessions")
    .select(`
      id,
      product_id,
      spots_remaining,
      starts_at,
      products!inner (
        id,
        title
      )
    `)
    .eq("status", "open")
    .gt("spots_remaining", 0)
    .lt("spots_remaining", 3)
    .gte("starts_at", now);

  if (error) {
    console.error("Almost-full query error:", error.message);
    return 0;
  }

  if (!almostFullSessions || almostFullSessions.length === 0) return 0;

  let sentCount = 0;

  for (const session of almostFullSessions) {
    const product = session.products as unknown as { id: string; title: string };

    // Find users who viewed or tapped this product
    const { data: interestedInteractions } = await adminClient
      .from("feed_interactions")
      .select("user_id")
      .eq("product_id", session.product_id)
      .in("interaction_type", ["view", "tap"]);

    if (!interestedInteractions || interestedInteractions.length === 0) continue;

    const interestedUserIds = [
      ...new Set(interestedInteractions.map((i) => i.user_id)),
    ];

    // Find users who already booked this session (to exclude them)
    const { data: existingBookings } = await adminClient
      .from("bookings")
      .select("user_id")
      .eq("session_id", session.id)
      .in("status", ["reserved", "confirmed"]);

    const bookedUserIds = new Set(
      (existingBookings || []).map((b) => b.user_id)
    );

    // Filter to users who haven't booked
    const eligibleUserIds = interestedUserIds.filter(
      (uid) => !bookedUserIds.has(uid)
    );

    if (eligibleUserIds.length === 0) continue;

    // Fetch push tokens for eligible users
    const { data: users } = await adminClient
      .from("users")
      .select("id, push_token")
      .in("id", eligibleUserIds);

    if (!users) continue;

    for (const targetUser of users) {
      // Check daily limit: max 3 promo notifications per user per day
      const dailyPromoCount = await countNotificationsSince(
        adminClient,
        targetUser.id,
        "promo",
        todayStartIso
      );

      if (dailyPromoCount >= 3) continue;

      // Check if we already sent an almost-full alert for this session to this user
      const alreadySent = await wasNotificationAlreadySent(
        adminClient,
        targetUser.id,
        "promo",
        "session_id",
        session.id,
        todayStartIso
      );

      if (alreadySent) continue;

      try {
        await sendNotification(
          adminClient,
          {
            user_id: targetUser.id,
            title: "Almost Full!",
            body: `Only ${session.spots_remaining} spot${session.spots_remaining === 1 ? "" : "s"} left for ${product.title}!`,
            type: "promo",
            data: {
              session_id: session.id,
              product_id: session.product_id,
              spots_remaining: session.spots_remaining,
              alert_type: "almost_full",
            },
          },
          targetUser.push_token
        );
        sentCount++;
      } catch (err) {
        console.error(
          `Failed to send almost-full alert to user ${targetUser.id}:`,
          err
        );
      }
    }
  }

  return sentCount;
}

/**
 * (c) Re-engagement
 * Find users who booked 7+ days ago but haven't booked since.
 * Suggest products similar to what they've booked before.
 */
async function processReengagement(
  adminClient: ReturnType<typeof createAdminClient>
): Promise<number> {
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const oneWeekAgoForLimit = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const nowIso = new Date(now).toISOString();

  // Find users whose most recent booking was 7+ days ago
  // Strategy: get users with bookings older than 7 days, then check they have
  // nothing more recent.
  const { data: oldBookings, error } = await adminClient
    .from("bookings")
    .select("user_id")
    .in("status", ["confirmed", "reserved"])
    .lt("created_at", sevenDaysAgo)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("Re-engagement query error:", error.message);
    return 0;
  }

  if (!oldBookings || oldBookings.length === 0) return 0;

  const candidateUserIds = [...new Set(oldBookings.map((b) => b.user_id))];

  let sentCount = 0;

  for (const userId of candidateUserIds) {
    // Check if the user has any bookings in the last 7 days
    const { count: recentBookingCount } = await adminClient
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", ["confirmed", "reserved"])
      .gte("created_at", sevenDaysAgo);

    if (recentBookingCount && recentBookingCount > 0) continue;

    // Check weekly limit: max 1 re-engagement promo per week
    const weeklyPromoCount = await countNotificationsSince(
      adminClient,
      userId,
      "promo",
      oneWeekAgoForLimit
    );

    // We use a specific data key to distinguish re-engagement from other promos
    const alreadySentReengagement = await wasNotificationAlreadySent(
      adminClient,
      userId,
      "promo",
      "alert_type",
      "re_engagement",
      oneWeekAgoForLimit
    );

    if (alreadySentReengagement) continue;

    // Find what the user has booked before (type and tags)
    const { data: pastBookings } = await adminClient
      .from("bookings")
      .select("sessions!inner(product_id, products!inner(id, type, tags, title))")
      .eq("user_id", userId)
      .in("status", ["confirmed", "reserved"])
      .order("created_at", { ascending: false })
      .limit(10);

    if (!pastBookings || pastBookings.length === 0) continue;

    // Collect product types and tags from past bookings
    const pastTypes = new Set<string>();
    const pastTags = new Set<string>();
    for (const booking of pastBookings) {
      const session = (booking as Record<string, unknown>).sessions as {
        product_id: string;
        products: { id: string; type: string; tags: string[] | null; title: string };
      };
      if (session?.products) {
        pastTypes.add(session.products.type);
        if (session.products.tags) {
          session.products.tags.forEach((t) => pastTags.add(t));
        }
      }
    }

    // Find a similar product with open sessions this week
    const oneWeekFromNow = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();

    let suggestedProduct: { id: string; title: string } | null = null;

    if (pastTypes.size > 0) {
      const { data: similarProducts } = await adminClient
        .from("products")
        .select("id, title")
        .eq("is_active", true)
        .in("type", Array.from(pastTypes))
        .limit(5);

      if (similarProducts && similarProducts.length > 0) {
        // Find one that has sessions with spots available this week
        for (const product of similarProducts) {
          const { data: availableSessions } = await adminClient
            .from("sessions")
            .select("id")
            .eq("product_id", product.id)
            .eq("status", "open")
            .gt("spots_remaining", 0)
            .gte("starts_at", nowIso)
            .lte("starts_at", oneWeekFromNow)
            .limit(1);

          if (availableSessions && availableSessions.length > 0) {
            suggestedProduct = product;
            break;
          }
        }
      }
    }

    if (!suggestedProduct) continue;

    // Fetch user's push token
    const { data: userRecord } = await adminClient
      .from("users")
      .select("push_token")
      .eq("id", userId)
      .single();

    try {
      await sendNotification(
        adminClient,
        {
          user_id: userId,
          title: "We Miss You!",
          body: `Missing the sand? ${suggestedProduct.title} has spots open this week`,
          type: "promo",
          data: {
            product_id: suggestedProduct.id,
            alert_type: "re_engagement",
          },
        },
        userRecord?.push_token ?? null
      );
      sentCount++;
    } catch (err) {
      console.error(`Failed to send re-engagement to user ${userId}:`, err);
    }
  }

  return sentCount;
}

/**
 * (d) Membership Upsell
 * Find users with 5+ bookings in the last 30 days who don't have a membership.
 */
async function processMembershipUpsell(
  adminClient: ReturnType<typeof createAdminClient>
): Promise<number> {
  const now = Date.now();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  const oneMonthAgoForLimit = thirtyDaysAgo;

  // Find users with 5+ confirmed bookings in the last 30 days
  // We use a two-step approach: get booking counts, then filter
  const { data: frequentBookers, error } = await adminClient
    .from("bookings")
    .select("user_id")
    .in("status", ["confirmed", "reserved"])
    .gte("created_at", thirtyDaysAgo);

  if (error) {
    console.error("Membership upsell query error:", error.message);
    return 0;
  }

  if (!frequentBookers || frequentBookers.length === 0) return 0;

  // Count bookings per user
  const bookingCounts: Record<string, number> = {};
  for (const booking of frequentBookers) {
    bookingCounts[booking.user_id] =
      (bookingCounts[booking.user_id] || 0) + 1;
  }

  // Filter to users with 5+ bookings
  const eligibleUserIds = Object.entries(bookingCounts)
    .filter(([_, count]) => count >= 5)
    .map(([userId]) => userId);

  if (eligibleUserIds.length === 0) return 0;

  // Exclude users who already have an active membership
  const { data: existingMemberships } = await adminClient
    .from("memberships")
    .select("user_id")
    .in("user_id", eligibleUserIds)
    .eq("status", "active");

  const memberedUserIds = new Set(
    (existingMemberships || []).map((m) => m.user_id)
  );

  const nonMemberUserIds = eligibleUserIds.filter(
    (uid) => !memberedUserIds.has(uid)
  );

  if (nonMemberUserIds.length === 0) return 0;

  let sentCount = 0;

  for (const userId of nonMemberUserIds) {
    // Check monthly limit: max 1 membership notification per user per month
    const alreadySent = await wasNotificationAlreadySent(
      adminClient,
      userId,
      "membership",
      "alert_type",
      "membership_upsell",
      oneMonthAgoForLimit
    );

    if (alreadySent) continue;

    // Fetch user's push token
    const { data: userRecord } = await adminClient
      .from("users")
      .select("push_token")
      .eq("id", userId)
      .single();

    try {
      await sendNotification(
        adminClient,
        {
          user_id: userId,
          title: "Become a Member",
          body: "You're a regular! Save up to 25% with a Bakyard membership",
          type: "membership",
          data: {
            alert_type: "membership_upsell",
            booking_count_30d: bookingCounts[userId],
          },
        },
        userRecord?.push_token ?? null
      );
      sentCount++;
    } catch (err) {
      console.error(`Failed to send membership upsell to user ${userId}:`, err);
    }
  }

  return sentCount;
}

// ---------- Main handler ----------

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // This function is designed to be called by pg_cron every 30 minutes.
    // It can also be invoked manually via an admin HTTP call.
    // No user auth is required since this runs as a background job with
    // the service role key.
    const adminClient = createAdminClient();

    console.log("Smart notifications: starting batch processing...");

    // Run all notification strategies in parallel
    const [
      sessionReminderCount,
      almostFullCount,
      reengagementCount,
      membershipUpsellCount,
    ] = await Promise.all([
      processSessionReminders(adminClient),
      processAlmostFullAlerts(adminClient),
      processReengagement(adminClient),
      processMembershipUpsell(adminClient),
    ]);

    const summary = {
      session_reminders: sessionReminderCount,
      almost_full_alerts: almostFullCount,
      re_engagement: reengagementCount,
      membership_upsells: membershipUpsellCount,
      total:
        sessionReminderCount +
        almostFullCount +
        reengagementCount +
        membershipUpsellCount,
      processed_at: new Date().toISOString(),
    };

    console.log("Smart notifications: batch complete", JSON.stringify(summary));

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("smart-notifications error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
