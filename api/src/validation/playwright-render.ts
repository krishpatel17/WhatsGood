// Node-only: a headless Chromium that renders JavaScript menu pages for the importer (A2 v2).
// Local use only; a deployed Worker would need Cloudflare Browser Rendering instead.
import { type Browser, chromium } from "playwright-core";
import type { Render } from "../menu/render";

const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

/** Opens the page, waits for it to settle, scrolls so lazy sections load, and returns the rendered HTML. */
export function playwrightRender(opts: { timeoutMs?: number } = {}): Render & { close: () => Promise<void> } {
  const timeout = opts.timeoutMs ?? 30_000;
  let browser: Promise<Browser> | null = null;
  const render = (async (url: string) => {
    browser ??= chromium.launch();
    const page = await (await browser).newPage({ userAgent: USER_AGENT });
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout });
      for (let i = 0; i < 8; i++) {
        await page.mouse.wheel(0, 4000);
        await page.waitForTimeout(400);
      }
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
