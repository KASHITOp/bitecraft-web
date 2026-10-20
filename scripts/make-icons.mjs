// Renders public/icons/icon.svg to the PNG sizes the manifest and iOS need.
// Usage: node scripts/make-icons.mjs
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";

const svg = readFileSync(new URL("../public/icons/icon.svg", import.meta.url), "utf8");
const browser = await chromium.launch();
const page = await browser.newPage();
const jobs = [
  ["icon-192.png", 192, 1],
  ["icon-512.png", 512, 1],
  // maskable: keep the drawing inside the 80% safe zone
  ["icon-maskable-512.png", 512, 0.78],
  ["apple-touch-icon.png", 180, 1],
];
for (const [name, size, scale] of jobs) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:#E2A615;display:grid;place-items:center;width:${size}px;height:${size}px">
      <div style="width:${size * scale}px;height:${size * scale}px">${svg.replace("<svg ", '<svg width="100%" height="100%" ')}</div>
    </body></html>`,
  );
  await page.screenshot({ path: new URL(`../public/icons/${name}`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1") });
  console.log("wrote", name);
}
await browser.close();
