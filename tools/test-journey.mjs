import assert from "node:assert/strict";
import {
  attentionMismatchNote,
  findSameDayDuplicate,
  formatDayPlanText,
  formatWeekHonestyText,
  intentionStreak,
  nextDayISO,
  previousDayISO,
  pruneAuditEntries,
  stalePendingCommitments,
  weekDayBreakdown,
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
assert.equal(nextDayISO("2026-08-11"), "2026-08-12");
assert.equal(nextDayISO("2026-02-28"), "2026-03-01");

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

const days = weekDayBreakdown({
  now: new Date(2026, 7, 11),
  commitments: [
    { id: "1", planDate: "2026-08-10", estimateMin: 60, status: "done" },
    { id: "2", planDate: "2026-08-11", estimateMin: 30, status: "pending" },
    { id: "3", planDate: "2026-08-11", estimateMin: 20, status: "done" },
  ],
});
assert.equal(days.start, "2026-08-10");
assert.equal(days.days.length, 7);
const tue = days.days.find((x) => x.date === "2026-08-11");
assert.equal(tue.plannedMin, 50);
assert.equal(tue.doneMin, 20);
assert.equal(tue.openCount, 1);
assert.equal(tue.doneCount, 1);

const stale = stalePendingCommitments(
  [
    { id: "1", planDate: "2026-08-09", status: "pending", estimateMin: 30, text: "old" },
    { id: "2", planDate: "2026-08-11", status: "pending", estimateMin: 20, text: "today" },
    { id: "3", planDate: "2026-08-08", status: "done", estimateMin: 10, text: "closed" },
    { id: "4", planDate: "2026-08-07", status: "dropped", estimateMin: 10, text: "gone" },
  ],
  "2026-08-11"
);
assert.equal(stale.length, 1);
assert.equal(stale[0].id, "1");

const planText = formatDayPlanText({
  dayISO: "2026-08-11",
  intention: "Ship",
  note: "Deep work",
  commitments: [
    {
      id: "1",
      targetId: "t1",
      text: "Hard part",
      estimateMin: 50,
      mustKeep: true,
      status: "pending",
    },
  ],
  targets: [{ id: "t1", title: "AIly" }],
});
assert.match(planText, /AIly plan 2026-08-11/);
assert.match(planText, /Intention: Ship/);
assert.match(planText, /Note: Deep work/);
assert.match(planText, /50m \(must-keep\) Hard part · AIly/);
assert.match(planText, /Total planned: 50m/);

const honesty = formatWeekHonestyText({
  dayISO: "2026-08-11",
  version: "2026.08.11.110",
  intention: "Deep work",
  todayPlannedMin: 80,
  todayUsageMin: 40,
  week: {
    start: "2026-08-10",
    plannedMin: 120,
    doneMin: 60,
    usageMin: 40,
    glass: 1,
  },
  days: [{ date: "2026-08-11", plannedMin: 80, doneMin: 20, openCount: 2 }],
  reflection: "Some progress landed.",
});
assert.match(honesty, /2026\.08\.11\.110/);
assert.match(honesty, /Intention: Deep work/);
assert.match(honesty, /Today planned: 80m/);
assert.match(honesty, /Week from 2026-08-10/);
assert.match(honesty, /2026-08-11 \(today\): plan 80m/);
assert.match(honesty, /Some progress landed/);

const pruned = pruneAuditEntries(
  [
    { tool: "a", ts: "2026-06-01T00:00:00.000Z" },
    { tool: "b", ts: "2026-08-10T00:00:00.000Z" },
    { tool: "c", ts: "2026-08-11T00:00:00.000Z" },
  ],
  7,
  "2026-08-11"
);
assert.equal(pruned.removed, 1);
assert.equal(pruned.audit.length, 2);
assert.equal(pruned.audit[0].tool, "b");

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
