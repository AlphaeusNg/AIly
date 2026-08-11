import assert from "node:assert/strict";
import {
  checkSoftCapSum,
  metricIsUpward,
  metricProgressPct,
  metricProgressRatio,
  stepMetricTowardTarget,
} from "../apps/web/js/target.js";

assert.equal(
  metricProgressRatio({ baseline: 0, target: 100, current: 40 }),
  0.4,
  "upward metric measures movement toward the target",
);
assert.equal(
  metricProgressRatio({ baseline: 100, target: 20, current: 60 }),
  0.5,
  "downward metric measures movement toward the target",
);
assert.equal(
  metricProgressRatio({ baseline: 0, target: 100, current: -50 }),
  0,
  "wrong-way upward movement is not progress",
);
assert.equal(
  metricProgressRatio({ baseline: 100, target: 20, current: 140 }),
  0,
  "wrong-way downward movement is not progress",
);
assert.equal(
  metricProgressRatio({ baseline: 0, target: 100, current: 150 }),
  1,
  "upward overshoot caps at complete",
);
assert.equal(
  metricProgressRatio({ baseline: 100, target: 20, current: 0 }),
  1,
  "downward overshoot caps at complete",
);
assert.equal(metricProgressRatio({ baseline: 1, target: 1, current: 1 }), 0);
assert.equal(metricProgressRatio({ baseline: 0, target: 1, current: Number.NaN }), 0);
assert.equal(metricProgressPct({ baseline: 0, target: 3, current: 1 }), 33);

assert.equal(metricIsUpward({ baseline: 0, target: 10 }), true);
assert.equal(metricIsUpward({ baseline: 10, target: 2 }), false);

const up = stepMetricTowardTarget({
  baseline: 0,
  target: 10,
  current: 9,
  minMeaningfulDelta: 2,
});
assert.equal(up.next, 10);
assert.equal(up.moved, true);
assert.equal(up.complete, true);

const down = stepMetricTowardTarget({
  baseline: 100,
  target: 40,
  current: 50,
  minMeaningfulDelta: 5,
});
assert.equal(down.next, 45);
assert.equal(down.complete, false);

const softOk = checkSoftCapSum(
  [
    { targetId: "a", hours: 4 },
    { targetId: "b", hours: 5 },
  ],
  10
);
assert.equal(softOk.ok, true);
const softBad = checkSoftCapSum(
  [
    { targetId: "a", hours: 6 },
    { targetId: "b", hours: 6 },
  ],
  10
);
assert.equal(softBad.ok, false);
assert.equal(softBad.error, "soft_sum_over");

console.log("test-target.mjs: direction-aware metric progress + soft caps passed");
