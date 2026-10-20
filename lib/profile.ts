import type { Gear, Goal, Tier } from "./types";

export type Sex = "male" | "female";
export type Activity = "sitting" | "walking" | "gym";

export interface Profile {
  age: number;
  weightKg: number;
  heightCm: number;
  sex: Sex;
  activity: Activity;
  goal: Goal;
  tier: Tier;
  gear: Gear[];
}

export const ACTIVITY: Record<Activity, { factor: number; label: string }> = {
  sitting: { factor: 1.2, label: "Mostly sitting" },
  walking: { factor: 1.375, label: "Some walking" },
  gym: { factor: 1.55, label: "Gym 3–5x a week" },
};

export const GOAL_LABEL: Record<Goal, string> = {
  gain: "Gain weight",
  lose: "Lose weight",
  maintain: "Stay where I am",
  protein: "High protein",
};

export const GOAL_KCAL_ADJUST: Record<Goal, number> = {
  gain: 350,
  lose: -400,
  maintain: 0,
  protein: 0,
};

export const ALL_GEAR: { id: Gear; label: string }[] = [
  { id: "kettle", label: "Electric kettle" },
  { id: "induction", label: "Induction plate" },
  { id: "pan", label: "Pan or kadhai" },
  { id: "microwave", label: "Microwave" },
  { id: "fridge", label: "Fridge" },
];

/** Mifflin–St Jeor. Returns kcal/day at rest. */
export function bmr(p: Pick<Profile, "weightKg" | "heightCm" | "age" | "sex">): number {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return p.sex === "male" ? base + 5 : base - 161;
}

export interface Targets {
  bmr: number;
  maintenance: number;
  kcal: number;
  protein: number;
  proteinPerKg: number;
  adjust: number;
  factor: number;
}

export function targets(p: Profile): Targets {
  const b = bmr(p);
  const factor = ACTIVITY[p.activity].factor;
  const maintenance = b * factor;
  const adjust = GOAL_KCAL_ADJUST[p.goal];
  const proteinPerKg = p.goal === "gain" || p.goal === "protein" ? 1.6 : 1.2;
  return {
    bmr: Math.round(b),
    maintenance: Math.round(maintenance),
    kcal: Math.round(maintenance + adjust),
    protein: Math.round(p.weightKg * proteinPerKg),
    proteinPerKg,
    adjust,
    factor,
  };
}

const GEAR_IDS: Gear[] = ["kettle", "induction", "pan", "microwave", "fridge"];

/** Validate whatever came out of storage. */
export function cleanProfile(v: unknown): Profile | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const num = (x: unknown, min: number, max: number) =>
    typeof x === "number" && Number.isFinite(x) && x >= min && x <= max ? x : null;
  const age = num(o.age, 13, 90);
  const weightKg = num(o.weightKg, 25, 250);
  const heightCm = num(o.heightCm, 120, 230);
  if (age == null || weightKg == null || heightCm == null) return null;
  const sex: Sex = o.sex === "female" ? "female" : "male";
  const activity: Activity =
    o.activity === "walking" || o.activity === "gym" ? o.activity : "sitting";
  const goal: Goal =
    o.goal === "gain" || o.goal === "lose" || o.goal === "protein" ? o.goal : "maintain";
  const tier: Tier = o.tier === "broke" || o.tier === "treat" ? o.tier : "balanced";
  const gear = Array.isArray(o.gear)
    ? (o.gear.filter((g) => GEAR_IDS.includes(g as Gear)) as Gear[])
    : ["kettle"];
  return { age, weightKg, heightCm, sex, activity, goal, tier, gear: gear as Gear[] };
}
