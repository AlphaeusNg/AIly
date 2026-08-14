import assert from "node:assert/strict";
import {
  createAndroidUsageBackend,
  createAndroidUsageBackendStub,
  createWebSessionBackend,
  selectUsageBackend,
  usageBackendHonesty,
} from "../apps/web/js/platform-usage.js";

const web = createWebSessionBackend();
assert.equal(web.id, "web-session");
assert.equal(web.capabilities.session, true);
assert.equal(await web.requestPermission(), "granted");
assert.deepEqual(await web.listTodaySamples(), []);

const android = createAndroidUsageBackendStub();
assert.equal(android.id, "android-usagestats");
assert.equal(android.capabilities.perApp, true);
assert.equal(await android.requestPermission(), "unsupported");

let settingsOpens = 0;
let nativeReads = 0;
let granted = false;
const nativePlugin = {
  async getPermissionStatus() {
    return { granted };
  },
  async openUsageAccessSettings() {
    settingsOpens += 1;
  },
  async listTodayUsage(options) {
    nativeReads += 1;
    assert.deepEqual(options, { consented: true });
    return {
      permission: "granted",
      day: "2026-08-11",
      samples: [
        { packageName: "com.example.editor", label: "Editor", foregroundMs: 61000 },
        { packageName: "com.example.tiny", label: "Tiny", foregroundMs: 1000 },
        { packageName: "bad.zero", label: "Bad", foregroundMs: 0 },
        { packageName: "bad.missing", foregroundMs: 60000 },
      ],
    };
  },
};
const native = createAndroidUsageBackend(nativePlugin);
assert.equal(native.id, "android-usagestats");
assert.equal(native.available, true);
assert.equal(await native.permissionStatus(), "denied");
assert.equal(await native.requestPermission(), "settings_opened");
assert.equal(settingsOpens, 1, "denied access opens Android settings only when requested");
assert.deepEqual(
  await native.listTodaySamples(),
  [],
  "native reads require an explicit consent argument",
);
assert.equal(nativeReads, 0, "missing consent never calls the native usage API");

granted = true;
assert.equal(await native.requestPermission(), "granted");
assert.equal(settingsOpens, 1, "an existing grant does not reopen settings");
assert.deepEqual(await native.listTodaySamples({ consented: true }), [
  {
    app: "Editor",
    mins: 1,
    ts: "2026-08-11T12:00:00",
    source: "android-usagestats",
    packageName: "com.example.editor",
  },
  {
    app: "Tiny",
    mins: 1,
    ts: "2026-08-11T12:00:00",
    source: "android-usagestats",
    packageName: "com.example.tiny",
  },
]);
assert.equal(nativeReads, 1);

const capped = createAndroidUsageBackend({
  async getPermissionStatus() {
    return { granted: true };
  },
  async listTodayUsage() {
    return {
      permission: "granted",
      day: "2026-08-11",
      samples: Array.from({ length: 55 }, (_, i) => ({
        packageName: `com.example.app${i}`,
        label: `App ${i}`,
        foregroundMs: 60_000,
      })),
    };
  },
});
assert.equal(
  (await capped.listTodaySamples({ consented: true })).length,
  50,
  "the JavaScript boundary independently caps native rows",
);

const validSampleCap = createAndroidUsageBackend({
  async listTodayUsage() {
    return {
      permission: "granted",
      day: "2026-08-11",
      samples: [
        ...Array.from({ length: 50 }, (_, i) => ({
          packageName: `invalid.zero${i}`,
          label: `Invalid ${i}`,
          foregroundMs: 0,
        })),
        ...Array.from({ length: 55 }, (_, i) => ({
          packageName: `com.example.valid${i}`,
          label: `Valid ${i}`,
          foregroundMs: 60_000,
        })),
      ],
    };
  },
});
const validSamples = await validSampleCap.listTodaySamples({ consented: true });
assert.equal(validSamples.length, 50, "malformed rows do not consume the valid-sample cap");
assert.equal(validSamples[0].packageName, "com.example.valid0");
assert.equal(validSamples[49].packageName, "com.example.valid49");

assert.equal(selectUsageBackend({ isNative: false }).id, "web-session");
assert.equal(
  selectUsageBackend({ isNative: true, platform: "android", plugin: null }).id,
  "android-usagestats"
);
assert.equal(
  selectUsageBackend({ isNative: true, platform: "android", plugin: nativePlugin }).available,
  true,
  "native Android selects the installed adapter",
);
assert.equal(selectUsageBackend({ isNative: true, platform: "ios" }).id, "web-session");

assert.match(usageBackendHonesty(web), /tab only/i);
assert.match(usageBackendHonesty(android), /not installed/i);
assert.match(usageBackendHonesty(native), /local daily totals/i);

console.log("test-platform-usage.mjs: usage backend boundary ok");
