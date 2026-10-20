import type { Gear, MealKind, MealSlot, Recipe, Tier } from "./types";

export const SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];

export const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

/** Share of the day's calories each meal aims for. */
export const SLOT_SHARE: Record<MealSlot, number> = {
  breakfast: 0.25,
  lunch: 0.35,
  dinner: 0.3,
  snack: 0.1,
};

const SLOT_KIND: Record<MealSlot, MealKind> = {
  breakfast: "b",
  lunch: "m",
  dinner: "m",
  snack: "s",
};

const PORTIONS = [0.5, 1, 1.5, 2];

export interface PlannerInput {
  kcal: number;
  protein: number;
  tier: Tier;
  gear: readonly Gear[];
}

export interface Meal {
  slot: MealSlot;
  recipeId: string | null;
  portion: number;
  locked: boolean;
  mess: boolean;
}

export interface Totals {
  kcal: number;
  protein: number;
  cost: number;
  /** what the plan aims for once mess meals are taken out */
  targetKcal: number;
  targetProtein: number;
}

const TIER_ALLOWS: Record<Tier, Tier[]> = {
  broke: ["broke"],
  balanced: ["broke", "balanced"],
  treat: ["broke", "balanced", "treat"],
};

export function eligible(r: Recipe, slot: MealSlot, input: Pick<PlannerInput, "tier" | "gear">): boolean {
  return (
    r.meals.includes(SLOT_KIND[slot]) &&
    TIER_ALLOWS[input.tier].includes(r.tier) &&
    r.gear.every((g) => input.gear.includes(g))
  );
}

