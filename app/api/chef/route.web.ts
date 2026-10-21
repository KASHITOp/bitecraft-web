import { z } from "zod";
import { gearFromWords, matchRecipes, parseIngredients, type ChefMatch } from "@/lib/chef";
import type { ChefResponse } from "@/lib/chef-api";
import { dualName, GEAR_WORDS, ING, INGREDIENTS, RECIPE, RECIPES, TIER_RANGE } from "@/lib/data";
import type { Gear } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Input                                                               */
/* ------------------------------------------------------------------ */

const GEAR = ["kettle", "induction", "pan", "microwave", "fridge"] as const;

const RequestSchema = z.object({
  message: z.string().trim().max(500).default(""),
  usePantry: z.boolean().optional(),
  pantry: z.array(z.string().max(40)).max(200).optional(),
  profile: z
    .object({
      gear: z.array(z.enum(GEAR)).max(5),
      tier: z.enum(["broke", "balanced", "treat"]),
      goal: z.enum(["gain", "lose", "maintain", "protein"]).optional(),
      kcal: z.number().min(800).max(6000).optional(),
      protein: z.number().min(20).max(400).optional(),
    })
    .optional(),
});

/* ------------------------------------------------------------------ */
/* What the model must return                                          */
/* ------------------------------------------------------------------ */

const ModelReply = z.object({
  reply: z.string().min(1).max(600),
  libraryId: z.string().optional().nullable(),
  recipe: z.object({
    title: z.string().min(2).max(120),
    equipment: z.array(z.string().max(60)).max(6),
    minutes: z.number().int().min(1).max(240),
    costEstimate: z.number().min(0).max(5000),
    ingredients: z
      .array(z.object({ name: z.string().min(1).max(80), quantity: z.string().min(1).max(40) }))
      .min(1)
      .max(20),
    steps: z.array(z.string().min(8).max(400)).min(3).max(10),
    tip: z.string().min(10).max(400),
    macros: z.object({
      kcal: z.number().min(0).max(3000),
      protein: z.number().min(0).max(250),
      carbs: z.number().min(0).max(500),
      fat: z.number().min(0).max(250),
    }),
  }),
});

/** Gemini responseSchema (OpenAPI subset) mirroring ModelReply. */
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    reply: { type: "STRING", description: "One or two friendly sentences to the student. No emoji." },
    libraryId: { type: "STRING", description: "id of the library recipe you picked, or empty if you wrote a new one", nullable: true },
    recipe: {
      type: "OBJECT",
      properties: {
        title: { type: "STRING" },
        equipment: { type: "ARRAY", items: { type: "STRING" } },
        minutes: { type: "INTEGER" },
        costEstimate: { type: "NUMBER", description: "rupees per plate, Bangalore quick-commerce prices" },
        ingredients: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: { name: { type: "STRING" }, quantity: { type: "STRING" } },
            required: ["name", "quantity"],
          },
        },
        steps: { type: "ARRAY", items: { type: "STRING" } },
        tip: { type: "STRING", description: "one 'where this goes wrong' tip" },
        macros: {
          type: "OBJECT",
          properties: {
            kcal: { type: "NUMBER" },
            protein: { type: "NUMBER" },
            carbs: { type: "NUMBER" },
            fat: { type: "NUMBER" },
          },
          required: ["kcal", "protein", "carbs", "fat"],
        },
      },
      required: ["title", "equipment", "minutes", "costEstimate", "ingredients", "steps", "tip", "macros"],
    },
  },
  required: ["reply", "recipe"],
};

/* ------------------------------------------------------------------ */
/* Rate limit: 20 requests per 10 minutes per IP, in memory            */
/* ------------------------------------------------------------------ */

const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 20;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  }
  return false;
}

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "local";
}

/* ------------------------------------------------------------------ */
/* Prompt                                                              */
/* ------------------------------------------------------------------ */

function systemPrompt(gear: Gear[], tier: string): string {
  const owned = gear.length ? gear.map((g) => GEAR_WORDS[g]).join(", ") : "nothing at all, so no-cook only";
  return [
    "You are the Fridge Raid Chef inside BiteCraft, an app for students in Indian PGs and hostels.",
    "You are a practical senior who lived in a Bangalore PG for four years: warm, direct, a little funny, never preachy.",
    `The student's room has: ${owned}. Never suggest any equipment outside that list, not even a second pan, a pressure cooker, an oven or a blender.`,
    `Their budget is ${tier} (${TIER_RANGE[tier as keyof typeof TIER_RANGE]} per plate). Use approximate Bangalore Zepto/Blinkit/Instamart prices in rupees.`,
    "Use Indian ingredient names next to English where useful, e.g. onion (kanda/pyaz), flattened rice (poha).",
    "Steps must be specific and beginner-proof: real quantities, heat level, and minutes. 4 to 8 steps. No filler like 'prep ingredients' or 'enjoy'.",
    "Give exactly one 'where this goes wrong' tip, and rough macros per plate.",
    "You are given up to five recipes from the BiteCraft library that match what they have. If one fits well, recommend it: set libraryId to its id and copy its title, equipment, steps and tip faithfully. Otherwise write a new complete recipe and leave libraryId empty.",
    "Use what they have first. Keep extra shopping to two or three cheap items at most.",
    "Reply in JSON only, matching the schema. The 'reply' field is one or two sentences, no emoji.",
  ].join("\n");
}

