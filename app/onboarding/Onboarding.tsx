"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { Segmented } from "@/components/ui";
import { ACTIVITY, ALL_GEAR, bmr, GOAL_LABEL, targets, type Activity, type Profile, type Sex } from "@/lib/profile";
import { useOnboarding, useProfile } from "@/lib/state";
import { useHydrated } from "@/lib/useStored";
import type { Gear, Goal, Tier } from "@/lib/types";

export function Onboarding() {
  const hydrated = useHydrated();
  const [profile] = useProfile();
  // Remount once storage is readable so the form starts from the saved profile.
  return <Form key={hydrated ? "client" : "server"} initial={profile} />;
}

interface Draft {
  age: string;
  weightKg: string;
  heightCm: string;
  sex: Sex | null;
  activity: Activity | null;
  goal: Goal | null;
  tier: Tier | null;
  gear: Gear[];
}

const GOALS: { value: Goal; title: string; line: string }[] = [
  { value: "gain", title: "Gain weight", line: "350 kcal over maintenance. More rice, more paneer." },
  { value: "lose", title: "Lose weight", line: "400 kcal under maintenance. Big plates, light food." },
  { value: "maintain", title: "Stay where I am", line: "Eat what you burn." },
  { value: "protein", title: "High protein", line: "Maintenance calories, 1.6 g protein per kg." },
];

const TIERS: { value: Tier; title: string; range: string; line: string }[] = [
  { value: "broke", title: "Broke", range: "under ₹60 a meal", line: "Month-end mode. Cheaper than a chai and samosa." },
  { value: "balanced", title: "Balanced", range: "₹60–150 a meal", line: "A normal week. Paneer is back on the menu." },
  { value: "treat", title: "Treat", range: "above ₹150 a meal", line: "Stipend just landed. Avocados allowed." },
];

const GEAR_ICON: Record<Gear, IconName> = {
  kettle: "kettle",
  induction: "plate",
  pan: "pan",
  microwave: "microwave",
  fridge: "fridge",
};

const STEPS = ["About you", "Goal", "Budget", "Kitchen", "Your numbers"];

