import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "apps/web/sw.js"), "utf8");
const currentCache = /const CACHE = "([^"]+)";/.exec(source)?.[1];
assert.match(currentCache || "", /^aily-\d{4}\.\d{2}\.\d{2}\.\d+$/, "worker cache uses an AIly-owned version name");

const handlers = new Map();
const deleted = [];
let claimed = false;
const cacheNames = [
  currentCache,
  "aily-obsolete-test",
  "christoday-2026.08.11.3",
  "other-project-offline-v1",
];
const context = {
  URL,
  console,
  fetch: async () => {
    throw new Error("network is outside this activation test");
  },
  caches: {
    keys: async () => cacheNames,
    delete: async (name) => {
      deleted.push(name);
      return true;
    },
  },
  self: {
    location: { origin: "https://alphaeusng.github.io" },
    clients: {
      claim: async () => {
        claimed = true;
      },
    },
    skipWaiting: async () => {},
    addEventListener: (type, handler) => handlers.set(type, handler),
  },
};

vm.createContext(context);
vm.runInContext(source, context, { filename: "apps/web/sw.js" });

let activation;
handlers.get("activate")?.({
  waitUntil(promise) {
    activation = promise;
  },
});
assert.ok(activation, "worker activation registers a lifetime promise");
await activation;

assert.deepEqual(
  deleted,
  ["aily-obsolete-test"],
  "activation removes obsolete AIly caches without deleting foreign same-origin caches",
);
assert.equal(claimed, true, "worker claims clients after owned-cache cleanup");

console.log("test-service-worker.mjs: cache ownership and activation lifecycle passed");
