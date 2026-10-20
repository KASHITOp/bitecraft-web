import { describe, expect, it } from "vitest";
import { ING, INGREDIENTS, RECIPE, RECIPES } from "@/lib/data";
import { bmr, targets, type Profile } from "@/lib/profile";
import { searchIngredients, searchRecipes } from "@/lib/search";
import { coverage, daysUntil, expiringSoon, rankByPantry } from "@/lib/pantry";
import { compareBasket, packsNeeded } from "@/lib/prices";
import { applyFilters, DEFAULT_FILTERS } from "@/lib/filters";
import { parseIngredients, matchRecipes } from "@/lib/chef";
import type { Ingredient } from "@/lib/types";

describe("BMR and targets (Mifflin–St Jeor)", () => {
  const base: Profile = {
    age: 20,
    weightKg: 70,
    heightCm: 175,
    sex: "male",
    activity: "gym",
    goal: "gain",
    tier: "balanced",
    gear: ["kettle"],
  };

  it("matches the published formula for men and women", () => {
    expect(bmr(base)).toBeCloseTo(10 * 70 + 6.25 * 175 - 5 * 20 + 5, 6); // 1698.75
    expect(bmr({ ...base, sex: "female", weightKg: 62, heightCm: 172, age: 21 })).toBeCloseTo(1429, 6);
  });

  it("applies activity, goal adjustment and protein per kg", () => {
    const gain = targets(base);
    expect(gain.kcal).toBe(Math.round(1698.75 * 1.55 + 350)); // 2983
    expect(gain.protein).toBe(112); // 1.6 g/kg
    const lose = targets({ ...base, goal: "lose", activity: "sitting" });
    expect(lose.kcal).toBe(Math.round(1698.75 * 1.2 - 400));
    expect(lose.protein).toBe(84); // 1.2 g/kg
    const hp = targets({ ...base, goal: "protein", activity: "walking" });
    expect(hp.kcal).toBe(Math.round(1698.75 * 1.375));
    expect(hp.protein).toBe(112);
    expect(targets({ ...base, goal: "maintain" }).protein).toBe(84);
  });
});

describe("dual-name search", () => {
  const onionish = (id: string) => RECIPE.get(id)!.ingredients.some((i) => i.id === "onion" || i.id === "spring-onion");

  it('"kanda" finds onion recipes and only onion recipes', () => {
    const res = searchRecipes("kanda", RECIPES, ING);
    expect(res.length).toBeGreaterThan(50);
    expect(res[0].title).toBe("Kanda Poha");
    for (const r of res) expect(onionish(r.id) || /kanda/i.test(r.title)).toBe(true);
  });

  it("matches the same recipes whatever name you use", () => {
    const ids = (q: string) => new Set(searchRecipes(q, RECIPES, ING).map((r) => r.id));
    const onion = ids("onion");
    for (const alias of ["pyaz", "eerulli", "vengayam"]) {
      for (const id of ids(alias)) expect(onion.has(id)).toBe(true);
    }
    expect(ids("aloo")).toEqual(ids("batata"));
    // "dhaniya" also means coriander powder, so it is a superset of "kothimbir" (fresh leaves only)
    const dhaniya = ids("dhaniya");
    for (const id of ids("kothimbir")) expect(dhaniya.has(id)).toBe(true);
    expect(ids("avalakki").size).toBeGreaterThan(5);
    expect([...ids("besan")].every((id) => RECIPE.get(id)!.ingredients.some((i) => i.id === "besan") || /besan/i.test(RECIPE.get(id)!.title))).toBe(true);
  });

  it("does not match inside words ('anda' is not 'kanda')", () => {
    const res = searchRecipes("anda", RECIPES, ING);
    expect(res.every((r) => r.ingredients.some((i) => i.id === "egg") || /anda/i.test(r.title))).toBe(true);
  });

  it("finds ingredients for the pantry by any name", () => {
    expect(searchIngredients("pyaz", INGREDIENTS)[0].id).toBe("onion");
    expect(searchIngredients("avalakki", INGREDIENTS)[0].id).toBe("poha");
    expect(searchIngredients("besan", INGREDIENTS)[0].id).toBe("besan");
    expect(searchIngredients("dahi", INGREDIENTS)[0].id).toBe("curd");
  });

  it("every ingredient has at least one local name", () => {
    const bare = INGREDIENTS.filter((i: Ingredient) => i.aliases.length === 0);
    expect(bare.map((i) => i.id)).toEqual([]);
  });
});