function userPrompt(message: string, haveIds: string[], matches: ChefMatch[], profile?: z.infer<typeof RequestSchema>["profile"]): string {
  const lines: string[] = [];
  lines.push(`What I have (my words): ${message || "(see list)"}`);
  if (haveIds.length) lines.push(`Recognised ingredients: ${haveIds.map((id) => dualName(ING.get(id)!)).join("; ")}`);
  if (profile?.goal) lines.push(`My goal: ${profile.goal}. Daily target about ${profile.kcal ?? "?"} kcal and ${profile.protein ?? "?"} g protein.`);
  lines.push("");
  lines.push("Library candidates:");
  for (const m of matches) {
    const r = RECIPE.get(m.id)!;
    lines.push(
      [
        `- id: ${r.id}`,
        `  title: ${r.title} (${r.cuisine}), ${r.minutes} min, about ₹${r.costPerServing} per plate, needs: ${r.gear.join(", ") || "no equipment"}`,
        `  ingredients: ${r.ingredients.map((i) => `${ING.get(i.id)!.name} ${i.qty}${ING.get(i.id)!.unit === "pc" ? "" : ING.get(i.id)!.unit}`).join(", ")}`,
        `  uses ${m.have} of my items, ${m.missing} more to buy`,
        `  steps: ${r.steps.map((s, i) => `${i + 1}. ${s.text}`).join(" ")}`,
        `  tip: ${r.tip.text}`,
        `  macros per plate: ${r.macros.kcal} kcal, ${r.macros.protein} g protein, ${r.macros.carbs} g carbs, ${r.macros.fat} g fat`,
      ].join("\n"),
    );
  }
  if (!matches.length) lines.push("(none matched, write a new recipe)");
  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
/* Handler                                                             */
/* ------------------------------------------------------------------ */

function fallback(matches: ChefMatch[], note: string): ChefResponse {
  return {
    kind: "fallback",
    reply: matches.length
      ? "Here's what the recipe book says you can make with that."
      : "I couldn't spot anything I know in that. Try plain ingredient names, like '2 eggs, onion, bread'.",
    note,
    matches,
  };
}

// The Android app (https://localhost inside a WebView) calls this from another origin.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body: ChefResponse): Response {
  return Response.json(body, { headers: CORS });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = RequestSchema.safeParse(body);
  const input = parsed.success ? parsed.data : { message: "" };
  const gear: Gear[] = input.profile?.gear ?? [...GEAR];
  const tier = input.profile?.tier ?? "balanced";

  const fromText = parseIngredients(input.message, INGREDIENTS);
  const fromPantry = input.usePantry ? (input.pantry ?? []).filter((id) => ING.has(id)) : [];
  const haveIds = [...new Set([...fromText, ...fromPantry])];
  const matches = matchRecipes(haveIds, RECIPES, { gear, tier, limit: 5 });

  if (rateLimited(clientIp(req))) {
    return json(fallback(matches, "You've asked a lot in the last 10 minutes, so these come straight from the recipe book."));
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return json(fallback(matches, "The Chef's AI isn't switched on here, so these are the closest matches from the recipe book."));
  }
  if (!haveIds.length && !input.message) {
    return json(fallback([], "Tell me what's in your room and I'll take it from there."));
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt(gear, tier) }] },
        contents: [{ role: "user", parts: [{ text: userPrompt(input.message, haveIds, matches, input.profile) }] }],
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    });
    if (!res.ok) throw new Error(`model status ${res.status}`);
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const reply = ModelReply.parse(JSON.parse(text));

    // Enforce the equipment rule even if the model slips.
    const needs = gearFromWords(reply.recipe.equipment);
    if (needs.some((g) => !gear.includes(g))) throw new Error("suggested gear the student doesn't own");

    const libraryId = reply.libraryId && RECIPE.has(reply.libraryId) ? reply.libraryId : undefined;
    const payload: ChefResponse = {
      kind: "recipe",
      reply: reply.reply,
      recipe: {
        title: reply.recipe.title,
        equipment: reply.recipe.equipment,
        minutes: Math.round(reply.recipe.minutes),
        costEstimate: Math.round(reply.recipe.costEstimate),
        ingredients: reply.recipe.ingredients,
        steps: reply.recipe.steps,
        tip: reply.recipe.tip,
        macros: {
          kcal: Math.round(reply.recipe.macros.kcal),
          protein: Math.round(reply.recipe.macros.protein),
          carbs: Math.round(reply.recipe.macros.carbs),
          fat: Math.round(reply.recipe.macros.fat),
        },
        fromLibraryId: libraryId,
      },
      matches,
    };
    return json(payload);
  } catch (err) {
    console.error("[chef] falling back:", err instanceof Error ? err.message : err);
    return json(fallback(matches, "The Chef is having a moment, so these are the closest matches from the recipe book."));
  } finally {
    clearTimeout(timer);
  }
}
