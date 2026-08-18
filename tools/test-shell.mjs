/** Static shell integrity checks for the web app. */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const web = join(root, "apps/web");

function read(rel) {
  return readFileSync(join(web, rel), "utf8");
}

const required = [
  "index.html",
  "offline.html",
  "css/app.css",
  "js/app.js",
  "js/store.js",
  "js/capacity.js",
  "js/target.js",
  "js/tutorial.js",
  "js/usage.js",
  "js/block.js",
  "js/ally.js",
  "js/journey.js",
  "js/version.js",
  "sw.js",
  "manifest.webmanifest",
  "assets/logo.svg",
  "assets/splash-mark.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

for (const rel of required) {
  assert.ok(existsSync(join(web, rel)), `missing shell asset: ${rel}`);
}

const html = read("index.html");
for (const id of [
  "boot-splash",
  "app-shell",
  "install-banner",
  "update-banner",
  "tutorial-modal",
  "intention-modal",
  "checkin-modal",
  "breakglass-modal",
  "help-modal",
  "toast-host",
]) {
  assert.match(html, new RegExp(`id="${id}"`), `index has #${id}`);
}

const sw = read("sw.js");
assert.match(sw, /offline\.html/, "SW caches offline page");
assert.match(sw, /SKIP_WAITING/, "SW handles update message");
assert.match(sw, /journey\.js/, "SW caches journey module");
assert.match(sw, /ally\.js/, "SW caches ally module");
assert.match(sw, /target\.js/, "SW caches target progress module");

const version = read("js/version.js");
assert.match(version, /SITE_VERSION/, "version module exports SITE_VERSION");
assert.match(version, /\bid:\s*"\d{4}\.\d{2}\.\d{2}\.\d+"/, "version stamp uses deploy format");

const manifest = JSON.parse(read("manifest.webmanifest"));
assert.equal(manifest.display, "standalone");
assert.ok(manifest.icons?.length >= 3, "manifest has icons");
assert.match(manifest.name || "", /AIly/i);
assert.equal(manifest.id, "./", "PWA identity stays relative to the AIly scope");
assert.notEqual(manifest.id, "/", "PWA identity must not collide with the portfolio origin root");
assert.equal(manifest.start_url, "./index.html");
assert.equal(manifest.scope, "./");

const launcherPath = join(root, "tools/serve-windows.ps1");
const launcherBytes = readFileSync(launcherPath);
assert.ok(
  [...launcherBytes].every((byte) => byte < 0x80),
  "Windows launcher stays ASCII so Windows PowerShell 5.1 can parse it without a UTF-8 BOM",
);
const launcher = launcherBytes.toString("ascii");
assert.doesNotMatch(launcher, /node\s+-e/, "Windows launcher must not embed a node -e one-liner");
assert.match(launcher, /serve-static\.mjs/, "Windows launcher uses the extracted static server");
assert.match(launcher, /not a native Windows installer/, "Windows launcher states it is not a native installer");
assert.ok(
  launcher.split(/\r?\n/).every((line) => line.length <= 220),
  "Windows launcher lines stay short enough to parse reliably",
);
const bat = readFileSync(join(root, "tools/serve-windows.bat"), "utf8");
assert.match(bat, /serve-windows\.ps1/, "batch wrapper invokes the PowerShell launcher");

const app = read("js/app.js");
assert.match(app, /proposeDayPlan/, "app wires ally propose");
assert.match(app, /metricProgressPct/, "app uses shared direction-aware target progress");
assert.match(app, /cloneYesterday|clone-yesterday/, "app can clone yesterday");
assert.match(app, /watchServiceWorkerUpdates/, "app watches SW updates");
assert.match(app, /prefers-reduced-motion|reduceMotion|reduce-motion/, "motion prefs considered");
assert.match(app, /seedDemoJourney|seed-demo/, "sample journey seeder exists");
assert.match(app, /upsertBlockRule/, "block upsert is wired");
assert.match(app, /attentionMismatchNote/, "attention mismatch note is wired");
assert.match(app, /platform-usage|selectUsageBackend/, "platform usage backend is wired");
assert.match(app, /requestUsageGrant/, "usage grant is routed through the selected backend");
assert.match(app, /listTodaySamples\(\{ consented: true \}\)/, "native usage reads require consent");
assert.match(
  app,
  /action === "revoke-usage"[\s\S]{0,700}platformUsageSamples = \[\]/,
  "revoking usage immediately clears in-memory native totals",
);
assert.match(app, /undoLast|pushUndo/, "session undo is wired");

const androidManifest = readFileSync(join(root, "android/app/src/main/AndroidManifest.xml"), "utf8");
assert.match(
  androidManifest,
  /android\.permission\.PACKAGE_USAGE_STATS/,
  "Android declares special usage access",
);
const androidMain = readFileSync(
  join(root, "android/app/src/main/java/com/alphaeusng/aily/MainActivity.java"),
  "utf8",
);
assert.match(androidMain, /AilyUsagePlugin\.class/, "Android registers AIly's local usage plugin");
assert.ok(
  androidMain.indexOf("registerPlugins(nativePlugins())") < androidMain.indexOf("super.onCreate(savedInstanceState)"),
  "local plugins are registered before Capacitor creates the bridge",
);
const androidUsage = readFileSync(
  join(root, "android/app/src/main/java/com/alphaeusng/aily/AilyUsagePlugin.java"),
  "utf8",
);
assert.match(androidUsage, /USAGE_CONSENT_REQUIRED/, "native usage reads enforce tutorial consent");
assert.match(androidUsage, /MAX_ENTRIES\s*=\s*50/, "native usage output is bounded");

const offline = read("offline.html");
assert.match(offline, /offline/i, "offline page mentions offline");
assert.match(offline, /AIly/i, "offline page brands AIly");

console.log(`test-shell.mjs: ${required.length} assets + shell contracts ok`);
