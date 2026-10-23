import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { basketSummary, nameScore, parseQuantities, perUnitPrice, pickBest, type LiveItem, type QcProduct } from "@/lib/live-prices";
import { cacheKey, dayKey, livePrices, type QcDeps, type QcState } from "@/lib/qc-server";

// A real BlinkIt search for "toned milk" (Bangalore), saved from one live call.
const milk = JSON.parse(readFileSync(join(__dirname, "fixtures/blinkit-toned-milk.json"), "utf8")) as {
  data: { products: QcProduct[] };
};

const prod = (name: string, quantity: string, offer_price: number, extra: Partial<QcProduct> = {}): QcProduct => ({
  name,
  quantity,
  offer_price,
  mrp: offer_price,
  available: true,
  inventory: 10,
  images: [`https://img/${encodeURIComponent(name)}.jpg`],
  deeplink: `https://store/${encodeURIComponent(name)}`,
  ...extra,
});

describe("product matching", () => {
  it("picks the closest pack size, then the cheapest (real BlinkIt data)", () => {
    const half = pickBest(milk.data.products, { searchQuery: "toned milk", packSize: "500 ml" });
    expect(half.status).toBe("ok");
    expect(half.product?.quantity).toBe("500 ml");
    expect(half.product?.offerPrice).toBe(24); // cheapest of the 500 ml toned milks
    const litre = pickBest(milk.data.products, { searchQuery: "toned milk", packSize: "1 l" });
    expect(litre.product?.quantity).toBe("1 ltr");
  });

  it("prefers the right size over a cheaper wrong size", () => {
    const offer = pickBest(
      [prod("Onion", "500 g", 25), prod("Onion", "1 kg", 42), prod("Onion", "2 kg", 70)],
      { searchQuery: "onion", packSize: "1 kg" },
    );
    expect(offer.product?.quantity).toBe("1 kg");
  });

  it("rejects wrong products: excluded words and processed forms", () => {
    expect(nameScore({ name: "Spring Onion" }, "onion", ["spring"])).toBe(-1);
    expect(nameScore({ name: "Onion Powder" }, "onion")).toBe(-1);
    expect(nameScore({ name: "Red Chilli Powder" }, "red chilli powder")).toBe(1);
    const offer = pickBest([prod("Spring Onion", "100 g", 15), prod("Onion Rings Chips", "100 g", 20), prod("Onion (Kanda)", "1 kg", 44)], {
      searchQuery: "onion",
      packSize: "1 kg",
      searchExclude: ["spring"],
    });
    expect(offer.product?.name).toBe("Onion (Kanda)");
  });

  it("skips out-of-stock products, and says so when nothing is in stock", () => {
    const some = pickBest([prod("Paneer", "200 g", 80, { available: false }), prod("Paneer", "200 g", 95)], { searchQuery: "paneer", packSize: "200 g" });
    expect(some.status).toBe("ok");
    expect(some.product?.offerPrice).toBe(95);
    const none = pickBest([prod("Paneer", "200 g", 80, { inventory: 0 })], { searchQuery: "paneer", packSize: "200 g" });
    expect(none.status).toBe("out");
    expect(pickBest([prod("Shampoo", "200 ml", 99)], { searchQuery: "paneer", packSize: "200 g" }).status).toBe("nomatch");
  });

  it("does not pick a 2 kg combo bundle for a 1 kg need (seen on real Zepto data)", () => {
    const offer = pickBest(
      [prod("Onion Combo", "1000 g X 2", 132, { brand: "BUNDLE" }), prod("Onion (Pyaz)", "1 kg", 49), prod("Onion", "2 kg", 90)],
      { searchQuery: "onion", packSize: "1 kg", searchExclude: ["spring"] },
    );
    expect(offer.product?.name).toBe("Onion (Pyaz)");
    expect(nameScore({ name: "Onion Combo", brand: "BUNDLE" }, "onion")).toBe(-1);
  });

  it("ignores sponsored results when there are organic ones", () => {
    const offer = pickBest([prod("Toned Milk", "500 ml", 20, { is_ad: true }), prod("Toned Milk", "500 ml", 27)], { searchQuery: "toned milk", packSize: "500 ml" });
    expect(offer.product?.offerPrice).toBe(27);
  });
});

