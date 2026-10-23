/**
 * Live grocery prices: shared types and pure logic (no network, no secrets).
 * Used by the /api/prices route on the server and by Quick Mart in the browser.
 */

/** Platform names exactly as the QuickCommerce API expects them. */
export type LivePlatform = "Zepto" | "BlinkIt" | "Swiggy" | "Minutes";

export const LIVE_STORES: { id: LivePlatform; name: string }[] = [
  { id: "Zepto", name: "Zepto" },
  { id: "BlinkIt", name: "Blinkit" },
  { id: "Swiggy", name: "Instamart" },
  { id: "Minutes", name: "Flipkart Minutes" },
];

export const LIVE_NOTE = "Live prices via QuickCommerce API. May differ slightly from the app.";

/** A product as the search API returns it (after validation). */
export interface QcProduct {
  id?: string;
  name: string;
  brand?: string | null;
  available?: boolean | null;
  images?: string[] | null;
  mrp?: number | null;
  offer_price?: number | null;
  quantity?: string | null;
  deeplink?: string | null;
  inventory?: number | null;
  is_ad?: boolean | null;
  platform?: { sla?: string | null } | null;
}

export type QtyUnit = "g" | "ml" | "pc";
export interface Qty {
  amount: number;
  unit: QtyUnit;
}

export interface LiveOffer {
  /** ok: matched and in stock; out: matched but out of stock; nomatch: nothing sensible found;
   *  error: the store call failed; skipped: not fetched (daily limit reached, nothing cached) */
  status: "ok" | "out" | "nomatch" | "error" | "skipped";
  product?: {
    name: string;
    brand?: string;
    image?: string;
    quantity?: string;
    offerPrice: number;
    mrp?: number;
    deeplink?: string;
    sla?: string;
  };
  perUnit?: { value: number; label: string };
  /** when this store's result was fetched (ms) */
  fetchedAt?: number;
}

export interface LiveItem {
  id: string;
  query: string;
  packSize: string;
  offers: Record<LivePlatform, LiveOffer>;
}

export type LivePricesResponse =
  | {
      mode: "live";
      items: LiveItem[];
      /** oldest result in this answer (ms) */
      fetchedAt: number;
      /** paid searches this request made */
      creditsUsed: number;
      /** daily credit limit hit: some results are old or missing */
      limited: boolean;
      note?: string;
    }
  | { mode: "sample"; reason: string };

/* ------------------------------------------------------------------ */
/* Quantities                                                          */
/* ------------------------------------------------------------------ */

const UNIT_WORDS: [RegExp, QtyUnit, number][] = [
  [/^(kg|kgs|kilo|kilogram|kilograms)$/, "g", 1000],
  [/^(g|gm|gms|gram|grams|gr|grm)$/, "g", 1],
  [/^(l|lt|ltr|ltrs|litre|litres|liter|liters)$/, "ml", 1000],
  [/^(ml|mls|millilitre|milliliter)$/, "ml", 1],
  [/^(pc|pcs|piece|pieces|unit|units|n|nos|no|slices|slice|pack|packs|bunch|bunches|eggs|egg)$/, "pc", 1],
];

function unitOf(word: string): [QtyUnit, number] | null {
  const w = word.toLowerCase().replace(/\.$/, "");
  for (const [re, unit, mult] of UNIT_WORDS) if (re.test(w)) return [unit, mult];
  return null;
}

/**
 * Every quantity mentioned in a pack label, in base units (g, ml, pc).
 * "2 x 200 ml" -> 400 ml; "500-600 g" -> 550 g; "1 pc (450-550 g)" -> [1 pc, 500 g]; "Pack of 6" -> 6 pc.
 */
