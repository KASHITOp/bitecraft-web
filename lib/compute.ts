import type { RecipeSrc } from "../data/source/define";
import type { Gear, GoalTag, Ingredient, Macros, MealKind, Recipe, Tier } from "./types";

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function medianPrice(ing: Ingredient): number {
  const p = [ing.prices.zepto, ing.prices.blinkit, ing.prices.instamart].sort((a, b) => a - b);
  return p[1];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function macrosFor(ing: Ingredient, qty: number): Macros {
  const f = ing.unit === "pc" ? qty : qty / 100;
  const n = ing.nutrition;
  return { kcal: n.kcal * f, protein: n.protein * f, carbs: n.carbs * f, fat: n.fat * f, fibre: n.fibre * f };
}

export function tierFor(costPerServing: number): Tier {
  if (costPerServing < 60) return "broke";
  if (costPerServing <= 150) return "balanced";
  return "treat";
}

export function goalTags(m: Macros, minutes: number, slow = false): GoalTag[] {
  const tags: GoalTag[] = [];
  const proteinShare = m.kcal > 0 ? (m.protein * 4) / m.kcal : 0;
  if (m.kcal >= 550 || (m.kcal >= 450 && m.protein >= 20)) tags.push("gain");
  if (m.kcal <= 420 && m.kcal >= 120 && (m.protein >= 12 || m.fibre >= 6)) tags.push("lose");
  if (m.protein >= 28 || (m.protein >= 18 && proteinShare >= 0.2)) tags.push("protein");
  if (minutes <= 15 && !slow) tags.push("quick");
  return tags;
}

const BASE_GEAR: Record<RecipeSrc["equipment"], Gear[]> = {
  kettle: ["kettle"],
  plate: ["induction", "pan"],
  nocook: [],
};

export function computeRecipe(src: RecipeSrc, byId: Map<string, Ingredient>): Recipe {
  const total: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 };
  let cost = 0;
  let fullPack = 0;
  for (const [id, qty] of src.ingredients) {
    const ing = byId.get(id);
    if (!ing) continue;
    const m = macrosFor(ing, qty);
    total.kcal += m.kcal;
    total.protein += m.protein;
    total.carbs += m.carbs;
    total.fat += m.fat;
    total.fibre += m.fibre;
    const price = medianPrice(ing);
    cost += (qty / ing.pack.size) * price;
    fullPack += Math.max(1, Math.ceil(qty / ing.pack.size - 1e-9)) * price;
  }
  const s = src.serves;
  const macros: Macros = {
    kcal: Math.round(total.kcal / s),
    protein: round1(total.protein / s),
    carbs: round1(total.carbs / s),
    fat: round1(total.fat / s),
    fibre: round1(total.fibre / s),
  };
  const costPerServing = Math.max(1, Math.round(cost / s));
  const gear = [...new Set([...BASE_GEAR[src.equipment], ...(src.extraGear ?? [])])];
  return {
    id: slugify(src.title),
    title: src.title,
    cuisine: src.cuisine,
    equipment: src.equipment,
    gear,
    family: src.family,
    meals: [...src.meals].filter((c): c is MealKind => c === "b" || c === "m" || c === "s"),
    minutes: src.minutes,
    serves: s,
    ingredients: src.ingredients.map(([id, qty, note]) => (note ? { id, qty, note } : { id, qty })),
    steps: src.steps.map((st) =>
      typeof st === "string" ? { text: st } : { text: st[0], timer: Math.round(st[1] * 60) },
    ),
    tip: { beforeStep: src.tip[0] - 1, text: src.tip[1] },
    macros,
    costPerServing,
    fullPackCost: Math.round(fullPack),
    tier: tierFor(costPerServing),
    goals: goalTags(macros, src.minutes, gear.includes("fridge")),
  };
}
