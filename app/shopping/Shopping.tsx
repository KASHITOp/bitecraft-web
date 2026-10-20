"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { BackLink, EmptyState, PageTitle, Section } from "@/components/ui";
import { dualName, formatQty, ING } from "@/lib/data";
import { packsNeeded } from "@/lib/prices";
import { mergeShopping } from "@/lib/shopping";
import { usePantry, useShopping, type ShoppingItem } from "@/lib/state";

const ORDER = [
  "Vegetables",
  "Fruit",
  "Dairy & eggs",
  "Grains & bread",
  "Dal & pulses",
  "Meat & fish",
  "Packaged",
  "Masala & condiments",
  "Oil & ghee",
  "Other",
];

export function Shopping() {
  const [list, setList] = useShopping();
  const [, setPantry] = usePantry();
  const [text, setText] = useState("");

  const toggle = (key: string) => setList((prev) => prev.map((i) => (i.key === key ? { ...i, done: !i.done } : i)));
  const ticked = list.filter((i) => i.done);

  const groups = ORDER.map((cat) => ({
    cat,
    items: list.filter((i) => (i.ingredientId ? ING.get(i.ingredientId)?.category ?? "Other" : "Other") === cat),
  })).filter((g) => g.items.length);

  const addFree = () => {
    const name = text.trim();
    if (!name) return;
    setList((prev) => mergeShopping(prev, [{ name, from: "Added by hand" }]));
    setText("");
  };

  const tickedToPantry = () => {
    const ids = ticked.map((i) => i.ingredientId).filter((x): x is string => !!x);
    setPantry((prev) => {
      const have = new Set(prev.map((p) => p.id));
      return [...prev, ...ids.filter((id) => !have.has(id)).map((id) => ({ id, addedAt: Date.now() }))];
    });
    setList((prev) => prev.filter((i) => !i.done));
  };

  return (
    <div>
      <div className="px-4 pt-2">
        <BackLink href="/more" label="More" />
      </div>
      <PageTitle sub="From recipes and your meal plan. Tick things off in the shop.">Shopping list</PageTitle>

      <form
        className="flex gap-2 px-4"
        onSubmit={(e) => {
          e.preventDefault();
          addFree();
        }}
      >
        <label htmlFor="free-item" className="sr-only">
          Add something else
        </label>
        <input
          id="free-item"
          className="field"
          placeholder="Add something else: soap, Maggi…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="btn shrink-0" aria-label="Add to list">
          <Icon name="plus" size={20} />
        </button>
      </form>

      {list.length === 0 ? (
        <EmptyState
          text="Your list is empty. Add missing items from any recipe, or from your meal plan."
          action={
            <Link href="/" className="btn btn-primary">
              Find a recipe
            </Link>
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-2 px-4 pt-4">
            <Link href="/mart?list=1" className="btn btn-primary flex-1">
              <Icon name="store" size={20} />
              Compare store prices
            </Link>
          </div>
          {groups.map((g) => (
            <Section key={g.cat} label={g.cat}>
              <ul className="divide-y divide-rule">
                {g.items.map((i) => (
                  <Row key={i.key} item={i} onToggle={toggle} />
                ))}
              </ul>
            </Section>
          ))}
          <div className="flex flex-col gap-2 px-4 py-4">
            <button type="button" className="btn" disabled={!ticked.length} onClick={tickedToPantry}>
              <Icon name="jar" size={20} />
              Put ticked items in my pantry
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={!ticked.length}
              onClick={() => setList((prev) => prev.filter((i) => !i.done))}
            >
              Clear ticked
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ item, onToggle }: { item: ShoppingItem; onToggle: (key: string) => void }) {
  const ing = item.ingredientId ? ING.get(item.ingredientId) : undefined;
  const id = `shop-${item.key}`;
  return (
    <li className="flex items-start gap-3 py-2.5" data-testid="shopping-item">
      <input
        id={id}
        type="checkbox"
        className="mt-1 h-6 w-6 shrink-0 accent-[var(--accent)]"
        checked={item.done}
        onChange={() => onToggle(item.key)}
      />
      <label htmlFor={id} className={`flex-1 ${item.done ? "text-muted line-through" : ""}`}>
        <span className="font-semibold">{ing ? dualName(ing) : item.name}</span>
        {ing && item.qty !== undefined && (
          <span className="block text-sm text-muted">
            Need <span className="num">{formatQty(ing, item.qty)}</span> · buy{" "}
            <span className="num">
              {packsNeeded(ing, item.qty)} × {ing.pack.label}
            </span>
          </span>
        )}
        <span className="block text-xs text-muted">For {item.from.join(", ")}</span>
      </label>
    </li>
  );
}
