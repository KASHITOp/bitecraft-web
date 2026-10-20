"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { EmptyState, PageTitle, Section } from "@/components/ui";
import { dualName, ING, INGREDIENTS } from "@/lib/data";
import { daysUntil, expiringSoon } from "@/lib/pantry";
import { searchIngredients } from "@/lib/search";
import { usePantry, type PantryItem } from "@/lib/state";
import type { IngredientCategory } from "@/lib/types";

const STAPLES = [
  "onion",
  "tomato",
  "potato",
  "egg",
  "rice",
  "poha",
  "oats",
  "milk",
  "curd",
  "bread",
  "instant-noodles",
  "masoor-dal",
  "salt",
  "oil",
  "turmeric",
  "chilli-powder",
  "garlic",
  "ginger",
  "green-chilli",
  "peanuts",
  "banana",
  "paneer",
];

const CATEGORY_ORDER: IngredientCategory[] = [
  "Vegetables",
  "Fruit",
  "Dairy & eggs",
  "Grains & bread",
  "Dal & pulses",
  "Meat & fish",
  "Packaged",
  "Masala & condiments",
  "Oil & ghee",
];

export function Pantry() {
  const [pantry, setPantry] = usePantry();
  const [query, setQuery] = useState("");
  const have = useMemo(() => new Set(pantry.map((p) => p.id)), [pantry]);
  const matches = useMemo(() => searchIngredients(query, INGREDIENTS).slice(0, 8), [query]);

  const add = (id: string) => {
    if (have.has(id)) return;
    setPantry((prev) => [...prev, { id, addedAt: Date.now() }]);
  };
  const remove = (id: string) => setPantry((prev) => prev.filter((p) => p.id !== id));
  const setExpiry = (id: string, expiry: string | undefined) =>
    setPantry((prev) => prev.map((p) => (p.id === id ? { ...p, expiry } : p)));

  const soon = pantry.filter((p) => expiringSoon(p.expiry)).sort((a, b) => (a.expiry! < b.expiry! ? -1 : 1));
  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: pantry
      .filter((p) => ING.get(p.id)?.category === cat && !expiringSoon(p.expiry))
      .sort((a, b) => ING.get(a.id)!.name.localeCompare(ING.get(b.id)!.name)),
  })).filter((g) => g.items.length);

  return (
    <div>
      <PageTitle sub="What's in your room right now. Recipes get matched against this.">Pantry</PageTitle>

      <div className="px-4">
        <label htmlFor="pantry-search" className="label">
          Add an item
        </label>
        <div className="relative mt-1.5">
          <Icon name="search" size={20} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            id="pantry-search"
            type="search"
            className="field pl-10"
            placeholder="pyaz, dahi, atta, anda…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
        </div>
        {query.trim() && (
          <ul className="mt-2 divide-y divide-rule rounded-md border border-rule bg-surface" aria-label="Matching ingredients">
            {matches.length === 0 && <li className="px-3 py-3 text-sm text-muted">No ingredient by that name yet.</li>}
            {matches.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  className="flex min-h-12 w-full items-center gap-3 px-3 text-left disabled:opacity-60"
                  onClick={() => {
                    add(i.id);
                    setQuery("");
                  }}
                  disabled={have.has(i.id)}
                >
                  <Icon name={have.has(i.id) ? "check" : "plus"} size={20} />
                  <span className="flex-1">
                    <span className="font-semibold">{i.name}</span>
                    <span className="block text-xs text-muted">{i.aliases.slice(0, 4).join(", ")}</span>
                  </span>
                  {have.has(i.id) && <span className="text-xs text-muted">Already in</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>


      {pantry.length === 0 ? (
        <>
        <Section label="Quick add">
          <div className="flex flex-wrap gap-2">
            {STAPLES.filter((id) => !have.has(id)).map((id) => (
              <button key={id} type="button" className="chip" onClick={() => add(id)}>
                <Icon name="plus" size={16} />
                {ING.get(id)!.name.replace(/ \(.*\)$/, "")}
              </button>
            ))}
            {STAPLES.every((id) => have.has(id)) && <p className="text-sm text-muted">All the staples are in. Well stocked.</p>}
          </div>
        </Section>
            <EmptyState text="Nothing in here yet. Tap a staple above to start." />
        </>
      ) : (
        <>
          <div className="px-4 pt-2">
            <Link href="/?pantry=1" className="btn btn-primary w-full text-lg" data-testid="what-can-i-make">
              What can I make?
            </Link>
          </div>

          {soon.length > 0 && (
            <Section label="Use these first">
              <ul className="divide-y divide-rule">
                {soon.map((p) => (
                  <PantryRow key={p.id} item={p} onRemove={remove} onExpiry={setExpiry} />
                ))}
              </ul>
            </Section>
          )}

          {grouped.map((g) => (
            <Section key={g.cat} label={g.cat}>
              <ul className="divide-y divide-rule">
                {g.items.map((p) => (
                  <PantryRow key={p.id} item={p} onRemove={remove} onExpiry={setExpiry} />
                ))}
              </ul>
            </Section>
          ))}


          <Section label="Quick add">
            <div className="flex flex-wrap gap-2">
              {STAPLES.filter((id) => !have.has(id)).map((id) => (
                <button key={id} type="button" className="chip" onClick={() => add(id)}>
                  <Icon name="plus" size={16} />
                  {ING.get(id)!.name.replace(/ \(.*\)$/, "")}
                </button>
              ))}
              {STAPLES.every((id) => have.has(id)) && <p className="text-sm text-muted">All the staples are in. Well stocked.</p>}
            </div>
          </Section>
              <div className="px-4 py-4">
            <button
              type="button"
              className="tap text-sm font-semibold text-chilli underline underline-offset-4"
              onClick={() => {
                if (window.confirm("Empty the whole pantry?")) setPantry([]);
              }}
            >
              Empty the pantry
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function PantryRow({
  item,
  onRemove,
  onExpiry,
}: {
  item: PantryItem;
  onRemove: (id: string) => void;
  onExpiry: (id: string, v: string | undefined) => void;
}) {
  const ing = ING.get(item.id);
  const [editing, setEditing] = useState(false);
  if (!ing) return null;
  const soon = expiringSoon(item.expiry);
  const days = item.expiry ? daysUntil(item.expiry) : null;
  const when =
    days === null ? null : days < 0 ? "Expired" : days === 0 ? "Use today" : days === 1 ? "Use by tomorrow" : `Use in ${days} days`;

  return (
    <li
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 py-2 ${soon ? "-mx-2 rounded-md border-l-4 border-chilli bg-chilli-soft px-2" : ""}`}
      data-testid="pantry-item"
    >
      <span className="min-w-0 flex-1">
        <span className="font-semibold">{dualName(ing)}</span>
        {when && (
          <span className={`block text-xs font-semibold ${soon ? "text-chilli" : "text-muted"}`}>
            {when} <span className="num font-normal">({item.expiry})</span>
          </span>
        )}
      </span>
      {editing || item.expiry ? (
        <label className="flex items-center gap-1 text-xs text-muted">
          <span className="sr-only">Expiry date for {ing.name}</span>
          <input
            type="date"
            className="field num h-10 min-h-10 w-[9.5rem] px-2 text-sm"
            value={item.expiry ?? ""}
            onChange={(e) => onExpiry(item.id, e.target.value || undefined)}
          />
        </label>
      ) : (
        <button type="button" className="tap px-2 text-sm font-semibold underline underline-offset-4" onClick={() => setEditing(true)}>
          Add expiry
        </button>
      )}
      <button type="button" className="tap flex items-center justify-center" aria-label={`Remove ${ing.name}`} onClick={() => onRemove(item.id)}>
        <Icon name="x" size={20} />
      </button>
    </li>
  );
}
