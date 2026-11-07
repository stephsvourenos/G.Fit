// Where Stripe may send people back to after checkout. Never trust an arbitrary origin.
const DEFAULT = ["https://g-fit-liard.vercel.app", "http://localhost:3000", "http://localhost:3100"];
const EXTRA = (Deno.env.get("SITE_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const ALLOWED = new Set([...DEFAULT, ...EXTRA]);

export function safeOrigin(o: unknown): string {
  return typeof o === "string" && ALLOWED.has(o) ? o : DEFAULT[0];
}
