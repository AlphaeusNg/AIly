/** Execute the shared Rust/browser capacity and replan contract in JavaScript. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { checkPlanAccept, replanToday } from "../apps/web/js/capacity.js";

const contract = JSON.parse(
  readFileSync(new URL("../tests/capacity-contract.json", import.meta.url), "utf8")
);
const sorted = (values) => [...values].sort();
const shrinkMap = (values) =>
  Object.fromEntries(values.map((item) => [item.id, item.newEstimateMin]).sort());

for (const testCase of contract.capacityCases) {
  const actual = checkPlanAccept(testCase.input);
  assert.equal(actual.ok, testCase.expected.ok, testCase.name);
  assert.equal(actual.error, testCase.expected.error, testCase.name);
}

for (const testCase of contract.replanCases) {
  const actual = replanToday(testCase.input);
  assert.deepEqual(sorted(actual.keep), sorted(testCase.expected.keep), testCase.name);
  assert.deepEqual(sorted(actual.drop), sorted(testCase.expected.drop), testCase.name);
  assert.deepEqual(shrinkMap(actual.shrink), shrinkMap(testCase.expected.shrink), testCase.name);
  for (const id of testCase.expected.untouched) {
    assert(!actual.drop.includes(id), `${testCase.name}: dropped untouched work`);
    assert(!actual.shrink.some((item) => item.id === id), `${testCase.name}: shrank untouched work`);
  }
}

console.log(
  `test-capacity-contract.mjs: ${contract.capacityCases.length} capacity + ${contract.replanCases.length} replan cases ok`
);
