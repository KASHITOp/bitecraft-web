import Link from "next/link";
import type { Recipe } from "@/lib/types";
import { FAMILY_LABEL } from "@/lib/data";
import { EquipIcon, EquipTagView, TierTag } from "./ui";

/**
 * A recipe row: colour band from the main ingredient family with the
 * equipment drawn on it, then the numbers that decide "can I make this".
 */
export function RecipeCard({ recipe: r, coverage }: { recipe: Recipe; coverage?: { have: number; total: number } }) {
  return (
    <Link
      href={`/recipe?id=${r.id}`}
      className="flex min-h-[92px] items-stretch overflow-hidden rounded-md border border-rule bg-surface transition-colors hover:border-rule-strong"
      data-testid="recipe-card"
      data-tier={r.tier}
      data-equip={r.equipment}
    >
      <span className={`fam fam-${r.family} flex w-[72px] shrink-0 flex-col items-center justify-center gap-1`}>
        <EquipIcon equip={r.equipment} size={30} />
        <span className="text-[0.625rem] font-bold uppercase tracking-wider opacity-90">{FAMILY_LABEL[r.family].split(" ")[0]}</span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 px-3 py-2.5">
        <span className="text-[1.05rem] font-bold leading-snug" data-testid="card-title">
          {r.title}
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span>
            <span className="num font-semibold">₹{r.costPerServing}</span>
            <span className="text-muted"> /plate</span>
          </span>
          <span>
            <span className="num font-semibold">{r.minutes}</span>
            <span className="text-muted"> min</span>
          </span>
          <span>
            <span className="num font-semibold">{Math.round(r.macros.protein)}</span>
            <span className="text-muted"> g protein</span>
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-2">
          <TierTag tier={r.tier} />
          <EquipTagView equip={r.equipment} />
          {coverage && (
            <span className="text-xs font-semibold" data-testid="coverage">
              You have <span className="num">{coverage.have}</span> of <span className="num">{coverage.total}</span>
            </span>
          )}
        </span>
      </span>
    </Link>
  );
}
