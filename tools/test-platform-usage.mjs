import assert from "node:assert/strict";
import {
  createAndroidUsageBackend,
  createAndroidUsageBackendStub,
  createUsageJourneyModel,
  createWindowsUsageBackend,
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

const windowsCalls = [];
const windowsInvoke = async (command, args = {}) => {
  windowsCalls.push([command, args]);
  if (command === "windows_usage_status") {
    return { available: true, tracking: false, day: "2026-08-11" };
  }
  if (command === "set_windows_usage_tracking") {
    return { available: true, tracking: args.consented, day: "2026-08-11" };
  }
  if (command === "list_windows_session_usage") {
    return {
      day: "2026-08-11",
      samples: [
        { processName: "editor.exe", label: "Editor", foregroundMs: 125_000 },
        { processName: "short.exe", label: "Short", foregroundMs: 59_999 },
        { processName: "", label: "Missing", foregroundMs: 120_000 },
      ],
    };
  }
  throw new Error(`unexpected Windows command: ${command}`);
};
const windows = createWindowsUsageBackend(windowsInvoke);
assert.equal(windows.id, "windows-foreground-session");
assert.equal(windows.available, true);
assert.equal(windows.capabilities.perApp, true);
assert.equal(await windows.permissionStatus(), "granted");
assert.deepEqual(await windows.listTodaySamples(), [], "Windows reads require explicit consent");
assert.equal(windowsCalls.some(([command]) => command === "list_windows_session_usage"), false);
assert.equal(await windows.requestPermission(), "granted");
assert.deepEqual(await windows.listTodaySamples({ consented: true }), [
  {
    app: "Editor",
    mins: 2,
    ts: "2026-08-11T12:00:00",
    source: "windows-foreground-session",
    processName: "editor.exe",
  },
]);
await windows.revokePermission();
assert.deepEqual(windowsCalls.at(-1), ["set_windows_usage_tracking", { consented: false }]);

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
assert.equal(
  selectUsageBackend({ tauriInvoke: windowsInvoke }).id,
  "windows-foreground-session",
  "the installed Tauri shell selects native Windows usage",
);
assert.equal(
  selectUsageBackend({
    isNative: true,
    platform: "android",
    plugin: nativePlugin,
    tauriInvoke: windowsInvoke,
  }).id,
  "android-usagestats",
  "Android remains preferred inside the Capacitor shell",
);

assert.match(usageBackendHonesty(web), /tab only/i);
assert.match(usageBackendHonesty(android), /not installed/i);
assert.match(usageBackendHonesty(native), /local daily totals/i);
assert.match(usageBackendHonesty(windows), /since AIly opened/i);

function assertUnmeasured(reading, label) {
  assert.equal(reading.measured, false, `${label} is not measured`);
  assert.equal(reading.minutes, null, `${label} does not present a minute total`);
  assert.equal(reading.windowLabel, "not measured", `${label} window`);
}

for (const platform of ["web", "windows", "android", "unsupported"]) {
  const model = createUsageJourneyModel({ platform, day: "2026-09-25" });
  assert.equal(model.physicalDevice, false, `${platform} harness is not a device`);
  assert.equal(model.claimsNativeMonitorPaused, false, `${platform} harness does not claim a paused OS monitor`);
  assert.match(model.limitation, /not run/i);
  assert.equal(model.record(30).accepted, false, `${platform} records nothing before grant`);
  assertUnmeasured(model.present(), `${platform} before grant`);
  assertUnmeasured(model.deny(), `${platform} deny`);
}

const windowsJourney = createUsageJourneyModel({ platform: "windows", day: "2026-09-25" });
assert.equal(windowsJourney.grant().windowLabel, "installed Windows session");
assert.equal(windowsJourney.record(2).accepted, true);
assert.equal(windowsJourney.present().minutes, 2);
windowsJourney.suspend();
assert.equal(windowsJourney.record(9).reason, "gap", "a suspended shell does not fill the gap");
assert.equal(windowsJourney.present().minutes, 2);
windowsJourney.resume();
assert.equal(windowsJourney.record(1).accepted, true);
assert.equal(windowsJourney.present().minutes, 3, "resume does not backfill the suspended gap");
assertUnmeasured(windowsJourney.revoke(), "windows revoke clears the session");
windowsJourney.grant();
windowsJourney.record(4);
assert.equal(windowsJourney.midnight("2026-09-26").minutes, 0, "windows midnight starts a new session day");
windowsJourney.record(6);
assertUnmeasured(windowsJourney.restart(), "windows restart drops the in-memory session");
windowsJourney.grant();
assert.equal(windowsJourney.present().minutes, 0, "a new Windows grant does not restore pre-restart minutes");

const androidJourney = createUsageJourneyModel({ platform: "android", day: "2026-09-25" });
assertUnmeasured(androidJourney.deny(), "android deny");
assert.equal(androidJourney.grant().windowLabel, "Android day");
assert.equal(androidJourney.readOsDay(40).minutes, 40);
androidJourney.suspend();
assert.equal(androidJourney.readOsDay(80).accepted, false, "android does not sample while the shell is suspended");
assert.equal(androidJourney.present().minutes, 40);
androidJourney.resume();
assert.equal(androidJourney.present().minutes, 40, "android resume does not invent the gap");
assert.equal(androidJourney.readOsDay(42).minutes, 42);
assertUnmeasured(androidJourney.revoke(), "android revoke");
androidJourney.grant();
androidJourney.readOsDay(15);
assert.equal(androidJourney.midnight("2026-09-26").minutes, 0, "android midnight rolls the day window");
assert.equal(androidJourney.readOsDay(3).minutes, 3);
assertUnmeasured(androidJourney.restart(), "android restart drops AIly's in-memory copy");
androidJourney.grant();
assert.equal(androidJourney.present().minutes, 0, "restart does not resurrect the previous Android read");
assert.equal(androidJourney.readOsDay(7).minutes, 7, "only a new supplied day snapshot is shown");

const webJourney = createUsageJourneyModel({ platform: "web", day: "2026-09-25" });
assert.equal(webJourney.grant().windowLabel, "browser visit");
webJourney.record(5);
webJourney.record(4, { manual: true });
assert.equal(webJourney.present().minutes, 5);
assert.equal(webJourney.present().manualMinutes, 4);
webJourney.suspend();
assert.equal(webJourney.record(20).reason, "gap");
assert.equal(webJourney.resume().minutes, 5);
assert.equal(webJourney.midnight("2026-09-26").minutes, 0, "browser visit rolls at local midnight");
webJourney.record(2);
assert.equal(webJourney.restart().minutes, 0, "reload drops the unflushed browser visit");
assertUnmeasured(webJourney.revoke(), "web revoke");

const unsupportedJourney = createUsageJourneyModel({ platform: "unsupported" });
assertUnmeasured(unsupportedJourney.grant(), "unsupported grant");
assert.equal(unsupportedJourney.record(100).reason, "unsupported");
assertUnmeasured(unsupportedJourney.present(), "unsupported totals");
unsupportedJourney.suspend();
unsupportedJourney.resume();
unsupportedJourney.restart();
unsupportedJourney.midnight("2026-09-26");
assertUnmeasured(unsupportedJourney.present(), "unsupported after every journey event");

console.log("test-platform-usage.mjs: usage backend boundary ok");
