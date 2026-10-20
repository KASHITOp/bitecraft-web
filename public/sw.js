/* BiteCraft service worker.
 * - Precaches every screen and the JS/CSS each one needs, so the app works offline.
 * - /api/* (the Chef) always goes to the network; the chat screen has its own offline fallback.
 * - Static build assets are cache-first; pages are network-first with the cached copy as backup.
 */
// The page registers /sw.js?v=<build>, so each deploy gets a fresh cache.
const VERSION = `bitecraft-${new URL(self.location.href).searchParams.get("v") || "dev"}`;
const SHELL = [
  "/",
  "/pantry",
  "/chef",
  "/planner",
  "/more",
  "/saved",
  "/shopping",
  "/mart",
  "/recipe",
  "/cook",
  "/mine",
  "/onboarding",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

const ASSET_RE = /(?:src|href)="(\/_next\/static\/[^"]+)"/g;

async function precache() {
  const cache = await caches.open(VERSION);
  const assets = new Set();
  await Promise.all(
    SHELL.map(async (url) => {
      try {
        const res = await fetch(url, { cache: "reload" });
        if (!res.ok) return;
        await cache.put(url, res.clone());
        if ((res.headers.get("content-type") || "").includes("text/html")) {
          const html = await res.text();
          for (const m of html.matchAll(ASSET_RE)) assets.add(m[1]);
        }
      } catch {
        /* keep going; a missing page shouldn't block install */
      }
    }),
  );
  await Promise.all(
    [...assets].map(async (url) => {
      try {
        if (!(await cache.match(url))) await cache.add(url);
      } catch {
        /* ignore */
      }
    }),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) (await caches.open(VERSION)).put(req, res.clone());
  return res;
}

async function networkFirstPage(req) {
  const url = new URL(req.url);
  try {
    const res = await fetch(req);
    if (res.ok) (await caches.open(VERSION)).put(url.pathname, res.clone());
    return res;
  } catch {
    const cached = (await caches.match(url.pathname)) || (await caches.match(req, { ignoreSearch: true }));
    return cached || (await caches.match("/")) || Response.error();
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  const network = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => hit);
  return hit || network;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // the Chef needs the network

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req));
    return;
  }
  if (req.mode === "navigate") {
    event.respondWith(networkFirstPage(req));
    return;
  }
  // RSC payloads for client-side navigation: try network, fall back to the page shell
  if (req.headers.get("RSC") === "1") {
    event.respondWith(fetch(req).catch(() => Response.error()));
    return;
  }
  event.respondWith(staleWhileRevalidate(req));
});
