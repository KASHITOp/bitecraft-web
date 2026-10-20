/**
 * Quality gate for the recipe library. Fails (exit 1) when:
 *  - fewer than MIN_RECIPES recipes
 *  - any two titles are the same (ignoring case and punctuation)
 *  - any two recipes have the same step list
 *  - any two recipes share 3 or more identical steps (copy-paste smell)
 *  - any single step sentence appears in more than 2 recipes
 *  - any step contains generic filler ("prep ingredients", "adjust seasoning", "enjoy"...)
 *  - any recipe lacks a "where this goes wrong" tip, or has < 5 or > 8 steps
 *  - any ingredient reference is unknown, or numbers are missing
 *
 *   npx tsx scripts/verify-recipes.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Ingredient, Recipe } from "../lib/types";

const MIN_RECIPES = 250;
const root = join(__dirname, "..");
const recipes: Recipe[] = JSON.parse(readFileSync(join(root, "data/recipes.json"), "utf8"));
const ingredients: Ingredient[] = JSON.parse(readFileSync(join(root, "data/ingredients.json"), "utf8"));
const ingIds = new Set(ingredients.map((i) => i.id));

const FILLER: RegExp[] = [
  /\bprep(are)?\s+(all\s+|the\s+|your\s+)?ingredients\b/i,
  /\badjust\s+(the\s+)?seasoning/i,
  /\benjoy\b/i,
  /\bseason\s+to\s+taste\s+and\s+serve\b/i,
  /\bserve\s+(hot|warm|immediately)\s*(and\s+\w+)?\s*\.?\s*$/i,
  /\bgather\s+(all\s+)?(the\s+)?ingredients\b/i,
  /\bcook\s+until\s+done\b/i,
  /\bmix\s+well\s+and\s+serve\s*\.?$/i,
  /\blorem\b/i,
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const errors: string[] = [];
const fail = (msg: string) => errors.push(msg);

if (recipes.length < MIN_RECIPES) fail(`Only ${recipes.length} recipes, need at least ${MIN_RECIPES}.`);

const titles = new Map<string, string>();
const stepLists = new Map<string, string>();
const stepUse = new Map<string, string[]>();

for (const r of recipes) {
  const t = norm(r.title);
  if (titles.has(t)) fail(`Duplicate title: "${r.title}" and "${titles.get(t)}"`);
  titles.set(t, r.title);

  if (r.steps.length < 5 || r.steps.length > 8) fail(`${r.title}: has ${r.steps.length} steps (need 5-8).`);

  const list = r.steps.map((s) => norm(s.text)).join(" | ");
  if (stepLists.has(list)) fail(`Same step list: "${r.title}" and "${stepLists.get(list)}"`);
  stepLists.set(list, r.title);

  r.steps.forEach((s, i) => {
    if (s.text.trim().length < 30) fail(`${r.title}: step ${i + 1} is too short to be useful: "${s.text}"`);
    for (const re of FILLER) {
      if (re.test(s.text)) fail(`${r.title}: step ${i + 1} has filler text (${re}): "${s.text}"`);
    }
    if (s.timer !== undefined && (s.timer <= 0 || s.timer > 4 * 3600)) fail(`${r.title}: step ${i + 1} timer out of range.`);
    const key = norm(s.text);
    stepUse.set(key, [...(stepUse.get(key) ?? []), r.title]);
  });

  if (!r.tip || r.tip.text.trim().length < 30) fail(`${r.title}: missing a proper "where this goes wrong" tip.`);
  else if (r.tip.beforeStep < 0 || r.tip.beforeStep >= r.steps.length) fail(`${r.title}: tip points at a step that does not exist.`);
  for (const re of FILLER) if (r.tip && re.test(r.tip.text)) fail(`${r.title}: tip has filler text.`);

  if (r.ingredients.length < 2) fail(`${r.title}: fewer than 2 ingredients.`);
  for (const i of r.ingredients) {
    if (!ingIds.has(i.id)) fail(`${r.title}: unknown ingredient ${i.id}`);
    if (!(i.qty > 0)) fail(`${r.title}: ingredient ${i.id} has no quantity.`);
  }
  if (!r.cuisine) fail(`${r.title}: no cuisine.`);
  if (!["kettle", "plate", "nocook"].includes(r.equipment)) fail(`${r.title}: bad equipment tag.`);
  if (!(r.macros.kcal > 0)) fail(`${r.title}: no calories computed.`);
  if (!(r.costPerServing > 0) || r.fullPackCost < r.costPerServing) fail(`${r.title}: cost numbers look wrong.`);
  if (!(r.minutes > 0) || !(r.serves > 0)) fail(`${r.title}: minutes/serves missing.`);
}

for (const [step, users] of stepUse) {
  if (users.length > 2) fail(`Step reused in ${users.length} recipes (${users.slice(0, 4).join(", ")}): "${step}"`);
}

// pairwise shared-step check
const stepSets = recipes.map((r) => new Set(r.steps.map((s) => norm(s.text))));
for (let a = 0; a < recipes.length; a++) {
  for (let b = a + 1; b < recipes.length; b++) {
    let shared = 0;
    for (const s of stepSets[a]) if (stepSets[b].has(s)) shared++;
    if (shared >= 3) fail(`"${recipes[a].title}" and "${recipes[b].title}" share ${shared} identical steps.`);
  }
}

if (errors.length) {
  console.error(`verify-recipes: ${errors.length} problem(s)\n`);
  console.error(errors.map((e) => " - " + e).join("\n"));
  process.exit(1);
}

const by = (k: (r: Recipe) => string) =>
  Object.entries(recipes.reduce<Record<string, number>>((acc, r) => ((acc[k(r)] = (acc[k(r)] ?? 0) + 1), acc), {}))
    .map(([k, v]) => `${k} ${v}`)
    .join(", ");
console.log(`verify-recipes: OK. ${recipes.length} recipes, ${titles.size} unique titles, ${stepLists.size} unique step lists.`);
console.log(`  equipment: ${by((r) => r.equipment)}`);
console.log(`  tier:      ${by((r) => r.tier)}`);
console.log(`  family:    ${by((r) => r.family)}`);
