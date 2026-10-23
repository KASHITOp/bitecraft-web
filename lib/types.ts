export type Gear = "kettle" | "induction" | "pan" | "microwave" | "fridge";
export type EquipTag = "kettle" | "plate" | "nocook";
export type Tier = "broke" | "balanced" | "treat";
export type Goal = "gain" | "lose" | "maintain" | "protein";
export type GoalTag = "gain" | "lose" | "protein" | "quick";
export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";
export type MealKind = "b" | "m" | "s";
export type Store = "zepto" | "blinkit" | "instamart";
export type Family =
  | "dal"
  | "greens"
  | "egg"
  | "tomato"
  | "dairy"
  | "grain"
  | "meat"
  | "fruit"
  | "bean";

export type Unit = "g" | "ml" | "pc";

export type IngredientCategory =
  | "Vegetables"
  | "Fruit"
  | "Dairy & eggs"
  | "Grains & bread"
  | "Dal & pulses"
  | "Masala & condiments"
  | "Meat & fish"
  | "Packaged"
  | "Oil & ghee";

export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
}

export interface Ingredient {
  id: string;
  name: string;
  /** Common Indian names: Hindi, Marathi, Kannada, Tamil, etc. */
  aliases: string[];
  category: IngredientCategory;
  unit: Unit;
  /** Nutrition is given per 100 g / 100 ml, or per 1 piece. */
  nutrition: Macros;
  pack: { size: number; label: string };
  prices: Record<Store, number>;
  /** Query sent to the quick-commerce search, e.g. "toned milk". */
  searchQuery: string;
  /** Pack we'd normally buy, e.g. "500 ml" or "1 kg"; used to pick the closest-sized product. */
  packSize: string;
  /** Words that mean the search hit is the wrong product (e.g. "spring" for onion). */
  searchExclude?: string[];
}

export interface RecipeIngredient {
  id: string;
  qty: number;
  note?: string;
}

export interface Step {
  text: string;
  /** Countdown timer for this step, in seconds. */
  timer?: number;
}

export interface Recipe {
  id: string;
  title: string;
  cuisine: string;
  equipment: EquipTag;
  /** Every bit of gear this recipe needs. */
  gear: Gear[];
  family: Family;
  meals: MealKind[];
  minutes: number;
  serves: number;
  ingredients: RecipeIngredient[];
  steps: Step[];
  tip: { text: string; beforeStep: number };
  /** Per serving. */
  macros: Macros;
  costPerServing: number;
  fullPackCost: number;
  tier: Tier;
  goals: GoalTag[];
}

export interface ChefRecipe {
  id: string;
  title: string;
  equipment: string[];
  minutes: number;
  costEstimate: number;
  ingredients: { name: string; quantity: string }[];
  steps: string[];
  tip: string;
  macros: { kcal: number; protein: number; carbs: number; fat: number };
  savedAt: number;
  fromLibraryId?: string;
}
