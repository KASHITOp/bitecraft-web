"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "./Icon";
import { useChefRecipes } from "@/lib/state";
import type { ChefRecipe } from "@/lib/types";

/** A model-written (or model-picked) recipe, rendered as a real card, not a wall of text. */
export function ChefRecipeCard({ recipe, compact = false }: { recipe: Omit<ChefRecipe, "savedAt">; compact?: boolean }) {
  const router = useRouter();
  const [mine, setMine] = useChefRecipes();
  const saved = mine.some((r) => r.id === recipe.id);

  const save = () => {
    if (!saved) setMine((prev) => [{ ...recipe, savedAt: Date.now() }, ...prev.filter((r) => r.id !== recipe.id)]);
  };

  return (
    <article className="overflow-hidden rounded-md border-[1.5px] border-ink bg-surface" data-testid="chef-recipe">
      <div className="flex items-center justify-between bg-accent px-3 py-1.5 text-accent-ink">
        <span className="text-xs font-bold uppercase tracking-wider">
          {recipe.fromLibraryId ? "From the recipe book" : "Chef's recipe"}
        </span>
        <Icon name="chat" size={18} />
      </div>
      <div className="px-3 pb-3 pt-2.5">
        <h3 className="text-xl font-bold leading-snug">{recipe.title}</h3>
        <p className="mt-1 text-sm">
          <span className="num font-semibold">{recipe.minutes}</span>
          <span className="text-muted"> min · about </span>
          <span className="num font-semibold">₹{recipe.costEstimate}</span>
          <span className="text-muted"> a plate</span>
        </p>
        <p className="mt-1 text-sm text-muted">
          You need: {recipe.equipment.length ? recipe.equipment.join(", ") : "no equipment"}
        </p>

        <dl className="mt-3 grid grid-cols-4 divide-x divide-rule rounded-md border border-rule text-center">
          {(
            [
              ["kcal", recipe.macros.kcal, ""],
              ["protein", recipe.macros.protein, "g"],
              ["carbs", recipe.macros.carbs, "g"],
              ["fat", recipe.macros.fat, "g"],
            ] as const
          ).map(([k, v, u]) => (
            <div key={k} className="py-1.5">
              <dt className="text-[0.7rem] font-semibold uppercase text-muted">{k}</dt>
              <dd className="num font-bold">
                {v}
                {u}
              </dd>
            </div>
          ))}
        </dl>

        <h4 className="label mt-4 border-b border-rule pb-1">Ingredients</h4>
        <ul className="mt-1 divide-y divide-rule text-[0.95rem]">
          {recipe.ingredients.map((i, idx) => (
            <li key={idx} className="flex justify-between gap-3 py-1.5">
              <span>{i.name}</span>
              <span className="num shrink-0 text-sm text-muted">{i.quantity}</span>
            </li>
          ))}
        </ul>

        {!compact && (
          <>
            <h4 className="label mt-4 border-b border-rule pb-1">Steps</h4>
            <ol className="mt-2 space-y-2.5">
              {recipe.steps.map((s, idx) => (
                <li key={idx} className="flex gap-2.5">
                  <span className="num mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px] border-ink text-xs font-bold">
                    {idx + 1}
                  </span>
                  <span className="flex-1 leading-relaxed">{s.replace(/^\s*\d+[.)]\s*/, "")}</span>
                </li>
              ))}
            </ol>
          </>
        )}

        {recipe.tip && (
          <aside className="mt-4 rounded-md border-l-4 border-chilli bg-chilli-soft px-3 py-2">
            <p className="text-xs font-bold uppercase tracking-wider text-chilli">Where this goes wrong</p>
            <p className="mt-1 text-[0.95rem]">{recipe.tip}</p>
          </aside>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn flex-1" onClick={save} disabled={saved} data-testid="save-chef-recipe">
            <Icon name={saved ? "bookmarkFilled" : "bookmark"} size={20} />
            {saved ? "Saved to my recipes" : "Save to my recipes"}
          </button>
          <button
            type="button"
            className="btn btn-primary flex-1"
            onClick={() => {
              save();
              router.push(`/cook?mine=${recipe.id}`);
            }}
          >
            <Icon name="flame" size={20} />
            Cook this
          </button>
        </div>
        {recipe.fromLibraryId && (
          <Link
            href={`/recipe?id=${recipe.fromLibraryId}`}
            className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4"
          >
            Open the full recipe with pantry checks
          </Link>
        )}
      </div>
    </article>
  );
}
