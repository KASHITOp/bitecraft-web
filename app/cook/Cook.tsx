"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CookMode, type CookStep } from "@/components/CookMode";
import { EmptyState } from "@/components/ui";
import { getRecipe } from "@/lib/data";
import { useChefRecipes } from "@/lib/state";
import { useHydrated } from "@/lib/useStored";

/** Pulls "for 5 minutes" / "8 min" out of free-text chef steps to offer a timer. */
export function timerFromText(text: string): number | undefined {
  const m = text.match(/(\d{1,2})(?:\s*(?:-|to|–)\s*\d{1,2})?\s*(?:minutes?|mins?)\b/i);
  if (!m) return undefined;
  const n = Number(m[1]);
  return n > 0 && n <= 90 ? n * 60 : undefined;
}

export function Cook() {
  const params = useSearchParams();
  const hydrated = useHydrated();
  const [mine] = useChefRecipes();
  const id = params.get("id");
  const mineId = params.get("mine");

  const recipe = getRecipe(id);
  if (recipe) {
    return <CookMode title={recipe.title} steps={recipe.steps} tip={recipe.tip} backHref={`/recipe?id=${recipe.id}`} />;
  }

  const chef = mine.find((r) => r.id === mineId);
  if (chef) {
    const steps: CookStep[] = chef.steps.map((text) => ({ text, timer: timerFromText(text) }));
    return (
      <CookMode
        title={chef.title}
        steps={steps}
        tip={chef.tip ? { text: chef.tip, beforeStep: 0 } : undefined}
        backHref={`/mine?id=${chef.id}`}
      />
    );
  }

  if (!hydrated) return null;
  return (
    <div className="pt-10">
      <EmptyState
        text="Couldn't find that recipe."
        action={
          <Link href="/" className="btn btn-primary">
            Back to Explore
          </Link>
        }
      />
    </div>
  );
}
