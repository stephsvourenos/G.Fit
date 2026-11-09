import { supabase, supabaseConfigured } from "@/lib/supabase";

let sent = 0;

/** Short crash report to Admin → System health (message + screen only, no personal data; max 5 per app launch). */
export function reportError(message: string, where?: string) {
  if (!supabaseConfigured || sent >= 5) return;
  sent += 1;
  void supabase().rpc("report_client_error", { p_source: "mobile", p_message: message.slice(0, 300), p_where: where ?? null }).then(() => undefined, () => undefined);
}

/** Catch crashes the screens don't handle, report them, then let React Native carry on as normal. */
export function installErrorReporter() {
  const g = globalThis as unknown as { ErrorUtils?: { getGlobalHandler: () => (e: Error, fatal?: boolean) => void; setGlobalHandler: (h: (e: Error, fatal?: boolean) => void) => void }; __gfitErrors?: boolean };
  if (!g.ErrorUtils || g.__gfitErrors) return;
  g.__gfitErrors = true;
  const previous = g.ErrorUtils.getGlobalHandler();
  g.ErrorUtils.setGlobalHandler((e, fatal) => {
    reportError(`${fatal ? "Fatal: " : ""}${e?.message ?? String(e)}`);
    previous(e, fatal);
  });
}
