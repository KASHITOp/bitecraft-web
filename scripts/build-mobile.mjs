// Static export for the Android app, then copy it into the Capacitor project.
//   npm run build:mobile
//   NEXT_PUBLIC_API_BASE=https://your-bitecraft.vercel.app npm run build:mobile   (live AI Chef)
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const win = process.platform === "win32";
function run(cmd, args, env = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: win, env: { ...process.env, ...env } });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run("npm", ["run", "data"]);
run("npm", ["run", "verify-recipes"]);
run("npx", ["next", "build"], { BUILD_TARGET: "mobile" });
if (!existsSync("out/index.html")) {
  console.error("Static export failed: out/index.html is missing.");
  process.exit(1);
}
// The service worker is web-only; Capacitor serves the files from the APK.
rmSync("out/sw.js", { force: true });

// Next 16 writes segment prefetch files as `__next.<seg>/__PAGE__.txt`, but the client
// asks for `__next.<seg>.__PAGE__.txt` under trailingSlash. Add flat copies so client
// navigation inside the app never hits a 404.
let flat = 0;
(function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith("__next.")) {
      for (const f of readdirSync(p, { withFileTypes: true })) {
        if (f.isFile()) {
          copyFileSync(join(p, f.name), join(dir, `${entry.name}.${f.name}`));
          flat++;
        }
      }
    }
    walk(p);
  }
})("out");
console.log(`Added ${flat} flat segment files.`);
if (existsSync("android")) run("npx", ["cap", "sync", "android"]);
console.log(
  process.env.NEXT_PUBLIC_API_BASE
    ? `Mobile build ready. Chef calls ${process.env.NEXT_PUBLIC_API_BASE}/api/chef`
    : "Mobile build ready. No NEXT_PUBLIC_API_BASE, so the Chef answers from the local recipe book.",
);
