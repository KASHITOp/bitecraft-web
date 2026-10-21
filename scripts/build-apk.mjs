// Debug APK for sideloading.
//   npm run apk
// Uses JAVA_HOME / ANDROID_HOME if set, otherwise the portable toolchain in ../android-toolchain.
// Output: ../release/BiteCraft.apk
import { spawnSync, execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const win = process.platform === "win32";
const toolchain = resolve("..", "android-toolchain");
const JAVA_HOME = process.env.JAVA_HOME && existsSync(process.env.JAVA_HOME) ? process.env.JAVA_HOME : join(toolchain, "jdk-21");
const ANDROID_HOME =
  [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT, join(toolchain, "sdk")].find((p) => p && existsSync(p)) ?? "";
if (!existsSync(join(JAVA_HOME, "bin", win ? "java.exe" : "java"))) {
  console.error(`No JDK 21 found. Set JAVA_HOME (tried ${JAVA_HOME}).`);
  process.exit(1);
}
if (!ANDROID_HOME) {
  console.error("No Android SDK found. Set ANDROID_HOME.");
  process.exit(1);
}
const env = {
  ...process.env,
  JAVA_HOME,
  ANDROID_HOME,
  ANDROID_SDK_ROOT: ANDROID_HOME,
  PATH: `${join(JAVA_HOME, "bin")}${win ? ";" : ":"}${process.env.PATH}`,
};
function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: win, env, ...opts });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log(`JDK: ${JAVA_HOME}\nSDK: ${ANDROID_HOME}`);
writeFileSync("android/local.properties", `sdk.dir=${ANDROID_HOME.replace(/\\/g, "\\\\").replace(/:/g, "\\:")}\n`);

run("node", ["scripts/build-mobile.mjs"]);
run(resolve("android", win ? "gradlew.bat" : "gradlew"), ["assembleDebug", "--no-daemon", "--console=plain"], { cwd: "android" });

const built = "android/app/build/outputs/apk/debug/app-debug.apk";
if (!existsSync(built)) {
  console.error(`Gradle finished but ${built} is missing.`);
  process.exit(1);
}
mkdirSync("../release", { recursive: true });
const out = resolve("../release/BiteCraft.apk");
copyFileSync(built, out);

const bytes = statSync(out).size;
console.log(`\nAPK: ${out}\nSize: ${(bytes / 1024 / 1024).toFixed(2)} MB (${bytes} bytes)`);
const bt = join(ANDROID_HOME, "build-tools");
const ver = existsSync(bt) ? readdirSync(bt).sort().at(-1) : null;
const aapt = ver ? join(bt, ver, win ? "aapt.exe" : "aapt") : null;
if (aapt && existsSync(aapt)) {
  const badging = execFileSync(aapt, ["dump", "badging", out], { encoding: "utf8" });
  const pkg = badging.match(/package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'/);
  const label = badging.match(/application-label:'([^']+)'/);
  console.log(`Package: ${pkg?.[1]}\nVersion: ${pkg?.[3]} (code ${pkg?.[2]})\nLabel: ${label?.[1]}`);
}
