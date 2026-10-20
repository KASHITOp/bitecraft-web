"use client";

import Link from "next/link";
import { Icon } from "@/components/Icon";
import { RecipeCard } from "@/components/RecipeCard";
import { BackLink, EmptyState, PageTitle } from "@/components/ui";
import { RECIPE } from "@/lib/data";
import { useChefRecipes, useSaved } from "@/lib/state";

export function Saved() {
  const [saved] = useSaved();
  const [mine, setMine] = useChefRecipes();
  const library = saved.map((id) => RECIPE.get(id)).filter((r) => !!r);
  const empty = library.length === 0 && mine.length === 0;

  return (
    <div>
      <div className="px-4 pt-2">
        <BackLink href="/more" label="More" />
      </div>
      <PageTitle sub="Recipes you bookmarked and ones the Chef wrote for you.">Saved</PageTitle>
      {empty ? (
        <EmptyState
          text="Nothing saved yet. Tap Save on any recipe to keep it here."
          action={
            <Link href="/" className="btn btn-primary">
              Browse recipes
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2.5 px-4 pb-6" data-testid="saved-list">
          {mine.map((r) => (
            <li key={r.id} className="flex items-stretch overflow-hidden rounded-md border border-rule bg-surface">
              <Link href={`/mine?id=${r.id}`} className="flex min-h-[84px] flex-1 items-stretch">
                <span className="flex w-[72px] shrink-0 flex-col items-center justify-center gap-1 bg-accent text-accent-ink">
                  <Icon name="chat" size={28} />
                  <span className="text-[0.625rem] font-bold uppercase tracking-wider">Chef</span>
                </span>
                <span className="flex flex-col justify-center gap-1 px-3 py-2.5">
                  <span className="font-bold leading-snug">{r.title}</span>
                  <span className="text-sm">
                    <span className="num font-semibold">₹{r.costEstimate}</span>
                    <span className="text-muted"> · </span>
                    <span className="num font-semibold">{r.minutes}</span>
                    <span className="text-muted"> min · </span>
                    <span className="num font-semibold">{r.macros.protein}</span>
                    <span className="text-muted"> g protein</span>
                  </span>
                </span>
              </Link>
              <button
                type="button"
                className="tap flex items-center justify-center px-3 text-muted"
                aria-label={`Delete ${r.title}`}
                onClick={() => setMine(mine.filter((x) => x.id !== r.id))}
              >
                <Icon name="trash" size={20} />
              </button>
            </li>
          ))}
          {library.map((r) => (
            <li key={r!.id}>
              <RecipeCard recipe={r!} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
