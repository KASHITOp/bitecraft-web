"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChefRecipeCard } from "@/components/ChefRecipeCard";
import { BackLink, EmptyState } from "@/components/ui";
import { useChefRecipes } from "@/lib/state";
import { useHydrated } from "@/lib/useStored";

/** A recipe the Chef wrote and the user saved. */
export function Mine() {
  const id = useSearchParams().get("id");
  const hydrated = useHydrated();
  const [mine] = useChefRecipes();
  const recipe = mine.find((r) => r.id === id);

  return (
    <div className="pb-6">
      <div className="px-4 pt-2">
        <BackLink href="/saved" label="Saved" />
      </div>
      {recipe ? (
        <div className="px-4 pt-2">
          <ChefRecipeCard recipe={recipe} />
        </div>
      ) : hydrated ? (
        <EmptyState
          text="That saved recipe isn't on this phone any more."
          action={
            <Link href="/chef" className="btn btn-primary">
              Ask the Chef
            </Link>
          }
        />
      ) : null}
    </div>
  );
}