describe("per-kg / per-litre normalisation", () => {
  it("normalises by pack size", () => {
    expect(perUnitPrice(48, { amount: 500, unit: "g" })?.label).toBe("₹96/kg");
    expect(perUnitPrice(24, { amount: 500, unit: "ml" })?.label).toBe("₹48/L");
    expect(perUnitPrice(54, { amount: 6, unit: "pc" })?.label).toBe("₹9/pc");
    expect(perUnitPrice(265, { amount: 5000, unit: "g" })?.value).toBe(53);
  });

  it("parses the pack labels stores use", () => {
    expect(parseQuantities("2 x 200 ml")[0]).toEqual({ amount: 400, unit: "ml" });
    expect(parseQuantities("1000 g X 2")[0]).toEqual({ amount: 2000, unit: "g" });
    expect(parseQuantities("0.95-1.05Kg")[0]).toEqual({ amount: 1000, unit: "g" });
    expect(parseQuantities("1 ltr")[0]).toEqual({ amount: 1000, unit: "ml" });
    expect(parseQuantities("500-600 g")[0]).toEqual({ amount: 550, unit: "g" });
    expect(parseQuantities("Pack of 6")[0]).toEqual({ amount: 6, unit: "pc" });
    expect(parseQuantities("1 pc (450-550 g)")).toContainEqual({ amount: 500, unit: "g" });
    // multipack price per litre: 2 x 200 ml for ₹34 = ₹85/L
    const offer = pickBest([prod("Taaza Toned Milk - Pack of 2", "2 x 200 ml", 34)], { searchQuery: "toned milk", packSize: "500 ml" });
    expect(offer.perUnit?.label).toBe("₹85/L");
  });
});

describe("cheapest store", () => {
  const ok = (p: number) => ({ status: "ok" as const, product: { name: "x", offerPrice: p } });
  const out = { status: "out" as const, product: { name: "x", offerPrice: 1 } };
  const items: LiveItem[] = [
    { id: "a", query: "a", packSize: "1 kg", offers: { Zepto: ok(40), BlinkIt: ok(38), Swiggy: ok(45), Minutes: ok(41) } },
    { id: "b", query: "b", packSize: "1 kg", offers: { Zepto: ok(60), BlinkIt: out, Swiggy: ok(58), Minutes: ok(55) } },
  ];

  it("picks the cheapest among stores with the most items, and the savings", () => {
    const s = basketSummary(items);
    // BlinkIt is cheapest overall (38) but only has 1 of 2 items, so it can't win the basket
    expect(s.stores.find((x) => x.store === "BlinkIt")).toMatchObject({ total: 38, available: 1 });
    expect(s.cheapest).toBe("Minutes"); // 41 + 55 = 96 vs Zepto 100, Swiggy 103
    expect(s.savings).toBe(103 - 96);
    expect(s.lowest).toEqual({ a: "BlinkIt", b: "Minutes" });
  });
});

/* ------------------------------------------------------------------ */
/* Server: cache, daily limit, missing key (API mocked)                */
/* ------------------------------------------------------------------ */

const LOC = { lat: 12.9352, lon: 77.6245, pincode: "560034" };
function apiResponse(products: QcProduct[]) {
  return new Response(JSON.stringify({ status: "success", credits_remaining: 90, data: { products } }), { status: 200 });
}
function makeDeps(over: Partial<QcDeps> = {}): QcDeps & { fetch: ReturnType<typeof vi.fn>; state: QcState } {
  let t = Date.UTC(2026, 9, 23, 6, 0, 0);
  const fetchMock = vi.fn(async (url: string) => {
    const q = new URL(url).searchParams.get("q")!;
    return apiResponse([prod(q === "toned milk" ? "Toned Milk" : "Onion", q === "toned milk" ? "500 ml" : "1 kg", 30)]);
  });
  return {
    key: "test-key",
    dailyLimit: 300,
    fetch: fetchMock as unknown as typeof fetch,
    now: () => t,
    state: { cache: new Map(), used: new Map() },
    log: () => {},
    ...over,
    // let tests move the clock
    advance: (ms: number) => (t += ms),
  } as never;
}

