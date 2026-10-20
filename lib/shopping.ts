import type { ShoppingItem } from "./state";
import type { Ingredient } from "./types";

export interface NewShoppingItem {
  ingredientId?: string;
  name: string;
  qty?: number;
  unit?: string;
  from: string;
}

/** Add items to the list, merging the same ingredient and summing quantities. */
export function mergeShopping(list: readonly ShoppingItem[], items: readonly NewShoppingItem[]): ShoppingItem[] {
  const out = list.map((i) => ({ ...i, from: [...i.from] }));
  for (const it of items) {
    const key = it.ingredientId ?? `free:${it.name.trim().toLowerCase()}`;
    const existing = out.find((x) => x.key === key);
    if (existing) {
      if (it.qty !== undefined) existing.qty = Math.round(((existing.qty ?? 0) + it.qty) * 10) / 10;
      if (!existing.from.includes(it.from)) existing.from.push(it.from);
      existing.done = false;
    } else {
      out.push({
        key,
        ingredientId: it.ingredientId,
        name: it.name,
        qty: it.qty,
        unit: it.unit,
        from: [it.from],
        done: false,
      });
    }
  }
  return out;
}

export function fromIngredient(ing: Ingredient, qty: number, from: string): NewShoppingItem {
  return { ingredientId: ing.id, name: ing.name, qty, unit: ing.unit, from };
}