function toNum(s: string): number {
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

function Form({ initial }: { initial: Profile | null }) {
  const router = useRouter();
  const params = useSearchParams();
  const editing = params.get("edit") === "1";
  const [, setProfile] = useProfile();
  const [, setOnboarding] = useOnboarding();
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>(() => ({
    age: initial ? String(initial.age) : "",
    weightKg: initial ? String(initial.weightKg) : "",
    heightCm: initial ? String(initial.heightCm) : "",
    sex: initial?.sex ?? null,
    activity: initial?.activity ?? null,
    goal: initial?.goal ?? null,
    tier: initial?.tier ?? null,
    gear: initial?.gear ?? ["kettle"],
  }));

  const age = toNum(d.age);
  const weight = toNum(d.weightKg);
  const height = toNum(d.heightCm);
  const errors = {
    age: d.age && !(age >= 13 && age <= 90) ? "Enter an age between 13 and 90." : "",
    weightKg: d.weightKg && !(weight >= 25 && weight <= 250) ? "Enter a weight between 25 and 250 kg." : "",
    heightCm: d.heightCm && !(height >= 120 && height <= 230) ? "Enter a height between 120 and 230 cm." : "",
  };
  const step1ok =
    !!d.age && !!d.weightKg && !!d.heightCm && !errors.age && !errors.weightKg && !errors.heightCm && !!d.sex && !!d.activity;
  const canNext = [step1ok, !!d.goal, !!d.tier, true, true][step];

  const profile: Profile | null =
    step1ok && d.goal && d.tier
      ? {
          age,
          weightKg: weight,
          heightCm: height,
          sex: d.sex!,
          activity: d.activity!,
          goal: d.goal,
          tier: d.tier,
          gear: d.gear,
        }
      : null;

  const finish = () => {
    if (profile) setProfile(profile);
    setOnboarding({ done: true });
    router.replace(editing ? "/more" : "/");
  };

  const skip = () => {
    setOnboarding({ done: true });
    router.replace("/");
  };

  const toggleGear = (g: Gear) =>
    setD((x) => ({ ...x, gear: x.gear.includes(g) ? x.gear.filter((y) => y !== g) : [...x.gear, g] }));

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col bg-bg px-4 pb-6 pt-[max(env(safe-area-inset-top),1rem)]">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-lg font-bold">
          <span aria-hidden className="inline-block h-4 w-4 rounded-[3px] bg-accent" />
          BiteCraft
        </span>
        {editing ? (
          <button type="button" className="tap text-sm font-semibold underline underline-offset-4" onClick={() => router.back()}>
            Cancel
          </button>
        ) : (
          <button type="button" className="tap text-sm font-semibold underline underline-offset-4" onClick={skip}>
            Skip for now
          </button>
        )}
      </div>

      <div className="mt-4" aria-hidden>
        <div className="flex gap-1.5">
          {STEPS.map((s, i) => (
            <span key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-ink" : "bg-rule"}`} />
          ))}
        </div>
      </div>
      <p className="label mt-3">
        Step <span className="num">{step + 1}</span> of <span className="num">{STEPS.length}</span> · {STEPS[step]}
      </p>

      <div className="flex-1 pt-2">
        {step === 0 && (
          <fieldset>
            <legend className="text-2xl font-bold tracking-tight">First, the numbers</legend>
            <p className="mt-1 text-sm text-muted">Only used to work out your daily calories and protein. Stays on this phone.</p>
            <div className="mt-5 grid grid-cols-3 gap-3">
              <NumField label="Age" unit="years" value={d.age} onChange={(v) => setD({ ...d, age: v })} error={errors.age} />
              <NumField label="Weight" unit="kg" value={d.weightKg} onChange={(v) => setD({ ...d, weightKg: v })} error={errors.weightKg} />
              <NumField label="Height" unit="cm" value={d.heightCm} onChange={(v) => setD({ ...d, heightCm: v })} error={errors.heightCm} />
            </div>
            {(errors.age || errors.weightKg || errors.heightCm) && (
              <p role="alert" className="mt-2 text-sm font-semibold text-chilli">
                {errors.age || errors.weightKg || errors.heightCm}
              </p>
            )}
            <p className="label mt-6 mb-2">Sex (the formula needs one)</p>
            <Segmented
              name="sex"
              label="Sex"
              value={d.sex}
              onChange={(sex) => setD({ ...d, sex })}
              options={[
                { value: "male", label: "Male" },
                { value: "female", label: "Female" },
              ]}
            />
            <p className="label mt-6 mb-2">How active are you?</p>
            <Segmented
              name="activity"
              label="Activity"
              value={d.activity}
              onChange={(activity) => setD({ ...d, activity })}
              options={(Object.keys(ACTIVITY) as Activity[]).map((a) => ({ value: a, label: ACTIVITY[a].label }))}
            />
          </fieldset>
        )}

        {step === 1 && (
          <ChoiceList
            legend="What are you aiming for?"
            sub="You can change this any time from the header."
            name="goal"
            value={d.goal}
            onChange={(goal) => setD({ ...d, goal })}
            options={GOALS.map((g) => ({ value: g.value, title: g.title, line: g.line }))}
          />
        )}

        {step === 2 && (
          <ChoiceList
            legend="What's the usual budget?"
            sub="This sets the default filter. Broke days and treat days are one tap away."
            name="tier"
            value={d.tier}
            onChange={(tier) => setD({ ...d, tier })}
            options={TIERS.map((t) => ({ value: t.value, title: t.title, meta: t.range, line: t.line, tier: t.value }))}
          />
        )}

        {step === 3 && (
          <fieldset>
            <legend className="text-2xl font-bold tracking-tight">What&apos;s in your room?</legend>
            <p className="mt-1 text-sm text-muted">
              Recipes that need gear you don&apos;t have get hidden. Tick nothing and you get no-cook recipes only.
            </p>
            <div className="mt-5 grid grid-cols-1 gap-2">
              {ALL_GEAR.map((g) => {
                const on = d.gear.includes(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggleGear(g.id)}
                    className={`flex min-h-14 items-center gap-3 rounded-md border-[1.5px] px-4 text-left font-semibold ${
                      on ? "border-ink bg-surface" : "border-rule-strong bg-surface text-muted"
                    }`}
                  >
                    <Icon name={GEAR_ICON[g.id]} size={28} />
                    <span className="flex-1">{g.label}</span>
                    <span
                      aria-hidden
                      className={`flex h-6 w-6 items-center justify-center rounded-[4px] border-[1.5px] ${
                        on ? "border-accent bg-accent text-accent-ink" : "border-rule-strong"
                      }`}
                    >
                      {on && <Icon name="check" size={18} strokeWidth={2.5} />}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        {step === 4 && profile && <Summary profile={profile} />}
        {step === 4 && !profile && (
          <p className="mt-6">Some answers are missing. Go back and fill them in, or skip for now.</p>
        )}
      </div>

      <div className="sticky bottom-0 mt-6 flex gap-3 bg-bg pb-[env(safe-area-inset-bottom)] pt-3">
        {step > 0 && (
          <button type="button" className="btn btn-ghost" onClick={() => setStep(step - 1)}>
            Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button type="button" className="btn btn-primary flex-1" disabled={!canNext} onClick={() => setStep(step + 1)}>
            Next
          </button>
        ) : (
          <button type="button" className="btn btn-primary flex-1" disabled={!profile} onClick={finish}>
            {editing ? "Save my targets" : "Save and start cooking"}
          </button>
        )}
      </div>
    </div>
  );
}

function NumField({
  label,
  unit,
  value,
  onChange,
  error,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  error: string;
}) {
  const id = `f-${label.toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="label block">
        {label}
      </label>
      <div className="relative mt-1.5">
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          className="field num pr-12 text-lg"
          value={value}
          aria-invalid={!!error}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, "").slice(0, 5))}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">{unit}</span>
      </div>
    </div>
  );
}

function ChoiceList<T extends string>({
  legend,
  sub,
  name,
  value,
  onChange,
  options,
}: {
  legend: string;
  sub: string;
  name: string;
  value: T | null;
  onChange: (v: T) => void;
  options: { value: T; title: string; line: string; meta?: string; tier?: Tier }[];
}) {
  return (
    <fieldset>
      <legend className="text-2xl font-bold tracking-tight">{legend}</legend>
      <p className="mt-1 text-sm text-muted">{sub}</p>
      <div role="radiogroup" aria-label={legend} className="mt-5 flex flex-col gap-2">
        {options.map((o) => {
          const on = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              name={name}
              aria-checked={on}
              onClick={() => onChange(o.value)}
              className={`flex min-h-16 items-start gap-3 rounded-md border-[1.5px] bg-surface px-4 py-3 text-left ${
                on ? "border-ink" : "border-rule-strong"
              }`}
            >
              <span
                aria-hidden
                className={`mt-1 h-5 w-5 shrink-0 rounded-full border-[1.5px] ${on ? "border-ink bg-accent" : "border-rule-strong"}`}
              />
              <span className="flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className={`text-lg font-bold ${o.tier ? `tier-${o.tier}` : ""}`}>{o.title}</span>
                  {o.meta && <span className="text-sm text-muted">{o.meta}</span>}
                </span>
                <span className="mt-0.5 block text-sm text-muted">{o.line}</span>
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function Summary({ profile: p }: { profile: Profile }) {
  const t = targets(p);
  const b = bmr(p);
  const fmt = (n: number) => Math.round(n).toLocaleString("en-IN");
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">Your daily numbers</h2>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-md border-[1.5px] border-ink bg-surface p-4">
          <p className="label">Calories</p>
          <p className="num mt-1 text-3xl font-bold" data-testid="summary-kcal">
            {fmt(t.kcal)}
          </p>
          <p className="text-sm text-muted">kcal a day</p>
        </div>
        <div className="rounded-md border-[1.5px] border-ink bg-surface p-4">
          <p className="label">Protein</p>
          <p className="num mt-1 text-3xl font-bold" data-testid="summary-protein">
            {t.protein}
          </p>
          <p className="text-sm text-muted">grams a day</p>
        </div>
      </div>

      <h3 className="label mt-6 border-b border-rule pb-1.5">How we got there</h3>
      <ol className="mt-3 space-y-3 text-[0.95rem] leading-relaxed">
        <li>
          <strong>Resting burn.</strong> Your body uses about <span className="num font-semibold">{fmt(b)}</span> kcal a day
          just keeping you alive. That&apos;s the Mifflin–St Jeor formula:{" "}
          <span className="num text-sm text-muted">
            10 × {p.weightKg} kg + 6.25 × {p.heightCm} cm − 5 × {p.age} {p.sex === "male" ? "+ 5" : "− 161"}
          </span>
          .
        </li>
        <li>
          <strong>Moving around.</strong> {ACTIVITY[p.activity].label} means multiplying by{" "}
          <span className="num font-semibold">{t.factor}</span>, so you burn about{" "}
          <span className="num font-semibold">{fmt(t.maintenance)}</span> kcal on a normal day.
        </li>
        <li>
          <strong>Your goal.</strong> {GOAL_LABEL[p.goal]}:{" "}
          {t.adjust === 0 ? (
            <>no change, so you eat what you burn.</>
          ) : (
            <>
              {t.adjust > 0 ? "add" : "take off"} <span className="num font-semibold">{Math.abs(t.adjust)}</span> kcal, which
              lands at <span className="num font-semibold">{fmt(t.kcal)}</span>.
            </>
          )}
        </li>
        <li>
          <strong>Protein.</strong> <span className="num font-semibold">{t.proteinPerKg}</span> g for every kg you weigh:{" "}
          <span className="num font-semibold">
            {t.proteinPerKg} × {p.weightKg} = {t.protein} g
          </span>
          .
        </li>
      </ol>
      <p className="mt-4 text-sm text-muted">
        These are estimates, not medical advice. If you have a health condition, check with a doctor.
      </p>
    </div>
  );
}
