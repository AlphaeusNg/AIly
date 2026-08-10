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

const version = read("js/version.js");
assert.match(version, /SITE_VERSION/, "version module exports SITE_VERSION");
assert.match(version, /2026\.08\.11\.\d+/, "version stamp is current series");

const manifest = JSON.parse(read("manifest.webmanifest"));
assert.equal(manifest.display, "standalone");
assert.ok(manifest.icons?.length >= 3, "manifest has icons");
assert.match(manifest.name || "", /AIly/i);

const app = read("js/app.js");
assert.match(app, /proposeDayPlan/, "app wires ally propose");
assert.match(app, /cloneYesterday|clone-yesterday/, "app can clone yesterday");
assert.match(app, /watchServiceWorkerUpdates/, "app watches SW updates");
assert.match(app, /prefers-reduced-motion|reduceMotion|reduce-motion/, "motion prefs considered");
assert.match(app, /seedDemoJourney|seed-demo/, "sample journey seeder exists");
assert.match(app, /upsertBlockRule/, "block upsert is wired");
assert.match(app, /attentionMismatchNote/, "attention mismatch note is wired");

const offline = read("offline.html");
assert.match(offline, /offline/i, "offline page mentions offline");
assert.match(offline, /AIly/i, "offline page brands AIly");

console.log(`test-shell.mjs: ${required.length} assets + shell contracts ok`);
