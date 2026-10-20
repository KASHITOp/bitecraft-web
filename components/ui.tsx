"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "./Icon";
import type { EquipTag, Tier } from "@/lib/types";
import { EQUIP_LABEL, TIER_LABEL } from "@/lib/data";

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="px-4 pb-3 pt-5">
      <h1 className="text-2xl font-bold tracking-tight">{children}</h1>
      {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
    </div>
  );
}

export function Section({ label, children, action }: { label: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="px-4 py-3">
      <div className="mb-2 flex items-center justify-between border-b border-rule pb-1.5">
        <h2 className="label">{label}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function TierTag({ tier }: { tier: Tier }) {
  return (
    <span className={`tier-${tier} inline-flex items-center rounded-[4px] border px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide`}>
      {TIER_LABEL[tier]}
    </span>
  );
}

const EQUIP_ICON = { kettle: "kettle", plate: "plate", nocook: "nocook" } as const;

export function EquipTagView({ equip }: { equip: EquipTag }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted">
      <Icon name={EQUIP_ICON[equip]} size={16} />
      {EQUIP_LABEL[equip]}
    </span>
  );
}

export function EquipIcon({ equip, size = 28 }: { equip: EquipTag; size?: number }) {
  return <Icon name={EQUIP_ICON[equip]} size={size} />;
}

/** Single-choice row of chips. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  name,
}: {
  label: string;
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  name: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          name={name}
          aria-checked={value === o.value}
          className="chip"
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <div className="mx-4 my-6 border-y border-dashed border-rule-strong py-6 text-center">
      <p className="text-base">{text}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function BackLink({ href, label = "Back" }: { href: string; label?: string }) {
  return (
    <Link href={href} className="tap -ml-2 inline-flex items-center gap-1 px-2 text-sm font-semibold">
      <Icon name="back" size={20} />
      {label}
    </Link>
  );
}

export function Rupees({ value, className = "" }: { value: number; className?: string }) {
  return <span className={`num ${className}`}>₹{Math.round(value).toLocaleString("en-IN")}</span>;
}
