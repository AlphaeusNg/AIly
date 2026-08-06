/**
 * Capacity + replan — JS port of aily-core for web dogfood.
 */

export function dailySoftCapMinutes(weeklyHours, nightsPerWeek) {
  const n = Math.max(1, nightsPerWeek || 4);
  return Math.max(15, (weeklyHours * 60) / n);
}

export function checkPlanAccept({
  weeklyCapacityHours,
  nightsPerWeek,
  softCaps, // [{ targetId, hours }]
  weekOther, // [{ targetId, estimateMin }]
  today, // [{ id, targetId, estimateMin, mustKeep }]
}) {
  const weeklyMin = weeklyCapacityHours * 60;
  const dailyCap = dailySoftCapMinutes(weeklyCapacityHours, nightsPerWeek);

  if (softCaps && softCaps.length >= 2) {
    const sum = softCaps.reduce((a, s) => a + s.hours, 0);
    if (sum > weeklyCapacityHours + 1e-9) return { ok: false, error: "soft_sum_over" };
  }

  let weekTotal = 0;
  const perGoal = new Map();
  for (const c of [...(weekOther || []), ...(today || [])]) {
    weekTotal += c.estimateMin;
    perGoal.set(c.targetId, (perGoal.get(c.targetId) || 0) + c.estimateMin);
  }
  if (weekTotal > weeklyMin + 1e-9) return { ok: false, error: "global_over" };

  const todaySum = (today || []).reduce((a, c) => a + c.estimateMin, 0);
  if (todaySum > dailyCap + 1e-9) return { ok: false, error: "daily_over" };

  for (const s of softCaps || []) {
    const used = perGoal.get(s.targetId) || 0;
    if (used > s.hours * 60 + 1e-9) {
      return { ok: false, error: "goal_soft_over", targetId: s.targetId };
    }
  }
  return { ok: true };
}

const FLOOR = 15;

/** Deterministic replan matching aily-core::replan_today */
export function replanToday({
  weeklyCapacityHours,
  nightsPerWeek,
  softCaps,
  weekOther,
  today,
}) {
  const protect = today.filter((c) => c.mustKeep).map((c) => ({ ...c }));
  let rest = today
    .filter((c) => !c.mustKeep)
    .map((c) => ({ ...c }))
    .sort((a, b) => b.priority - a.priority || b.estimateMin - a.estimateMin);

  const drop = [];
  const shrink = [];
  const reasons = [];

  const pack = () => [...protect, ...rest];

  for (let guard = 0; guard < 100; guard++) {
    const check = checkPlanAccept({
      weeklyCapacityHours,
      nightsPerWeek,
      softCaps,
      weekOther,
      today: pack(),
    });
    if (check.ok) break;
    reasons.push(check.error);
    if (!rest.length) {
      reasons.push("protect-set alone still over capacity");
      break;
    }
    const last = rest[rest.length - 1];
    if (last.estimateMin > FLOOR) {
      last.estimateMin = FLOOR;
      shrink.push({ id: last.id, newEstimateMin: FLOOR });
      reasons.push(`shrink ${last.id}`);
    } else {
      const removed = rest.pop();
      drop.push(removed.id);
      reasons.push(`drop ${removed.id}`);
    }
  }

  return {
    keep: pack().map((c) => c.id),
    drop,
    shrink,
    reasons,
    today: pack(),
  };
}

export function errorLabel(err) {
  switch (err) {
    case "global_over":
      return "That plan needs more hours than your week allows.";
    case "daily_over":
      return "Today is overloaded — trim commitments.";
    case "soft_sum_over":
      return "Your target hour budgets add up past your week.";
    case "goal_soft_over":
      return "One target is over its soft capacity.";
    default:
      return "Plan doesn't fit capacity.";
  }
}
