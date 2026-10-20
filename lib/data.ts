import recipesJson from "@/data/recipes.json";
import ingredientsJson from "@/data/ingredients.json";
import type { EquipTag, Family, Gear, Ingredient, Recipe, Tier } from "./types";

export const RECIPES = recipesJson as unknown as Recipe[];
export const INGREDIENTS = ingredientsJson as unknown as Ingredient[];

export const ING: ReadonlyMap<string, Ingredient> = new Map(INGREDIENTS.map((i) => [i.id, i]));
export const RECIPE: ReadonlyMap<string, Recipe> = new Map(RECIPES.map((r) => [r.id, r]));

export function getRecipe(id: string | null | undefined): Recipe | undefined {
  return id ? RECIPE.get(id) : undefined;
}

/** "Onion (kanda, pyaz)". Shows up to `max` local names. */
export function dualName(ing: Ingredient, max = 2): string {
  const local = ing.aliases.filter((a) => a.toLowerCase() !== ing.name.toLowerCase()).slice(0, max);
  return local.length ? `${ing.name} (${local.join(", ")})` : ing.name;
}

export function formatQty(ing: Ingredient, qty: number): string {
  const n = Number.isInteger(qty) ? String(qty) : qty < 1 ? fraction(qty) : String(Math.round(qty * 10) / 10);
  if (ing.unit === "pc") {
    if (ing.id === "bread" || ing.id === "sourdough") return `${n} slice${qty === 1 ? "" : "s"}`;
    if (ing.id === "cheese-slice") return `${n} slice${qty === 1 ? "" : "s"}`;
    if (ing.id === "instant-noodles") return `${n} pack${qty === 1 ? "" : "s"}`;
    return n;
  }
  return `${n} ${ing.unit}`;
}

function fraction(q: number): string {
  if (Math.abs(q - 0.5) < 0.01) return "½";
  if (Math.abs(q - 0.25) < 0.01) return "¼";
  if (Math.abs(q - 0.75) < 0.01) return "¾";
  return String(Math.round(q * 100) / 100);
}

export const TIER_LABEL: Record<Tier, string> = {
  broke: "Broke",
  balanced: "Balanced",
  treat: "Treat",
};
export const TIER_RANGE: Record<Tier, string> = {
  broke: "under ₹60",
  balanced: "₹60–150",
  treat: "above ₹150",
};

export const EQUIP_LABEL: Record<EquipTag, string> = {
  kettle: "Kettle",
  plate: "One plate",
  nocook: "No cook",
};

export const GEAR_WORDS: Record<Gear, string> = {
  kettle: "an electric kettle",
  induction: "an induction plate",
  pan: "one pan or kadhai with a lid",
  microwave: "a microwave",
  fridge: "a fridge",
};

/** Plain-words equipment line for the recipe page. */
export function needsLine(r: Recipe): string {
  if (r.gear.length === 0) return "Nothing. A knife, a bowl and a spoon.";
  const words = r.gear.map((g) => GEAR_WORDS[g]);
  const extra = r.equipment === "kettle" ? ", plus a steel bowl or tiffin with a lid" : "";
  const joined = words.length === 1 ? words[0] : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
  return `${joined[0].toUpperCase()}${joined.slice(1)}${extra}.`;
}

export const FAMILY_LABEL: Record<Family, string> = {
  dal: "Dal",
  greens: "Greens",
  egg: "Eggs",
  tomato: "Tomato",
  dairy: "Paneer & dairy",
  grain: "Grains",
  meat: "Meat & fish",
  fruit: "Fruit",
  bean: "Beans",
};

export function fitsGear(r: Recipe, gear: readonly Gear[]): boolean {
  return r.gear.every((g) => gear.includes(g));
}
