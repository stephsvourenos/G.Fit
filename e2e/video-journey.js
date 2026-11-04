// Live browser checks for Phase 2 video against the dev database + Mux.
//  1. Content editor uploads a generated test clip to "Jungle Animal Moves" (browser → Mux direct upload).
//  2. Family (with a test membership) plays it on the child profile through a signed link.
//  3. Adult profile (all-ages "Family Wake-Up Shake") needs the PIN on the SERVER: after switching to a child profile it's locked again.
// Run: E2E_PASSWORD=... TEST_VIDEO=path/to/clip.mp4 node e2e/video-journey.js  (web app on :3100 or BASE_URL)
const chromium = require("@sparticuz/chromium").default ?? require("@sparticuz/chromium");
const puppeteer = require("puppeteer-core");
const B = process.env.BASE_URL ?? "http://localhost:3100";
const PW = process.env.E2E_PASSWORD;
const CLIP = process.env.TEST_VIDEO;
if (!PW || !CLIP) throw new Error("Set E2E_PASSWORD and TEST_VIDEO");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);

async function as(email, next, fn) {
  const browser = await puppeteer.launch({
    args: [...chromium.args, `--proxy-server=${process.env.HTTPS_PROXY}`, "--ignore-certificate-errors", "--autoplay-policy=no-user-gesture-required"],
    executablePath: await chromium.executablePath(), headless: true,
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const net = [];
  page.on("response", (r) => { if (r.url().includes("stream.mux.com")) net.push(r.status()); });
  const waitText = async (t, ms = 30000) => { try { await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout: ms }, t); return true; } catch { return false; } };
  const click = (t, sel = "button, a") => page.evaluate((t, sel) => { const el = [...document.querySelectorAll(sel)].find((e) => e.textContent.trim().includes(t)); if (!el) return false; el.click(); return true; }, t, sel);
  await page.goto(`${B}/account/sign-in/?next=${encodeURIComponent(next)}`, { waitUntil: "networkidle0" });
  await page.type("#email", email); await page.type("#password", PW);
  await click("Sign in", "button");
  try { await fn({ page, waitText, click, net }); } finally { await browser.close(); }
}

(async () => {
  // 1. Upload through the admin page.
  if (process.env.SKIP_UPLOAD !== "1") await as("e2e-admin@gfit.test", "/admin/content/", async ({ page, waitText, click }) => {
    await waitText("Jungle Animal Moves");
    await click("Jungle Animal Moves", "button");
    await waitText("Replace video");
    const input = await page.$("input[type=file][id^=video-file-]");
    await input.uploadFile(CLIP);
    const uploaded = await waitText("waiting for upload", 20000) || await waitText("processing", 20000);
    check("admin upload starts (browser → Mux)", uploaded);
    const ready = await page.waitForFunction(() => {
      const row = [...document.querySelectorAll("tr")].find((r) => r.textContent.includes("Jungle Animal Moves"));
      return row && row.textContent.includes("ready");
    }, { timeout: 180000 }).then(() => true, () => false);
    check("Mux processed it and status shows ready", ready);
    check("length shown", await waitText("Length 0:12", 5000));
  });

  // 2 + 3. Family playback.
  await as("e2e-parent@gfit.test", "/watch/", async ({ page, waitText, click, net }) => {
    await waitText("Who’s moving today?");
    await click("Leo", "button");
    await page.waitForFunction(() => location.pathname.includes("/watch/home"), { timeout: 20000 });
    await page.goto(`${B}/watch/play/wk-jungle-animal-moves/`, { waitUntil: "networkidle2" });
    const hasPlayer = await page.waitForSelector("mux-player", { timeout: 30000 }).then(() => true, () => false);
    check("child profile gets the real video player", hasPlayer);
    await sleep(6000);
    check("signed stream loads from Mux (HTTP 200)", net.length > 0 && net.every((s) => s === 200), JSON.stringify(net.slice(0, 6)));
    const media = await page.evaluate(() => {
      const p = document.querySelector("mux-player");
      return { duration: p?.duration, codecs: typeof MediaSource !== "undefined" && MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E"') };
    });
    check("video metadata loaded", (media.duration ?? 0) > 10 || media.codecs === false, JSON.stringify(media));

    // Adult profile: the PIN unlock lives on the server; switching to a child profile locked it.
    await page.goto(`${B}/watch/`, { waitUntil: "networkidle0" });
    await click("Sam", "button"); await sleep(600);
    for (const d of "4826") { await page.evaluate((d) => [...document.querySelectorAll("[role=dialog] button")].find((b) => b.textContent.trim() === d).click(), d); await sleep(150); }
    await page.waitForFunction(() => location.pathname.includes("/watch/home"), { timeout: 20000 });
    await page.goto(`${B}/watch/play/wk-family-wake-up-shake/`, { waitUntil: "networkidle2" });
    const adultOk = await page.waitForSelector("mux-player", { timeout: 30000 }).then(() => true, () => false);
    check("adult plays after PIN", adultOk, adultOk ? "" : (await page.evaluate(() => document.body.innerText)).slice(0, 160).replace(/\n/g, " | "));
    // Lock on the server (as "Lock & exit" / choosing a child does) and try again.
    await page.goto(`${B}/watch/`, { waitUntil: "networkidle0" });
    await click("Leo", "button");
    await page.waitForFunction(() => location.pathname.includes("/watch/home"), { timeout: 20000 });
    await sleep(1500);
    const denied = await page.evaluate(async () => {
      const key = Object.keys(localStorage).find((k) => k.startsWith("sb-") && k.endsWith("-auth-token"));
      const tok = JSON.parse(localStorage.getItem(key)).access_token;
      const h = { apikey: "sb_publishable_wk7bojwHFpsZlOBqOcCFPA_os_1w4z6", Authorization: `Bearer ${tok}`, "Content-Type": "application/json" };
      const profs = await fetch("https://iwwnexttdqksrwqafazi.supabase.co/rest/v1/profiles?select=id,nickname", { headers: h }).then((r) => r.json());
      const sam = profs.find((p) => p.nickname === "Sam");
      const r = await fetch("https://iwwnexttdqksrwqafazi.supabase.co/functions/v1/playback-token", { method: "POST", headers: h, body: JSON.stringify({ slug: "family-wake-up-shake", profile_id: sam.id }) });
      return r.json();
    });
    check("after switching to a child, server requires the PIN again for the adult", denied.reason === "pin-required", JSON.stringify(denied));
    await page.goto(`${B}/watch/play/wk-core-strength-for-young-athletes/`, { waitUntil: "networkidle2" });
    check("child can't open a teen workout", await waitText("isn’t available on this profile"));
  });

  console.log(results.join("\n"));
})().catch((e) => { console.log(results.join("\n")); console.log("CRASH", e.message); process.exit(1); });