/** Small seeded PRNG so a plan can be reproduced from its seed. */
export function rng(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function planTargets(meals: readonly Meal[], input: PlannerInput) {
  const share = meals.filter((m) => !m.mess).reduce((s, m) => s + SLOT_SHARE[m.slot], 0);
  return { kcal: input.kcal * share, protein: input.protein * share };
}

export function totals(meals: readonly Meal[], byId: ReadonlyMap<string, Recipe>, input: PlannerInput): Totals {
  const t = planTargets(meals, input);
  let kcal = 0;
  let protein = 0;
  let cost = 0;
  for (const m of meals) {
    if (m.mess || !m.recipeId) continue;
    const r = byId.get(m.recipeId);
    if (!r) continue;
    kcal += r.macros.kcal * m.portion;
    protein += r.macros.protein * m.portion;
    cost += r.costPerServing * m.portion;
  }
  return {
    kcal: Math.round(kcal),
    protein: Math.round(protein),
    cost: Math.round(cost),
    targetKcal: Math.round(t.kcal),
    targetProtein: Math.round(t.protein),
  };
}

function score(r: Recipe, portion: number, k: number, p: number): number {
  const kc = r.macros.kcal * portion;
  const pr = r.macros.protein * portion;
  const kErr = Math.abs(kc - k) / Math.max(k, 1);
  const pShort = Math.max(0, p - pr) / Math.max(p, 1);
  const pOver = Math.max(0, pr - p * 1.8) / Math.max(p, 1);
  return kErr + 0.9 * pShort + 0.2 * pOver + Math.abs(portion - 1) * 0.12;
}

function pick(
  slot: MealSlot,
  k: number,
  p: number,
  recipes: readonly Recipe[],
  input: PlannerInput,
  exclude: ReadonlySet<string>,
  rand: () => number,
): { recipeId: string; portion: number } | null {
  const options: { recipeId: string; portion: number; s: number }[] = [];
  for (const r of recipes) {
    if (exclude.has(r.id) || !eligible(r, slot, input)) continue;
    let best = { portion: 1, s: Infinity };
    for (const portion of PORTIONS) {
      const s = score(r, portion, k, p);
      if (s < best.s) best = { portion, s };
    }
    options.push({ recipeId: r.id, portion: best.portion, s: best.s });
  }
  if (!options.length) return null;
  options.sort((a, b) => a.s - b.s);
  // choose among the closest few so plans don't repeat every day
  const pool = options.slice(0, Math.min(6, options.length));
  const choice = pool[Math.floor(rand() * pool.length)];
  return { recipeId: choice.recipeId, portion: choice.portion };
}

function error(meals: readonly Meal[], byId: ReadonlyMap<string, Recipe>, input: PlannerInput): number {
  const t = totals(meals, byId, input);
  if (!t.targetKcal) return 0;
  const kErr = Math.abs(t.kcal - t.targetKcal) / t.targetKcal;
  const pErr = Math.abs(t.protein - t.targetProtein) / Math.max(t.targetProtein, 1);
  return kErr + 0.8 * pErr;
}

function closeEnough(meals: readonly Meal[], byId: ReadonlyMap<string, Recipe>, input: PlannerInput): boolean {
  const t = totals(meals, byId, input);
  if (!t.targetKcal) return true;
  return (
    Math.abs(t.kcal - t.targetKcal) / t.targetKcal <= 0.05 &&
    Math.abs(t.protein - t.targetProtein) / Math.max(t.targetProtein, 1) <= 0.07
  );
}

/**
 * Local search after the greedy pass: nudge portions, and if that isn't
 * enough, swap one unlocked meal for another eligible recipe. Stops as soon
 * as the day is comfortably inside the target band.
 */
function tune(
  meals: Meal[],
  recipes: readonly Recipe[],
  byId: ReadonlyMap<string, Recipe>,
  input: PlannerInput,
): Meal[] {
  let current = meals;
  for (let i = 0; i < 16 && !closeEnough(current, byId, input); i++) {
    let best = current;
    let bestErr = error(current, byId, input);
    const used = new Set(current.map((m) => m.recipeId));
    current.forEach((m, idx) => {
      if (m.locked || m.mess || !m.recipeId) return;
      const tryMeal = (recipeId: string, portion: number) => {
        const next = current.map((x, j) => (j === idx ? { ...x, recipeId, portion } : x));
        const e = error(next, byId, input);
        if (e < bestErr - 1e-6) {
          best = next;
          bestErr = e;
        }
      };
      for (const delta of [-0.5, 0.5]) {
        const portion = m.portion + delta;
        if (portion >= 0.5 && portion <= 2) tryMeal(m.recipeId, portion);
      }
      for (const r of recipes) {
        if (used.has(r.id) || !eligible(r, m.slot, input)) continue;
        for (const portion of PORTIONS) tryMeal(r.id, portion);
      }
    });
    if (best === current) break;
    current = best;
  }
  return current;
}

/**
 * Greedy day plan. Locked and mess meals stay as they are; every other
 * slot gets the recipe that best fills what's left of the day's kcal and
 * protein, biggest meals first. Then portions are tuned.
 */
export function generatePlan(
  input: PlannerInput,
  recipes: readonly Recipe[],
  previous: readonly Meal[] | null,
  seed: number,
): Meal[] {
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const rand = rng(seed);
  const meals: Meal[] = SLOTS.map((slot) => {
    const prev = previous?.find((m) => m.slot === slot);
    if (prev && (prev.locked || prev.mess)) return { ...prev };
    return { slot, recipeId: null, portion: 1, locked: false, mess: prev?.mess ?? false };
  });

  const target = planTargets(meals, input);
  let remK = target.kcal;
  let remP = target.protein;
  const used = new Set<string>();
  for (const m of meals) {
    if (m.mess || !m.recipeId) continue;
    const r = byId.get(m.recipeId);
    if (!r) continue;
    remK -= r.macros.kcal * m.portion;
    remP -= r.macros.protein * m.portion;
    used.add(r.id);
  }

  const order: MealSlot[] = ["lunch", "dinner", "breakfast", "snack"];
  let openShare = meals.filter((m) => !m.mess && !m.recipeId).reduce((s, m) => s + SLOT_SHARE[m.slot], 0);
  for (const slot of order) {
    const m = meals.find((x) => x.slot === slot)!;
    if (m.mess || m.recipeId) continue;
    const frac = SLOT_SHARE[slot] / openShare;
    const choice = pick(slot, Math.max(remK * frac, 80), Math.max(remP * frac, 3), recipes, input, used, rand);
    openShare -= SLOT_SHARE[slot];
    if (!choice) continue;
    const r = byId.get(choice.recipeId)!;
    m.recipeId = choice.recipeId;
    m.portion = choice.portion;
    used.add(choice.recipeId);
    remK -= r.macros.kcal * choice.portion;
    remP -= r.macros.protein * choice.portion;
  }
  return tune(meals, recipes, byId, input);
}

/** Swap one meal for a different recipe that fills the same gap. */
export function shuffleMeal(
  meals: readonly Meal[],
  slot: MealSlot,
  input: PlannerInput,
  recipes: readonly Recipe[],
  seed: number,
): Meal[] {
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const target = planTargets(meals, input);
  let k = target.kcal;
  let p = target.protein;
  for (const m of meals) {
    if (m.slot === slot || m.mess || !m.recipeId) continue;
    const r = byId.get(m.recipeId);
    if (!r) continue;
    k -= r.macros.kcal * m.portion;
    p -= r.macros.protein * m.portion;
  }
  const exclude = new Set(meals.map((m) => m.recipeId).filter((x): x is string => !!x));
  const choice = pick(slot, Math.max(k, 80), Math.max(p, 3), recipes, input, exclude, rng(seed));
  if (!choice) return [...meals];
  return meals.map((m) => (m.slot === slot ? { ...m, recipeId: choice.recipeId, portion: choice.portion } : m));
}

/** Ingredients for N days of this plan, merged by ingredient. */
export function planIngredients(
  meals: readonly Meal[],
  byId: ReadonlyMap<string, Recipe>,
  days: number,
): { ingredientId: string; qty: number; from: string[] }[] {
  const acc = new Map<string, { qty: number; from: Set<string> }>();
  for (const m of meals) {
    if (m.mess || !m.recipeId) continue;
    const r = byId.get(m.recipeId);
    if (!r) continue;
    const factor = (m.portion / r.serves) * days;
    for (const i of r.ingredients) {
      const row = acc.get(i.id) ?? { qty: 0, from: new Set<string>() };
      row.qty += i.qty * factor;
      row.from.add(r.title);
      acc.set(i.id, row);
    }
  }
  return [...acc].map(([ingredientId, v]) => ({
    ingredientId,
    qty: Math.round(v.qty * 10) / 10,
    from: [...v.from],
  }));
}
