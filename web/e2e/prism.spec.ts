import { test, expect } from "@playwright/test";
import { mockApi, API, fallback } from "./mock-api";
for (const width of [390, 1280]) {
  test(`[ai] Prism flow and dialog accessibility at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await mockApi(page);
    await page.goto("/results/?r=r1");
    await expect(page.getByTestId("results")).toHaveAttribute(
      "data-mode",
      "llm",
    );
    await expect(page.getByText("Fits profile:").first()).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`results-${width}.png`),
      fullPage: true,
    });
    const profile = page.getByRole("button", { name: /My profile/ });
    await profile.click();
    const dialog = page.getByRole("dialog", { name: "Your profile" });
    await expect(dialog.getByRole("spinbutton")).toHaveValue("25");
    await dialog.getByRole("checkbox", { name: "dairy", exact: true }).check();
    await dialog.getByRole("spinbutton").focus();
    await dialog.getByRole("spinbutton").fill("20");
    const budgetBox = await dialog.getByRole("spinbutton").boundingBox();
    const footerBox = await dialog
      .getByRole("button", { name: /Apply Filters/ })
      .boundingBox();
    expect(budgetBox!.y + budgetBox!.height).toBeLessThan(footerBox!.y);
    await expect(
      dialog.getByRole("button", { name: /Apply Filters • Under \$20/ }),
    ).toBeEnabled();
    await page.screenshot({
      path: testInfo.outputPath(`profile-${width}.png`),
      fullPage: false,
    });
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(profile).toBeFocused();
    await page.getByRole("button", { name: "Scan Menu", exact: true }).click();
    const scanner = page.getByRole("dialog", { name: "Scan the menu" });
    await scanner.getByRole("button", { name: "Web or PDF link" }).click();
    await expect(scanner.getByLabel("Menu page or PDF URL")).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`scanner-${width}.png`),
      fullPage: false,
    });
    await page.keyboard.press("Escape");
    await page.goto("/");
    await page.getByRole("searchbox").fill("noodle");
    await expect(
      page.getByRole("link", { name: /Test Noodle House/ }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`restaurants-${width}.png`),
      fullPage: true,
    });
  });
}
test("[ai] final fallback contains no generated blocks and no perpetual loader", async ({
  page,
}, testInfo) => {
  await mockApi(page);
  await page.route(`${API}/restaurants/r1/recommend`, (route) =>
    route.fulfill({ json: fallback }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/results/?r=r1");
  await expect(
    page.getByText("Your menu matches, ranked by review sentiment."),
  ).toBeVisible();
  await expect(page.getByText(/Finding the best picks/)).toHaveCount(0);
  await expect(page.locator("blockquote")).toHaveCount(0);
  await expect(page.getByText("✦ Verified on menu")).toHaveCount(2);
  await page.screenshot({
    path: testInfo.outputPath("fallback-390.png"),
    fullPage: true,
  });
});
test("[ai] profile save reruns picks with the unchanged profile API contract", async ({
  page,
}) => {
  await mockApi(page);
  let budget = 25;
  let recommendations = 0;
  await page.route(`${API}/profiles/p1`, async (route) => {
    if (route.request().method() === "PATCH")
      budget = route.request().postDataJSON().budget;
    await route.fulfill({
      json: {
        id: "p1",
        allergies: [],
        diets: [],
        tastes: [],
        notes: "",
        budget,
      },
    });
  });
  await page.route(`${API}/restaurants/r1/recommend`, async (route) => {
    recommendations++;
    expect(route.request().postDataJSON()).toEqual({ profileId: "p1" });
    await route.fulfill({ json: fallback });
  });
  await page.goto("/results/?r=r1");
  await expect(page.getByTestId("pick-card")).toHaveCount(2);
  const before = recommendations;
  await page.getByRole("button", { name: /My profile/ }).click();
  await expect(page.getByRole("spinbutton")).toHaveValue("25");
  await page.getByRole("spinbutton").fill("20");
  await page.getByRole("button", { name: /Apply Filters/ }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect.poll(() => recommendations).toBeGreaterThan(before);
  expect(budget).toBe(20);
  await expect(page.getByTestId("profile-summary")).toContainText("under $20");
});
test("[ai] hosted PDF import uses the existing URL endpoint", async ({
  page,
}) => {
  await mockApi(page);
  let imported: unknown;
  await page.route(`${API}/restaurants`, (route) =>
    route.fulfill({ json: { id: "r1" } }),
  );
  await page.route(`${API}/restaurants/r1/menu`, (route) => {
    imported = route.request().postDataJSON();
    return route.fulfill({ json: { status: "active" } });
  });
  await page.goto("/scan/");
  await page
    .getByRole("searchbox", { name: "Restaurant name" })
    .fill("Test Noodle House");
  await page.getByRole("button", { name: "Web or PDF link" }).click();
  await page
    .getByLabel("Menu page or PDF URL")
    .fill("https://example.com/menu.pdf");
  await page.getByRole("button", { name: "Find What’s Good" }).click();
  await expect(page).toHaveURL(/\/results\/\?r=r1/);
  expect(imported).toEqual({ url: "https://example.com/menu.pdf" });
});

test("[ai] adding a menu to an existing restaurant reuses its ID", async ({
  page,
}) => {
  await mockApi(page);
  let creates = 0;
  await page.route(`${API}/restaurants`, (route) => {
    creates++;
    return route.fulfill({ json: { id: "duplicate" } });
  });
  await page.route(`${API}/restaurants/r1/menu`, (route) =>
    route.fulfill({ json: { status: "active" } }),
  );
  await page.goto("/scan/?r=r1");
  await expect(page.getByRole("searchbox")).toHaveValue("Test Noodle House");
  await page.getByRole("button", { name: "Web or PDF link" }).click();
  await page
    .getByLabel("Menu page or PDF URL")
    .fill("https://example.com/menu.pdf");
  await page.getByRole("button", { name: "Find What’s Good" }).click();
  await expect(page).toHaveURL(/\/results\/\?r=r1/);
  expect(creates).toBe(0);
});
test("[ai] header buttons do not stack a second form on the page that already has it", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/setup/");
  await page.getByRole("button", { name: /My profile/ }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("main input").first()).toBeFocused();
  await page.goto("/scan/");
  await page.getByRole("button", { name: "Scan Menu", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("main input").first()).toBeFocused();
});
test("[ai] results never credit reviews a restaurant does not have", async ({
  page,
}) => {
  await mockApi(page);
  const noReviews = {
    mode: "fallback",
    explanation: null,
    picks: [{ dishId: "d1", name: "Dan Dan Noodles", price: 14, reason: null, quotes: [], mentionCount: 0, flags: [], labels: ["menu_only"] }],
  };
  await page.route(`${API}/restaurants/r1`, (route) =>
    route.fulfill({ json: { id: "r1", name: "Test Noodle House", address: "1 Main St", has_menu: true, has_reviews: false } }),
  );
  await page.route(`${API}/restaurants/r1/fallback*`, (route) => route.fulfill({ json: noReviews }));
  await page.route(`${API}/restaurants/r1/recommend`, (route) => route.fulfill({ json: noReviews }));
  await page.goto("/results/?r=r1");
  await expect(page.getByTestId("pick-card")).toHaveCount(1);
  await expect(page.getByText("Up to three dishes, checked against the menu.")).toBeVisible();
  await expect(page.getByText("Your menu matches, listed alphabetically.")).toBeVisible();
  await expect(page.getByText(/review sentiment|real reviews|top-rated/)).toHaveCount(0);
});
