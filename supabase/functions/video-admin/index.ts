// Staff-only video management for one workout:
//   create-upload  → one-time Mux upload link (the browser sends the file straight to Mux)
//   use-sample     → attach Mux's demo clip (for testing before real videos exist)
//   refresh        → ask Mux for the latest status
// Replacing a video deletes the old one from Mux (the free plan holds 10 videos).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { asServer, cors, json, staffRoles, serverError } from "../_shared/http.ts";
import { mux, SAMPLE_VIDEO_URL, syncWorkoutVideo } from "../_shared/mux.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const roles = await staffRoles(auth);
    if (!roles.some((r) => r === "admin" || r === "content_editor")) return json({ error: "Only content staff can manage videos." }, 403);

    const { action, workout_id, origin } = await req.json();
    if (typeof workout_id !== "string" || !/^[0-9a-f-]{36}$/.test(workout_id)) return json({ error: "workout_id required" }, 400);
    const w = await asServer(`workouts?id=eq.${workout_id}&select=id,title,slug,mux_upload_id,mux_asset_id`);
    const workout = w.data?.[0];
    if (!workout) return json({ error: "Workout not found" }, 404);

    const removeOld = async () => {
      if (workout.mux_asset_id) await mux(`/video/v1/assets/${workout.mux_asset_id}`, { method: "DELETE" });
    };
    const settings = {
      playback_policy: ["signed"],
      passthrough: workout.id,
      video_quality: "basic",
      meta: { title: workout.title, external_id: workout.slug },
    };

    if (action === "create-upload") {
      const allowed = typeof origin === "string" && /^https:\/\/[a-z0-9.-]+$|^http:\/\/localhost(:\d+)?$/.test(origin) ? origin : "*";
      await removeOld();
      const up = await mux("/video/v1/uploads", { method: "POST", body: JSON.stringify({ cors_origin: allowed, new_asset_settings: settings, timeout: 3600 }) });
      await asServer(`workouts?id=eq.${workout.id}`, {
        method: "PATCH",
        body: JSON.stringify({ mux_upload_id: up.data.id, mux_asset_id: null, mux_playback_id: null, video_status: "waiting", video_error: null, video_duration_sec: null }),
      });
      return json({ uploadUrl: up.data.url, uploadId: up.data.id });
    }

    if (action === "use-sample") {
      await removeOld();
      const a = await mux("/video/v1/assets", { method: "POST", body: JSON.stringify({ ...settings, inputs: [{ url: SAMPLE_VIDEO_URL }] }) });
      await asServer(`workouts?id=eq.${workout.id}`, {
        method: "PATCH",
        body: JSON.stringify({ mux_upload_id: null, mux_asset_id: a.data.id, mux_playback_id: null, video_status: "processing", video_error: null }),
      });
      return json({ assetId: a.data.id, video_status: "processing" });
    }

    if (action === "refresh") return json(await syncWorkoutVideo(workout));

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error(e);
    return serverError("video-admin", e);
  }
});
