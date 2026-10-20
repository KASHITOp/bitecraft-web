"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Ring } from "@/components/Ring";
import { EmptyState, PageTitle, TierTag } from "@/components/ui";
import { ING, RECIPE, RECIPES, TIER_LABEL } from "@/lib/data";
import { useMyGear, useTargets } from "@/lib/hooks";
import {
  generatePlan,
  planIngredients,
  shuffleMeal,
  SLOT_LABEL,
  SLOTS,
  totals,
  type Meal,
  type PlannerInput,
} from "@/lib/planner";
import { fromIngredient, mergeShopping } from "@/lib/shopping";
import { usePlan, useProfile, useShopping } from "@/lib/state";

function portionLabel(p: number): string {
  const whole = Math.floor(p);
  const half = p - whole >= 0.5;
  if (p === 1) return "1 plate";
  if (whole === 0) return "½ plate";
  return `${whole}${half ? "½" : ""} plates`;
}

export function Planner() {
  const [profile] = useProfile();
  const t = useTargets();
  const gear = useMyGear();
  const [plan, setPlan] = usePlan();
  const [, setShopping] = useShopping();
  const [listNote, setListNote] = useState<string | null>(null);

  const input: PlannerInput = {
    kcal: t?.kcal ?? 2000,
    protein: t?.protein ?? 60,
    tier: profile?.tier ?? "balanced",
    gear,
  };

  const meals: Meal[] = plan?.meals ?? SLOTS.map((slot) => ({ slot, recipeId: null, portion: 1, locked: false, mess: false }));
  const hasPlan = meals.some((m) => m.recipeId);
  const tot = totals(meals, RECIPE, input);
  const seed = plan?.seed ?? 1;

  const save = (next: Meal[], nextSeed = seed + 1) => {
    setPlan({ meals: next, seed: nextSeed });
    setListNote(null);
  };

  const generate = () => save(generatePlan(input, RECIPES, hasPlan ? meals : meals.filter((m) => m.mess), seed + 1));
  const shuffle = (slot: Meal["slot"]) => save(shuffleMeal(meals, slot, input, RECIPES, seed * 31 + SLOTS.indexOf(slot) + 1));
  const patch = (slot: Meal["slot"], p: Partial<Meal>) => save(meals.map((m) => (m.slot === slot ? { ...m, ...p } : m)), seed);

  const toggleMess = (m: Meal) => {
    if (m.mess) {
      // back from the mess: fill this one slot
      const next = shuffleMeal(
        meals.map((x) => (x.slot === m.slot ? { ...x, mess: false, recipeId: null, locked: false } : x)),
        m.slot,
        input,
        RECIPES,
        seed + 7,
      );
      save(next);
    } else {
      patch(m.slot, { mess: true, recipeId: null, locked: false });
    }
  };

  const addWeek = () => {
    const rows = planIngredients(meals, RECIPE, 7);
    setShopping((prev) => mergeShopping(prev, rows.map((r) => fromIngredient(ING.get(r.ingredientId)!, r.qty, "Week plan"))));
    setListNote(`Added ${rows.length} items for 7 days to your shopping list.`);
  };

  return (
    <div className="pb-6">
      <PageTitle
        sub={
          <>
            Built for your targets, a <TierTag tier={input.tier} /> budget and the gear you have.{" "}
            {!profile && (
              <Link href="/onboarding?edit=1" className="font-semibold text-ink underline underline-offset-4">
                Set your targets
              </Link>
            )}
          </>
        }
      >
        Today&apos;s plan
      </PageTitle>

      <div className="mx-4 flex items-center justify-around rounded-md border border-rule bg-surface py-4">
        <Ring value={tot.kcal} target={tot.targetKcal} label="Calories" unit="kcal" testId="ring-kcal" />
        <Ring value={tot.protein} target={tot.targetProtein} label="Protein" unit="g" color="var(--ink)" testId="ring-protein" />
      </div>
      {hasPlan && (
        <p className="px-4 pt-2 text-sm text-muted">
          Food cost today: <span className="num font-semibold text-ink">₹{tot.cost}</span>
          {meals.some((m) => m.mess) && <> · mess meals are taken out of the targets</>}
        </p>
      )}

      <div className="px-4 pt-4">
        <button type="button" className="btn btn-primary w-full text-lg" onClick={generate} data-testid="plan-generate">
          <Icon name="refresh" size={22} />
          {hasPlan ? "Redo the unlocked meals" : "Make my plan"}
        </button>
      </div>

      {!hasPlan && !meals.some((m) => m.mess) ? (
        <EmptyState text={`No plan yet. One tap builds a day around ${input.kcal} kcal and ${input.protein} g protein.`} />
      ) : (
        <ul className="flex flex-col gap-3 px-4 pt-4">
          {meals.map((m) => (
            <MealRow
              key={m.slot}
              meal={m}
              onShuffle={() => shuffle(m.slot)}
              onLock={() => patch(m.slot, { locked: !m.locked })}
              onMess={() => toggleMess(m)}
            />
          ))}
        </ul>
      )}

      {hasPlan && (
        <div className="px-4 pt-4">
          <button type="button" className="btn w-full" onClick={addWeek} data-testid="plan-to-list">
            <Icon name="cart" size={20} />
            Add a week of this to my shopping list
          </button>
          {listNote && (
            <p className="mt-2 text-sm font-semibold" role="status">
              {listNote}{" "}
              <Link href="/shopping" className="underline underline-offset-4">
                Open list
              </Link>
            </p>
          )}
        </div>
      )}
      <p className="px-4 pt-4 text-xs text-muted">
        Budget is your default ({TIER_LABEL[input.tier]}). Change it in{" "}
        <Link href="/onboarding?edit=1" className="underline underline-offset-4">
          your targets
        </Link>
        .
      </p>
    </div>
  );
}

