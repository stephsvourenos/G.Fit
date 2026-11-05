// Phone app (web build) against the dev database: sign-in, real profiles, server PIN,
// and server permission to play. Native video playback itself needs a real phone.
// Run: E2E_PASSWORD=... node e2e/mobile-journey.js   (web build served on :3200 or MOBILE_URL)
const chromium = require("@sparticuz/chromium").default ?? require("@sparticuz/chromium");
const puppeteer = require("puppeteer-core");
const B = process.env.MOBILE_URL ?? "http://localhost:3200";
const PW = process.env.E2E_PASSWORD;
if (!PW) throw new Error("Set E2E_PASSWORD");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);

(async () => {
  const browser = await puppeteer.launch({
    args: [...chromium.args, `--proxy-server=${process.env.HTTPS_PROXY}`, "--ignore-certificate-errors"],
    executablePath: await chromium.executablePath(), headless: true,
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  const grants = [];
  page.on("response", async (r) => {
    if (r.url().includes("/functions/v1/playback-token") && r.request().method() === "POST") { try { grants.push(await r.json()); } catch {} }
  });
  const waitText = async (t, ms = 30000) => { try { await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout: ms }, t); return true; } catch { return false; } };
  const tap = (t) => page.evaluate((t) => { const el = [...document.querySelectorAll("[role=button], button, div[tabindex]")].reverse().find((e) => e.textContent.trim() === t || e.getAttribute("aria-label") === t); if (!el) return false; el.click(); return true; }, t);
  try {
    await page.goto(B, { waitUntil: "networkidle0" });
    check("signed-out phone shows sign-in", await waitText("Use your family’s household account"));
    await page.type("input[aria-label=Email]", "e2e-parent@gfit.test");
    await page.type("input[aria-label=Password]", "wrong-password");
    await tap("Sign in");
    check("wrong password is refused", await waitText("don’t match"));
    await page.click("input[aria-label=Password]", { clickCount: 3 });
    await page.evaluate(() => { const i = document.querySelector("input[aria-label=Password]"); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(i, ""); i.dispatchEvent(new Event("input", { bubbles: true })); });
    await page.type("input[aria-label=Password]", PW);
    await tap("Sign in");
    check("real family profiles load after sign-in", await waitText("Who’s moving today?") && await waitText("Leo") && await waitText("Sam"));
    // Adult profile: wrong PIN refused by the server, right PIN accepted.
    await tap("Open Sam"); await sleep(500);
    for (const d of "1111") { await tap(d); await sleep(120); }
    check("wrong PIN refused by the server", await waitText("didn’t match", 15000));
    for (const d of "4826") { await tap(d); await sleep(120); }
    check("right PIN opens the adult profile", await waitText("Hi Sam", 15000));
    // Child profile + a workout with a real video: the server grants signed playback and opens a session.
    // Navigate inside the app (a page reload would forget the open profile, as a phone never does).
    const go = (path) => page.evaluate((path) => { history.pushState({}, "", path); dispatchEvent(new PopStateEvent("popstate")); }, path);
    await go("/");
    await waitText("Leo"); await tap("Open Leo");
    await waitText("Hi Leo", 15000);
    await go("/play/wk-jungle-animal-moves");
    await sleep(5000);
    const g = grants.at(-1) ?? {};
    check("server grants signed playback to the child", g.allowed === true && g.video === true && !!g.sessionId, JSON.stringify({ allowed: g.allowed, video: g.video, session: g.sessionId }));
    check("player screen shows", await waitText("Jungle Animal Moves", 10000));
    await go("/play/wk-core-strength-for-young-athletes");
    check("child can't open a teen workout", await waitText("isn’t available on this profile", 15000));
  } finally {
    await browser.close();
  }
  console.log(results.join("\n"));
})().catch((e) => { console.log(results.join("\n")); console.log("CRASH", e.message); process.exit(1); });
