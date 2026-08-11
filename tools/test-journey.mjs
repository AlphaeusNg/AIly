import assert from "node:assert/strict";
import {
  attentionMismatchNote,
  findSameDayDuplicate,
  intentionStreak,
  previousDayISO,
  weekJourneyStats,
  weekReflection,
  weekStartISO,
} from "../apps/web/js/journey.js";

// 2026-08-11 is a Tuesday → week starts Monday 2026-08-10
assert.equal(weekStartISO(new Date(2026, 7, 11)), "2026-08-10");
assert.equal(weekStartISO(new Date(2026, 7, 10)), "2026-08-10");
assert.equal(weekStartISO(new Date(2026, 7, 9)), "2026-08-03"); // Sunday → prior Monday

assert.equal(previousDayISO("2026-08-11"), "2026-08-10");
assert.equal(previousDayISO("2026-03-01"), "2026-02-28");

const stats = weekJourneyStats({
  now: new Date(2026, 7, 11),
  commitments: [
    {
      id: "1",
      planDate: "2026-08-10",
      estimateMin: 60,
      status: "done",
    },
    {
      id: "2",
      planDate: "2026-08-11",
      estimateMin: 30,
      status: "pending",
    },
    {
      id: "3",
      planDate: "2026-08-01",
      estimateMin: 99,
      status: "done",
    },
  ],
  usageSamples: [
    { app: "AIly", mins: 20, ts: "2026-08-11T10:00:00.000Z" },
    { app: "Old", mins: 50, ts: "2026-08-01T10:00:00.000Z" },
  ],
  audit: [
    { tool: "block.break_glass", ts: "2026-08-11T12:00:00.000Z" },
    { tool: "block.break_glass", ts: "2026-07-01T12:00:00.000Z" },
  ],
});
assert.equal(stats.start, "2026-08-10");
assert.equal(stats.plannedMin, 90);
assert.equal(stats.doneMin, 60);
assert.equal(stats.doneCount, 1);
assert.equal(stats.openCount, 1);
assert.equal(stats.usageMin, 20);
assert.equal(stats.glass, 1);
assert.ok(Math.abs(stats.doneRatio - 60 / 90) < 1e-9);

assert.match(weekReflection(stats), /progress|slipping|follow/i);
assert.match(weekReflection({ plannedMin: 0 }), /No planned/i);
assert.match(weekReflection({ plannedMin: 100, doneMin: 90, doneRatio: 0.9, glass: 0 }), /Strong/i);

assert.equal(intentionStreak({ ui: { lastCheckInDate: "2026-08-10" } }, "2026-08-11"), 0);
assert.equal(
  intentionStreak(
    {
      ui: { lastCheckInDate: "2026-08-11" },
      audit: [{ tool: "checkin.save", ts: "2026-08-11T08:00:00.000Z" }],
    },
    "2026-08-11"
  ),
  1
);
assert.equal(
  intentionStreak(
    {
      ui: { lastCheckInDate: "2026-08-11" },
      audit: [
        { tool: "checkin.save", ts: "2026-08-11T08:00:00.000Z" },
        { tool: "checkin.save", ts: "2026-08-10T08:00:00.000Z" },
      ],
    },
    "2026-08-11"
  ),
  2
);

assert.equal(attentionMismatchNote(10, 100), null, "ignores tiny plans");
assert.match(attentionMismatchNote(60, 120), /above planned/i);
assert.match(attentionMismatchNote(120, 20), /larger than logged/i);
assert.equal(attentionMismatchNote(60, 50), null);

const dup = findSameDayDuplicate(
  [
    { id: "1", planDate: "2026-08-11", text: "Deep work", status: "pending" },
    { id: "2", planDate: "2026-08-11", text: "Other", status: "pending" },
  ],
  { planDate: "2026-08-11", text: "  deep   work " }
);
assert.equal(dup.duplicate, true);
assert.equal(dup.match.id, "1");
assert.equal(
  findSameDayDuplicate(
    [{ id: "1", planDate: "2026-08-11", text: "Deep work", status: "dropped" }],
    { planDate: "2026-08-11", text: "Deep work" }
  ).duplicate,
  false,
  "dropped items are not duplicates"
);

console.log("test-journey.mjs: week stats and streak helpers passed");