describe("pantry coverage scoring", () => {
  it("counts how many recipe ingredients are in the pantry", () => {
    const poha = RECIPE.get("kanda-poha")!;
    const cov = coverage(poha, new Set(["poha", "onion", "salt", "lemon"]));
    expect(cov.total).toBe(poha.ingredients.length);
    expect(cov.have).toBe(4);
    expect(cov.missing).not.toContain("onion");
  });

  it("ranks recipes by pantry items used", () => {
    const pantry = new Set(["egg", "onion", "tomato"]);
    const ranked = rankByPantry(RECIPES, pantry);
    expect(ranked[0].cov.have).toBe(3);
    for (let i = 1; i < ranked.length; i++) expect(ranked[i - 1].cov.have).toBeGreaterThanOrEqual(ranked[i].cov.have);
  });

  it("flags items expiring within 2 days", () => {
    const today = new Date(2026, 9, 21);
    expect(daysUntil("2026-10-23", today)).toBe(2);
    expect(expiringSoon("2026-10-23", today)).toBe(true);
    expect(expiringSoon("2026-10-24", today)).toBe(false);
    expect(expiringSoon("2026-10-19", today)).toBe(true);
    expect(expiringSoon(undefined, today)).toBe(false);
  });
});

describe("price comparison", () => {
  it("picks the cheapest store and reports the saving", () => {
    const lines = RECIPE.get("pg-pav-bhaji")!.ingredients.map((i) => ({ ingredientId: i.id, qty: i.qty }));
    const cmp = compareBasket(lines, ING);
    const totals = Object.fromEntries(cmp.totals.map((t) => [t.store, t.total]));
    const min = Math.min(...Object.values(totals));
    const max = Math.max(...Object.values(totals));
    expect(totals[cmp.cheapest]).toBe(min);
    expect(cmp.savings).toBe(max - min);
    // hand-check one line: potatoes 200 g -> one 1 kg pack
    const potato = cmp.totals.find((t) => t.store === "zepto")!.lines.find((l) => l.ingredientId === "potato")!;
    expect(potato.packs).toBe(1);
    expect(potato.price).toBe(ING.get("potato")!.prices.zepto);
  });

  it("works with a hand-built basket where each store wins one item", () => {
    const fake = new Map<string, Ingredient>([
      ["a", { ...ING.get("onion")!, id: "a", prices: { zepto: 10, blinkit: 50, instamart: 50 } }],
      ["b", { ...ING.get("onion")!, id: "b", prices: { zepto: 50, blinkit: 12, instamart: 50 } }],
      ["c", { ...ING.get("onion")!, id: "c", prices: { zepto: 30, blinkit: 30, instamart: 5 } }],
    ]);
    const cmp = compareBasket(
      [
        { ingredientId: "a", qty: 100 },
        { ingredientId: "b", qty: 100 },
        { ingredientId: "c", qty: 100 },
        { ingredientId: "c", qty: 100 },
      ],
      fake,
    );
    // zepto 90, blinkit 92, instamart 105
    expect(cmp.cheapest).toBe("zepto");
    expect(cmp.savings).toBe(15);
  });

  it("buys whole packs", () => {
    const onion = ING.get("onion")!;
    expect(packsNeeded(onion, 50)).toBe(1);
    expect(packsNeeded(onion, 1000)).toBe(1);
    expect(packsNeeded(onion, 1001)).toBe(2);
  });
});

describe("explore filters", () => {
  it("Broke + Kettle only returns only broke kettle recipes", () => {
    const res = applyFilters(RECIPES, { ...DEFAULT_FILTERS, tier: "broke", equip: "kettle" }, ["kettle", "induction", "pan"]);
    expect(res.length).toBeGreaterThan(5);
    expect(res.every((r) => r.tier === "broke" && r.equipment === "kettle")).toBe(true);
  });

  it("hides recipes needing gear I don't own unless show all", () => {
    const kettleOnly = applyFilters(RECIPES, DEFAULT_FILTERS, ["kettle"]);
    expect(kettleOnly.every((r) => r.gear.every((g) => g === "kettle"))).toBe(true);
    expect(applyFilters(RECIPES, { ...DEFAULT_FILTERS, showAllGear: true }, ["kettle"]).length).toBe(RECIPES.length);
  });
});

describe("chef matching engine", () => {
  it("reads ingredients out of free text, plurals and local names included", () => {
    expect(parseIngredients("2 eggs, half onion, bread, cheese slice", INGREDIENTS)).toEqual(["egg", "onion", "bread", "cheese-slice"]);
    expect(parseIngredients("some aloo and 3 tomatoes", INGREDIENTS)).toEqual(["potato", "tomato"]);
    expect(parseIngredients("spring onion", INGREDIENTS)).toEqual(["spring-onion"]);
  });

  it("only suggests recipes for gear I own", () => {
    const m = matchRecipes(["egg", "bread"], RECIPES, { gear: ["kettle"], limit: 10 });
    expect(m.length).toBeGreaterThan(0);
    expect(m.every((x) => RECIPE.get(x.id)!.gear.every((g) => g === "kettle"))).toBe(true);
  });
});
