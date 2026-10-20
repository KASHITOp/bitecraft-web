/**
 * Authoring format for recipes. Each recipe is written by hand in the
 * recipes-*.ts files; scripts/build-data.ts turns them into recipes.json
 * and computes macros, cost and tags from the ingredient table.
 */
import type { EquipTag, Family, Gear } from "../../lib/types";

/** [ingredientId, quantity in the ingredient's unit (g, ml or pieces), note] */
export type Ing = [string, number, string?];
/** Plain step, or [step, timer minutes] when the step has a wait. */
export type StepSrc = string | [string, number];

export interface RecipeSrc {
  title: string;
  cuisine: string;
  equipment: EquipTag;
  family: Family;
  /** b = breakfast, m = lunch/dinner, s = snack */
  meals: string;
  minutes: number;
  serves: number;
  ingredients: Ing[];
  steps: StepSrc[];
  /** [step number (1-based) the tip belongs before, tip text] */
  tip: [number, string];
  extraGear?: Gear[];
}

export function R(
  title: string,
  cuisine: string,
  equipment: EquipTag,
  family: Family,
  meals: string,
  minutes: number,
  serves: number,
  ingredients: Ing[],
  steps: StepSrc[],
  tip: [number, string],
  extraGear?: Gear[],
): RecipeSrc {
  return { title, cuisine, equipment, family, meals, minutes, serves, ingredients, steps, tip, extraGear };
}
