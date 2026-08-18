/** Tests for local propose-only ally helpers. */
import assert from "node:assert/strict";
import { pickNextCommitment, previewAcceptAll, proposeDayPlan, rankCommitments, returnNudge } from "../apps/web/js/ally.js";

const noTargets = proposeDayPlan({
  targets: [],
  weeklyCapacityHours: 10,
  nightsPerWeek: 4,
});
assert.equal(noTargets.ok, false);
assert.equal(noTargets.error, "no_targets");

const targets = [
  {
    id: "a",
    title: "Ship AIly",
    status: "active",
    softCapacityHours: 6,
    metrics: [{ name: "features", unit: "items", baseline: 0, target: 10, current: 1 }],
  },
  {
    id: "b",
    title: "Health",
    status: "active",
    softCapacityHours: 4,
    metrics: [{ name: "sessions", unit: "n", baseline: 0, target: 5, current: 4 }],
  },
];

const plan = proposeDayPlan({
  targets,
  weeklyCapacityHours: 10,
  nightsPerWeek: 4,
  softCaps: [
    { targetId: "a", hours: 6 },
    { targetId: "b", hours: 4 },
  ],
  existingToday: [],
  intention: "Ship AIly hard part",
  maxItems: 3,
});
assert.equal(plan.ok, true, "plan succeeds with targets");
assert.ok(plan.proposals.length >= 1, "at least one proposal");
assert.equal(plan.proposals[0].targetId, "a", "intention biases toward Ship AIly");
assert.match(plan.proposals[0].text, /Protect:|Ship/i);
assert.ok(
  plan.proposals.every((p) => p.estimateMin >= 15 && p.estimateMin % 15 === 0),
  "estimates snap to 15m"
);

const total = plan.proposals.reduce((a, p) => a + p.estimateMin, 0);
const dailyCap = (10 * 60) / 4;
assert.ok(total <= dailyCap + 1e-9, "proposals fit daily soft cap");

const full = proposeDayPlan({
  targets,
  weeklyCapacityHours: 10,
  nightsPerWeek: 4,
  existingToday: [{ id: "x", targetId: "a", estimateMin: 200, status: "pending" }],
});
assert.equal(full.ok, true);
assert.equal(full.proposals.length, 0, "no proposals when day already full");

const wrongWay = proposeDayPlan({
  targets: [
    {
      id: "worse",
      title: "Worsening target",
      status: "active",
      metrics: [{ baseline: 0, target: 10, current: -10 }],
    },
    {
      id: "some",
      title: "Some progress",
      status: "active",
      metrics: [{ baseline: 0, target: 10, current: 1 }],
    },
  ],
  weeklyCapacityHours: 10,
  nightsPerWeek: 4,
  maxItems: 1,
});
assert.equal(
  wrongWay.proposals[0]?.targetId,
  "worse",
  "AIly prioritizes a wrong-way metric as zero progress",
);

const skipPlanned = proposeDayPlan({
  targets,
  weeklyCapacityHours: 10,
  nightsPerWeek: 4,
  softCaps: [
    { targetId: "a", hours: 6 },
    { targetId: "b", hours: 4 },
  ],
  existingToday: [{ id: "x", targetId: "a", estimateMin: 30, status: "pending" }],
  intention: "",
  maxItems: 2,
});
assert.equal(skipPlanned.ok, true);
assert.ok(
  skipPlanned.proposals.every((p) => p.targetId !== "a" || /buffer|break/i.test(p.text)),
  "skips Progress proposals for targets that already have pending work",
);
assert.ok(
  skipPlanned.proposals.some((p) => p.targetId === "b") || skipPlanned.proposals.length === 0,
  "prefers unplanned targets when capacity remains",
);

const skipDupText = proposeDayPlan({
  targets: [targets[0]],
  weeklyCapacityHours: 10,
  nightsPerWeek: 4,
  existingToday: [
    {
      id: "dup",
      targetId: "a",
      estimateMin: 30,
      status: "pending",
      text: "Progress: Ship AIly on features",
    },
  ],
  intention: "",
  maxItems: 3,
});
assert.ok(
  skipDupText.proposals.every((p) => !/Progress: Ship AIly/i.test(p.text) || /buffer|break/i.test(p.text)),
  "does not re-propose identical Progress text already on today",
);

const nextPick = pickNextCommitment([
  { id: "done", text: "Already done", status: "done", mustKeep: true, priority: 0, estimateMin: 90 },
  { id: "optional", text: "Optional", status: "pending", mustKeep: false, priority: 0, estimateMin: 60 },
  { id: "keep", text: "Protect this", status: "pending", mustKeep: true, priority: 2, estimateMin: 30 },
]);
assert.equal(nextPick?.id, "keep", "ally picks the pending must-keep first");
assert.equal(pickNextCommitment([]), null, "no next commitment when the day is empty");
assert.equal(
  rankCommitments([
    { id: "long", priority: 1, estimateMin: 45 },
    { id: "short-important", priority: 0, estimateMin: 15 },
  ])[0].id,
  "short-important",
  "existing ranking prefers lower priority number before length"
);

assert.equal(returnNudge({ awayMin: 2 }), null);
const deep = returnNudge({ awayMin: 20, intention: "Deep work" });
assert.match(deep.question, /Still protecting Deep work/);
assert.match(deep.text, /intention/i);
assert.match(returnNudge({ awayMin: 20, focusActive: true }).text, /Focus/i);
assert.match(
  returnNudge({ awayMin: 15, openPending: 2, plannedMin: 40 }).text,
  /2 open/,
  "return nudge mentions open plan load"
);

const preview = previewAcceptAll({
  proposals: [
    { text: "Protect: Ship AIly hard part", targetId: "a", estimateMin: 45, mustKeep: true },
    { text: "Progress: Health on sessions", targetId: "b", estimateMin: 30, mustKeep: false },
    { text: "Protect: Ship AIly hard part", targetId: "a", estimateMin: 45, mustKeep: true },
    { text: "Ghost", targetId: "missing", estimateMin: 15, mustKeep: false },
  ],
  existingToday: [],
  targets,
  weeklyCapacityHours: 10,
  nightsPerWeek: 4,
  softCaps: [
    { targetId: "a", hours: 6 },
    { targetId: "b", hours: 4 },
  ],
  planDate: "2026-08-18",
});
assert.equal(preview.added.length, 2, "preview adds the two unique active proposals");
assert.equal(preview.addedMin, 75);
assert.ok(
  preview.skipped.some((s) => s.reason === "duplicate"),
  "preview names the duplicate skip"
);
assert.ok(
  preview.skipped.some((s) => s.reason === "inactive"),
  "preview names the inactive-target skip"
);

const overflow = previewAcceptAll({
  proposals: [{ text: "Too much", targetId: "a", estimateMin: 180, mustKeep: false }],
  existingToday: [{ id: "x", targetId: "a", estimateMin: 90, status: "pending", mustKeep: false }],
  targets,
  weeklyCapacityHours: 10,
  nightsPerWeek: 4,
  planDate: "2026-08-18",
});
assert.equal(overflow.added.length, 0);
assert.equal(overflow.skipped[0]?.reason, "daily_over");

// Determinism
const p1 = proposeDayPlan({
  targets,
  weeklyCapacityHours: 10,
  nightsPerWeek: 4,
  intention: "",
});
const p2 = proposeDayPlan({
  targets,
  weeklyCapacityHours: 10,
  nightsPerWeek: 4,
  intention: "",
});
assert.deepEqual(p1.proposals, p2.proposals, "same inputs → same proposals");

console.log("test-ally.mjs: propose-only ally helpers passed");
