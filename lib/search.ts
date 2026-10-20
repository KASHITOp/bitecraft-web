import type { Ingredient, Recipe } from "./types";

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(q: string): string[] {
  return normalize(q)
    .split(" ")
    .filter((t) => t.length >= 2);
}

/** Every name an ingredient goes by, normalized. */
export function namesOf(ing: Ingredient): string[] {
  return [ing.name, ...ing.aliases].map(normalize);
}

/** Word-prefix match: "kan" matches "kanda", "pati kanda"; "anda" does not match "kanda". */
function wordPrefix(haystack: string, token: string): boolean {
  return (" " + haystack).includes(" " + token);
}

export function ingredientMatches(ing: Ingredient, query: string): boolean {
  const ts = tokens(query);
  if (!ts.length) return false;
  const hay = namesOf(ing).join(" ");
  return ts.every((t) => wordPrefix(hay, t));
}

/** Ingredient search for the pantry: matches English or any local name. */
export function searchIngredients(query: string, all: readonly Ingredient[]): Ingredient[] {
  const q = normalize(query);
  if (!q) return [];
  return all
    .filter((i) => ingredientMatches(i, q))
    .sort((a, b) => score(b) - score(a));

  function score(i: Ingredient) {
    const names = namesOf(i);
    if (names.some((n) => n === q)) return 3;
    if (names.some((n) => n.startsWith(q))) return 2;
    return 1;
  }
}

interface Indexed {
  recipe: Recipe;
  title: string;
  ingredients: string;
}

const cache = new WeakMap<readonly Recipe[], Indexed[]>();

function index(recipes: readonly Recipe[], ing: ReadonlyMap<string, Ingredient>): Indexed[] {
  const hit = cache.get(recipes);
  if (hit) return hit;
  const built = recipes.map((r) => ({
    recipe: r,
    title: normalize(`${r.title} ${r.cuisine}`),
    ingredients: r.ingredients
      .map((ri) => {
        const i = ing.get(ri.id);
        return i ? namesOf(i).join(" ") : "";
      })
      .join(" | "),
  }));
  cache.set(recipes, built);
  return built;
}

/**
 * Search titles and every ingredient name in any language.
 * Each query word must match the title or one of the ingredient names.
 */
export function searchRecipes(
  query: string,
  recipes: readonly Recipe[],
  ing: ReadonlyMap<string, Ingredient>,
): Recipe[] {
  const ts = tokens(query);
  if (!ts.length) return [...recipes];
  const scored: { r: Recipe; s: number }[] = [];
  for (const row of index(recipes, ing)) {
    let s = 0;
    let ok = true;
    for (const t of ts) {
      const inTitle = wordPrefix(row.title, t);
      const inIng = wordPrefix(row.ingredients.replace(/ \| /g, " "), t);
      if (!inTitle && !inIng) {
        ok = false;
        break;
      }
      s += inTitle ? 3 : 0;
      s += inIng ? 1 : 0;
    }
    if (ok) scored.push({ r: row.recipe, s });
  }
  return scored.sort((a, b) => b.s - a.s).map((x) => x.r);
}
