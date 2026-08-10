/**
 * Cross-check JS proposeDayPlan shape against aily-core fixtures (shared cases).
 * Does not invoke cargo; validates JS determinism + invariants that Rust tests also cover.
 */
import assert from "node:assert/strict";
import { proposeDayPlan } from "../apps/web/js/ally.js";

const cases = [
  {
    name: "no_targets",
    input: {
      targets: [],
      weeklyCapacityHours: 10,
      nightsPerWeek: 4,
    },
    expect: { ok: false, error: "no_targets" },
  },
  {
    name: "day_full",
    input: {
      targets: [{ id: "a", title: "Ship", status: "active", metrics: [] }],
      weeklyCapacityHours: 10,
      nightsPerWeek: 4,
      existingToday: [
        { id: "x", targetId: "a", estimateMin: 200, status: "pending", mustKeep: false },
      ],
    },
    expect: { ok: true, empty: true },
  },
  {
    name: "intention_bias",
    input: {
      targets: [
        {
          id: "a",
          title: "Ship AIly",
          status: "active",
          softCapacityHours: 6,
          metrics: [{ baseline: 0, target: 10, current: 1 }],
        },
        {
          id: "b",
          title: "Health",
          status: "active",
          softCapacityHours: 4,
          metrics: [{ baseline: 0, target: 5, current: 4 }],
        },
      ],
      weeklyCapacityHours: 10,
      nightsPerWeek: 4,
      softCaps: [
        { targetId: "a", hours: 6 },
        { targetId: "b", hours: 4 },
      ],
      intention: "Ship AIly hard part",
      maxItems: 3,
    },
    expect: { ok: true, firstTarget: "a" },
  },
];

for (const c of cases) {
  const out = proposeDayPlan(c.input);
  assert.equal(out.ok, c.expect.ok, `${c.name} ok`);
  if (c.expect.error) assert.equal(out.error, c.expect.error, `${c.name} error`);
  if (c.expect.empty) assert.equal(out.proposals.length, 0, `${c.name} empty`);
  if (c.expect.firstTarget) {
    assert.ok(out.proposals.length >= 1, `${c.name} has proposals`);
    assert.equal(out.proposals[0].targetId, c.expect.firstTarget, `${c.name} first target`);
  }
  if (out.ok && out.proposals.length) {
    const total = out.proposals.reduce((a, p) => a + p.estimateMin, 0);
    const daily = (c.input.weeklyCapacityHours * 60) / c.input.nightsPerWeek;
    assert.ok(total <= daily + 1e-9, `${c.name} under daily soft cap`);
    for (const p of out.proposals) {
      assert.ok(p.estimateMin >= 15 && p.estimateMin % 15 === 0, `${c.name} snap 15m`);
    }
  }
}

// Determinism
const base = {
  targets: [
    {
      id: "a",
      title: "Alpha",
      status: "active",
      metrics: [{ baseline: 0, target: 10, current: 2 }],
    },
  ],
  weeklyCapacityHours: 12,
  nightsPerWeek: 4,
  intention: "",
  maxItems: 2,
};
assert.deepEqual(proposeDayPlan(base).proposals, proposeDayPlan(base).proposals);

console.log(`test-ally-rust-contract.mjs: ${cases.length} shared propose cases + determinism ok`);
