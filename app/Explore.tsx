"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useDeferredValue, useMemo, useState, type ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { RecipeCard } from "@/components/RecipeCard";
import { EmptyState } from "@/components/ui";
import { EQUIP_LABEL, ING, RECIPES, TIER_LABEL, TIER_RANGE } from "@/lib/data";
import { applyFilters, DEFAULT_FILTERS, GOAL_FILTER_LABEL, TIER_COPY, type Filters } from "@/lib/filters";
import { rankByPantry } from "@/lib/pantry";
import { searchRecipes } from "@/lib/search";
import { useMyGear } from "@/lib/hooks";
import { usePantry, useProfile } from "@/lib/state";
import type { Profile } from "@/lib/profile";
import type { EquipTag, GoalTag, Recipe, Tier } from "@/lib/types";

const PAGE = 30;

// Survives client-side navigation to a recipe and back.
let remembered: Filters | null = null;

export function Explore() {
  const params = useSearchParams();
  const [f, setF] = useState<Filters>(() => {
    const base = remembered ?? DEFAULT_FILTERS;
    return params.get("pantry") === "1" ? { ...base, pantryMode: true } : base;
  });
  const [limit, setLimit] = useState(PAGE);
  const gear = useMyGear();
  const [pantry] = usePantry();
  const [profile] = useProfile();
  const query = useDeferredValue(f.query);

  const update = (patch: Partial<Filters>) => {
    setF((prev) => {
      const next = { ...prev, ...patch };
      remembered = next;
      return next;
    });
    setLimit(PAGE);
  };

  const pantryIds = useMemo(() => new Set(pantry.map((p) => p.id)), [pantry]);

  const results = useMemo(() => {
    const filtered = applyFilters(RECIPES, { ...f, query }, gear);
    const searched = query.trim() ? searchRecipes(query, filtered, ING) : forMe(filtered, profile);
    if (!f.pantryMode) return searched.map((recipe) => ({ recipe, cov: undefined }));
    return rankByPantry(searched, pantryIds).filter((x) => x.cov.have > 0);
  }, [f, query, gear, pantryIds, profile]);

  const hiddenByGear = useMemo(
    () => (f.showAllGear ? 0 : applyFilters(RECIPES, { ...f, showAllGear: true }, gear).length - applyFilters(RECIPES, f, gear).length),
    [f, gear],
  );

  const anyFilter = f.tier || f.equip || f.goal || f.maxMinutes || f.query || f.pantryMode;

  return (
    <div>
      <div className="px-4 pt-4">
        <label htmlFor="search" className="sr-only">
          Search recipes or ingredients
        </label>
        <div className="relative">
          <Icon name="search" size={20} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            id="search"
            type="search"
            className="field pl-10 text-base"
            placeholder="kanda, paneer, maggi, aloo…"
            value={f.query}
            onChange={(e) => update({ query: e.target.value })}
            autoComplete="off"
            enterKeyHint="search"
          />
        </div>
        <p className="mt-1.5 text-xs text-muted">Search in English or local names: pyaz, batata, dhaniya, avalakki.</p>
      </div>

      <div className="mt-3 mb-1 flex items-center justify-between gap-3 px-4">
        <button
          type="button"
          aria-pressed={f.pantryMode}
          onClick={() => update({ pantryMode: !f.pantryMode })}
          className="chip"
          data-testid="pantry-toggle"
        >
          <Icon name="jar" size={18} />
          Cook from my pantry
        </button>
        {anyFilter && (
          <button type="button" className="tap text-sm font-semibold underline underline-offset-4" onClick={() => update({ ...DEFAULT_FILTERS })}>
            Clear filters
          </button>
        )}
      </div>

      <FilterRow label="Budget">
        <Chip on={f.tier === null} onClick={() => update({ tier: null })}>
          Any
        </Chip>
        {(["broke", "balanced", "treat"] as Tier[]).map((t) => (
          <Chip key={t} on={f.tier === t} onClick={() => update({ tier: f.tier === t ? null : t })}>
            {TIER_LABEL[t]} <span className="num text-xs font-normal">{TIER_RANGE[t]}</span>
          </Chip>
        ))}
      </FilterRow>

      <FilterRow label="Gear">
        <Chip on={f.equip === null} onClick={() => update({ equip: null })}>
          Anything I own
        </Chip>
        {(["kettle", "plate", "nocook"] as EquipTag[]).map((e) => (
          <Chip key={e} on={f.equip === e} onClick={() => update({ equip: f.equip === e ? null : e })}>
            {EQUIP_LABEL[e]} only
          </Chip>
        ))}
        <Chip on={f.showAllGear} onClick={() => update({ showAllGear: !f.showAllGear })}>
          Show all gear
          {!f.showAllGear && hiddenByGear > 0 && (
            <span className="text-xs font-normal">
              (<span className="num">{hiddenByGear}</span> hidden)
            </span>
          )}
        </Chip>
      </FilterRow>

      <FilterRow label="Goal">
        {(["gain", "lose", "protein", "quick"] as GoalTag[]).map((g) => (
          <Chip key={g} on={f.goal === g} onClick={() => update({ goal: f.goal === g ? null : g })}>
            {GOAL_FILTER_LABEL[g]}
          </Chip>
        ))}
      </FilterRow>

      <FilterRow label="Time">
        {[10, 20, 30].map((m) => (
          <Chip key={m} on={f.maxMinutes === m} onClick={() => update({ maxMinutes: f.maxMinutes === m ? null : m })}>
            Under <span className="num">{m}</span> min
          </Chip>
        ))}
      </FilterRow>

      {f.tier && <p className="px-4 pt-3 text-sm font-semibold">{TIER_COPY[f.tier]}</p>}
      {f.goal === "quick" && <p className="px-4 pt-3 text-sm font-semibold">Fifteen minutes, one pan, back to the syllabus.</p>}

      {f.pantryMode && pantry.length === 0 ? (
        <EmptyState
          text="Your pantry is empty, so there's nothing to match against."
          action={
            <Link href="/pantry" className="btn btn-primary">
              Add what I have
            </Link>
          }
        />
      ) : results.length === 0 ? (
        <EmptyState
          text="Nothing matches all of that. Loosen a filter."
          action={
            <button type="button" className="btn" onClick={() => update({ ...DEFAULT_FILTERS })}>
              Clear filters
            </button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2.5 px-4 pb-4 pt-3" data-testid="results">
          {results.slice(0, limit).map(({ recipe, cov }) => (
            <li key={recipe.id}>
              <RecipeCard recipe={recipe} coverage={cov} />
            </li>
          ))}
        </ul>
      )}
      {results.length > limit && (
        <div className="px-4 pb-6">
          <button type="button" className="btn w-full" onClick={() => setLimit(limit + PAGE)}>
            Show more recipes
          </button>
        </div>
      )}
    </div>
  );
}

/** Default order: recipes that suit my goal and budget first, mixed across gear types. */
function forMe(recipes: Recipe[], profile: Profile | null): Recipe[] {
  if (!profile) return recipes;
  const goalTag: GoalTag | null = profile.goal === "maintain" ? null : profile.goal;
  const rank = (r: Recipe) => (goalTag && r.goals.includes(goalTag) ? 2 : 0) + (r.tier === profile.tier ? 1 : 0);
  return recipes
    .map((r, i) => ({ r, k: rank(r), mix: (i * 7919) % 257 }))
    .sort((a, b) => b.k - a.k || a.mix - b.mix)
    .map((x) => x.r);
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="scroll-row mt-2 flex items-center gap-2 px-4 pb-0.5" role="group" aria-label={label}>
      <span className="label w-14 shrink-0" aria-hidden>
        {label}
      </span>
      {children}
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className="chip">
      {children}
    </button>
  );
}
