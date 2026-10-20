import type { Macros } from "@/lib/types";
import type { Targets } from "@/lib/profile";

/** Daily targets for every macro, derived from kcal and protein targets. */
export function dailyMacroTargets(t: Targets | null): Macros {
  const kcal = t?.kcal ?? 2000;
  const protein = t?.protein ?? 60;
  const fat = (kcal * 0.28) / 9;
  const carbs = Math.max(0, (kcal - protein * 4 - fat * 9) / 4);
  return { kcal, protein, carbs, fat, fibre: 30 };
}

const ROWS: { key: keyof Macros; label: string; unit: string }[] = [
  { key: "kcal", label: "Calories", unit: "kcal" },
  { key: "protein", label: "Protein", unit: "g" },
  { key: "carbs", label: "Carbs", unit: "g" },
  { key: "fat", label: "Fat", unit: "g" },
  { key: "fibre", label: "Fibre", unit: "g" },
];

export function MacroBar({ macros, targets, portion = 1 }: { macros: Macros; targets: Targets | null; portion?: number }) {
  const daily = dailyMacroTargets(targets);
  return (
    <div>
      <dl className="grid grid-cols-1 gap-2.5">
        {ROWS.map((row) => {
          const value = macros[row.key] * portion;
          const pct = daily[row.key] > 0 ? Math.round((value / daily[row.key]) * 100) : 0;
          return (
            <div key={row.key} className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-3">
              <dt className="text-sm font-semibold">{row.label}</dt>
              <dd className="flex flex-col gap-1">
                <span className="text-sm">
                  <span className="num font-semibold">{row.key === "kcal" ? Math.round(value) : Math.round(value * 10) / 10}</span>{" "}
                  <span className="text-muted">{row.unit}</span>
                </span>
                <span className="meter" aria-hidden>
                  <span className={pct > 100 ? "over" : ""} style={{ width: `${Math.min(100, pct)}%` }} />
                </span>
              </dd>
              <dd className="num text-right text-sm text-muted" aria-label={`${pct} percent of your daily ${row.label.toLowerCase()}`}>
                {pct}%
              </dd>
            </div>
          );
        })}
      </dl>
      <p className="mt-2 text-xs text-muted">
        {targets ? "Percent of your daily target, per plate." : "Percent of a 2,000 kcal day. Set your targets for your own numbers."}
      </p>
    </div>
  );
}
