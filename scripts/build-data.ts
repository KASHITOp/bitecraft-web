/**
 * Turns the hand-written sources in data/source into the JSON the app
 * imports: data/ingredients.json and data/recipes.json.
 *
 *   npx tsx scripts/build-data.ts
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { INGREDIENT_ROWS } from "../data/source/ingredients";
import { INGREDIENT_SEARCH } from "../data/source/ingredient-search";
import { ALL_RECIPES } from "../data/source";
import { computeRecipe, slugify } from "../lib/compute";
import type { Ingredient } from "../lib/types";

const root = join(__dirname, "..");

const ingredients: Ingredient[] = INGREDIENT_ROWS.map(
  ([id, name, aliases, category, unit, kcal, protein, carbs, fat, fibre, size, label, z, b, i]) => ({
    id,
    name,
    aliases: [...new Set(aliases.map((a) => a.trim()).filter((a) => a && a.toLowerCase() !== name.toLowerCase()))],
    category,
    unit,
    nutrition: { kcal, protein, carbs, fat, fibre },
    pack: { size, label },
    prices: { zepto: z, blinkit: b, instamart: i },
    searchQuery: INGREDIENT_SEARCH[id]?.[0] ?? name.toLowerCase(),
    packSize: INGREDIENT_SEARCH[id]?.[1] ?? label,
    ...(INGREDIENT_SEARCH[id]?.[2]?.length ? { searchExclude: INGREDIENT_SEARCH[id]![2] } : {}),
  }),
);

const unsearchable = INGREDIENT_ROWS.map((r) => r[0]).filter((id) => !INGREDIENT_SEARCH[id]);
if (unsearchable.length) throw new Error(`No live-price search entry for: ${unsearchable.join(", ")}`);

const byId = new Map(ingredients.map((i) => [i.id, i]));
if (byId.size !== ingredients.length) throw new Error("Duplicate ingredient id");

const errors: string[] = [];
const recipes = ALL_RECIPES.map((src) => {
  for (const [id] of src.ingredients) {
    if (!byId.has(id)) errors.push(`${src.title}: unknown ingredient "${id}"`);
  }
  return computeRecipe(src, byId);
});
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

const ids = new Set<string>();
for (const r of recipes) {
  if (ids.has(r.id)) {
    console.error(`Duplicate recipe id ${r.id} (${slugify(r.title)})`);
    process.exit(1);
  }
  ids.add(r.id);
}

writeFileSync(join(root, "data/ingredients.json"), JSON.stringify(ingredients, null, 1) + "\n");
writeFileSync(join(root, "data/recipes.json"), JSON.stringify(recipes) + "\n");
console.log(`Wrote ${ingredients.length} ingredients and ${recipes.length} recipes.`);
