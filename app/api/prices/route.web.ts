import { z } from "zod";
import type { LivePricesResponse } from "@/lib/live-prices";
import { livePrices } from "@/lib/qc-server";

// Several store searches per request; give the function room on Vercel.
export const maxDuration = 60;

const RequestSchema = z.object({
  ids: z.array(z.string().max(40)).min(1).max(25),
  lat: z.number().min(6).max(37),
  lon: z.number().min(68).max(98),
  pincode: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
  refresh: z.boolean().optional(),
});

// The Android app (https://localhost inside a WebView) calls this from another origin.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body: LivePricesResponse, status = 200): Response {
  return Response.json(body, { status, headers: CORS });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS });
}

/* Per-IP request limit on top of the daily credit limit: 30 requests per 10 minutes. */
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 30;
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  const over = recent.length >= LIMIT;
  if (!over) recent.push(now);
  hits.set(ip, recent);
  return over;
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) return json({ mode: "sample", reason: "That request didn't make sense." });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? req.headers.get("x-real-ip") ?? "local";
  if (rateLimited(ip)) return json({ mode: "sample", reason: "Too many price checks in a few minutes. Try again shortly." });

  const { ids, lat, lon, pincode, refresh } = parsed.data;
  try {
    return json(await livePrices(ids, { lat, lon, pincode }, { refresh }));
  } catch (err) {
    console.error("[prices] failed:", err instanceof Error ? err.message : err);
    return json({ mode: "sample", reason: "Couldn't reach the stores just now." });
  }
}
