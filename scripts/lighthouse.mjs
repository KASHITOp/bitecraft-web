// Mobile Lighthouse run against a local production server.
// Chromium comes from Playwright; Lighthouse attaches over the debugging port.
//   npx next start -p 3301 &  then  node scripts/lighthouse.mjs [baseUrl]
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:3301";
const pages = ["/", "/recipe?id=kanda-poha", "/pantry", "/planner"];
const PORT = 9333;
mkdirSync("lighthouse", { recursive: true });
const browser = await chromium.launch({ channel: process.env.LH_CHANNEL || "chromium", args: [`--remote-debugging-port=${PORT}`] });
try {
  for (const p of pages) {
    const out = `lighthouse/${p.replace(/[^a-z0-9]+/gi, "_") || "home"}.json`;
    try {
      execFileSync(
        process.platform === "win32" ? "npx.cmd" : "npx",
        ["--yes", "lighthouse@13.5.0", base + p, `--port=${PORT}`, "--quiet", "--only-categories=performance,accessibility,best-practices", "--output=json", `--output-path=${out}`],
        { stdio: "inherit", shell: process.platform === "win32" },
      );
    } catch {
      /* lighthouse exits non-zero on some warnings; the report is still written */
    }
    const r = JSON.parse(readFileSync(out, "utf8"));
    const s = Object.values(r.categories).map((c) => `${c.id}=${Math.round(c.score * 100)}`).join(" ");
    console.log(`${p.padEnd(24)} ${s}  LCP ${r.audits["largest-contentful-paint"].displayValue}  TBT ${r.audits["total-blocking-time"].displayValue}  CLS ${r.audits["cumulative-layout-shift"].displayValue}`);
    const failing = Object.values(r.audits).filter((a) => a.score !== null && a.score < 0.9 && r.categories.accessibility.auditRefs.some((x) => x.id === a.id));
    for (const a of failing) console.log(`   a11y: ${a.id} - ${a.title}`);
  }
} finally {
  await browser.close();
}
