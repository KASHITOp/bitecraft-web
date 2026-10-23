"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./Icon";
import { dualName, ING } from "@/lib/data";
import { cachedLive, fetchLive } from "@/lib/live-client";
import { ago, basketSummary, LIVE_NOTE, LIVE_STORES, type LiveItem, type LiveOffer, type LivePricesResponse } from "@/lib/live-prices";
import { useLocation } from "@/lib/state";
import { useHydrated } from "@/lib/useStored";

type Live = Extract<LivePricesResponse, { mode: "live" }>;
const storeName = (id: string) => LIVE_STORES.find((s) => s.id === id)?.name ?? id;

/**
 * Live prices for a basket of ingredients. Nothing is fetched until the user taps
 * "Check live prices" (or arrives from such a tap with autoStart). Saved results show at once.
 */
export function LivePrices({
  ids,
  autoStart = false,
  onLive,
}: {
  ids: string[];
  autoStart?: boolean;
  onLive?: (live: boolean) => void;
}) {
  const hydrated = useHydrated();
  const [loc] = useLocation();
  const [result, setResult] = useState<{ data: LivePricesResponse; key: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [, tick] = useState(0);
  const key = `${ids.join(",")}|${loc.lat}|${loc.lon}`;

  // Fresh-enough prices saved on this phone from an earlier tap: show them, spend nothing.
  const saved = useMemo(() => (hydrated && ids.length ? cachedLive(ids, loc) : null), [hydrated, ids, loc]);
  const current: LivePricesResponse | null = result?.key === key ? result.data : saved ? saved.data : null;
  const live: Live | null = current?.mode === "live" ? current : null;

  useEffect(() => {
    onLive?.(!!live);
  }, [live, onLive]);

  // keep "Updated 12 min ago" honest
  useEffect(() => {
    if (!live) return;
    const t = window.setInterval(() => tick((n) => n + 1), 60_000);
    return () => window.clearInterval(t);
  }, [live]);

  const run = async (refresh = false) => {
    if (busy || !ids.length) return;
    setBusy(true);
    const r = await fetchLive(ids, loc, { refresh });
    setResult({ data: r.data, key });
    setBusy(false);
  };

  // arrived here from a "Check live prices" tap on a recipe or the shopping list
  const started = useRef(false);
  useEffect(() => {
    if (!autoStart || !hydrated || started.current || !ids.length) return;
    started.current = true;
    const t = window.setTimeout(() => void run(), 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, hydrated, ids.length]);

  if (!ids.length) return null;

  return (
    <section className="px-4 pt-3" data-testid="live-prices" aria-busy={busy}>
      <div className="flex items-center justify-between gap-2 border-b border-rule pb-1.5">
        <h2 className="label">Live prices</h2>
        <span className="text-xs text-muted">
          near {loc.label}{" "}
          <Link href="/more#area" className="font-semibold text-ink underline underline-offset-4">
            Change
          </Link>
        </span>
      </div>

      {!live && !busy && (
        <div className="mt-3">
          {current?.mode === "sample" && (
            <p className="mb-3 rounded-md border-[1.5px] border-dashed border-rule-strong bg-surface px-3 py-2 text-sm" data-testid="live-fallback">
              {current.reason} Showing <strong>sample prices</strong> below.
            </p>
          )}
          <button type="button" className="btn btn-primary w-full" onClick={() => void run()} data-testid="check-live">
            <Icon name="store" size={20} />
            {current?.mode === "sample" ? "Try live prices again" : "Check live prices"}
          </button>
          <p className="mt-1.5 text-xs text-muted">Checks Zepto, Blinkit, Instamart and Flipkart Minutes near you.</p>
        </div>
      )}

      {busy && (
        <p className="mt-3 flex items-center gap-2 text-sm font-semibold" role="status">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
          Checking {LIVE_STORES.length} stores for {ids.length} item{ids.length === 1 ? "" : "s"}…
        </p>
      )}

      {live && <LiveResult live={live} busy={busy} onRefresh={() => void run(true)} />}
    </section>
  );
}

function LiveResult({ live, busy, onRefresh }: { live: Live; busy: boolean; onRefresh: () => void }) {
  const sum = basketSummary(live.items);
  const cheapest = sum.stores.find((s) => s.store === sum.cheapest);
  return (
    <div data-testid="live-result">
      <div className="mt-2 flex items-center justify-between gap-2 text-sm">
        <span className="text-muted" data-testid="live-updated">
          Updated {ago(live.fetchedAt)}
        </span>
        <button type="button" className="tap inline-flex items-center gap-1 px-2 font-semibold" onClick={onRefresh} disabled={busy}>
          <Icon name="refresh" size={18} />
          Refresh
        </button>
      </div>
      {live.note && (
        <p className="mt-1 rounded-md bg-accent-soft px-3 py-2 text-sm" role="status">
          {live.note}
        </p>
      )}

      <div className="mt-2 grid grid-cols-2 gap-2" data-testid="live-totals">
        {sum.stores.map((s) => {
          const best = s.store === sum.cheapest;
          return (
            <div
              key={s.store}
              className={`rounded-md border-[1.5px] bg-surface p-2.5 ${best ? "border-accent" : "border-rule"}`}
              data-testid={`live-store-${s.store}`}
              data-cheapest={best ? "true" : "false"}
            >
              <p className="text-sm font-bold">{storeName(s.store)}</p>
              <p className="num mt-0.5 text-2xl font-bold">{s.available ? `₹${s.total}` : "–"}</p>
              <p className="text-xs text-muted">
                {s.available === s.items ? (
                  s.items === 1 ? (
                    "in stock"
                  ) : (
                    <>
                      all <span className="num">{s.items}</span> items
                    </>
                  )
                ) : (
                  <>
                    <span className="num">{s.available}</span> of <span className="num">{s.items}</span> items available
                  </>
                )}
              </p>
              {best && (
                <p className="mt-1 inline-flex rounded-[4px] bg-accent px-1.5 py-0.5 text-[0.7rem] font-bold uppercase text-accent-ink">
                  Cheapest
                </p>
              )}
            </div>
          );
        })}
      </div>
      {cheapest && (
        <p className="pt-2 text-[0.95rem]" data-testid="live-savings">
          {sum.savings > 0 ? (
            <>
              <strong>{storeName(cheapest.store)}</strong> is cheapest for this basket: you save{" "}
              <span className="num font-semibold">₹{sum.savings}</span> over the priciest store.
            </>
          ) : (
            <>The stores with the most items come to the same total.</>
          )}
        </p>
      )}

      <ul className="mt-3 flex flex-col gap-2.5">
        {live.items.map((it) => (
          <ItemCard key={it.id} item={it} lowest={sum.lowest[it.id]} />
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted" data-testid="live-note">
        {LIVE_NOTE}
      </p>
    </div>
  );
}

function ItemCard({ item, lowest }: { item: LiveItem; lowest: string | null }) {
  const ing = ING.get(item.id);
  const offers = LIVE_STORES.map((s) => ({ store: s, offer: item.offers[s.id] }));
  const hero = (lowest && item.offers[lowest as keyof typeof item.offers]?.product) || offers.find((o) => o.offer?.product)?.offer?.product;
  return (
    <li className="overflow-hidden rounded-md border border-rule bg-surface" data-testid="live-item">
      <div className="flex gap-3 p-3">
        {hero?.image ? (
          // product photos come from the stores' CDNs; next/image would need every host allow-listed
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hero.image} alt="" width={64} height={64} referrerPolicy="no-referrer" className="h-16 w-16 shrink-0 rounded-[4px] bg-white object-contain" />
        ) : (
          <span className="h-16 w-16 shrink-0 rounded-[4px] bg-surface-2" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-bold leading-snug">{ing ? dualName(ing, 1) : item.query}</p>
          {hero && (
            <p className="mt-0.5 text-sm text-muted">
              {hero.brand && !hero.name.toLowerCase().startsWith(hero.brand.toLowerCase()) ? `${hero.brand} ` : ""}
              {hero.name}
            </p>
          )}
          <span className="mt-1 inline-flex rounded-full border border-rule-strong px-2 py-0.5 text-xs">
            You need about <span className="num ml-1">{item.packSize}</span>
          </span>
        </div>
      </div>
      <ul className="divide-y divide-rule border-t border-rule">
        {offers.map(({ store, offer }) => (
          <StoreRow key={store.id} store={store.name} offer={offer} lowest={lowest === store.id} />
        ))}
      </ul>
    </li>
  );
}

function StoreRow({ store, offer, lowest }: { store: string; offer: LiveOffer | undefined; lowest: boolean }) {
  const p = offer?.product;
  const label =
    !offer || offer.status === "error"
      ? "Couldn't load"
      : offer.status === "nomatch"
        ? "Not found"
        : offer.status === "skipped"
          ? "Not checked today"
          : offer.status === "out"
            ? "Out of stock"
            : null;
  return (
    <li className={`flex items-center gap-2 px-3 py-2 ${lowest ? "bg-accent-soft" : ""}`} data-testid="live-row" data-status={offer?.status ?? "error"}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{store}</p>
        {p && (
          <p className="truncate text-xs text-muted">
            {p.quantity && <span className="num">{p.quantity}</span>}
            {p.quantity && " · "}
            {p.name}
          </p>
        )}
      </div>
      {label ? (
        <span className={`text-sm ${offer?.status === "out" ? "font-semibold text-chilli" : "text-muted"}`}>{label}</span>
      ) : (
        <div className="text-right">
          <p className="flex items-center justify-end gap-1.5">
            {lowest && (
              <span className="rounded-[4px] bg-accent px-1 py-0.5 text-[0.65rem] font-bold uppercase text-accent-ink" data-testid="lowest">
                Lowest
              </span>
            )}
            <span className="num text-base font-bold">₹{p!.offerPrice}</span>
          </p>
          <p className="num text-xs text-muted">
            {p!.mrp && p!.mrp > p!.offerPrice ? <s className="mr-1">₹{p!.mrp}</s> : null}
            {offer?.perUnit?.label}
          </p>
        </div>
      )}
      {p?.deeplink && offer?.status === "ok" && (
        <a
          href={p.deeplink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 shrink-0 items-center rounded-md border-[1.5px] border-ink px-2 text-xs font-semibold"
        >
          Buy on {store}
        </a>
      )}
    </li>
  );
}
