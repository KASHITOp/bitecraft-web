/** Request/response shapes for /api/chef. Shared by the route and the chat screen. */
import type { ChefMatch } from "./chef";
import type { ChefRecipe, Gear, Goal, Tier } from "./types";

export interface ChefRequest {
  message: string;
  usePantry?: boolean;
  pantry?: string[];
  profile?: {
    gear: Gear[];
    tier: Tier;
    goal?: Goal;
    kcal?: number;
    protein?: number;
  };
}

export type ChefRecipePayload = Omit<ChefRecipe, "savedAt" | "id">;

export type ChefResponse =
  | {
      kind: "recipe";
      reply: string;
      recipe: ChefRecipePayload;
      matches: ChefMatch[];
    }
  | {
      kind: "fallback";
      reply: string;
      note: string;
      matches: ChefMatch[];
    };
