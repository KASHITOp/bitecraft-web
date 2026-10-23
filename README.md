# BiteCraft

What can I actually cook right now, in this room, with what I have and what I can afford?

A mobile-first PWA for students in Indian PGs and hostels: a kettle, maybe an induction plate and one pan, a budget that swings between broke and treat, and no idea that kanda, pyaz and onion are the same thing.

- **Explore**: hand-written recipes, searchable by English or local ingredient names (kanda, batata, dhaniya, avalakki…), filtered by gear you own, budget tier, goal and time. "Cook from my pantry" ranks by what you already have.
- **Recipe + cook mode**: macros against your daily target, pantry checks, portion vs full-pack cost, one-step-at-a-time cooking with timers (sound + vibration) and screen wake lock.
- **Pantry** with expiry warnings, **Shopping list**, **Saved**.
- **Fridge Raid Chef**: type what's lying around and get a structured recipe from Gemini, grounded in the library. Falls back to the local matching engine when there's no key, the call fails, or you're offline.
- **Planner**: a day plan that fits your kcal and protein targets, budget and gear. Shuffle, lock, mess days, a week of shopping in one tap.
- **Quick Mart**: tap **Check live prices** for real prices on Zepto, Blinkit, Instamart and Flipkart Minutes near you (via [QuickCommerce API](https://quickcommerceapi.com)): the matched product per store, pack size, ₹/kg, LOWEST badge, basket total per store and a "Buy on <store>" link. Without a key, or if the API fails, it shows clearly labelled sample prices from Oct 2026.

All user data stays in `localStorage` on the phone. No login, no database.

## Run it

Needs Node 20.9+ (tested on Node 24).

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3000. The service worker only registers in production builds:

```bash
npm run build
npm start
```

`npm run build` first runs `npm run data` (turns `data/source/*.ts` into `data/recipes.json` and `data/ingredients.json`) and `npm run verify-recipes`. The build fails if the recipe library breaks the quality rules.

## The Chef: GEMINI_API_KEY and GEMINI_MODEL

The chatbot works without any key: it answers from the local matching engine and says so in a small note. To turn on the AI:

1. Get a key from Google AI Studio (https://aistudio.google.com/apikey).
2. Create `web/.env.local`:

   ```
   GEMINI_API_KEY=your-key-here
   GEMINI_MODEL=gemini-3.8-flash
   ```

   `GEMINI_MODEL` is optional and defaults to `gemini-3.8-flash`. If Google reports that model as overloaded (503) or rate-limited (429), or takes longer than 18 seconds, the route moves down `GEMINI_FALLBACK_MODEL`, a comma-separated list (default `gemini-3.6-flash,gemini-3.5-flash,gemini-3.5-flash-lite`). The whole request stays under 55 seconds before falling back to the local engine. Google retires old models for new keys, so if every call falls back, list what your key can use: `curl -H "x-goog-api-key: $KEY" https://generativelanguage.googleapis.com/v1beta/models`.
3. Restart `npm run dev`.

The key is only read in `app/api/chef/route.web.ts` on the server. It's sent to Google in a request header and never reaches the browser. The route is rate-limited to 20 requests per 10 minutes per IP (in memory, so per server instance). Model output must match a zod schema and must not use gear the student doesn't own. Anything else falls back to library matches; the chat never shows a raw error.

## Live prices: QCAPI_KEY and QCAPI_DAILY_LIMIT

Add to `web/.env.local`:

```
QCAPI_KEY=your-quickcommerceapi-key
QCAPI_DAILY_LIMIT=300
```

- **Each store search costs 1 credit.** A basket of 5 ingredients across 4 stores is 20 credits.
- **Only on a tap.** Prices are fetched only when someone taps "Check live prices", never on page load.
- **Two caches.** Results are cached for 6 hours on the server (keyed by search + store + location rounded to 2 decimals) and on the phone. Refresh re-fetches only results older than 30 minutes.
- **Daily cap.** `QCAPI_DAILY_LIMIT` (default 300) caps credits per day (India time). Past it, the app shows the last prices it has with a note.
- **Logging.** Every request logs `[prices] … N credit(s) used this request, X/300 today`. It also logs a line when a store returns nothing usable.
- **Where they live.** The cache and the daily counter are in the server's memory. On Vercel that's per running instance, so treat the limit as a safety net, not an exact meter. Check real usage free at `GET https://api.quickcommerceapi.com/v1/credits`.
- **Key stays server-side.** It's only read in `lib/qc-server.ts`; the browser and the APK call `/api/prices`.
- **Location.** Picked in onboarding (kitchen step) or More → Your area: GPS or a Bangalore area. Flipkart Minutes needs a pincode, so a GPS fix borrows the nearest area's pincode. The default is central Bangalore.
- **Matching** (`lib/live-prices.ts`). Every ingredient has a `searchQuery` and `packSize` (in `data/source/ingredient-search.ts`). For each store the app takes products whose name matches, prefers in-stock ones, then the pack size closest to `packSize`, then the cheapest. Wrong forms (powder, chips, combo packs…) and per-ingredient exclusions are skipped.

## Deploy to Vercel

1. Push the repo to GitHub.
2. In Vercel, **Add New → Project**, import the repo. In the bitecraft-web repo the app is at the root, so leave **Root Directory** empty (set it to `web` only if the app sits in a `web/` subfolder). Everything else is detected (Next.js, `npm run build`).
3. Under **Settings → Environment Variables**, add `GEMINI_API_KEY`, `GEMINI_MODEL`, `QCAPI_KEY` and `QCAPI_DAILY_LIMIT` for Production and Preview.
4. Deploy. The app is static except `/api/chef`, which runs as a serverless function.

Or with the CLI: `cd web && npx vercel` then `npx vercel env add GEMINI_API_KEY`.

## Android app (Capacitor)

The same code ships as an Android app. A mobile build (`BUILD_TARGET=mobile`) does a static export into `out/`: no API routes, no service worker, every screen as `<screen>/index.html`. Capacitor (`com.bitecraft.app`, project in `android/`) bundles that into the APK, so the app works fully offline.

Inside the app:
- **Chef and live prices**: the app has no server of its own. Build with `NEXT_PUBLIC_API_BASE=https://bitecraft-web.vercel.app` (your deployed site) and it calls that site's `/api/chef` and `/api/prices` (CORS is allowed). Without it, or if a call fails, the Chef answers from the recipe book on the phone and Quick Mart shows sample prices, plainly labelled. It never shows an error. No API key is ever bundled into the APK.
- **Back button** goes back a screen; on the Explore tab it closes the app.
- **Status bar** matches the header colour and follows the light/dark theme.
- **Cook mode** keeps the screen on (`@capacitor-community/keep-awake`) and buzzes with `@capacitor/haptics` when a timer ends.

### Rebuild the APK

You need JDK 21 (Capacitor 8 requires it) and an Android SDK with `platforms;android-36` and `build-tools;36.0.0`. Point `JAVA_HOME` and `ANDROID_HOME` at them. If they aren't set, the script looks for a portable toolchain in `../android-toolchain/jdk-21` and `../android-toolchain/sdk`.

```bash
cd web
npm install
npm run apk
```

That runs `npm run build:mobile` (data, recipe check, static export, `cap sync android`), then `gradlew assembleDebug`, and copies the result to `../release/BiteCraft.apk`. It prints the size, package name, version and label from `aapt`. The APK is debug-signed, which is fine for sideloading: copy it to the phone and allow "install unknown apps" for your file manager.

Other pieces:
- `npm run build:mobile` builds the static app and syncs it into `android/` without running Gradle. Open `android/` in Android Studio to run it on a device.
- `node scripts/make-android-assets.mjs` regenerates the launcher icons (from `public/icons/icon.svg`) and the plain light/dark splash.
- API routes are named `route.web.ts`. Next only treats them as routes in the web build, so the static export skips them.

## Tests and checks

```bash
npm run lint
npm run verify-recipes   # library quality gate (also runs on every build)
npm test                 # Vitest: BMR, dual-name search, pantry coverage, planner, prices, /api/chef
npx playwright install chromium   # once
npm run build && npm run test:e2e # Playwright, 390x844 mobile viewport, against the production build
node scripts/lighthouse.mjs      # mobile Lighthouse against `npx next start -p 3301`
```

The Playwright server runs with `GEMINI_API_KEY` empty, so the chef test checks the fallback path.

## Where things live

```
app/                  screens (App Router) and app/api/chef/route.web.ts (web build only)
components/           UI pieces (RecipeCard, CookMode, Ring, ChefRecipeCard, Icon…)
lib/storage.ts        the only code that touches localStorage (try/catch, safe defaults)
lib/state.ts          typed hooks per storage key, with validation
lib/search.ts         dual-name search
lib/planner.ts        greedy day planner + local search on portions
lib/prices.ts         sample-price basket comparison (fallback)
lib/live-prices.ts    live prices: pack parsing, matching, ₹/kg, basket summary (pure)
lib/qc-server.ts      QuickCommerce API client, cache, daily limit (server only)
lib/live-client.ts    browser side: calls /api/prices, 6 h phone cache
lib/location.ts       Bangalore areas and the saved location
lib/chef.ts           ingredient parsing + coverage matching (shared by server and offline fallback)
data/source/          hand-written ingredients and recipes (edit these)
data/*.json           generated, imported at build time
scripts/              build-data, verify-recipes, make-icons, lighthouse,
                      build-mobile, build-apk, make-android-assets
lib/native.ts         Capacitor bridge (back button, status bar, keep-awake, haptics)
capacitor.config.ts   app id, name, splash and status bar defaults
android/              Capacitor Android project
public/sw.js          service worker (precache every screen, network-only for /api)
```

### Adding a recipe

Add an `R(...)` entry to one of `data/source/recipes-*.ts`. Use ingredient ids from `data/source/ingredients.ts`, 5 to 8 specific steps (`[text, minutes]` adds a timer), and a `[stepNumber, "where this goes wrong"]` tip. Macros, cost per plate, full-pack cost, budget tier and goal tags are computed from the ingredient table. Run `npm run data && npm run verify-recipes`.

Nutrition values are estimates. Prices are samples.
