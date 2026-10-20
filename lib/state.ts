"use client";

import { useStored } from "./useStored";
import { cleanProfile, type Profile } from "./profile";
import type { ChefRecipe, MealSlot } from "./types";

/* ---------- small validators ---------- */

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === "string";

function arrayOf<T>(item: (v: unknown) => T | null) {
  return (v: unknown): T[] | null =>
    Array.isArray(v) ? v.map(item).filter((x): x is T => x !== null) : null;
}

/* ---------- profile ---------- */

export function useProfile() {
  return useStored<Profile | null>("profile", null, cleanProfile);
}

export interface OnboardingState {
  done: boolean;
}
const ONBOARDING_DEFAULT: OnboardingState = { done: false };
const cleanOnboarding = (v: unknown) => (isObj(v) ? { done: v.done === true } : null);
export function useOnboarding() {
  return useStored<OnboardingState>("onboarding", ONBOARDING_DEFAULT, cleanOnboarding);
}

/* ---------- settings ---------- */

export type ThemePref = "system" | "light" | "dark";
export interface Settings {
  theme: ThemePref;
  showAllGear: boolean;
}
const SETTINGS_DEFAULT: Settings = { theme: "system", showAllGear: false };
const cleanSettings = (v: unknown): Settings | null =>
  isObj(v)
    ? {
        theme: v.theme === "light" || v.theme === "dark" ? v.theme : "system",
        showAllGear: v.showAllGear === true,
      }
    : null;
export function useSettings() {
  return useStored<Settings>("settings", SETTINGS_DEFAULT, cleanSettings);
}

/* ---------- pantry ---------- */

export interface PantryItem {
  id: string;
  addedAt: number;
  /** YYYY-MM-DD */
  expiry?: string;
}
const cleanPantryItem = (v: unknown): PantryItem | null =>
  isObj(v) && str(v.id)
    ? {
        id: v.id,
        addedAt: typeof v.addedAt === "number" ? v.addedAt : 0,
        expiry: str(v.expiry) && /^\d{4}-\d{2}-\d{2}$/.test(v.expiry) ? v.expiry : undefined,
      }
    : null;
const EMPTY_PANTRY: PantryItem[] = [];
const cleanPantry = arrayOf(cleanPantryItem);
export function usePantry() {
  return useStored<PantryItem[]>("pantry", EMPTY_PANTRY, cleanPantry);
}

/* ---------- saved ---------- */

const EMPTY_IDS: string[] = [];
const cleanIds = arrayOf((v) => (str(v) ? v : null));
export function useSaved() {
  return useStored<string[]>("saved", EMPTY_IDS, cleanIds);
}

const cleanChefRecipe = (v: unknown): ChefRecipe | null => {
  if (!isObj(v) || !str(v.id) || !str(v.title) || !Array.isArray(v.steps)) return null;
  const m = isObj(v.macros) ? v.macros : {};
  const n = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : 0);
  return {
    id: v.id,
    title: v.title,
    equipment: Array.isArray(v.equipment) ? v.equipment.filter(str) : [],
    minutes: n(v.minutes),
    costEstimate: n(v.costEstimate),
    ingredients: Array.isArray(v.ingredients)
      ? v.ingredients
          .filter(isObj)
          .map((i) => ({ name: str(i.name) ? i.name : "", quantity: str(i.quantity) ? i.quantity : "" }))
      : [],
    steps: v.steps.filter(str),
    tip: str(v.tip) ? v.tip : "",
    macros: { kcal: n(m.kcal), protein: n(m.protein), carbs: n(m.carbs), fat: n(m.fat) },
    savedAt: n(v.savedAt),
    fromLibraryId: str(v.fromLibraryId) ? v.fromLibraryId : undefined,
  };
};
const EMPTY_CHEF: ChefRecipe[] = [];
const cleanChef = arrayOf(cleanChefRecipe);
export function useChefRecipes() {
  return useStored<ChefRecipe[]>("chefRecipes", EMPTY_CHEF, cleanChef);
}

/* ---------- shopping list ---------- */

export interface ShoppingItem {
  /** ingredient id for library items, or a slug for free text */
  key: string;
  ingredientId?: string;
  name: string;
  qty?: number;
  unit?: string;
  from: string[];
  done: boolean;
}
const cleanShoppingItem = (v: unknown): ShoppingItem | null =>
  isObj(v) && str(v.key) && str(v.name)
    ? {
        key: v.key,
        ingredientId: str(v.ingredientId) ? v.ingredientId : undefined,
        name: v.name,
        qty: typeof v.qty === "number" ? v.qty : undefined,
        unit: str(v.unit) ? v.unit : undefined,
        from: Array.isArray(v.from) ? v.from.filter(str) : [],
        done: v.done === true,
      }
    : null;
const EMPTY_SHOP: ShoppingItem[] = [];
const cleanShopping = arrayOf(cleanShoppingItem);
export function useShopping() {
  return useStored<ShoppingItem[]>("shopping", EMPTY_SHOP, cleanShopping);
}

/* ---------- meal plan ---------- */

export interface PlanMeal {
  slot: MealSlot;
  recipeId: string | null;
  portion: number;
  locked: boolean;
  mess: boolean;
}
export interface PlanState {
  meals: PlanMeal[];
  seed: number;
}
const SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];
const cleanPlan = (v: unknown): PlanState | null => {
  if (!isObj(v) || !Array.isArray(v.meals)) return null;
  const meals = SLOTS.map((slot) => {
    const m = (v.meals as unknown[]).find((x) => isObj(x) && x.slot === slot);
    const o = isObj(m) ? m : {};
    return {
      slot,
      recipeId: str(o.recipeId) ? o.recipeId : null,
      portion: typeof o.portion === "number" && o.portion > 0 && o.portion <= 3 ? o.portion : 1,
      locked: o.locked === true,
      mess: o.mess === true,
    };
  });
  return { meals, seed: typeof v.seed === "number" ? v.seed : 1 };
};
export function usePlan() {
  return useStored<PlanState | null>("plan", null, cleanPlan);
}

/* ---------- chef chat ---------- */

export interface ChatMessage {
  id: string;
  role: "user" | "chef";
  text: string;
  /** chef replies may carry a recipe card */
  recipe?: Omit<ChefRecipe, "savedAt">;
  matches?: { id: string; have: number; total: number; missing: number }[];
  note?: string;
}
const cleanMsg = (v: unknown): ChatMessage | null => {
  if (!isObj(v) || !str(v.id) || (v.role !== "user" && v.role !== "chef") || !str(v.text)) return null;
  const recipe = v.recipe ? cleanChefRecipe({ ...(v.recipe as object), savedAt: 0 }) : null;
  return {
    id: v.id,
    role: v.role,
    text: v.text,
    recipe: recipe ?? undefined,
    matches: Array.isArray(v.matches)
      ? v.matches
          .filter(isObj)
          .filter((m) => str(m.id))
          .map((m) => ({
            id: m.id as string,
            have: typeof m.have === "number" ? m.have : 0,
            total: typeof m.total === "number" ? m.total : 0,
            missing: typeof m.missing === "number" ? m.missing : 0,
          }))
      : undefined,
    note: str(v.note) ? v.note : undefined,
  };
};
const EMPTY_CHAT: ChatMessage[] = [];
const cleanChat = arrayOf(cleanMsg);
export function useChat() {
  return useStored<ChatMessage[]>("chat", EMPTY_CHAT, cleanChat);
}
