/**
 * Server-only: QuickCommerce API client with a 6-hour cache and a daily credit limit.
 * Imported only by app/api/prices/route.web.ts. QCAPI_KEY never leaves the server.
 *
 * The cache and the credit counter live in this server process's memory. On Vercel that
 * means per running instance; a restart or a new instance starts empty.
 */
import { z } from "zod";
import { ING } from "./data";
import { LIVE_STORES, pickBest, type LiveItem, type LiveOffer, type LivePlatform, type LivePricesResponse, type QcProduct } from "./live-prices";

const API = "https://api.quickcommerceapi.com/v1/search";
export const CACHE_MS = 6 * 60 * 60 * 1000;
/** A Refresh may re-fetch results older than this; newer ones come from cache (saves credits). */
export const REFRESH_AFTER_MS = 30 * 60 * 1000;
const CALL_TIMEOUT_MS = 15_000;
const CONCURRENCY = 8;

const ProductSchema = z
  .object({
    id: z.union([z.string(), z.number()]).transform(String).optional(),
    name: z.string().min(1),
    brand: z.string().nullish(),
    available: z.boolean().nullish(),
    images: z.array(z.string()).nullish(),
    mrp: z.number().nullish(),
    offer_price: z.number().nullish(),
    quantity: z.string().nullish(),
    deeplink: z.string().nullish(),
    inventory: z.number().nullish(),
    is_ad: z.boolean().nullish(),
    platform: z.object({ sla: z.string().nullish() }).partial().passthrough().nullish(),
  })
  .passthrough();

const SearchSchema = z.object({
  status: z.string(),
  credits_remaining: z.number().nullish(),
  data: z.object({ products: z.array(z.unknown()).default([]) }),
});

export interface Loc {
  lat: number;
  lon: number;
  pincode?: string;
}

interface CacheEntry {
  at: number;
  products: QcProduct[];
}

export interface QcState {
  cache: Map<string, CacheEntry>;
  /** credits used per day, keyed YYYY-MM-DD (India time) */
  used: Map<string, number>;
}

/** Process-wide state. Tests pass their own. */
export const qcState: QcState = { cache: new Map(), used: new Map() };

export interface QcDeps {
  key?: string;
  dailyLimit: number;
  fetch: typeof fetch;
  now: () => number;
  state: QcState;
  log: (msg: string) => void;
}

export function defaultDeps(): QcDeps {
  return {
    key: process.env.QCAPI_KEY || undefined,
    dailyLimit: Number(process.env.QCAPI_DAILY_LIMIT) > 0 ? Number(process.env.QCAPI_DAILY_LIMIT) : 300,
    fetch: (...a) => fetch(...a),
    now: () => Date.now(),
    state: qcState,
    log: (m) => console.log(m),
  };
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function cacheKey(query: string, platform: LivePlatform, loc: Loc): string {
  return `${query.trim().toLowerCase()}|${platform}|${round2(loc.lat).toFixed(2)}|${round2(loc.lon).toFixed(2)}`;
}

/** India date, so the daily limit resets at midnight IST. */
export function dayKey(ms: number): string {
  return new Date(ms + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

async function search(query: string, platform: LivePlatform, loc: Loc, deps: QcDeps): Promise<QcProduct[]> {
  const url = new URL(API);
  url.searchParams.set("q", query);
  url.searchParams.set("platform", platform);
  url.searchParams.set("lat", String(loc.lat));
  url.searchParams.set("lon", String(loc.lon));
  if (loc.pincode) url.searchParams.set("pincode", loc.pincode);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), CALL_TIMEOUT_MS);
  try {
    const res = await deps.fetch(url.toString(), { headers: { "X-API-Key": deps.key! }, signal: ctl.signal });
    if (!res.ok) throw new Error(`QuickCommerce ${platform} ${res.status}`);
    const body = SearchSchema.parse(await res.json());
    return body.data.products.flatMap((p) => {
      const r = ProductSchema.safeParse(p);
      return r.success ? [r.data as QcProduct] : [];
    });
  } finally {
    clearTimeout(timer);
  }
}

async function pool<T>(jobs: (() => Promise<T>)[], n: number): Promise<T[]> {
  const out: T[] = new Array(jobs.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, jobs.length) }, async () => {
      while (next < jobs.length) {
        const i = next++;
        out[i] = await jobs[i]();
      }
    }),
  );
  return out;
}

