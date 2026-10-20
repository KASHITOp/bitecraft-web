import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type R = { id: string; title: string; tier: string; equipment: string; ingredients: { id: string }[] };
const recipes: R[] = JSON.parse(readFileSync(join(__dirname, "../../data/recipes.json"), "utf8"));
const byTitle = new Map(recipes.map((r) => [r.title, r]));

const PROFILE = {
  age: 20,
  weightKg: 70,
  heightCm: 175,
  sex: "male",
  activity: "gym",
  goal: "gain",
  tier: "balanced",
  gear: ["kettle", "induction", "pan", "microwave", "fridge"],
};

/** Skip onboarding with a known profile. */
async function seed(page: Page, extra: Record<string, unknown> = {}) {
  await page.addInitScript(
    ([profile, more]) => {
      if (sessionStorage.getItem("seeded")) return;
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem("bitecraft:v1:onboarding", JSON.stringify({ done: true }));
      localStorage.setItem("bitecraft:v1:profile", JSON.stringify(profile));
      for (const [k, v] of Object.entries(more as Record<string, unknown>)) {
        localStorage.setItem(`bitecraft:v1:${k}`, JSON.stringify(v));
      }
    },
    [PROFILE, extra] as const,
  );
}

async function cardTitles(page: Page): Promise<string[]> {
  return page.getByTestId("card-title").allInnerTexts();
}

test("complete onboarding and see targets in the header", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/onboarding/);

  await page.getByLabel("Age").fill("20");
  await page.getByLabel("Weight").fill("70");
  await page.getByLabel("Height").fill("175");
  await page.getByRole("radio", { name: "Male", exact: true }).click();
  await page.getByRole("radio", { name: "Gym 3–5x a week" }).click();
  await page.getByRole("button", { name: "Next" }).click();

  await page.getByRole("radio", { name: /Gain weight/ }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("radio", { name: /Balanced/ }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("checkbox", { name: /Induction plate/ }).click();
  await page.getByRole("checkbox", { name: /Pan or kadhai/ }).click();
  await page.getByRole("button", { name: "Next" }).click();

  // BMR = 10*70 + 6.25*175 - 5*20 + 5 = 1698.75; x1.55 = 2633; +350 = 2983. Protein 1.6 x 70 = 112.
  await expect(page.getByTestId("summary-kcal")).toHaveText("2,983");
  await expect(page.getByTestId("summary-protein")).toHaveText("112");
  await expect(page.getByText("Mifflin–St Jeor")).toBeVisible();

  await page.getByRole("button", { name: "Save and start cooking" }).click();
  await expect(page).toHaveURL(/\/$/);
  const header = page.getByTestId("header-targets");
  await expect(header).toContainText("2983");
  await expect(header).toContainText("112");
  await expect(header.getByRole("link", { name: /Edit/ })).toBeVisible();
});

test('search "kanda" finds onion recipes', async ({ page }) => {
  await seed(page);
  await page.goto("/");
  await page.getByLabel("Search recipes or ingredients").fill("kanda");
  await expect(page.getByTestId("recipe-card").first()).toBeVisible();
  await expect(page.getByTestId("recipe-card").first()).toContainText("Kanda Poha");
  const titles = await cardTitles(page);
  expect(titles.length).toBeGreaterThan(10);
  for (const t of titles) {
    const r = byTitle.get(t);
    expect(r, t).toBeTruthy();
    // "kanda" is onion; "pati kanda" is spring onion
    expect(r!.ingredients.some((i) => i.id === "onion" || i.id === "spring-onion") || /kanda/i.test(t), t).toBe(true);
  }
  const onionOnly = titles.filter((t) => byTitle.get(t)!.ingredients.some((i) => i.id === "onion"));
  expect(onionOnly.length).toBeGreaterThan(10);
});

