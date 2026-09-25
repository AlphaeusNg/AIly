/** Unit tests for usage helpers (no browser required). */
import assert from "node:assert/strict";
import {
  appendUsageSample,
  createSessionTracker,
  presentUsageTotal,
  removeUsageSampleAt,
  summarizeDayByApp,
  totalMinutesForDay,
} from "../apps/web/js/usage.js";

const empty = appendUsageSample([], { app: "", mins: 10 });
assert.equal(empty.added, false, "rejects empty app");

const badMins = appendUsageSample([], { app: "Chrome", mins: 0 });
assert.equal(badMins.added, false, "rejects non-positive minutes");

const a = appendUsageSample([], { app: "AIly", mins: 3, ts: "2026-08-11T10:00:00.000Z" });
assert.equal(a.added, true);
assert.equal(a.samples[0].mins, 3);

const b = appendUsageSample(a.samples, {
  app: "AIly",
  mins: 2,
  ts: "2026-08-11T10:05:00.000Z",
  mergeWindowMin: 15,
});
assert.equal(b.merged, true, "merges same app within window");
assert.equal(b.samples[0].mins, 5, "merged minutes sum");
assert.equal(b.samples.length, 1);

const c = appendUsageSample(b.samples, {
  app: "AIly",
  mins: 4,
  ts: "2026-08-11T11:00:00.000Z",
  mergeWindowMin: 15,
});
assert.equal(c.merged, false, "does not merge outside window");
assert.equal(c.samples.length, 2);

assert.equal(totalMinutesForDay(c.samples, "2026-08-11"), 9);
assert.equal(totalMinutesForDay(c.samples, "2026-08-10"), 0);

const removed = removeUsageSampleAt(c.samples, 0);
assert.equal(removed.removed, true);
assert.equal(removed.samples.length, 1);
assert.equal(removeUsageSampleAt(c.samples, 99).removed, false);

const summary = summarizeDayByApp(
  [
    { app: "AIly", mins: 5, ts: "2026-08-11T10:00:00.000Z" },
    { app: "Chrome", mins: 20, ts: "2026-08-11T11:00:00.000Z" },
    { app: "AIly", mins: 3, ts: "2026-08-11T12:00:00.000Z" },
  ],
  "2026-08-11"
);
assert.equal(summary[0].app, "Chrome");
assert.equal(summary[0].mins, 20);
assert.equal(summary[1].app, "AIly");
assert.equal(summary[1].mins, 8);

// Session tracker with fake clock
let flushed = [];
let t = 1_000_000;
const tracker = createSessionTracker({
  appName: "AIly",
  now: () => t,
  onFlush: (entry) => flushed.push(entry),
  minFlushMinutes: 1,
});
// Mock document as always active
globalThis.document = {
  visibilityState: "visible",
  hasFocus: () => true,
};
tracker.start();
t += 90_000; // 1.5 minutes active
const mins = tracker.flush();
assert.equal(mins, 1, "flushes whole minutes only");
assert.equal(flushed.length, 1);
assert.equal(flushed[0].app, "AIly");
assert.equal(flushed[0].mins, 1);
assert.ok(tracker.pendingMs() < 60000, "remainder stays in carry");

// Pause on hidden — fresh tracker so carry from the previous case does not leak
flushed = [];
t = 2_000_000;
const tracker2 = createSessionTracker({
  appName: "AIly",
  now: () => t,
  onFlush: (entry) => flushed.push(entry),
  minFlushMinutes: 1,
});
tracker2.start();
t += 30_000;
tracker2.pause();
t += 120_000; // hidden time must not count
tracker2.resume();
t += 60_000;
const mins2 = tracker2.flush();
assert.equal(mins2, 1, "only visible active time counts (30s+60s)");
assert.equal(flushed[0].mins, 1);

const sourced = appendUsageSample([], {
  app: "AIly",
  mins: 2,
  ts: "2026-09-25T10:00:00",
  source: "web-session",
});
assert.equal(sourced.samples[0].source, "web-session");
const manualBeside = appendUsageSample(sourced.samples, {
  app: "AIly",
  mins: 9,
  ts: "2026-09-25T10:02:00",
});
assert.equal(manualBeside.merged, false, "manual notes do not merge into a measured visit");
assert.equal(manualBeside.samples[0].source, undefined);

const browser = presentUsageTotal({
  backend: { id: "web-session", available: true },
  permission: "granted",
  status: "granted",
  platformSamples: [],
  manualSamples: manualBeside.samples,
  day: "2026-09-25",
});
assert.equal(browser.measured, true);
assert.equal(browser.minutes, 2);
assert.equal(browser.manualMinutes, 9);
assert.equal(browser.windowLabel, "browser visit");
assert.match(browser.explanation, /Resets when this page loads/);
assert.match(browser.explanation, /not included/);
const scopedRows = appendUsageSample(sourced.samples, {
  app: "AIly", mins: 3, ts: "2026-09-25T10:01:00", source: "web-session", visitId: "current",
}).samples;
assert.equal(scopedRows.length, 2, "different visits never merge");
assert.equal(presentUsageTotal({
  backend: { id: "web-session", available: true }, permission: "granted", status: "granted",
  manualSamples: scopedRows, day: "2026-09-25", visitId: "current",
}).minutes, 3, "only the current visit contributes measured minutes");

const unsupported = presentUsageTotal({
  backend: { id: "android-usagestats", available: false },
  permission: "granted",
  status: "unsupported",
  platformSamples: [{ app: "Mail", mins: 400, ts: "2026-09-25T12:00:00", source: "android-usagestats" }],
  manualSamples: [],
  day: "2026-09-25",
});
assert.equal(unsupported.measured, false);
assert.equal(unsupported.minutes, null, "unsupported totals are not a measured zero");
assert.equal(unsupported.windowLabel, "not measured");

const denied = presentUsageTotal({
  backend: { id: "windows-foreground-session", available: true },
  permission: "denied",
  status: "denied",
  platformSamples: [{ app: "Editor", mins: 20, ts: "2026-09-25T12:00:00", source: "windows-foreground-session" }],
  manualSamples: [],
  day: "2026-09-25",
});
assert.equal(denied.measured, false);
assert.equal(denied.minutes, null);

console.log("test-usage.mjs: usage session and sample helpers passed");
