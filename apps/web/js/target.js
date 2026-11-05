/** Direction-aware target metric progress shared by the UI and local ally. */

export function metricProgressRatio(metric) {
  const baseline = metric?.baseline;
  const target = metric?.target;
  const current = metric?.current;
  if (![baseline, target, current].every(Number.isFinite)) return 0;

  const delta = target - baseline;
  const span = Math.abs(delta);
  if (span === 0) return 0;

  const movement = delta > 0 ? current - baseline : baseline - current;
  return Math.min(1, Math.max(0, movement / span));
}

export function metricProgressPct(metric) {
  return Math.round(metricProgressRatio(metric) * 100);
}

/** True when higher current is better (target >= baseline). */
export function metricIsUpward(metric) {
  if (!metric) return true;
  if (![metric.baseline, metric.target].every(Number.isFinite)) return true;
  return metric.target >= metric.baseline;
}

/**
 * Step current toward target by minMeaningfulDelta (or 1).
 * @returns {{ next: number, moved: boolean, complete: boolean }}
 */
export function stepMetricTowardTarget(metric) {
  if (!metric || ![metric.baseline, metric.target, metric.current].every(Number.isFinite)) {
    return { next: metric?.current, moved: false, complete: false };
  }
  const step = Number.isFinite(metric.minMeaningfulDelta) && metric.minMeaningfulDelta > 0
    ? metric.minMeaningfulDelta
    : 1;
  const upward = metricIsUpward(metric);
  let next = metric.current;
  if (upward) next = Math.min(metric.target, metric.current + step);
  else next = Math.max(metric.target, metric.current - step);
  const complete = upward ? next >= metric.target : next <= metric.target;
  return { next, moved: next !== metric.current, complete };
}

/**
 * Step current away from target toward baseline (honest reverse of +progress).
 * Clamps at baseline so wrong-way metrics are not invented.
 * @returns {{ next: number, moved: boolean, complete: boolean }}
 */
export function stepMetricAwayFromTarget(metric) {
  if (!metric || ![metric.baseline, metric.target, metric.current].every(Number.isFinite)) {
    return { next: metric?.current, moved: false, complete: false };
  }
  const step = Number.isFinite(metric.minMeaningfulDelta) && metric.minMeaningfulDelta > 0
    ? metric.minMeaningfulDelta
    : 1;
  const upward = metricIsUpward(metric);
  let next = metric.current;
  if (upward) next = Math.max(metric.baseline, metric.current - step);
  else next = Math.min(metric.baseline, metric.current + step);
  const complete = upward ? next >= metric.target : next <= metric.target;
  return { next, moved: next !== metric.current, complete };
}

/**
 * Snap current to the goal value (100% journey when finite).
 * @returns {{ next: number, moved: boolean, complete: boolean }}
 */
export function snapMetricToTarget(metric) {
  if (!metric || ![metric.baseline, metric.target, metric.current].every(Number.isFinite)) {
    return { next: metric?.current, moved: false, complete: false };
  }
  const next = metric.target;
  return { next, moved: next !== metric.current, complete: true };
}

/**
 * Soft-cap sum check when ≥2 caps present (mirrors capacity soft_sum_over).
 * @returns {{ ok: boolean, sum: number, weekly: number, error?: string }}
 */
export function checkSoftCapSum(softCaps, weeklyCapacityHours) {
  const weekly = Number(weeklyCapacityHours);
  if (!Number.isFinite(weekly) || weekly < 0) {
    return { ok: false, sum: 0, weekly: 0, error: "invalid_weekly" };
  }
  const caps = Array.isArray(softCaps) ? softCaps : [];
  const hours = caps
    .map((s) => (s && Number.isFinite(s.hours) ? s.hours : null))
    .filter((h) => h != null && h > 0);
  const sum = hours.reduce((a, h) => a + h, 0);
  if (hours.length >= 2 && sum > weekly + 1e-9) {
    return { ok: false, sum, weekly, error: "soft_sum_over" };
  }
  return { ok: true, sum, weekly };
}

/**
 * Proportionally scale soft cap hours so sum ≤ weekly (when oversubscribed).
 * @returns {{
 *   ok: boolean,
 *   scaled: boolean,
 *   softCaps: Array,
 *   sum: number,
 *   weekly: number,
 *   scale: number,
 *   error?: string,
 * }}
 */
export function scaleSoftCapsToFit(softCaps, weeklyCapacityHours) {
  const check = checkSoftCapSum(softCaps, weeklyCapacityHours);
  if (check.error === "invalid_weekly") {
    return {
      ok: false,
      scaled: false,
      softCaps: Array.isArray(softCaps) ? softCaps.slice() : [],
      sum: 0,
      weekly: 0,
      scale: 1,
      error: "invalid_weekly",
    };
  }
  if (check.ok) {
    return {
      ok: true,
      scaled: false,
      softCaps: Array.isArray(softCaps) ? softCaps.map((s) => ({ ...s })) : [],
      sum: check.sum,
      weekly: check.weekly,
      scale: 1,
    };
  }
  if (!(check.sum > 0)) {
    return {
      ok: true,
      scaled: false,
      softCaps: Array.isArray(softCaps) ? softCaps.map((s) => ({ ...s })) : [],
      sum: check.sum,
      weekly: check.weekly,
      scale: 1,
    };
  }
  const scale = check.weekly / check.sum;
  // Allocate whole tenths first, then give spare tenths to the largest
  // remainders. Rounding each cap independently can exceed weekly capacity.
  const budget = Math.floor(check.weekly * 10 + 1e-9);
  const allocations = softCaps.flatMap((s, index) => {
    if (!s || !Number.isFinite(s.hours) || s.hours <= 0) return [];
    const exact = s.hours * scale * 10;
    const tenths = Math.floor(exact);
    return [{ index, tenths, remainder: exact - tenths }];
  });
  let spare = budget - allocations.reduce((sum, entry) => sum + entry.tenths, 0);
  allocations.sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const entry of allocations) {
    if (spare <= 0) break;
    entry.tenths += 1;
    spare -= 1;
  }
  const hoursByIndex = new Map(allocations.map((entry) => [entry.index, entry.tenths / 10]));
  const scaled = softCaps.map((s, index) => hoursByIndex.has(index)
    ? { ...s, hours: hoursByIndex.get(index) }
    : { ...s });
  const after = checkSoftCapSum(scaled, check.weekly);
  return {
    ok: after.ok,
    scaled: true,
    softCaps: scaled,
    sum: after.sum,
    weekly: check.weekly,
    scale,
  };
}
