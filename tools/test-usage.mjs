/** Unit tests for usage helpers (no browser required). */
import assert from "node:assert/strict";
import {
  appendUsageSample,
  createSessionTracker,
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

console.log("test-usage.mjs: usage session and sample helpers passed");
