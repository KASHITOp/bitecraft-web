import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const body = (b: unknown) =>
  new Request("http://localhost/api/chef", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 250)}` },
    body: JSON.stringify(b),
  });

const ask = { message: "2 eggs, half onion, bread", profile: { gear: ["induction", "pan"], tier: "broke" } };

function gemini(json: unknown) {
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(json) }] } }] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

const goodRecipe = {
  reply: "Make a bread omelette, classic PG move.",
  libraryId: "bread-omelette",
  recipe: {
    title: "Bread Omelette",
    equipment: ["induction plate", "pan"],
    minutes: 12,
    costEstimate: 33,
    ingredients: [
      { name: "Egg (anda)", quantity: "2" },
      { name: "Bread", quantity: "2 slices" },
    ],
    steps: ["Beat the eggs with salt.", "Pour into the hot buttered pan.", "Press the bread on top and flip."],
    tip: "Dip the bread in raw egg first so it sticks.",
    macros: { kcal: 330, protein: 18, carbs: 26, fat: 16 },
  },
};

async function load() {
  vi.resetModules();
  return import("@/app/api/chef/route.web");
}

describe("/api/chef", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("without GEMINI_API_KEY returns local matches and a note", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { POST } = await load();
    const res = await (await POST(body(ask))).json();
    expect(res.kind).toBe("fallback");
    expect(res.matches.length).toBeGreaterThan(0);
    expect(res.note).toMatch(/recipe book/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("with a key, validates the model JSON and returns a recipe card; key never leaves the server", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL", "gemini-test");
    const fetchSpy = vi.fn().mockResolvedValue(gemini(goodRecipe));
    vi.stubGlobal("fetch", fetchSpy);
    const { POST } = await load();
    const res = await (await POST(body(ask))).json();
    expect(res.kind).toBe("recipe");
    expect(res.recipe.title).toBe("Bread Omelette");
    expect(res.recipe.fromLibraryId).toBe("bread-omelette");
    expect(JSON.stringify(res)).not.toContain("test-key");
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toContain("models/gemini-test:generateContent");
    expect(url).not.toContain("test-key");
    expect(init.headers["x-goog-api-key"]).toBe("test-key");
    const sent = JSON.parse(init.body);
    expect(sent.generationConfig.responseMimeType).toBe("application/json");
    // grounded: the prompt carries library candidates
    expect(sent.contents[0].parts[0].text).toContain("Library candidates");
    expect(sent.contents[0].parts[0].text).toContain("bread-omelette");
  });

  it("falls back when the model returns invalid JSON", async () => {
    vi.stubEnv("GEMINI_API_KEY", "k");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(gemini({ reply: "hi", recipe: { title: "x" } })));
    const { POST } = await load();
    const res = await (await POST(body(ask))).json();
    expect(res.kind).toBe("fallback");
    expect(res.matches.length).toBeGreaterThan(0);
  });

  it("falls back when the model suggests gear the student doesn't own", async () => {
    vi.stubEnv("GEMINI_API_KEY", "k");
    const oven = { ...goodRecipe, recipe: { ...goodRecipe.recipe, equipment: ["oven", "baking tray"] } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(gemini(oven)));
    const { POST } = await load();
    const res = await (await POST(body(ask))).json();
    expect(res.kind).toBe("fallback");
  });

  it("falls back when the network call fails", async () => {
    vi.stubEnv("GEMINI_API_KEY", "k");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    const { POST } = await load();
    const res = await (await POST(body(ask))).json();
    expect(res.kind).toBe("fallback");
    expect(JSON.stringify(res)).not.toMatch(/boom/);
  });

  it("rate-limits to 20 requests per 10 minutes per IP", async () => {
    vi.stubEnv("GEMINI_API_KEY", "k");
    const fetchSpy = vi.fn().mockImplementation(async () => gemini(goodRecipe));
    vi.stubGlobal("fetch", fetchSpy);
    const { POST } = await load();
    const same = () =>
      new Request("http://localhost/api/chef", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "1.2.3.4" },
        body: JSON.stringify(ask),
      });
    for (let i = 0; i < 20; i++) expect((await (await POST(same())).json()).kind).toBe("recipe");
    const res = await (await POST(same())).json();
    expect(res.kind).toBe("fallback");
    expect(res.note).toMatch(/10 minutes/);
    expect(fetchSpy).toHaveBeenCalledTimes(20);
  });
});
