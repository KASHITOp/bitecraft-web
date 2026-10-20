"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { BackLink, EmptyState, PageTitle, Section } from "@/components/ui";
import { dualName, getRecipe, ING, RECIPES } from "@/lib/data";
import { compareBasket, PRICE_LABEL, STORES, type BasketLine } from "@/lib/prices";
import { searchRecipes } from "@/lib/search";
import { usePantry, useShopping } from "@/lib/state";

export function Mart() {
  const params = useSearchParams();
  const router = useRouter();
  const recipe = getRecipe(params.get("recipe"));
  const [list] = useShopping();
  const [pantry] = usePantry();
  const [skipPantry, setSkipPantry] = useState(true);
  const [pick, setPick] = useState("");
  const source: "recipe" | "list" = recipe ? "recipe" : "list";

  const pantryIds = useMemo(() => new Set(pantry.map((p) => p.id)), [pantry]);

  const { lines, freeText, skipped } = useMemo(() => {
    let raw: BasketLine[];
    let free = 0;
    if (recipe) {
      raw = recipe.ingredients.map((i) => ({ ingredientId: i.id, qty: i.qty }));
    } else {
      const open = list.filter((i) => !i.done);
      free = open.filter((i) => !i.ingredientId).length;
      raw = open
        .filter((i) => i.ingredientId)
        .map((i) => ({ ingredientId: i.ingredientId!, qty: i.qty ?? ING.get(i.ingredientId!)?.pack.size ?? 1 }));
    }
    const kept = skipPantry ? raw.filter((l) => !pantryIds.has(l.ingredientId)) : raw;
    return { lines: kept, freeText: free, skipped: raw.length - kept.length };
  }, [recipe, list, skipPantry, pantryIds]);

  const cmp = useMemo(() => (lines.length ? compareBasket(lines, ING) : null), [lines]);
  const matches = pick.trim() ? searchRecipes(pick, RECIPES, ING).slice(0, 6) : [];

  return (
    <div className="pb-6">
      <div className="px-4 pt-2">
        <BackLink href={recipe ? `/recipe?id=${recipe.id}` : "/more"} label={recipe ? "Recipe" : "More"} />
      </div>
      <PageTitle sub="Basket total on each quick-commerce app, side by side.">Quick Mart</PageTitle>

      <p
        className="mx-4 flex items-start gap-2 rounded-md border-[1.5px] border-dashed border-rule-strong bg-surface px-3 py-2 text-sm"
        data-testid="sample-label"
      >
        <Icon name="store" size={18} className="mt-0.5 shrink-0" />
        <span>
          <strong>{PRICE_LABEL}.</strong> These are sample shelf prices for Bangalore, not live. Check the app before you
          order.
        </span>
      </p>

      <div className="mt-3 flex gap-2 px-4" role="group" aria-label="What to price">
        <button
          type="button"
          className="chip"
          aria-pressed={source === "list"}
          onClick={() => router.replace("/mart?list=1")}
        >
          My shopping list
        </button>
        <button type="button" className="chip" aria-pressed={source === "recipe"} onClick={() => setPick(pick || " ")}>
          {recipe ? recipe.title : "A recipe"}
        </button>
      </div>

      {(pick || (!recipe && source === "recipe")) && (
        <div className="px-4 pt-3">
          <label htmlFor="mart-pick" className="label">
            Price a recipe
          </label>
          <input
            id="mart-pick"
            className="field mt-1.5"
            placeholder="Search a recipe: poha, rajma…"
            value={pick.trimStart()}
            onChange={(e) => setPick(e.target.value)}
            autoFocus
          />
          {matches.length > 0 && (
            <ul className="mt-2 divide-y divide-rule rounded-md border border-rule bg-surface">
              {matches.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="min-h-12 w-full px-3 text-left font-semibold"
                    onClick={() => {
                      setPick("");
                      router.replace(`/mart?recipe=${r.id}`);
                    }}
                  >
                    {r.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <label className="flex min-h-12 cursor-pointer items-center gap-3 px-4 pt-2 text-sm">
        <input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={skipPantry} onChange={(e) => setSkipPantry(e.target.checked)} />
        Skip what&apos;s already in my pantry
        {skipped > 0 && (
          <span className="text-muted">
            (<span className="num">{skipped}</span> skipped)
          </span>
        )}
      </label>

      {!cmp ? (
        source === "list" && list.filter((i) => !i.done).length === 0 ? (
          <EmptyState
            text="Your shopping list is empty, so there's nothing to price."
            action={
              <Link href="/" className="btn btn-primary">
                Find a recipe
              </Link>
            }
          />
        ) : (
          <EmptyState text="You already have everything. Nothing to buy." />
        )
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 px-4 pt-2" data-testid="store-totals">
            {cmp.totals.map((t) => {
              const store = STORES.find((s) => s.id === t.store)!;
              const best = t.store === cmp.cheapest;
              return (
                <div
                  key={t.store}
                  className={`flex flex-col rounded-md border-[1.5px] bg-surface p-2.5 ${best ? "border-accent" : "border-rule"}`}
                  data-testid={`store-${t.store}`}
                  data-cheapest={best ? "true" : "false"}
                >
                  <p className="text-sm font-bold">{store.name}</p>
                  <p className="num mt-1 text-2xl font-bold">₹{t.total}</p>
                  {best ? (
                    <p className="mt-1 inline-flex w-fit rounded-[4px] bg-accent px-1.5 py-0.5 text-[0.7rem] font-bold uppercase text-accent-ink">
                      Cheapest
                    </p>
                  ) : (
                    <p className="num mt-1 text-xs text-muted">+₹{t.total - cmp.totals.find((x) => x.store === cmp.cheapest)!.total}</p>
                  )}
                  <a
                    href={store.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-auto inline-flex min-h-11 items-center pt-2 text-sm font-semibold underline underline-offset-4"
                  >
                    Open app
                  </a>
                </div>
              );
            })}
          </div>
          <p className="px-4 pt-3 text-[0.95rem]" data-testid="savings">
            {cmp.savings > 0 ? (
              <>
                <strong>{STORES.find((s) => s.id === cmp.cheapest)!.name}</strong> saves you{" "}
                <span className="num font-semibold">₹{cmp.savings}</span> over the priciest app on this basket.
              </>
            ) : (
              <>All three come to the same total on this basket.</>
            )}
          </p>
          {freeText > 0 && (
            <p className="px-4 pt-1 text-sm text-muted">
              <span className="num">{freeText}</span> hand-added item{freeText === 1 ? " has" : "s have"} no sample price.
            </p>
          )}

          <Section label="Item by item">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted">
                  <th className="py-1.5 font-semibold">Item</th>
                  {STORES.map((s) => (
                    <th key={s.id} className="py-1.5 pl-3 text-right font-semibold">
                      {s.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {cmp.totals[0].lines.map((row, i) => {
                  const ing = ING.get(row.ingredientId)!;
                  const prices = cmp.totals.map((t) => t.lines[i].price);
                  const min = Math.min(...prices);
                  return (
                    <tr key={row.ingredientId}>
                      <td className="py-2 pr-2">
                        <span className="font-semibold">{dualName(ing, 1)}</span>
                        <span className="num block text-xs text-muted">
                          {row.packs} × {ing.pack.label}
                        </span>
                      </td>
                      {prices.map((p, j) => (
                        <td key={j} className={`num py-2 pl-3 text-right ${p === min ? "font-bold" : "text-muted"}`}>
                          ₹{p}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted">Whole packs, since you can&apos;t buy 60 g of poha. Lowest price per row in bold.</p>
          </Section>
        </>
      )}
    </div>
  );
}
