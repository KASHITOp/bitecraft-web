import { expect, test } from "@playwright/test";

test("works offline after the first visit (except the live Chef)", async ({ page, context }) => {
  await page.addInitScript(() => {
    localStorage.setItem("bitecraft:v1:onboarding", JSON.stringify({ done: true }));
  });
  await page.goto("/");
  // wait for the service worker to install and precache every screen
  // (waitForFunction would treat an async predicate's Promise as truthy, so poll instead)
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (!reg?.active || reg.active.state !== "activated" || !navigator.serviceWorker.controller) return false;
    const keys = await caches.keys();
    for (const k of keys) {
      const c = await caches.open(k);
      if ((await c.match("/pantry")) && (await c.match("/recipe")) && (await c.match("/planner"))) return true;
    }
    return false;
        }),
      { timeout: 30_000 },
    )
    .toBe(true);

  await context.setOffline(true);

  await page.goto("/pantry");
  await expect(page.getByRole("heading", { name: "Pantry" })).toBeVisible();

  await page.goto("/recipe?id=rava-upma");
  await expect(page.getByRole("heading", { level: 1, name: "Rava Upma" })).toBeVisible();

  await page.goto("/planner");
  await page.getByTestId("plan-generate").click();
  await expect(page.getByTestId("meal-lunch").getByTestId("meal-title")).toBeVisible();

  // The Chef can't reach the server, so it answers from the recipe book on the phone.
  await page.goto("/chef");
  await page.getByLabel("What do you have?").fill("poha, onion, peanuts");
  await page.getByRole("button", { name: "Ask the Chef" }).click();
  await expect(page.getByTestId("chef-note").last()).toContainText("recipe book on your phone");
  await expect(page.getByTestId("chef-matches").last().getByTestId("recipe-card").first()).toBeVisible();

  await context.setOffline(false);
});
