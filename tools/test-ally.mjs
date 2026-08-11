/** Tests for local propose-only ally helpers. */
import assert from "node:assert/strict";
import { proposeDayPlan, returnNudge } from "../apps/web/js/ally.js";

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

assert.equal(returnNudge({ awayMin: 2 }), null);
assert.match(returnNudge({ awayMin: 20, intention: "Deep work" }), /intention/i);
assert.match(returnNudge({ awayMin: 20, focusActive: true }), /Focus/i);
assert.match(
  returnNudge({ awayMin: 15, openPending: 2, plannedMin: 40 }),
  /2 open/,
  "return nudge mentions open plan load"
);

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
