import { describe, expect, it } from "vitest";
import { RECIPES, RECIPE } from "@/lib/data";
import { eligible, generatePlan, shuffleMeal, totals, type PlannerInput } from "@/lib/planner";
import { targets } from "@/lib/profile";
import type { Gear } from "@/lib/types";

const ALL_GEAR: Gear[] = ["kettle", "induction", "pan", "microwave", "fridge"];

const cases: { name: string; input: PlannerInput }[] = [
  { name: "lean student, balanced, full kit", input: { kcal: 1800, protein: 70, tier: "balanced", gear: ALL_GEAR } },
  { name: "gainer, balanced, plate + kettle", input: { kcal: 2900, protein: 120, tier: "balanced", gear: ["kettle", "induction", "pan"] } },
  { name: "maintain, treat budget", input: { kcal: 2300, protein: 85, tier: "treat", gear: ALL_GEAR } },
  { name: "broke, one plate only", input: { kcal: 2200, protein: 70, tier: "broke", gear: ["induction", "pan"] } },
  {
    name: "from a real profile (70 kg male, gym, gain)",
    input: (() => {
      const t = targets({ age: 20, weightKg: 70, heightCm: 175, sex: "male", activity: "gym", goal: "gain", tier: "balanced", gear: ALL_GEAR });
      return { kcal: t.kcal, protein: t.protein, tier: "balanced", gear: ALL_GEAR } as PlannerInput;
    })(),
  },
];

describe("meal planner", () => {
  for (const { name, input } of cases) {
    it(`hits kcal and protein within 10%: ${name}`, () => {
      for (const seed of [1, 7, 42, 99, 2026]) {
        const plan = generatePlan(input, RECIPES, null, seed);
        const t = totals(plan, RECIPE, input);
        expect(plan.every((m) => m.recipeId)).toBe(true);
        expect(Math.abs(t.kcal - t.targetKcal) / t.targetKcal).toBeLessThanOrEqual(0.1);
        expect(Math.abs(t.protein - t.targetProtein) / t.targetProtein).toBeLessThanOrEqual(0.1);
      }
    });
  }

  it("respects equipment and budget", () => {
    const input: PlannerInput = { kcal: 2000, protein: 70, tier: "broke", gear: ["kettle"] };
    const plan = generatePlan(input, RECIPES, null, 3);
    for (const m of plan) {
      const r = RECIPE.get(m.recipeId!)!;
      expect(r.tier).toBe("broke");
      expect(r.gear.every((g) => g === "kettle")).toBe(true);
      expect(eligible(r, m.slot, input)).toBe(true);
    }
  });

  it("keeps locked meals and skips mess meals", () => {
    const input = cases[0].input;
    const first = generatePlan(input, RECIPES, null, 5);
    const locked = first.map((m) => (m.slot === "breakfast" ? { ...m, locked: true } : m.slot === "lunch" ? { ...m, mess: true } : m));
    const next = generatePlan(input, RECIPES, locked, 6);
    expect(next.find((m) => m.slot === "breakfast")!.recipeId).toBe(first.find((m) => m.slot === "breakfast")!.recipeId);
    expect(next.find((m) => m.slot === "lunch")!.mess).toBe(true);
    const t = totals(next, RECIPE, input);
    expect(t.targetKcal).toBe(Math.round(input.kcal * 0.65));
  });

  it("shuffle swaps one meal and changes totals", () => {
    const input = cases[2].input;
    const plan = generatePlan(input, RECIPES, null, 11);
    const shuffled = shuffleMeal(plan, "dinner", input, RECIPES, 12);
    const before = plan.find((m) => m.slot === "dinner")!.recipeId;
    const after = shuffled.find((m) => m.slot === "dinner")!.recipeId;
    expect(after).not.toBe(before);
    for (const slot of ["breakfast", "lunch", "snack"] as const) {
      expect(shuffled.find((m) => m.slot === slot)!.recipeId).toBe(plan.find((m) => m.slot === slot)!.recipeId);
    }
  });
});