test("filter Broke + Kettle only: every result matches", async ({ page }) => {
  await seed(page);
  await page.goto("/");
  await page.getByRole("group", { name: "Budget" }).getByRole("button", { name: /Broke/ }).click();
  await page.getByRole("group", { name: "Gear" }).getByRole("button", { name: "Kettle only" }).click();
  await expect(page.getByText("Broke week? These cost less than a chai and samosa.")).toBeVisible();

  // load everything
  while (await page.getByRole("button", { name: "Show more recipes" }).isVisible()) {
    await page.getByRole("button", { name: "Show more recipes" }).click();
  }
  const cards = page.getByTestId("recipe-card");
  const n = await cards.count();
  expect(n).toBeGreaterThan(5);
  for (let i = 0; i < n; i++) {
    await expect(cards.nth(i)).toHaveAttribute("data-tier", "broke");
    await expect(cards.nth(i)).toHaveAttribute("data-equip", "kettle");
  }
  const expected = recipes.filter((r) => r.tier === "broke" && r.equipment === "kettle").length;
  expect(n).toBe(expected);
});

test("open a recipe, start cook mode, start and finish a timer", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-21T08:00:00+05:30") });
  await seed(page);
  await page.goto("/");
  await page.getByLabel("Search recipes or ingredients").fill("kanda poha");
  await page.getByTestId("recipe-card").first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Kanda Poha" })).toBeVisible();
  await expect(page.getByTestId("tip")).toBeVisible();
  await page.getByTestId("start-cooking").click();

  await expect(page).toHaveURL(/\/cook\?id=kanda-poha/);
  // tip for poha is before step 1
  await expect(page.getByTestId("cook-tip")).toBeVisible();
  for (let i = 0; i < 3; i++) await page.getByTestId("step-done").click();
  await expect(page.getByTestId("cook-step")).toContainText("thinly sliced onion");

  await expect(page.getByTestId("timer-display")).toHaveText("03:00");
  await page.getByTestId("timer-start").click();
  await page.clock.runFor(1500);
  await expect(page.getByTestId("timer-display")).not.toHaveText("03:00");
  await page.clock.runFor(3 * 60 * 1000);
  await expect(page.getByTestId("timer").getByRole("alert")).toHaveText("Time's up");
  await expect(page.getByTestId("timer-display")).toHaveText("00:00");
  await page.getByTestId("timer-dismiss").click();
  await expect(page.getByTestId("timer-display")).toHaveText("03:00");
});

test('add 3 pantry items, "What can I make?" shows coverage', async ({ page }) => {
  await seed(page);
  await page.goto("/pantry");
  await page.getByLabel("Add an item").fill("pyaz");
  await page.getByRole("list", { name: "Matching ingredients" }).getByRole("button", { name: /^Onion/ }).click();
  await page.getByRole("button", { name: "Egg", exact: true }).click();
  await page.getByRole("button", { name: "Tomato", exact: true }).click();
  await expect(page.getByTestId("pantry-item")).toHaveCount(3);

  await page.getByTestId("what-can-i-make").click();
  await expect(page).toHaveURL(/pantry=1/);
  await expect(page.getByTestId("pantry-toggle")).toHaveAttribute("aria-pressed", "true");
  const first = page.getByTestId("recipe-card").first();
  await expect(first.getByTestId("coverage")).toContainText(/You have \d+ of \d+/);
  const text = await first.getByTestId("coverage").innerText();
  const [, have] = text.match(/You have (\d+) of (\d+)/)!;
  expect(Number(have)).toBe(3);
});

test("chef chat with no API key returns local fallback results, no error shown", async ({ page }) => {
  await seed(page);
  await page.goto("/chef");
  await page.getByLabel("What do you have?").fill("2 eggs, half onion, bread, cheese slice");
  await page.getByRole("button", { name: "Ask the Chef" }).click();
  const reply = page.getByTestId("chef-reply").last();
  await expect(reply).toBeVisible();
  await expect(reply.getByTestId("chef-note")).toContainText("recipe book");
  await expect(reply.getByTestId("chef-matches").getByTestId("recipe-card").first()).toBeVisible();
  const body = await page.locator("main").innerText();
  expect(body).not.toMatch(/error|exception|failed|undefined|500/i);
});