function MealRow({ meal, onShuffle, onLock, onMess }: { meal: Meal; onShuffle: () => void; onLock: () => void; onMess: () => void }) {
  const r = meal.recipeId ? RECIPE.get(meal.recipeId) : undefined;
  return (
    <li className="rounded-md border border-rule bg-surface" data-testid={`meal-${meal.slot}`}>
      <div className="flex items-center justify-between border-b border-rule px-3 py-1.5">
        <h2 className="label">{SLOT_LABEL[meal.slot]}</h2>
        <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-semibold">
          <input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={meal.mess} onChange={onMess} />
          Mess day
        </label>
      </div>
      {meal.mess ? (
        <p className="px-3 py-3 text-sm text-muted">Eating at the PG mess. This one&apos;s skipped.</p>
      ) : r ? (
        <div className="flex items-stretch">
          <span className={`fam fam-${r.family} w-2 shrink-0`} aria-hidden />
          <div className="min-w-0 flex-1 px-3 py-2.5">
            <Link href={`/recipe?id=${r.id}`} className="font-bold leading-snug underline-offset-4 hover:underline" data-testid="meal-title">
              {r.title}
            </Link>
            <p className="mt-1 text-sm">
              <span className="text-muted">{portionLabel(meal.portion)} · </span>
              <span className="num font-semibold">{Math.round(r.macros.kcal * meal.portion)}</span>
              <span className="text-muted"> kcal · </span>
              <span className="num font-semibold">{Math.round(r.macros.protein * meal.portion)}</span>
              <span className="text-muted"> g protein · </span>
              <span className="num font-semibold">₹{Math.round(r.costPerServing * meal.portion)}</span>
            </p>
          </div>
          <div className="flex shrink-0 flex-col border-l border-rule">
            <button
              type="button"
              className="tap flex flex-1 items-center justify-center px-3 disabled:opacity-40"
              onClick={onShuffle}
              disabled={meal.locked}
              aria-label={`Swap ${SLOT_LABEL[meal.slot].toLowerCase()}`}
              data-testid={`shuffle-${meal.slot}`}
            >
              <Icon name="shuffle" size={20} />
            </button>
            <button
              type="button"
              className={`tap flex flex-1 items-center justify-center border-t border-rule px-3 ${meal.locked ? "bg-accent text-accent-ink" : ""}`}
              onClick={onLock}
              aria-pressed={meal.locked}
              aria-label={`${meal.locked ? "Unlock" : "Lock"} ${SLOT_LABEL[meal.slot].toLowerCase()}`}
              data-testid={`lock-${meal.slot}`}
            >
              <Icon name={meal.locked ? "lock" : "unlock"} size={20} />
            </button>
          </div>
        </div>
      ) : (
        <p className="px-3 py-3 text-sm text-muted">Nothing fits this slot with your gear and budget.</p>
      )}
    </li>
  );
}
