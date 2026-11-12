// Node-only: a headless Chromium that renders JavaScript menu pages for the importer (A2 v2).
// Local use only; a deployed Worker would need Cloudflare Browser Rendering instead.
import { type Browser, chromium } from "playwright-core";
import type { Render } from "../menu/render";
import { scrollUntilEnd } from "../menu/scroll";

const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

/** Opens the page, waits for it to settle, scrolls a screen at a time so lazy sections load, and returns the rendered HTML. */
// Some hosts (Toast) keep polling and never reach "networkidle"; for those pass
// waitUntil "domcontentloaded" plus settleMs so the client app has time to draw the menu.
export function playwrightRender(
  opts: { timeoutMs?: number; waitUntil?: "networkidle" | "domcontentloaded" | "load"; settleMs?: number } = {},
): Render & { close: () => Promise<void> } {
  const timeout = opts.timeoutMs ?? 30_000;
  const waitUntil = opts.waitUntil ?? "networkidle";
  let browser: Promise<Browser> | null = null;
  const render = (async (url: string) => {
    browser ??= chromium.launch();
    const page = await (await browser).newPage({ userAgent: USER_AGENT });
    try {
      const res = await page.goto(url, { waitUntil, timeout });
      if (opts.settleMs) {
        // Bot-blocked (e.g. Toast 403 to headless browsers): fail fast instead of waiting on an error page.
        if (res && res.status() >= 400) throw new Error(`HTTP ${res.status()}`);
        await page.waitForTimeout(opts.settleMs);
      }
      await scrollUntilEnd({
        // In-page code as strings: this package's types have no browser globals.
        scrollBy: () => page.evaluate("window.scrollBy(0, window.innerHeight * 0.8)").then(() => {}),
        atBottom: () => page.evaluate("window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2").then(Boolean),
        wait: (ms) => page.waitForTimeout(ms),
      });
      return { html: await page.content(), finalUrl: page.url() };
    } finally {
      await page.close();
    }
  }) as Render & { close: () => Promise<void> };
  render.close = async () => {
    if (browser) await (await browser).close();
  };
  return render;
}