export function parseQuantities(text: string | null | undefined): Qty[] {
  if (!text) return [];
  const s = text.toLowerCase().replace(/,/g, " ");
  const out: Qty[] = [];
  // multipacks, written either way round: "2 x 200 ml" or "1000 g X 2"
  const multi = s.match(/(\d+)\s*[x×*]\s*(\d+(?:\.\d+)?)\s*([a-z]+)/);
  if (multi) {
    const u = unitOf(multi[3]);
    if (u) out.push({ amount: Number(multi[1]) * Number(multi[2]) * u[1], unit: u[0] });
  }
  const multiAfter = s.match(/(\d+(?:\.\d+)?)\s*([a-z]+)\s*[x×*]\s*(\d+)(?![\d.]*\s*[a-z])/);
  if (!multi && multiAfter) {
    const u = unitOf(multiAfter[2]);
    if (u) out.push({ amount: Number(multiAfter[1]) * Number(multiAfter[3]) * u[1], unit: u[0] });
  }
  const packOf = s.match(/pack\s*of\s*(\d+)/);
  if (packOf) out.push({ amount: Number(packOf[1]), unit: "pc" });
  const re = /(\d+(?:\.\d+)?)(?:\s*[-–to]+\s*(\d+(?:\.\d+)?))?\s*([a-z]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const u = unitOf(m[3]);
    if (!u) continue;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    const q = { amount: ((a + b) / 2) * u[1], unit: u[0] };
    if (!out.some((x) => x.unit === q.unit && Math.abs(x.amount - q.amount) < 1e-9)) out.push(q);
  }
  return out;
}

/** The quantity in a label that best compares with the target (same unit if possible). */
export function quantityFor(text: string | null | undefined, target: Qty): Qty | null {
  const all = parseQuantities(text);
  return all.find((q) => q.unit === target.unit) ?? all[0] ?? null;
}

/** How far apart two pack sizes are (0 = same). Different units count as far. */
export function sizeDistance(target: Qty, actual: Qty | null): number {
  if (!actual) return 3;
  if (actual.unit !== target.unit || actual.amount <= 0 || target.amount <= 0) return 4;
  return Math.abs(Math.log(actual.amount / target.amount));
}

/** "₹48/kg", "₹56/L", "₹9/pc". Uses the pack's own quantity. */
export function perUnitPrice(price: number, qty: Qty | null): { value: number; label: string } | undefined {
  if (!qty || qty.amount <= 0 || !(price > 0)) return undefined;
  if (qty.unit === "g") {
    const v = price / (qty.amount / 1000);
    return { value: v, label: `₹${fmt(v)}/kg` };
  }
  if (qty.unit === "ml") {
    const v = price / (qty.amount / 1000);
    return { value: v, label: `₹${fmt(v)}/L` };
  }
  const v = price / qty.amount;
  return { value: v, label: `₹${fmt(v)}/pc` };
}

function fmt(v: number): string {
  return v >= 100 ? String(Math.round(v)) : String(Math.round(v * 10) / 10);
}

/* ------------------------------------------------------------------ */
/* Matching a search result to an ingredient                           */
/* ------------------------------------------------------------------ */

/** Product forms that are never the raw ingredient, unless the query itself asks for them. */
const FORM_WORDS = [
  "powder", "chips", "flakes", "paste", "pickle", "sauce", "juice", "puree", "mix", "rings",
  "cookies", "biscuit", "biscuits", "cake", "drink", "candy", "soup", "chutney", "jam", "ketchup",
  "noodles", "namkeen", "seeds", "oil", "masala", "dehydrated", "frozen", "fries", "nuggets", "cubes",
  // multi-product bundles are never the single ingredient
  "combo", "bundle", "kit",
];

const tokenize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => (w.length > 3 && w.endsWith("es") && !w.endsWith("ses") ? w.slice(0, -2) : w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w));

/**
 * Share of the query's words found in the product's name and brand (0..1),
 * or -1 when the product is clearly something else (wrong form or an excluded word).
 */
export function nameScore(product: Pick<QcProduct, "name" | "brand">, query: string, exclude: string[] = []): number {
  const hay = new Set(tokenize(`${product.name} ${product.brand ?? ""}`));
  const q = tokenize(query);
  const qset = new Set(q);
  for (const w of [...FORM_WORDS, ...exclude].flatMap(tokenize)) {
    if (!qset.has(w) && hay.has(w)) return -1;
  }
  const words = q.filter((w) => w.length > 1);
  if (!words.length) return 0;
  const hits = words.filter((w) => hay.has(w)).length;
  return hits / words.length;
}

/**
 * Best product for an ingredient on one store:
 * 1) name matches (best-matching names first), 2) in stock, 3) pack size closest, 4) cheapest.
 * Sponsored results are ignored when there are organic ones.
 */
