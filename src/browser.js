// Single long-lived headless Chromium that passes Ozon's anti-bot (Variti) challenge once
// and is reused for the whole process. Requests are issued as fetch() to Ozon's internal
// composer API from inside the page context — like an extension running in the open tab.
//
// Design (per researched best practices):
//  - lazy init: browser launches on first call, not at startup
//  - one browser + one context for the process; cookies live in the context
//  - page pool so concurrent fetches don't share window state
//  - browser 'disconnected' -> null refs -> transparent relaunch on next call
//  - context.route aborts images/fonts/media/css (we only need JS + JSON)
//  - idle timer (unref'd) closes the browser to free RAM; relaunches on demand
//  - all logs go to stderr (stdout is the MCP JSON-RPC wire)

import { chromium } from "playwright";

const HOME = "https://www.ozon.ru/";
const API = "https://www.ozon.ru/api/composer-api.bx/page/json/v2?url=";
const CHALLENGE_WAIT_MS = 12000; // time for the JS challenge to set cookies on first load
const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // close browser after 10 min idle
const NAV_TIMEOUT_MS = 90000;

const LAUNCH_ARGS = [
  "--disable-blink-features=AutomationControlled",
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--mute-audio",
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-extensions",
  "--disable-background-networking",
];
const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const log = (...a) => console.error("[browser]", ...a);

let browser = null;
let context = null;
let mainPage = null; // the page that passed the challenge; all fetches run from it (stays on ozon.ru)
let initPromise = null;
let challenged = false; // has the current context passed the challenge?
let idleTimer = null;

function resetIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    log("idle timeout — closing browser to free RAM");
    shutdown().catch(() => {});
  }, IDLE_TIMEOUT_MS);
  idleTimer.unref(); // never keep the process alive just for this timer
}

async function launch() {
  log("launching Chromium…");
  browser = await chromium.launch({ headless: true, args: LAUNCH_ARGS });
  browser.on("disconnected", () => {
    log("disconnected — will relaunch on next request");
    browser = null;
    context = null;
    mainPage = null;
    challenged = false;
  });

  context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: USER_AGENT,
    locale: "ru-RU",
  });

  // NOTE: do NOT block stylesheet/image/font/media here — the Variti anti-bot challenge
  // loads its scripts/assets through those request types, and aborting them makes the
  // challenge fail (Ozon then returns HTTP 403 to the composer API).
  challenged = false;
}

async function ensureContext() {
  if (context && challenged) return context;
  if (initPromise) {
    await initPromise;
    return context;
  }
  initPromise = (async () => {
    if (!browser || !browser.isConnected()) await launch();
    // Pass the anti-bot challenge once: load the home page, let its JS run and set cookies.
    // Keep this very page open — all fetches run from it, so they inherit the passed origin/session.
    mainPage = await context.newPage();
    log("passing anti-bot challenge…");
    await mainPage.goto(HOME, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
    await mainPage.waitForTimeout(CHALLENGE_WAIT_MS);
    const title = await mainPage.title();
    if (/antibot|ограничен|доступ/i.test(title)) {
      throw new Error(`challenge not passed (title: ${title})`);
    }
    challenged = true;
    log("challenge passed:", title.slice(0, 40));
  })();
  try {
    await initPromise;
  } finally {
    initPromise = null;
  }
  return context;
}

const DEAD = /Target page, context or browser has been closed|Session closed|Connection closed|browser has been closed/i;

/**
 * Fetch a composer-api page as parsed JSON for the given site path (e.g. "/search/?text=...").
 * Runs fetch() from the challenged main page (which stays on ozon.ru, so cookies + origin apply).
 * Pure fetch() with no navigation/DOM mutation is safe to run concurrently on one page.
 * Retries once on HTTP 403/307 (expired session) or a dead browser by relaunching.
 */
export async function fetchJson(path, { retries = 1 } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      resetIdle();
      await ensureContext();
      const body = await mainPage.evaluate(async (url) => {
        const r = await fetch(url, { headers: { accept: "application/json" } });
        return { status: r.status, text: await r.text() };
      }, API + encodeURIComponent(path));

      if (body.status !== 200) {
        if ((body.status === 403 || body.status === 307) && attempt < retries) {
          await shutdown(); // session expired → relaunch + re-challenge
          continue;
        }
        throw new Error(`Ozon returned HTTP ${body.status}`);
      }
      return JSON.parse(body.text);
    } catch (err) {
      if (DEAD.test(String(err?.message)) && attempt < retries) {
        await shutdown();
        continue;
      }
      throw err;
    }
  }
}

export async function shutdown() {
  clearTimeout(idleTimer);
  challenged = false;
  mainPage = null;
  try {
    await context?.close();
  } catch {}
  try {
    await browser?.close();
  } catch {}
  context = null;
  browser = null;
}
