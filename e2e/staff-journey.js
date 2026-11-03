// Live browser checks for admin and creator logins against the dev database.
// Test logins: e2e-parent@ (family), e2e-admin@ (content editor), e2e-creator@ (guardian of "Junior Coach Pip").
// Run: E2E_PASSWORD=... node e2e/staff-journey.js   (web app on :3100, or BASE_URL=...)
const chromium = require("@sparticuz/chromium").default ?? require("@sparticuz/chromium");
const puppeteer = require("puppeteer-core");
const B = process.env.BASE_URL ?? "http://localhost:3100";
const PW = process.env.E2E_PASSWORD;
if (!PW) throw new Error("Set E2E_PASSWORD first");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);

(async () => {
  const launch = async () => puppeteer.launch({
    args: [...chromium.args, `--proxy-server=${process.env.HTTPS_PROXY}`, "--ignore-certificate-errors"],
    executablePath: await chromium.executablePath(), headless: true,
  });
  const errs = [];

  // A fresh browser per person, so sign-ins never leak between them.
  async function as(email, fn) {
    const browser = await launch();
    const page = await browser.newPage();
    page.on("pageerror", (e) => errs.push(String(e)));
    await page.setViewport({ width: 1280, height: 900 });
    const waitText = async (t, ms = 25000) => { try { await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout: ms }, t); return true; } catch { return false; } };
    const text = () => page.evaluate(() => document.body.innerText);
    const click = (t, sel = "button, a") => page.evaluate((t, sel) => { const el = [...document.querySelectorAll(sel)].find((e) => e.textContent.trim().includes(t)); if (!el) return false; el.click(); return true; }, t, sel);
    await page.goto(B + "/account/sign-in/?next=/admin/content/", { waitUntil: "networkidle0" });
    await page.type("#email", email); await page.type("#password", PW);
    await click("Sign in", "button");
    try { await fn({ page, waitText, text, click }); } finally { await browser.close(); }
  }

  // 1. A family account can't get into admin or the creator portal.
  await as("e2e-parent@gfit.test", async ({ page, waitText }) => {
    check("family login: admin blocked", await waitText("No admin access"));
    await page.goto(B + "/creator/", { waitUntil: "networkidle0" });
    check("family login: creator portal blocked", await waitText("No creator access"));
  });

  // 2. Content editor: real catalogue, publish gate, rights checklist saved + audited.
  await as("e2e-admin@gfit.test", async ({ page, waitText, text, click }) => {
    check("staff login lands on content approval", await waitText("Superhero Training Camp"), page.url());
    const t = await text();
    check("real catalogue loaded (24 workouts)", /published \(2\d\)/.test(t) || t.includes("published (21)"), (t.match(/published \(\d+\)/) || [""])[0]);
    check("staff email shown", t.includes("e2e-admin@gfit.test"));
    // Superhero Training Camp is approved but music isn't cleared: Publish must be disabled.
    const disabled = await page.evaluate(() => {
      const row = [...document.querySelectorAll("tr")].find((r) => r.textContent.includes("Superhero Training Camp"));
      const b = row && [...row.querySelectorAll("button")].find((x) => x.textContent.trim() === "Publish");
      return b ? b.disabled : null;
    });
    check("publish blocked while music not cleared", disabled === true, String(disabled));
    // The database itself refuses too (not just the button).
    const apiErr = await page.evaluate(async () => {
      const key = Object.keys(localStorage).find((k) => k.startsWith("sb-") && k.endsWith("-auth-token"));
      const tok = JSON.parse(localStorage.getItem(key)).access_token;
      const r = await fetch("https://iwwnexttdqksrwqafazi.supabase.co/rest/v1/workouts?slug=eq.superhero-training-camp", {
        method: "PATCH", headers: { apikey: "sb_publishable_wk7bojwHFpsZlOBqOcCFPA_os_1w4z6", Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify({ state: "published" }),
      });
      return (await r.text()).slice(0, 200);
    });
    check("database refuses publishing without music rights", apiErr.includes("music rights not cleared"), apiErr.slice(0, 80));
    // Tick then untick "music cleared" — both saved and audited.
    await click("Superhero Training Camp", "button"); await sleep(400);
    const toggle = () => page.evaluate(() => { const l = [...document.querySelectorAll("label")].find((x) => x.textContent.includes("Music sync")); l.querySelector("input").click(); });
    await toggle();
    check("rights change saved to database", await waitText("Music sync & master rights cleared = true (saved"));
    await sleep(800); await toggle();
    check("rights change reverted", await waitText("= false (saved"));
  });

  // 3. Creator (guardian) login: own record only.
  await as("e2e-creator@gfit.test", async ({ page, waitText, text, click }) => {
    check("creator login: admin blocked, offered creator portal", await waitText("Go to creator portal"));
    await click("Go to creator portal");
    check("creator sees own portal", await waitText("Hi, Junior Coach Pip"));
    await waitText("First Touch Footwork");
    const t = await text();
    check("guardian-managed notice shown", t.includes("managed by a parent or guardian"));
    check("lists own workouts only", t.includes("First Touch Footwork") && !t.includes("Wall Pilates"));
    check("no household or child data on page", !t.includes("Leo") && !t.includes("e2e-parent"));
  });

  console.log(results.join("\n"));
  console.log("page errors:", JSON.stringify(errs.slice(0, 5)));
})().catch((e) => { console.log(results.join("\n")); console.log("CRASH", e.message); process.exit(1); });
