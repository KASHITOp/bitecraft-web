// Android launcher icons and a plain splash, drawn from public/icons/icon.svg.
// Renders with Playwright's Chromium (no sharp / native image deps).
//   node scripts/make-android-assets.mjs
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const RES = "android/app/src/main/res";
const TURMERIC = "#E2A615";
const BG_LIGHT = "#EEF0EC";
const BG_DARK = "#141917";

const svg = readFileSync("public/icons/icon.svg", "utf8");
// The tiffin drawing without its square background, for the adaptive-icon foreground.
const drawing = svg.replace(/<rect width="512" height="512"[^>]*\/>/, "");

const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

const browser = await chromium.launch();
const page = await browser.newPage();

async function render(file, size, html) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;width:${size}px;height:${size}px;overflow:hidden;background:transparent">${html}</body></html>`,
  );
  await page.screenshot({ path: file, omitBackground: true });
}

const full = (s) => s.replace("<svg ", '<svg width="100%" height="100%" ');

for (const [d, k] of Object.entries(densities)) {
  const dir = join(RES, `mipmap-${d}`);
  mkdirSync(dir, { recursive: true });
  const legacy = Math.round(48 * k);
  const fg = Math.round(108 * k);
  // Legacy square icon with rounded corners, and a round one.
  await render(join(dir, "ic_launcher.png"), legacy, `<div style="width:100%;height:100%;border-radius:18%;overflow:hidden">${full(svg)}</div>`);
  await render(join(dir, "ic_launcher_round.png"), legacy, `<div style="width:100%;height:100%;border-radius:50%;overflow:hidden">${full(svg)}</div>`);
  // Adaptive foreground: 108dp canvas, drawing inside the 66dp safe zone.
  await render(
    join(dir, "ic_launcher_foreground.png"),
    fg,
    `<div style="width:100%;height:100%;display:grid;place-items:center"><div style="width:72%;height:72%">${full(drawing)}</div></div>`,
  );
  console.log(`mipmap-${d}: ${legacy}px icon, ${fg}px foreground`);
}
await browser.close();

// Adaptive icon background colour.
writeFileSync(
  join(RES, "values/ic_launcher_background.xml"),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${TURMERIC}</color>\n</resources>\n`,
);

// Plain splash: just the app background colour, light and dark.
for (const dir of readdirSync(RES)) {
  if (dir.startsWith("drawable")) rmSync(join(RES, dir, "splash.png"), { force: true });
}
// template's default Android-robot vectors are unused once the PNGs exist
rmSync(join(RES, "drawable-v24/ic_launcher_foreground.xml"), { force: true });
rmSync(join(RES, "drawable/ic_launcher_background.xml"), { force: true });
for (const dir of readdirSync(RES)) {
  const p = join(RES, dir);
  if (dir.startsWith("drawable") && existsSync(p) && readdirSync(p).length === 0) rmSync(p, { recursive: true });
}
mkdirSync(join(RES, "drawable"), { recursive: true });
writeFileSync(
  join(RES, "drawable/splash.xml"),
  `<?xml version="1.0" encoding="utf-8"?>\n<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">\n    <solid android:color="@color/splash_background" />\n</shape>\n`,
);
writeFileSync(
  join(RES, "values/colors.xml"),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="splash_background">${BG_LIGHT}</color>\n    <color name="colorPrimary">${BG_LIGHT}</color>\n    <color name="colorPrimaryDark">${BG_LIGHT}</color>\n    <color name="colorAccent">${TURMERIC}</color>\n</resources>\n`,
);
mkdirSync(join(RES, "values-night"), { recursive: true });
writeFileSync(
  join(RES, "values-night/colors.xml"),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="splash_background">${BG_DARK}</color>\n    <color name="colorPrimary">${BG_DARK}</color>\n    <color name="colorPrimaryDark">${BG_DARK}</color>\n    <color name="colorAccent">${TURMERIC}</color>\n</resources>\n`,
);
console.log("Wrote launcher icons, adaptive background, and a plain light/dark splash.");
