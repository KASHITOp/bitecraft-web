import type { Ingredient, Store } from "./types";

export const PRICE_LABEL = "Sample prices, Oct 2026";

export const STORES: { id: Store; name: string; url: string }[] = [
  { id: "zepto", name: "Zepto", url: "https://www.zeptonow.com/" },
  { id: "blinkit", name: "Blinkit", url: "https://blinkit.com/" },
  { id: "instamart", name: "Instamart", url: "https://www.swiggy.com/instamart" },
];

export interface BasketLine {
  ingredientId: string;
  qty: number;
}

export interface StoreTotal {
  store: Store;
  total: number;
  lines: { ingredientId: string; packs: number; price: number }[];
}

export interface Comparison {
  totals: StoreTotal[];
  cheapest: Store;
  priciest: Store;
  savings: number;
  unknown: string[];
}

export function packsNeeded(ing: Ingredient, qty: number): number {
  return Math.max(1, Math.ceil(qty / ing.pack.size - 1e-9));
}

/** Merge duplicate ingredients so each pack is counted once. */
export function mergeLines(lines: readonly BasketLine[]): BasketLine[] {
  const m = new Map<string, number>();
  for (const l of lines) m.set(l.ingredientId, (m.get(l.ingredientId) ?? 0) + l.qty);
  return [...m].map(([ingredientId, qty]) => ({ ingredientId, qty }));
}

/** Basket total per store. Picks the cheapest; ties go to the first store. */
export function compareBasket(
  lines: readonly BasketLine[],
  ing: ReadonlyMap<string, Ingredient>,
): Comparison {
  const merged = mergeLines(lines);
  const unknown = merged.filter((l) => !ing.has(l.ingredientId)).map((l) => l.ingredientId);
  const known = merged.filter((l) => ing.has(l.ingredientId));
  const totals: StoreTotal[] = STORES.map(({ id }) => {
    const rows = known.map((l) => {
      const i = ing.get(l.ingredientId)!;
      const packs = packsNeeded(i, l.qty);
      return { ingredientId: l.ingredientId, packs, price: packs * i.prices[id] };
    });
    return { store: id, total: rows.reduce((s, r) => s + r.price, 0), lines: rows };
  });
  let cheapest = totals[0];
  let priciest = totals[0];
  for (const t of totals) {
    if (t.total < cheapest.total) cheapest = t;
    if (t.total > priciest.total) priciest = t;
  }
  return {
    totals,
    cheapest: cheapest.store,
    priciest: priciest.store,
    savings: priciest.total - cheapest.total,
    unknown,
  };
}
