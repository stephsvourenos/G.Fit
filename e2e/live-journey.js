// Live end-to-end journey against the dev Supabase project (gfit-dev-sydney).
// Needs: a confirmed test parent e2e-parent@gfit.test, the web app on :3100,
// and puppeteer-core + @sparticuz/chromium installed. RESET=1 first deletes the
// test family through the app. Run: E2E_PASSWORD=... RESET=1 node e2e/live-journey.js
const chromium = require("@sparticuz/chromium").default ?? require("@sparticuz/chromium");
const puppeteer = require("puppeteer-core");
const B = "http://localhost:3100";
const EMAIL = "e2e-parent@gfit.test";
const PW = process.env.E2E_PASSWORD; // never commit the test password
if (!PW) throw new Error("Set E2E_PASSWORD (and run the web app on port 3100) first");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, extra = "") => { results.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };

(async () => {
  const browser = await puppeteer.launch({
    args: [...chromium.args, `--proxy-server=${process.env.HTTPS_PROXY}`, "--ignore-certificate-errors"],
    executablePath: await chromium.executablePath(), headless: true,
  });
  const page = await browser.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  await page.setViewport({ width: 1280, height: 860 });
  const text = () => page.evaluate(() => document.body.innerText);
  const clickText = async (t, sel = "button, a") => {
    const ok = await page.evaluate((t, sel) => {
      const el = [...document.querySelectorAll(sel)].find((e) => e.textContent.trim().includes(t));
      if (el) { el.click(); return true; } return false;
    }, t, sel);
    if (!ok) throw new Error("not found: " + t);
  };
  const clickExact = (d) => page.evaluate((d) => [...document.querySelectorAll("[role=dialog] button")].find((b) => b.textContent.trim() === d).click(), d);
  const shot = (n) => page.screenshot({ path: `e2e-${n}.png` });
  const waitText = async (t, ms = 20000) => {
    try { await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout: ms }, t); return true; } catch { return false; }
  };
  const waitUrl = async (part, ms = 20000) => {
    try { await page.waitForFunction((p) => location.href.includes(p), { timeout: ms }, part); return true; } catch { return false; }
  };

  // Reset from any earlier run, through the app itself: PIN → Family account → Delete household data.
  if (process.env.RESET === "1") {
    await page.goto(B + "/account/sign-in/", { waitUntil: "networkidle0" });
    await page.type("#email", EMAIL); await page.type("#password", PW);
    await clickText("Sign in", "button");
    await waitText("Who’s moving today?", 30000);
    await clickText("Family account & billing", "button"); await sleep(600);
    for (const d of "4826") { await clickExact(d); await sleep(120); }
    await waitText("Delete household data", 20000);
    await clickText("Delete household data", "button"); await sleep(300);
    await clickText("Delete everything", "button");
    let left = false;
    try { await page.waitForFunction(() => !location.pathname.startsWith("/watch"), { timeout: 20000 }); left = true; } catch {}
    check("delete household data via the app signs out and leaves", left, page.url());
    await sleep(2000);
  }

  // Signed-out visit goes to sign-in
  await page.goto(B + "/watch/", { waitUntil: "networkidle0" });
  check("signed-out visitor sent to sign-in", await waitUrl("/account/sign-in"), page.url());

  // Wrong password
  await page.type("#email", EMAIL); await page.type("#password", "wrong-password-123");
  await clickText("Sign in", "button");
  check("wrong password shows friendly error", await waitText("don’t match"));

  // Right password
  await page.focus("#password"); for (let i = 0; i < 40; i++) await page.keyboard.press("Backspace");
  await page.type("#password", PW);
  await clickText("Sign in", "button");
  check("sign in → set PIN screen", await waitText("Set your parent PIN", 30000), page.url());
  await shot("1-set-pin");

  // Weak PIN rejected, good PIN saved
  await page.type("#pin", "1111"); await page.type("#pin-again", "1111");
  await clickText("Save PIN", "button"); await sleep(800);
  check("obvious PIN rejected", (await text()).includes("harder to guess"));
  for (const id of ["#pin", "#pin-again"]) { await page.focus(id); for (let i = 0; i < 6; i++) await page.keyboard.press("Backspace"); }
  const cleared = await page.evaluate(() => document.querySelector("#pin").value + document.querySelector("#pin-again").value);
  if (cleared !== "") throw new Error("PIN boxes did not clear: " + cleared.length);
  await page.type("#pin", "4826"); await page.type("#pin-again", "4826");
  await clickText("Save PIN", "button");
  check("PIN saved → add family prompt", await waitText("Add your family"));
  await shot("2-add-family");

  // Add profiles
  await clickText("Add profiles"); await waitText("+ Add a profile");
  for (const [name, band] of [["Sam", "adult"], ["Leo", "under-6"]]) {
    await clickText("+ Add a profile", "button"); await sleep(400);
    await page.type("input[placeholder^='e.g.']", name);
    await page.select("select", band);
    await clickText("Save profile", "button"); await waitText(name + "\n"); await waitText("+ Add a profile");
  }
  const t1 = await text();
  check("two profiles saved", t1.includes("Sam") && t1.includes("Leo") && t1.includes("PIN protected"));
  await shot("3-profiles");

  // Back to picker, open child profile
  await clickText("Done — back"); await waitText("Who’s moving today?");
  await clickText("Leo", "button");
  check("child profile opens home", await waitUrl("/watch/home"), page.url());
  await waitText("Jungle Animal Moves");
  const home = await text();
  check("child sees age-appropriate catalogue", home.includes("Jungle Animal Moves") && !home.includes("Wall Pilates: Legs"));
  await shot("4-child-home");

  // Workout detail: no membership yet → locked; favourite saves
  await page.goto(B + "/watch/workout/wk-jungle-animal-moves/", { waitUntil: "networkidle0" }); await waitText("Videos unlock once");
  const det = await text();
  check("video locked until membership", det.includes("Videos unlock once"));
  await clickText("♡ Save", "button");
  check("favourite toggled", await waitText("♥ Saved"));
  await sleep(2000);
  await shot("5-detail");

  // Reload: still signed in; adult profile needs PIN
  await page.goto(B + "/watch/", { waitUntil: "networkidle0" });
  check("session survives reload", await waitText("Who’s moving today?"));
  await page.evaluate(() => sessionStorage.clear()); // forget the PIN unlock, like a new visit
  await clickText("Sam", "button"); await sleep(800);
  const dlg = await page.$("[role=dialog]");
  check("adult profile asks for PIN", !!dlg);
  for (const d of "1111") { await clickExact(d); await sleep(120); }
  check("wrong PIN rejected by server", await waitText("didn’t match"));
  for (const d of "4826") { await clickExact(d); await sleep(120); }
  check("right PIN opens adult profile", await waitUrl("/watch/home"), page.url());
  await shot("5b-after-pin");

  // Family account: export
  await page.goto(B + "/watch/account/", { waitUntil: "networkidle0" }); await waitText("Show my household data");
  await clickText("Show my household data", "button");
  const exp = await waitText('"nickname": "Leo"');
  const acct = await text();
  check("export shows own data, favourite saved", exp && acct.includes('"favourites"') && acct.includes("e2e-parent@gfit.test"));
  await shot("6-account");

  // Sign out
  await clickText("Sign out", "button"); await sleep(2500);
  await page.goto(B + "/watch/", { waitUntil: "networkidle0" });
  check("signed out", await waitUrl("/account/sign-in"), page.url());

  console.log(results.join("\n"));
  console.log("browser errors:", JSON.stringify(errs.filter((e) => !e.includes("favicon")).slice(0, 8)));
  await browser.close();
})().catch((e) => { console.log(results.join("\n")); console.log("CRASH", e.message); process.exit(1); });