test("generate a plan, shuffle one meal, totals update", async ({ page }) => {
  await seed(page);
  await page.goto("/planner");
  await page.getByTestId("plan-generate").click();
  const dinner = page.getByTestId("meal-dinner");
  await expect(dinner.getByTestId("meal-title")).toBeVisible();

  const sum = async (attr: "data-kcal" | "data-protein") => {
    let s = 0;
    for (const slot of ["breakfast", "lunch", "dinner", "snack"]) {
      s += Number(await page.getByTestId(`meal-${slot}`).getAttribute(attr));
    }
    return s;
  };
  const before = await dinner.getByTestId("meal-title").innerText();
  const kcalBefore = await page.getByTestId("ring-kcal-value").innerText();
  expect(Math.abs(Number(kcalBefore) - (await sum("data-kcal")))).toBeLessThanOrEqual(2);

  await page.getByTestId("shuffle-dinner").click();
  await expect(dinner.getByTestId("meal-title")).not.toHaveText(before);
  const kcalAfter = Number(await page.getByTestId("ring-kcal-value").innerText());
  const proteinAfter = Number(await page.getByTestId("ring-protein-value").innerText());
  expect(Math.abs(kcalAfter - (await sum("data-kcal")))).toBeLessThanOrEqual(2);
  expect(Math.abs(proteinAfter - (await sum("data-protein")))).toBeLessThanOrEqual(2);
});

test('Quick Mart shows three stores with the "Sample prices" label', async ({ page }) => {
  await seed(page);
  await page.goto("/mart?recipe=pg-pav-bhaji");
  await expect(page.getByTestId("sample-label")).toContainText("Sample prices, Oct 2026");
  const stores = page.getByTestId("store-totals").locator("[data-cheapest]");
  await expect(stores).toHaveCount(3);
  await expect(page.getByTestId("store-totals")).toContainText("Zepto");
  await expect(page.getByTestId("store-totals")).toContainText("Blinkit");
  await expect(page.getByTestId("store-totals")).toContainText("Instamart");
  const totals: number[] = [];
  for (let i = 0; i < 3; i++) {
    const t = await stores.nth(i).locator("p.num").first().innerText();
    totals.push(Number(t.replace(/[^\d]/g, "")));
  }
  const cheapest = page.locator('[data-cheapest="true"]');
  await expect(cheapest).toHaveCount(1);
  const best = Number((await cheapest.locator("p.num").first().innerText()).replace(/[^\d]/g, ""));
  expect(best).toBe(Math.min(...totals));
  await expect(page.getByRole("link", { name: "Open app" })).toHaveCount(3);
});

test("reload the page, all user data still there", async ({ page }) => {
  await seed(page);
  await page.goto("/pantry");
  await page.getByRole("button", { name: "Egg", exact: true }).click();
  await page.goto("/recipe?id=masala-omelette");
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: /Add \d+ missing to shopping list/ }).click();
  await page.goto("/planner");
  await page.getByTestId("plan-generate").click();
  const lunch = await page.getByTestId("meal-lunch").getByTestId("meal-title").innerText();

  await page.reload();
  await expect(page.getByTestId("header-targets")).toContainText("2983");
  await expect(page.getByTestId("meal-lunch").getByTestId("meal-title")).toHaveText(lunch);

  await page.goto("/pantry");
  await expect(page.getByTestId("pantry-item")).toHaveCount(1);
  await page.goto("/saved");
  await expect(page.getByTestId("saved-list")).toContainText("Masala Omelette");
  await page.goto("/shopping");
  expect(await page.getByTestId("shopping-item").count()).toBeGreaterThan(0);
});
