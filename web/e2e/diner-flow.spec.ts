import { expect, test } from "@playwright/test";
import { mockApi } from "./mock-api";

test.describe("US-14 Results screen", () => {
  test("[ai] T2 e2e: the results page has no horizontal scroll at 375 px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockApi(page);
    await page.goto("/results/?r=r1");
    await expect(page.getByTestId("pick-card").first()).toBeVisible();
    await expect(page.getByText("The most-praised dish here, and you like it spicy.")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("[ai] T3 e2e: the fallback list is replaced when the LLM picks arrive", async ({ page }) => {
    await mockApi(page, { recommendDelayMs: 1500 });
    await page.goto("/results/?r=r1");
    await expect(page.getByTestId("results")).toHaveAttribute("data-mode", "fallback");
    await expect(page.getByTestId("pick-card")).toHaveCount(2);
    await expect(page.getByText("Finding the best picks for you")).toBeVisible();
    await expect(page.getByTestId("results")).toHaveAttribute("data-mode", "llm", { timeout: 5000 });
    await expect(page.getByText("Best dan dan noodles in town")).toBeVisible();
    await expect(page.getByText("Ask your server about ingredients")).toBeVisible();
  });
});

test.describe("US-02 Pick the restaurant I'm at", () => {
  test("[ai] T3 e2e: searching for an unknown name shows the scan-menu option", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");
    await page.getByRole("searchbox", { name: "Restaurant name" }).fill("zzz unknown diner");
    await expect(page.getByRole("link", { name: /Scan the menu/ })).toBeVisible();
    await page.getByRole("searchbox", { name: "Restaurant name" }).fill("noodle");
    await expect(page.getByRole("link", { name: /Test Noodle House/ })).toBeVisible();
  });
});

test.describe("US-15 Rate my meal", () => {
  test("[ai] T3 e2e: the rate flow completes in 3 taps", async ({ page }) => {
    let rating: unknown = null;
    await mockApi(page, { onRating: (b) => (rating = b) });
    await page.goto("/rate/?rec=rec1");
    await page.getByRole("button", { name: "Dan Dan Noodles" }).click(); // tap 1: which dish
    await page.getByRole("button", { name: "4 stars" }).click(); // tap 2: rating
    await page.getByRole("button", { name: "Submit" }).click(); // tap 3: submit
    await expect(page.getByText("Thanks! Your rating helps the next diner.")).toBeVisible();
    expect(rating).toEqual({ dishId: "d1", rating: 4 });
  });
});
