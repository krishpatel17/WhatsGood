// Ordering sites load each menu section as the reader scrolls to it (A2 v4). Big jumps skip
// sections, so the renderer scrolls one screen at a time until the page stops growing.

export type Scroller = {
  /** Scroll down by most of one screen. */
  scrollBy: () => Promise<void>;
  atBottom: () => Promise<boolean>;
  wait: (ms: number) => Promise<void>;
};

export async function scrollUntilEnd(s: Scroller, opts: { maxSteps?: number; pauseMs?: number; settleMs?: number } = {}): Promise<void> {
  const { maxSteps = 60, pauseMs = 500, settleMs = 1500 } = opts;
  for (let i = 0; i < maxSteps; i++) {
    await s.scrollBy();
    await s.wait(pauseMs);
    if (await s.atBottom()) {
      // Give a lazy section time to load; if the page grew, keep going.
      await s.wait(settleMs);
      if (await s.atBottom()) return;
    }
  }
}
