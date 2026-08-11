import assert from "node:assert/strict";
import {
  metricProgressPct,
  metricProgressRatio,
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

console.log("test-target.mjs: direction-aware metric progress passed (9 contracts)");
