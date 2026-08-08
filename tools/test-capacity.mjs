/**
 * Node smoke tests for capacity.js / replan (no browser).
 */
import {
  checkPlanAccept,
  replanToday,
  dailySoftCapMinutes,
} from "../apps/web/js/capacity.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const id = () => crypto.randomUUID();

// daily soft cap
assert(dailySoftCapMinutes(10, 4) === 150, "daily soft cap 10h/4n = 150m");

// accept under budget
{
  const t = id();
  const r = checkPlanAccept({
    weeklyCapacityHours: 10,
    nightsPerWeek: 4,
    softCaps: [{ targetId: t, hours: 10 }],
    weekOther: [],
    today: [{ id: id(), targetId: t, estimateMin: 60, mustKeep: false }],
  });
  assert(r.ok, "should accept");
}

// reject global over
{
  const t = id();
  const r = checkPlanAccept({
    weeklyCapacityHours: 1,
    nightsPerWeek: 4,
    softCaps: [],
    weekOther: [],
    today: [{ id: id(), targetId: t, estimateMin: 120, mustKeep: false }],
  });
  assert(!r.ok && r.error === "global_over", "global over");
}

// replan drops
{
  const t = id();
  const keep = id();
  const drop = id();
  const out = replanToday({
    weeklyCapacityHours: 2,
    nightsPerWeek: 4,
    softCaps: [],
    weekOther: [],
    today: [
      { id: keep, targetId: t, estimateMin: 60, mustKeep: true, priority: 0 },
      { id: drop, targetId: t, estimateMin: 120, mustKeep: false, priority: 5 },
    ],
  });
  assert(out.keep.includes(keep), "keeps must-keep");
  assert(out.drop.includes(drop) || out.shrink.some((s) => s.id === drop), "drops or shrinks other");
}

// replan sacrifices a higher numeric priority (lower importance) first
{
  const t = id();
  const important = id();
  const optional = id();
  const out = replanToday({
    weeklyCapacityHours: 2,
    nightsPerWeek: 2,
    softCaps: [],
    weekOther: [],
    today: [
      { id: important, targetId: t, estimateMin: 60, mustKeep: false, priority: 0 },
      { id: optional, targetId: t, estimateMin: 60, mustKeep: false, priority: 5 },
    ],
  });
  assert(out.keep.includes(important), "keeps the more important commitment");
  assert(!out.drop.includes(important), "does not drop the more important commitment");
  assert(!out.shrink.some((s) => s.id === important), "does not shrink the more important commitment");
  assert(out.drop.includes(optional), "drops the lower-importance commitment");
}

console.log("test-capacity.mjs: ok");
