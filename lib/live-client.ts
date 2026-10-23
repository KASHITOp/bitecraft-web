/**
 * Browser side of live prices: calls /api/prices (or the deployed site from the Android app)
 * and keeps a 6-hour copy in localStorage so repeat visits don't spend credits.
 */
import type { LivePricesResponse } from "./live-prices";
import type { UserLocation } from "./location";
import { read, write } from "./storage";

const CACHE_MS = 6 * 60 * 60 * 1000;
const MAX_ENTRIES = 20;
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/+$/, "");

type Live = Extract<LivePricesResponse, { mode: "live" }>;
interface Entry {
  at: number;
  data: Live;
}
type CacheMap = Record<string, Entry>;

const cleanMap = (v: unknown): CacheMap | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as CacheMap) : null);

export function liveKey(ids: readonly string[], loc: UserLocation): string {
  return `${[...new Set(ids)].sort().join(",")}|${loc.lat.toFixed(2)}|${loc.lon.toFixed(2)}`;
}

/** Saved live prices for this basket and place, if any (any age; the caller decides). */
export function cachedLive(ids: readonly string[], loc: UserLocation): Entry | null {
  const map = read<CacheMap>("livePrices", {}, cleanMap);
  const e = map[liveKey(ids, loc)];
  return e && e.data?.mode === "live" && Array.isArray(e.data.items) ? e : null;
}

function save(ids: readonly string[], loc: UserLocation, data: Live) {
  const map = { ...read<CacheMap>("livePrices", {}, cleanMap), [liveKey(ids, loc)]: { at: Date.now(), data } };
  const keys = Object.keys(map).sort((a, b) => map[b].at - map[a].at);
  for (const k of keys.slice(MAX_ENTRIES)) delete map[k];
  write("livePrices", map);
}

/**
 * Live prices for a basket. Only ever called from a user tap.
 * Fresh saved prices (< 6 h) are returned without a network call unless `refresh` is set.
 * Never throws: falls back to saved prices (any age) or { mode: "sample" }.
 */
export async function fetchLive(
  ids: readonly string[],
  loc: UserLocation,
  opts: { refresh?: boolean } = {},
): Promise<{ data: LivePricesResponse; fromPhone: boolean }> {
  const saved = cachedLive(ids, loc);
  if (!opts.refresh && saved && Date.now() - saved.at < CACHE_MS) return { data: saved.data, fromPhone: true };

  // The Android app has no server of its own; without a deployed site to call, it can only show sample prices.
  if (process.env.NEXT_PUBLIC_MOBILE === "1" && !API_BASE) {
    return { data: { mode: "sample", reason: "Live prices need an internet connection to the BiteCraft site." }, fromPhone: false };
  }
  try {
    const res = await fetch(`${API_BASE}/api/prices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, lat: loc.lat, lon: loc.lon, pincode: loc.pincode, refresh: !!opts.refresh }),
    });
    const data = (await res.json()) as LivePricesResponse;
    if (data?.mode === "live" && Array.isArray(data.items)) {
      save(ids, loc, data);
      return { data, fromPhone: false };
    }
    if (saved) return { data: { ...saved.data, note: data?.mode === "sample" ? data.reason : saved.data.note }, fromPhone: true };
    return { data: data?.mode === "sample" ? data : { mode: "sample", reason: "Couldn't reach the stores just now." }, fromPhone: false };
  } catch {
    if (saved) return { data: { ...saved.data, note: "You're offline, so these are the last prices saved on this phone." }, fromPhone: true };
    return { data: { mode: "sample", reason: "You're offline, so these are sample prices." }, fromPhone: false };
  }
}
