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
  "js/register-sw.js",
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
assert.match(html, /<script[^>]+src="js\/register-sw\.js"/, "service-worker registration is externalized");
assert.doesNotMatch(
  html,
  /<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/i,
  "the app shell has no inline executable script",
);
for (const id of [
  "boot-splash",
  "app-shell",
  "install-banner",
  "update-banner",
  "tutorial-modal",
  "intention-modal",
  "checkin-modal",
  "return-nudge-modal",
  "breakglass-modal",
  "help-modal",
  "more-sheet",
  "toast-host",
]) {
  assert.match(html, new RegExp(`id="${id}"`), `index has #${id}`);
}

for (const tab of ["today", "targets", "review", "usage", "blocks", "setup", "activity"]) {
  assert.match(html, new RegExp(`data-nav="${tab}"`), `index still exposes ${tab} navigation`);
}
assert.match(html, /data-action="open-more"/, "phone nav exposes a More trigger");
assert.match(html, /class="nav-more-item"/, "Blocks/Setup/Activity are overflow nav items");
assert.match(html, /Fewer checks/, "intention modal hides snooze/skip under Fewer checks");
assert.match(
  html,
  /data-action="intention-confirm"[\s\S]*data-action="intention-cancel"[\s\S]*intention-fewer/,
  "intention primary/secondary stay outside the Fewer checks disclosure",
);

const css = read("css/app.css");
assert.match(css, /grid-template-columns:\s*repeat\(5,\s*1fr\)/, "phone bar is a 5-column grid");
assert.match(css, /nav-more-trigger/, "CSS hides More on desktop and shows it on phones");
assert.match(css, /\.commit-row\.is-must-keep/, "must-keep rows use a left accent");
assert.match(
  css,
  /@media \(max-width:\s*720px\)[\s\S]*#tray-status[\s\S]*display:\s*none/,
  "phone hides tray status without removing the node",
);
assert.match(
  css,
  /@media \(max-width:\s*720px\)[\s\S]*#net-status[\s\S]*display:\s*none/,
  "phone hides the network pill so Today leads",
);
assert.match(html, /id="tray-status"/, "tray status node remains for JS writes");
assert.match(html, /id="net-status"/, "net status node remains for JS writes");

const sw = read("sw.js");
assert.match(sw, /offline\.html/, "SW caches offline page");
assert.match(sw, /SKIP_WAITING/, "SW handles update message");
assert.match(sw, /journey\.js/, "SW caches journey module");
assert.match(sw, /ally\.js/, "SW caches ally module");
assert.match(sw, /target\.js/, "SW caches target progress module");
assert.match(sw, /register-sw\.js/, "SW caches its external registration script");

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
const windowsDownloadUrl = "https://github.com/AlphaeusNg/AIly/releases/latest/download/AIly-setup.exe";
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
assert.match(app, /"1": "today"[\s\S]*"7": "activity"/, "keyboard 1–7 still maps all seven tabs");
assert.match(app, /today-notices/, "non-danger Today banners fold into one disclosure");
assert.match(app, /pickNextCommitment/, "Today picks one next commitment with existing ranking");
assert.match(app, /one-thing/, "Today surfaces a one-thing card");
assert.match(app, /previewAcceptAll/, "accept-all uses a capacity preview");
assert.match(app, /today-log-metric/, "Today can log a target check-in");
assert.match(app, /return-still-yes/, "return nudge is a real yes/no question");
assert.match(app, /WINDOWS_DOWNLOAD_URL/, "install copy points at the Windows package");
assert.ok(app.includes(windowsDownloadUrl), "app uses the direct latest Windows asset");
assert.ok(html.includes(windowsDownloadUrl), "static install CTA works before JavaScript runs");
assert.match(app, /Install PWA/, "PWA install is named separately from the Windows package");
const tutorial = read("js/tutorial.js");
assert.match(tutorial, /AIly-setup.exe/, "tutorial names the Windows package");
assert.match(tutorial, /Auto-start stays/, "tutorial says auto-start stays off");
assert.match(html, /Windows package/, "install banner offers the Windows package");
assert.match(html, /id="return-nudge-title"/, "return-nudge modal has a question title");
assert.match(app, /formatClockHours/, "capacity copy can speak clock hours");
assert.match(app, /of a <strong>\$\{formatClockHours\(dailyCap\)\}<\/strong> day/, "time-consciousness states planned hours of a day");
assert.match(app, /commit-overflow/, "commitment extras live behind a per-row overflow menu");
assert.match(app, /open-more|closeMoreSheet/, "More sheet open/close is wired");

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
