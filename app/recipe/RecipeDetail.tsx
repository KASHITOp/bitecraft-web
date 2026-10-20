"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { MacroBar } from "@/components/MacroBar";
import { BackLink, EmptyState, EquipIcon, Section, TierTag } from "@/components/ui";
import { dualName, EQUIP_LABEL, FAMILY_LABEL, formatQty, getRecipe, ING, needsLine } from "@/lib/data";
import { useMyGear, useTargets } from "@/lib/hooks";
import { fromIngredient, mergeShopping } from "@/lib/shopping";
import { usePantry, useSaved, useShopping } from "@/lib/state";
import type { Recipe } from "@/lib/types";

export function RecipeDetail() {
  const id = useSearchParams().get("id");
  const recipe = getRecipe(id);
  if (!recipe) {
    return (
      <EmptyState
        text="That recipe isn't in the book."
        action={
          <Link href="/" className="btn btn-primary">
            Back to Explore
          </Link>
        }
      />
    );
  }
  return <Detail r={recipe} />;
}

function Detail({ r }: { r: Recipe }) {
  const t = useTargets();
  const gear = useMyGear();
  const [pantry] = usePantry();
  const [saved, setSaved] = useSaved();
  const [, setShopping] = useShopping();
  const [added, setAdded] = useState(0);
  const pantryIds = new Set(pantry.map((p) => p.id));
  const isSaved = saved.includes(r.id);
  const missing = r.ingredients.filter((i) => !pantryIds.has(i.id));
  const missingGear = r.gear.filter((g) => !gear.includes(g));

  const addMissing = () => {
    setShopping((prev) =>
      mergeShopping(
        prev,
        missing.map((i) => fromIngredient(ING.get(i.id)!, i.qty, r.title)),
      ),
    );
    setAdded(missing.length);
  };

  return (
    <article className="pb-6">
      <div className="flex items-center justify-between px-4 pt-2">
        <BackLink href="/" label="Explore" />
        <button
          type="button"
          className="tap inline-flex items-center gap-1.5 px-2 text-sm font-semibold"
          aria-pressed={isSaved}
          onClick={() => setSaved(isSaved ? saved.filter((x) => x !== r.id) : [r.id, ...saved])}
        >
          <Icon name={isSaved ? "bookmarkFilled" : "bookmark"} size={22} />
          {isSaved ? "Saved" : "Save"}
        </button>
      </div>

      <header className="px-4 pt-1">
        <div className={`fam fam-${r.family} flex h-20 items-center justify-between rounded-md px-4`}>
          <span className="text-xs font-bold uppercase tracking-widest">{FAMILY_LABEL[r.family]}</span>
          <EquipIcon equip={r.equipment} size={40} />
        </div>
        <h1 className="mt-4 text-[1.75rem] font-bold leading-tight tracking-tight">{r.title}</h1>
        <p className="mt-1 text-sm text-muted">
          {r.cuisine} · {EQUIP_LABEL[r.equipment]}
        </p>
        <div className="mt-3 grid grid-cols-3 divide-x divide-rule rounded-md border border-rule bg-surface">
          <Fact label="Time" value={`${r.minutes}`} unit="min" />
          <Fact label="Per plate" value={`₹${r.costPerServing}`} />
          <Fact label="Makes" value={`${r.serves}`} unit={r.serves === 1 ? "plate" : "plates"} />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <TierTag tier={r.tier} />
          {r.goals.includes("quick") && <span className="text-xs font-semibold text-muted">Exam-week quickie</span>}
        </div>
        <p className="mt-3 text-[0.95rem]" data-testid="cost-line">
          <span className="num font-semibold">₹{r.costPerServing}</span> for this meal,{" "}
          <span className="num font-semibold">₹{r.fullPackCost}</span> if you buy every pack.{" "}
          <Link href={`/mart?recipe=${r.id}`} className="font-semibold underline underline-offset-4">
            Compare stores
          </Link>
        </p>
      </header>

      <Section label="You need">
        <p>{needsLine(r)}</p>
        {missingGear.length > 0 && (
          <p className="mt-2 rounded-md bg-chilli-soft px-3 py-2 text-sm font-semibold text-chilli">
            Heads up: you said you don&apos;t have {missingGear.join(" or ")}.
          </p>
        )}
      </Section>

      <Section label="Per plate">
        <MacroBar macros={r.macros} targets={t} />
      </Section>

      <Section
        label="Ingredients"
        action={
          pantry.length > 0 ? (
            <span className="text-xs text-muted">
              <span className="num">{r.ingredients.length - missing.length}</span> of{" "}
              <span className="num">{r.ingredients.length}</span> in pantry
            </span>
          ) : undefined
        }
      >
        <ul className="divide-y divide-rule">
          {r.ingredients.map((i) => {
            const ing = ING.get(i.id)!;
            const have = pantryIds.has(i.id);
            return (
              <li key={i.id} className="flex items-start gap-3 py-2.5">
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] border-[1.5px] ${
                    have ? "border-broke bg-broke text-white" : "border-rule-strong"
                  }`}
                  aria-label={have ? "In your pantry" : "Not in your pantry"}
                  role="img"
                >
                  {have && <Icon name="check" size={14} strokeWidth={3} />}
                </span>
                <span className="flex-1">
                  <span className="font-semibold">{dualName(ing, 3)}</span>
                  {i.note && <span className="block text-sm text-muted">{i.note}</span>}
                </span>
                <span className="num shrink-0 text-sm">{formatQty(ing, i.qty)}</span>
              </li>
            );
          })}
        </ul>
        {missing.length > 0 && (
          <button type="button" className="btn mt-3 w-full" onClick={addMissing} disabled={added > 0}>
            <Icon name="cart" size={20} />
            {added > 0 ? `Added ${added} to shopping list` : `Add ${missing.length} missing to shopping list`}
          </button>
        )}
      </Section>

      <Section label="Method">
        <ol className="space-y-3">
          {r.steps.map((s, i) => (
            <li key={i}>
              {r.tip.beforeStep === i && <Tip text={r.tip.text} />}
              <div className="flex gap-3">
                <span className="num mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[1.5px] border-ink text-sm font-bold">
                  {i + 1}
                </span>
                <p className="flex-1 leading-relaxed">
                  {s.text}
                  {s.timer && (
                    <span className="ml-2 inline-flex items-center gap-1 whitespace-nowrap text-sm font-semibold text-muted">
                      <Icon name="timer" size={16} />
                      <span className="num">{fmtDuration(s.timer)}</span>
                    </span>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <div className="sticky bottom-16 z-20 mt-2 border-t border-rule bg-bg/95 px-4 py-3">
        <Link href={`/cook?id=${r.id}`} className="btn btn-primary w-full text-lg" data-testid="start-cooking">
          <Icon name="flame" size={22} />
          Start cooking
        </Link>
      </div>
    </article>
  );
}

export function Tip({ text }: { text: string }) {
  return (
    <aside className="mb-3 rounded-md border-l-4 border-chilli bg-chilli-soft px-3 py-2.5" data-testid="tip">
      <p className="text-xs font-bold uppercase tracking-wider text-chilli">Where this goes wrong</p>
      <p className="mt-1 text-[0.95rem]">{text}</p>
    </aside>
  );
}

function Fact({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="px-3 py-2.5">
      <p className="label">{label}</p>
      <p className="mt-0.5">
        <span className="num text-xl font-bold">{value}</span>
        {unit && <span className="text-sm text-muted"> {unit}</span>}
      </p>
    </div>
  );
}

export function fmtDuration(seconds: number): string {
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    return m ? `${h} h ${m} min` : `${h} h`;
  }
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m}:${String(s).padStart(2, "0")} min` : `${m} min`;
}
