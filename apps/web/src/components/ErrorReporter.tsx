"use client";

import { useEffect } from "react";
import { supabase, supabaseConfigured } from "@/lib/supabase";

let sent = 0;

/** Send a short crash report to Admin → System health. Message + page path only (no personal data); max 5 per page load. */
export function reportError(message: string, where?: string) {
  if (!supabaseConfigured || sent >= 5) return;
  sent += 1;
  void supabase().rpc("report_client_error", { p_source: "web", p_message: message.slice(0, 300), p_where: where ?? window.location.pathname });
}

/** Listens for crashes anywhere on the website. */
export function ErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      // Ignore noise from browser extensions and cross-origin scripts ("Script error.").
      if (!e.message || e.message === "Script error." || (e.filename && !e.filename.startsWith(window.location.origin))) return;
      reportError(e.message);
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const m = e.reason instanceof Error ? e.reason.message : String(e.reason ?? "");
      if (m && !/AbortError|Failed to fetch|Load failed|NetworkError/i.test(m)) reportError(`Unhandled: ${m}`);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
