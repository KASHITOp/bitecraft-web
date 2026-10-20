/**
 * Shared by the /api/chef route and the browser fallback:
 * pull ingredients out of free text and rank library recipes by coverage.
 */
import { fitsGear } from "./data";
import { namesOf, normalize } from "./search";
import type { Gear, Ingredient, Recipe, Tier } from "./types";

/** Things every PG room has, so they never count as "missing". */
export const STAPLES = new Set([
  "salt",
  "oil",
  "sugar",
  "turmeric",
  "chilli-powder",
  "cumin",
  "mustard-seeds",
  "garam-masala",
  "coriander-powder",
  "pepper",
  "hing",
]);

function singular(t: string): string {
  if (t.length > 4 && t.endsWith("oes")) return t.slice(0, -2); // tomatoes -> tomato
  if (t.length > 3 && t.endsWith("s") && !t.endsWith("ss")) return t.slice(0, -1);
  return t;
}

/** "2 eggs, half onion, bread, cheese slice" -> ["egg", "onion", "bread", "cheese-slice"] */
export function parseIngredients(text: string, all: readonly Ingredient[]): string[] {
  const norm = normalize(text);
  if (!norm) return [];
  const words = norm.split(" ");
  const hay = ` ${words.join(" ")} `;
  const haySingular = ` ${words.map(singular).join(" ")} `;
  const found: { id: string; len: number; at: number }[] = [];
  for (const ing of all) {
    let best: { len: number; at: number } | null = null;
    for (const name of namesOf(ing)) {
      if (!name) continue;
      const needle = ` ${name} `;
      const at = Math.max(hay.indexOf(needle), haySingular.indexOf(needle));
      if (at >= 0 && (!best || name.length > best.len)) best = { len: name.length, at };
    }
    if (best) found.push({ id: ing.id, ...best });
  }
  // Longest names win where matches overlap ("spring onion" beats "onion"), then keep order of mention.
  found.sort((a, b) => b.len - a.len);
  const kept: typeof found = [];
  for (const f of found) {
    const overlaps = kept.some((k) => f.at < k.at + k.len && k.at < f.at + f.len);
    if (!overlaps) kept.push(f);
  }
  return kept.sort((a, b) => a.at - b.at).map((k) => k.id);
}

export interface ChefMatch {
  id: string;
  /** how many of the user's items this recipe uses */
  have: number;
  /** recipe ingredient count */
  total: number;
  /** non-staple ingredients still to buy */
  missing: number;
}

const TIER_ORDER: Tier[] = ["broke", "balanced", "treat"];

/** Rank recipes that use what the user has, respecting gear and (softly) budget. */
export function matchRecipes(
  haveIds: readonly string[],
  recipes: readonly Recipe[],
  opts: { gear: readonly Gear[]; tier?: Tier; limit?: number },
): ChefMatch[] {
  const have = new Set(haveIds);
  const maxTier = opts.tier ? TIER_ORDER.indexOf(opts.tier) : 2;
  return recipes
    .filter((r) => fitsGear(r, opts.gear))
    .map((r) => {
      const ids = [...new Set(r.ingredients.map((i) => i.id))];
      const used = ids.filter((id) => have.has(id)).length;
      const missing = ids.filter((id) => !have.has(id) && !STAPLES.has(id)).length;
      const overBudget = TIER_ORDER.indexOf(r.tier) > maxTier ? 1 : 0;
      return { r, used, missing, overBudget, total: ids.length };
    })
    .filter((x) => x.used > 0)
    .sort((a, b) => a.overBudget - b.overBudget || b.used - a.used || a.missing - b.missing || a.r.minutes - b.r.minutes)
    .slice(0, opts.limit ?? 5)
    .map((x) => ({ id: x.r.id, have: x.used, total: x.total, missing: x.missing }));
}

/** Map free-text equipment words from the model onto our gear ids. */
export function gearFromWords(words: readonly string[]): Gear[] {
  const out = new Set<Gear>();
  for (const w of words.map((x) => x.toLowerCase())) {
    if (/kettle/.test(w)) out.add("kettle");
    if (/induction|stove|hob|burner|gas|cooktop|hot ?plate/.test(w)) out.add("induction");
    if (/\b(pan|frying pan|kadhai|kadai|wok|skillet|tawa|pot|saucepan)\b/.test(w)) out.add("pan");
    if (/microwave|oven/.test(w)) out.add("microwave");
    if (/fridge|refrigerat|freezer/.test(w)) out.add("fridge");
  }
  return [...out];
}
