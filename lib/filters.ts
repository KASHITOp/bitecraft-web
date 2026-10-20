import { fitsGear } from "./data";
import type { EquipTag, Gear, GoalTag, Recipe, Tier } from "./types";

export interface Filters {
  query: string;
  tier: Tier | null;
  equip: EquipTag | null;
  goal: GoalTag | null;
  maxMinutes: number | null;
  showAllGear: boolean;
  pantryMode: boolean;
}

export const DEFAULT_FILTERS: Filters = {
  query: "",
  tier: null,
  equip: null,
  goal: null,
  maxMinutes: null,
  showAllGear: false,
  pantryMode: false,
};

/** Everything except text search and pantry sorting. */
export function applyFilters(recipes: readonly Recipe[], f: Filters, myGear: readonly Gear[]): Recipe[] {
  return recipes.filter(
    (r) =>
      (f.tier === null || r.tier === f.tier) &&
      (f.equip === null || r.equipment === f.equip) &&
      (f.goal === null || r.goals.includes(f.goal)) &&
      (f.maxMinutes === null || r.minutes <= f.maxMinutes) &&
      (f.showAllGear || fitsGear(r, myGear)),
  );
}

export const GOAL_FILTER_LABEL: Record<GoalTag, string> = {
  gain: "Weight gain",
  lose: "Weight loss",
  protein: "High protein",
  quick: "Exam-week quickie",
};

export const TIER_COPY: Record<Tier, string> = {
  broke: "Broke week? These cost less than a chai and samosa.",
  balanced: "A normal week. Real food, sensible money.",
  treat: "Stipend day. Go on, you've earned the avocado.",
};
