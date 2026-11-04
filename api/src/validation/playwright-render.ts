// Node-only: a headless Chromium that renders JavaScript menu pages for the importer (A2 v2).
// Local use only; a deployed Worker would need Cloudflare Browser Rendering instead.
import { type Browser, chromium } from "playwright-core";
import type { Render } from "../menu/render";
import { scrollUntilEnd } from "../menu/scroll";

const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

/** Opens the page, waits for it to settle, scrolls a screen at a time so lazy sections load, and returns the rendered HTML. */
export function playwrightRender(opts: { timeoutMs?: number } = {}): Render & { close: () => Promise<void> } {
  const timeout = opts.timeoutMs ?? 30_000;
  let browser: Promise<Browser> | null = null;
  const render = (async (url: string) => {
    browser ??= chromium.launch();
    const page = await (await browser).newPage({ userAgent: USER_AGENT });
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout });
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
