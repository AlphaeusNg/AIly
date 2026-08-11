import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "apps/web/sw.js"), "utf8");
const scope = "https://alphaeusng.github.io/AIly/";
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
    registration: { scope },
    location: new URL(scope),
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

function createFetchWorker({
  ownedBody = null,
  offlineBody = null,
  foreignBody = null,
  networkBody = "network",
  networkFails = false,
  putFails = false,
} = {}) {
  const listeners = new Map();
  const calls = { fetch: [], globalMatch: [], ownedMatch: [], open: [], put: [] };
  const ownedCache = {
    async add() {},
    async match(request) {
      const url = typeof request === "string" ? request : request.url;
      calls.ownedMatch.push(url);
      const body = url === "./offline.html" ? offlineBody : ownedBody;
      return body == null ? undefined : new Response(body);
    },
    async put(request, response) {
      calls.put.push({ url: request.url, body: await response.text() });
      if (putFails) throw new Error("cache write denied");
    },
  };
  const runtimeContext = {
    URL,
    Promise,
    Response,
    console,
    fetch: async (request) => {
      calls.fetch.push(request.url);
      if (networkFails) throw new Error("offline");
      return new Response(networkBody, { status: 200 });
    },
    caches: {
      async open(name) {
        calls.open.push(name);
        return ownedCache;
      },
      async match(request) {
        calls.globalMatch.push(request.url || request);
        return foreignBody == null ? undefined : new Response(foreignBody);
      },
      async keys() {
        return [];
      },
      async delete() {
        return true;
      },
    },
    self: {
      registration: { scope },
      location: new URL(scope),
      clients: { claim: async () => {} },
      skipWaiting: async () => {},
      addEventListener(type, handler) {
        listeners.set(type, handler);
      },
    },
  };
  vm.createContext(runtimeContext);
  vm.runInContext(source, runtimeContext, { filename: "apps/web/sw.js" });

  function dispatchFetch(url, { navigate = false } = {}) {
    const responsePromises = [];
    const lifetimePromises = [];
    listeners.get("fetch")({
      request: {
        method: "GET",
        url,
        mode: navigate ? "navigate" : "cors",
        headers: { get: () => navigate ? "text/html" : "" },
      },
      respondWith(promise) {
        responsePromises.push(Promise.resolve(promise));
      },
      waitUntil(promise) {
        lifetimePromises.push(Promise.resolve(promise));
      },
    });
    return { responsePromises, lifetimePromises };
  }

  return { calls, dispatchFetch };
}

{
  const worker = createFetchWorker();
  const event = worker.dispatchFetch("https://alphaeusng.github.io/ChristoDay/js/app.js");
  assert.equal(event.responsePromises.length, 0, "out-of-scope requests are not intercepted");
  assert.equal(event.lifetimePromises.length, 0, "out-of-scope requests create no worker work");
  assert.equal(worker.calls.fetch.length, 0, "out-of-scope requests bypass worker fetch");
}

{
  const worker = createFetchWorker({ ownedBody: "AIly copy", foreignBody: "foreign copy", networkFails: true });
  const event = worker.dispatchFetch(`${scope}js/app.js`);
  const response = await event.responsePromises[0];
  await Promise.all(event.lifetimePromises);
  assert.equal(await response.text(), "AIly copy", "only AIly's current cache may answer AIly requests");
  assert.equal(worker.calls.globalMatch.length, 0, "runtime lookup never searches foreign caches");
  assert.equal(worker.calls.ownedMatch.length, 1, "runtime lookup checks the owned cache once");
}

{
  const worker = createFetchWorker({ networkBody: "fresh" });
  const event = worker.dispatchFetch(`${scope}docs/privacy.md`);
  assert.equal(event.responsePromises.length, 1, "in-scope GET receives a worker response");
  assert.equal(event.lifetimePromises.length, 1, "runtime update extends the fetch lifetime synchronously");
  const response = await event.responsePromises[0];
  await event.lifetimePromises[0];
  assert.equal(await response.text(), "fresh", "an uncached request returns its network response");
  assert.deepEqual(worker.calls.open, [currentCache], "only the current AIly cache is opened");
  assert.equal(worker.calls.put.length, 1, "a successful response is cached before lifetime settlement");
}

{
  const worker = createFetchWorker({ networkBody: "still usable", putFails: true });
  const event = worker.dispatchFetch(`${scope}docs/privacy.md`);
  const response = await event.responsePromises[0];
  await event.lifetimePromises[0];
  assert.equal(
    await response.text(),
    "still usable",
    "cache-write failure must not discard a valid network response",
  );
}

{
  const worker = createFetchWorker({ offlineBody: "offline shell", networkFails: true });
  const event = worker.dispatchFetch(`${scope}missing-page`, { navigate: true });
  const response = await event.responsePromises[0];
  await event.lifetimePromises[0];
  assert.equal(await response.text(), "offline shell", "offline navigation uses AIly's owned fallback");
  assert.deepEqual(
    worker.calls.ownedMatch,
    [`${scope}missing-page`, "./offline.html"],
    "navigation fallback stays inside the current AIly cache",
  );
}

console.log("test-service-worker.mjs: activation, scope, ownership, lifetime, fallback, and write-failure cases passed");