/**
 * Live prices for these ingredients at this location.
 * - Uses cached results (6 h) whenever possible; Refresh re-fetches only results older than 30 min.
 * - Never spends more than the daily limit; past it, returns what's cached and flags `limited`.
 * - Missing key: { mode: "sample" }. A store that fails shows as "error" for that store only;
 *   if every store fails for every item, the whole answer is { mode: "sample" }.
 */
export async function livePrices(
  ids: readonly string[],
  loc: Loc,
  opts: { refresh?: boolean } = {},
  deps: QcDeps = defaultDeps(),
): Promise<LivePricesResponse> {
  if (!deps.key) return { mode: "sample", reason: "Live prices aren't switched on here." };
  const ingredients = [...new Set(ids)].map((id) => ING.get(id)).filter((i) => !!i);
  if (!ingredients.length) return { mode: "sample", reason: "Nothing to price." };

  const now = deps.now();
  const today = dayKey(now);
  let used = deps.state.used.get(today) ?? 0;
  let creditsUsed = 0;
  let limited = false;

  type Job = { id: string; platform: LivePlatform; key: string; query: string };
  const needed: Job[] = [];
  const results = new Map<string, { products: QcProduct[]; at: number } | "error" | "skipped">();

  for (const ing of ingredients) {
    for (const { id: platform } of LIVE_STORES) {
      const key = cacheKey(ing.searchQuery, platform, loc);
      const hit = deps.state.cache.get(key);
      const fresh = hit && now - hit.at < CACHE_MS;
      const wantsRefresh = opts.refresh && hit && now - hit.at > REFRESH_AFTER_MS;
      if (fresh && !wantsRefresh) results.set(key, hit);
      else needed.push({ id: ing.id, platform, key, query: ing.searchQuery });
    }
  }

  const allowed = Math.max(0, deps.dailyLimit - used);
  const toFetch = needed.slice(0, allowed);
  if (toFetch.length < needed.length) {
    limited = true;
    for (const job of needed.slice(allowed)) {
      // past the limit: fall back to whatever we had, however old
      const old = deps.state.cache.get(job.key);
      results.set(job.key, old ?? "skipped");
    }
  }

  await pool(
    toFetch.map((job) => async () => {
      try {
        used++;
        creditsUsed++;
        const products = await search(job.query, job.platform, loc, deps);
        const entry = { at: deps.now(), products };
        deps.state.cache.set(job.key, entry);
        results.set(job.key, entry);
      } catch (err) {
        deps.log(`[prices] ${job.platform} "${job.query}" failed: ${err instanceof Error ? err.message : err}`);
        const old = deps.state.cache.get(job.key);
        results.set(job.key, old ?? "error");
      }
    }),
    CONCURRENCY,
  );
  deps.state.used.set(today, used);
  deps.log(`[prices] ${ingredients.length} item(s) x ${LIVE_STORES.length} stores: ${creditsUsed} credit(s) used this request, ${used}/${deps.dailyLimit} today`);

  let oldest = now;
  let anyData = false;
  const items: LiveItem[] = ingredients.map((ing) => {
    const offers = {} as Record<LivePlatform, LiveOffer>;
    for (const { id: platform } of LIVE_STORES) {
      const r = results.get(cacheKey(ing.searchQuery, platform, loc));
      if (!r || r === "error") offers[platform] = { status: "error" };
      else if (r === "skipped") offers[platform] = { status: "skipped" };
      else {
        anyData = true;
        oldest = Math.min(oldest, r.at);
        offers[platform] = pickBest(r.products, ing, r.at);
      }
    }
    return { id: ing.id, query: ing.searchQuery, packSize: ing.packSize, offers };
  });

  if (!anyData) {
    return {
      mode: "sample",
      reason: limited ? "Today's live-price limit is used up." : "Couldn't reach the stores just now.",
    };
  }
  return {
    mode: "live",
    items,
    fetchedAt: oldest,
    creditsUsed,
    limited,
    note: limited ? "Today's live-price limit is used up, so some prices are from earlier." : undefined,
  };
}
