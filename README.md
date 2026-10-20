# BiteCraft

What can I actually cook right now, in this room, with what I have and what I can afford?

A mobile-first PWA for students in Indian PGs and hostels: a kettle, maybe an induction plate and one pan, a budget that swings between broke and treat, and no idea that kanda, pyaz and onion are the same thing.

- **Explore**: hand-written recipes, searchable by English or local ingredient names (kanda, batata, dhaniya, avalakki…), filtered by gear you own, budget tier, goal and time. "Cook from my pantry" ranks by what you already have.
- **Recipe + cook mode**: macros against your daily target, pantry checks, portion vs full-pack cost, one-step-at-a-time cooking with timers (sound + vibration) and screen wake lock.
- **Pantry** with expiry warnings, **Shopping list**, **Saved**.
- **Fridge Raid Chef**: type what's lying around and get a structured recipe from Gemini, grounded in the library. Falls back to the local matching engine when there's no key, the call fails, or you're offline.
- **Planner**: a day plan that fits your kcal and protein targets, budget and gear. Shuffle, lock, mess days, a week of shopping in one tap.
- **Quick Mart**: basket totals on Zepto, Blinkit and Instamart side by side. **These are sample prices from Oct 2026, not live.** None of these apps has a public price API.

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
   GEMINI_MODEL=gemini-2.5-flash
   ```

   `GEMINI_MODEL` is optional and defaults to `gemini-2.5-flash`.
3. Restart `npm run dev`.

The key is only read in `app/api/chef/route.ts` on the server. It's sent to Google in a request header and never reaches the browser. The route is rate-limited to 20 requests per 10 minutes per IP (in memory, so per server instance). Model output must match a zod schema and must not use gear the student doesn't own. Anything else falls back to library matches; the chat never shows a raw error.

## Deploy to Vercel

1. Push the repo to GitHub.
2. In Vercel, **Add New → Project**, import the repo and set **Root Directory** to `web`. Everything else is detected (Next.js, `npm run build`).
3. Under **Settings → Environment Variables**, add `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`) for Production and Preview.
4. Deploy. The app is static except `/api/chef`, which runs as a serverless function.

Or with the CLI: `cd web && npx vercel` then `npx vercel env add GEMINI_API_KEY`.

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
app/                  screens (App Router) and app/api/chef/route.ts
components/           UI pieces (RecipeCard, CookMode, Ring, ChefRecipeCard, Icon…)
lib/storage.ts        the only code that touches localStorage (try/catch, safe defaults)
lib/state.ts          typed hooks per storage key, with validation
lib/search.ts         dual-name search
lib/planner.ts        greedy day planner + local search on portions
lib/prices.ts         basket comparison
lib/chef.ts           ingredient parsing + coverage matching (shared by server and offline fallback)
data/source/          hand-written ingredients and recipes (edit these)
data/*.json           generated, imported at build time
scripts/              build-data, verify-recipes, make-icons, lighthouse
public/sw.js          service worker (precache every screen, network-only for /api)
```

### Adding a recipe

Add an `R(...)` entry to one of `data/source/recipes-*.ts`. Use ingredient ids from `data/source/ingredients.ts`, 5 to 8 specific steps (`[text, minutes]` adds a timer), and a `[stepNumber, "where this goes wrong"]` tip. Macros, cost per plate, full-pack cost, budget tier and goal tags are computed from the ingredient table. Run `npm run data && npm run verify-recipes`.

Nutrition values are estimates. Prices are samples.
