import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ---------- Parse body ----------
    const { user_id, title, body, type, data } = await req.json();

    if (!user_id || !title || !body || !type) {
      return new Response(
        JSON.stringify({
          error: "user_id, title, body, and type are required",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createAdminClient();

    // ---------- Step A: Get user's push_token ----------
    const { data: userProfile, error: userError } = await adminClient
      .from("users")
      .select("push_token")
      .eq("id", user_id)
      .single();

    if (userError) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---------- Step B: Create notification record ----------
    const { data: notification, error: notifError } = await adminClient
      .from("notifications")
      .insert({
        user_id,
        title,
        body,
        type,
        data: data || null,
        is_read: false,
      })
      .select()
      .single();

    if (notifError) {
      return new Response(
        JSON.stringify({
          error: "Failed to create notification: " + notifError.message,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---------- Step C: Send push notification via Expo ----------
    let pushResult = null;

    if (userProfile.push_token) {
      // Validate that it looks like an Expo push token
      const token = userProfile.push_token;
      const isExpoToken =
        token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[");

      if (isExpoToken) {
        const pushPayload = {
          to: token,
          title,
          body,
          data: {
            ...data,
            notification_id: notification.id,
            type,
          },
          sound: "default",
        };

        try {
          const pushResponse = await fetch(EXPO_PUSH_URL, {
            method: "POST",
            headers: {
              "Accept": "application/json",
              "Accept-Encoding": "gzip, deflate",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(pushPayload),
          });

          pushResult = await pushResponse.json();
        } catch (pushErr) {
          console.error("Failed to send push notification:", pushErr);
          pushResult = { error: pushErr.message };
        }
      } else {
        console.warn(`Invalid push token format for user ${user_id}: ${token}`);
        pushResult = { error: "Invalid push token format" };
      }
    } else {
      pushResult = { skipped: true, reason: "No push token registered" };
    }

    // ---------- Response ----------
    return new Response(
      JSON.stringify({
        success: true,
        notificationId: notification.id,
        pushResult,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-notification error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
