import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const weatherApiKey = Deno.env.get("WEATHER_API_KEY");
    if (!weatherApiKey) {
      throw new Error("Missing WEATHER_API_KEY environment variable");
    }

    // Default coordinates for the Bakyard venue
    // Override with VENUE_LAT / VENUE_LON env vars if needed
    const lat = Deno.env.get("VENUE_LAT") || "33.4484";
    const lon = Deno.env.get("VENUE_LON") || "-112.0740";

    const adminClient = createAdminClient();

    // ---------- Step A: Query today's sessions without weather data ----------
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const { data: sessions, error: sessionsError } = await adminClient
      .from("sessions")
      .select("id, starts_at")
      .gte("starts_at", todayStart.toISOString())
      .lte("starts_at", todayEnd.toISOString())
      .is("weather_snapshot", null)
      .in("status", ["open", "full"]);

    if (sessionsError) {
      throw new Error("Failed to fetch sessions: " + sessionsError.message);
    }

    if (!sessions || sessions.length === 0) {
      return new Response(
        JSON.stringify({ message: "No sessions need weather updates", updated: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---------- Step B: Fetch weather from OpenWeatherMap ----------
    // Use the current weather endpoint for today's conditions.
    // For sessions later in the day, we fetch the forecast and pick the
    // closest time-slice.
    const currentWeatherUrl =
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${weatherApiKey}&units=imperial`;

    const forecastUrl =
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${weatherApiKey}&units=imperial`;

    const [currentRes, forecastRes] = await Promise.all([
      fetch(currentWeatherUrl),
      fetch(forecastUrl),
    ]);

    if (!currentRes.ok) {
      throw new Error(
        `Weather API error: ${currentRes.status} ${currentRes.statusText}`
      );
    }

    const currentWeather = await currentRes.json();
    const forecastData = forecastRes.ok ? await forecastRes.json() : null;

    // ---------- Step C: Update each session ----------
    let updatedCount = 0;

    for (const session of sessions) {
      const sessionTime = new Date(session.starts_at);
      const nowMs = Date.now();
      const sessionMs = sessionTime.getTime();

      let weatherSnapshot;

      // If the session is within the next 2 hours, use current weather.
      // Otherwise, try to find the closest forecast entry.
      if (sessionMs - nowMs < 2 * 60 * 60 * 1000) {
        weatherSnapshot = {
          temp: Math.round(currentWeather.main?.temp ?? 0),
          condition: currentWeather.weather?.[0]?.main ?? "Unknown",
          wind: Math.round(currentWeather.wind?.speed ?? 0),
          icon: currentWeather.weather?.[0]?.icon ?? "01d",
        };
      } else if (forecastData?.list) {
        // Find the forecast entry closest to session start
        let closest = forecastData.list[0];
        let closestDiff = Math.abs(
          new Date(closest.dt * 1000).getTime() - sessionMs
        );

        for (const entry of forecastData.list) {
          const diff = Math.abs(
            new Date(entry.dt * 1000).getTime() - sessionMs
          );
          if (diff < closestDiff) {
            closest = entry;
            closestDiff = diff;
          }
        }

        weatherSnapshot = {
          temp: Math.round(closest.main?.temp ?? 0),
          condition: closest.weather?.[0]?.main ?? "Unknown",
          wind: Math.round(closest.wind?.speed ?? 0),
          icon: closest.weather?.[0]?.icon ?? "01d",
        };
      } else {
        // Fallback to current weather if forecast is unavailable
        weatherSnapshot = {
          temp: Math.round(currentWeather.main?.temp ?? 0),
          condition: currentWeather.weather?.[0]?.main ?? "Unknown",
          wind: Math.round(currentWeather.wind?.speed ?? 0),
          icon: currentWeather.weather?.[0]?.icon ?? "01d",
        };
      }

      const { error: updateError } = await adminClient
        .from("sessions")
        .update({ weather_snapshot: weatherSnapshot })
        .eq("id", session.id);

      if (updateError) {
        console.error(
          `Failed to update weather for session ${session.id}:`,
          updateError.message
        );
      } else {
        updatedCount++;
      }
    }

    // ---------- Response ----------
    return new Response(
      JSON.stringify({
        message: `Weather updated for ${updatedCount} sessions`,
        updated: updatedCount,
        total: sessions.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("sync-weather error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
