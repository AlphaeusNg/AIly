import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  currentNotificationPermission,
  reconcileNotificationPermission,
  requestNotificationPermission,
} from "../apps/web/js/tutorial.js";

assert.equal(currentNotificationPermission(undefined), "unavailable");
assert.equal(currentNotificationPermission({ permission: "granted" }), "granted");
assert.equal(currentNotificationPermission({ permission: "denied" }), "denied");
assert.equal(currentNotificationPermission({ permission: "default" }), "default");
assert.equal(currentNotificationPermission({ permission: "unexpected" }), "error");

let requests = 0;
assert.equal(
  await requestNotificationPermission({
    permission: "granted",
    requestPermission: async () => {
      requests += 1;
      return "granted";
    },
  }),
  "granted",
  "an existing grant should not prompt again",
);
assert.equal(requests, 0);

assert.equal(
  await requestNotificationPermission({
    permission: "default",
    requestPermission: async () => "granted",
  }),
  "granted",
);
assert.equal(
  await requestNotificationPermission({
    permission: "default",
    requestPermission: async () => "denied",
  }),
  "denied",
);
assert.equal(
  await requestNotificationPermission({
    permission: "default",
    requestPermission: async () => "default",
  }),
  "default",
  "dismissing the browser prompt remains distinct from denial",
);
assert.equal(
  await requestNotificationPermission({ permission: "default" }),
  "unavailable",
  "a missing request API must not become an enabled permission",
);
assert.equal(
  await requestNotificationPermission({
    permission: "default",
    requestPermission: async () => {
      throw new Error("browser failure");
    },
  }),
  "error",
);

const staleDenied = {
  tutorial: { permissions: { notifications: true } },
};
assert.deepEqual(
  reconcileNotificationPermission(staleDenied, "denied"),
  { changed: true, enabled: false, permission: "denied" },
);
assert.equal(staleDenied.tutorial.permissions.notifications, false);

const staleUnavailable = {
  tutorial: { permissions: { notifications: true } },
};
assert.equal(
  reconcileNotificationPermission(staleUnavailable, "unavailable").changed,
  true,
);
assert.equal(staleUnavailable.tutorial.permissions.notifications, false);

const grantedOptIn = {
  tutorial: { permissions: { notifications: true } },
};
assert.deepEqual(
  reconcileNotificationPermission(grantedOptIn, "granted"),
  { changed: false, enabled: true, permission: "granted" },
);

const notOptedIn = {
  tutorial: { permissions: { notifications: false } },
};
assert.deepEqual(
  reconcileNotificationPermission(notOptedIn, "granted"),
  { changed: false, enabled: false, permission: "granted" },
  "a browser grant alone must not silently opt AIly in",
);

const appSource = readFileSync(new URL("../apps/web/js/app.js", import.meta.url), "utf8");
assert.match(
  appSource,
  /requestNotificationPermission\(\)/,
  "the tutorial grant uses the browser-backed permission request helper",
);
assert.match(
  appSource,
  /tutorial\.permissions\.notifications\s*=\s*notificationStatus\s*===\s*"granted"/,
  "AIly enables notifications only after a real browser grant",
);
assert.doesNotMatch(
  appSource,
  /tutorial\.permissions\.notifications\s*=\s*true/,
  "no UI path may claim notification permission before the browser grants it",
);
for (const event of [
  "permission.denied",
  "permission.dismissed",
  "permission.unavailable",
  "permission.error",
  "permission.reconcile",
]) {
  assert.ok(appSource.includes(event), `notification outcome is audited as ${event}`);
}
assert.match(
  appSource,
  /data-action="grant-notifications"/,
  "Setup provides a retry path after an optional denied or dismissed prompt",
);

console.log("test-tutorial.mjs: browser notification permission stays truthful");