describe("live prices server", () => {
  it("calls each store once per ingredient, sends the key only in the header, then serves from cache", async () => {
    const deps = makeDeps();
    const first = await livePrices(["milk"], LOC, {}, deps);
    expect(first.mode).toBe("live");
    expect(deps.fetch).toHaveBeenCalledTimes(4);
    const [url, init] = deps.fetch.mock.calls[0];
    expect(url).toContain("q=toned+milk");
    expect(url).toContain("pincode=560034");
    expect(url).not.toContain("test-key");
    expect(init.headers["X-API-Key"]).toBe("test-key");
    if (first.mode === "live") expect(first.creditsUsed).toBe(4);

    const second = await livePrices(["milk"], LOC, {}, deps);
    expect(deps.fetch).toHaveBeenCalledTimes(4); // cache hit: no new calls
    if (second.mode === "live") expect(second.creditsUsed).toBe(0);

    // same place to 2 decimals is the same cache entry
    await livePrices(["milk"], { ...LOC, lat: 12.9361, lon: 77.6249 }, {}, deps);
    expect(deps.fetch).toHaveBeenCalledTimes(4);
    expect(cacheKey("toned milk", "Zepto", LOC)).toBe("toned milk|Zepto|12.94|77.62");
  });

  it("re-fetches after 6 hours, and Refresh only re-fetches results older than 30 minutes", async () => {
    const deps = makeDeps() as ReturnType<typeof makeDeps> & { advance: (ms: number) => void };
    await livePrices(["milk"], LOC, {}, deps);
    deps.advance(10 * 60 * 1000);
    await livePrices(["milk"], LOC, { refresh: true }, deps);
    expect(deps.fetch).toHaveBeenCalledTimes(4); // too recent to refresh
    deps.advance(25 * 60 * 1000);
    await livePrices(["milk"], LOC, { refresh: true }, deps);
    expect(deps.fetch).toHaveBeenCalledTimes(8);
    deps.advance(6 * 60 * 60 * 1000 + 1);
    await livePrices(["milk"], LOC, {}, deps);
    expect(deps.fetch).toHaveBeenCalledTimes(12); // expired
  });

  it("stops calling the API at the daily limit and returns cached prices with a note", async () => {
    const deps = makeDeps({ dailyLimit: 6 });
    const r = await livePrices(["milk", "onion"], LOC, {}, deps); // needs 8 searches
    expect(deps.fetch).toHaveBeenCalledTimes(6);
    expect(r.mode).toBe("live");
    if (r.mode === "live") {
      expect(r.limited).toBe(true);
      expect(r.note).toMatch(/limit/);
      const skipped = r.items.flatMap((i) => Object.values(i.offers)).filter((o) => o.status === "skipped");
      expect(skipped).toHaveLength(2);
    }
    expect(deps.state.used.get(dayKey(deps.now()))).toBe(6);
    // the next request spends nothing, even for a new ingredient
    const again = await livePrices(["paneer"], LOC, {}, deps);
    expect(deps.fetch).toHaveBeenCalledTimes(6);
    expect(again.mode).toBe("sample");
  });

  it("falls back to sample prices when the key is missing, without calling the API", async () => {
    const deps = makeDeps({ key: undefined });
    const r = await livePrices(["milk"], LOC, {}, deps);
    expect(r.mode).toBe("sample");
    expect(deps.fetch).not.toHaveBeenCalled();
  });

  it("falls back to sample prices when every store call fails, and never throws", async () => {
    const deps = makeDeps({ fetch: vi.fn(async () => new Response("{}", { status: 502 })) as never });
    const r = await livePrices(["milk"], LOC, {}, deps);
    expect(r.mode).toBe("sample");
  });

  it("marks only the failing store when one store errors", async () => {
    const deps = makeDeps();
    deps.fetch.mockImplementation(async (url: string) =>
      url.includes("platform=Minutes") ? new Response("upstream", { status: 504 }) : apiResponse([prod("Toned Milk", "500 ml", 30)]),
    );
    const r = await livePrices(["milk"], LOC, {}, deps);
    expect(r.mode).toBe("live");
    if (r.mode === "live") {
      expect(r.items[0].offers.Minutes.status).toBe("error");
      expect(r.items[0].offers.Zepto.status).toBe("ok");
    }
  });
});

describe("/api/prices route", () => {
  it("answers with sample mode and CORS headers when QCAPI_KEY is missing", async () => {
    vi.stubEnv("QCAPI_KEY", "");
    vi.resetModules();
    const { POST, OPTIONS } = await import("@/app/api/prices/route.web");
    const res = await POST(
      new Request("http://x/api/prices", { method: "POST", body: JSON.stringify({ ids: ["milk"], lat: 12.97, lon: 77.6 }) }),
    );
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect((await res.json()).mode).toBe("sample");
    expect(OPTIONS().status).toBe(204);
    const bad = await POST(new Request("http://x/api/prices", { method: "POST", body: "nonsense" }));
    expect((await bad.json()).mode).toBe("sample");
    vi.unstubAllEnvs();
  });
});
