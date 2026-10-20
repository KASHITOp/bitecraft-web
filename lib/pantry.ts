import type { Recipe } from "./types";

export interface Coverage {
  have: number;
  total: number;
  missing: string[];
}

/** How many of a recipe's ingredients are already in the pantry. */
export function coverage(recipe: Recipe, pantry: ReadonlySet<string>): Coverage {
  const ids = [...new Set(recipe.ingredients.map((i) => i.id))];
  const missing = ids.filter((id) => !pantry.has(id));
  return { have: ids.length - missing.length, total: ids.length, missing };
}

/**
 * Sort by how many pantry items each recipe uses, then by how close it is
 * to complete. Recipes that use nothing from the pantry go last.
 */
export function rankByPantry(
  recipes: readonly Recipe[],
  pantry: ReadonlySet<string>,
): { recipe: Recipe; cov: Coverage }[] {
  return recipes
    .map((recipe) => ({ recipe, cov: coverage(recipe, pantry) }))
    .sort(
      (a, b) =>
        b.cov.have - a.cov.have ||
        a.cov.missing.length - b.cov.missing.length ||
        a.recipe.minutes - b.recipe.minutes,
    );
}

/** Days until a YYYY-MM-DD date, relative to `today` (local midnight). */
export function daysUntil(date: string, today = new Date()): number {
  const [y, m, d] = date.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target.getTime() - base.getTime()) / 86_400_000);
}

export function expiringSoon(date: string | undefined, today = new Date()): boolean {
  if (!date) return false;
  return daysUntil(date, today) <= 2;
}