export function pickBest(
  products: readonly QcProduct[],
  ing: { searchQuery: string; packSize: string; searchExclude?: string[] },
  fetchedAt?: number,
): LiveOffer {
  const target = parseQuantities(ing.packSize)[0] ?? { amount: 1, unit: "pc" as const };
  const organic = products.some((p) => !p.is_ad) ? products.filter((p) => !p.is_ad) : products;
  const scored = organic
    .filter((p) => typeof p.offer_price === "number" && p.offer_price > 0)
    .map((p) => ({ p, score: nameScore(p, ing.searchQuery, ing.searchExclude) }))
    .filter((x) => x.score >= 0.5);
  if (!scored.length) return { status: "nomatch", fetchedAt };

  const best = Math.max(...scored.map((x) => x.score));
  const named = scored.filter((x) => x.score >= best - 1e-9);
  const inStock = (p: QcProduct) => p.available !== false && (p.inventory == null || p.inventory > 0);
  const pool = named.some((x) => inStock(x.p)) ? named.filter((x) => inStock(x.p)) : named;
  const ranked = pool
    .map((x) => {
      const qty = quantityFor(x.p.quantity, target);
      // close sizes (within ~20%) are treated alike so price can decide between them
      return { ...x, qty, bucket: Math.round(sizeDistance(target, qty) / 0.2) };
    })
    .sort((a, b) => a.bucket - b.bucket || a.p.offer_price! - b.p.offer_price!);
  const top = ranked[0];
  const p = top.p;
  return {
    status: inStock(p) ? "ok" : "out",
    product: {
      name: p.name,
      brand: p.brand ?? undefined,
      image: p.images?.[0] ?? undefined,
      quantity: p.quantity ?? undefined,
      offerPrice: p.offer_price!,
      mrp: p.mrp ?? undefined,
      deeplink: p.deeplink ?? undefined,
      sla: p.platform?.sla ?? undefined,
    },
    perUnit: perUnitPrice(p.offer_price!, top.qty),
    fetchedAt,
  };
}

/* ------------------------------------------------------------------ */
/* Basket                                                              */
/* ------------------------------------------------------------------ */

export interface StoreBasket {
  store: LivePlatform;
  total: number;
  available: number;
  items: number;
}

export interface BasketSummary {
  stores: StoreBasket[];
  /** cheapest among the stores that have the most items in stock */
  cheapest: LivePlatform | null;
  /** priciest minus cheapest, among those same stores */
  savings: number;
  /** cheapest in-stock offer per item (for the LOWEST badge) */
  lowest: Record<string, LivePlatform | null>;
}

export function basketSummary(items: readonly LiveItem[], stores: readonly LivePlatform[] = LIVE_STORES.map((s) => s.id)): BasketSummary {
  const sum: StoreBasket[] = stores.map((store) => {
    let total = 0;
    let available = 0;
    for (const it of items) {
      const o = it.offers[store];
      if (o?.status === "ok" && o.product) {
        total += o.product.offerPrice;
        available++;
      }
    }
    return { store, total: Math.round(total), available, items: items.length };
  });
  const most = Math.max(0, ...sum.map((s) => s.available));
  const contenders = most > 0 ? sum.filter((s) => s.available === most) : [];
  let cheapest: StoreBasket | null = null;
  for (const s of contenders) if (!cheapest || s.total < cheapest.total) cheapest = s;
  const priciest = contenders.reduce((m, s) => Math.max(m, s.total), 0);
  const lowest: Record<string, LivePlatform | null> = {};
  for (const it of items) {
    let best: { store: LivePlatform; price: number } | null = null;
    for (const store of stores) {
      const o = it.offers[store];
      if (o?.status === "ok" && o.product && (!best || o.product.offerPrice < best.price)) best = { store, price: o.product.offerPrice };
    }
    lowest[it.id] = best?.store ?? null;
  }
  return { stores: sum, cheapest: cheapest?.store ?? null, savings: cheapest ? priciest - cheapest.total : 0, lowest };
}

/** "just now", "12 min ago", "3 h ago" */
export function ago(ts: number, now = Date.now()): string {
  const min = Math.max(0, Math.round((now - ts) / 60000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  return `${h} h ago`;
}
