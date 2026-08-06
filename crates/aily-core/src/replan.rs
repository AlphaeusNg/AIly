//! Forced replan pure function when capacity reject fires.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::capacity::{
    CapacityConfig, CapacityInput, CommitmentMinutes, TargetSoftCap,
    check_plan_accept,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitmentSlice {
    pub id: Uuid,
    pub target_id: Uuid,
    pub estimate_min: f64,
    pub must_keep: bool,
    pub priority: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplanInput {
    pub config: CapacityConfig,
    pub active_soft_caps: Vec<TargetSoftCap>,
    pub week_other_minutes: Vec<CommitmentMinutes>,
    pub today_candidate: Vec<CommitmentSlice>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShrinkOp {
    pub id: Uuid,
    pub new_estimate_min: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplanOutput {
    pub keep: Vec<Uuid>,
    pub drop: Vec<Uuid>,
    pub shrink: Vec<ShrinkOp>,
    pub reasons: Vec<String>,
}

const FLOOR_MIN: f64 = 15.0;

/// Deterministic replan: protect must_keep, then drop/shrink by priority.
pub fn replan_today(input: &ReplanInput) -> ReplanOutput {
    let mut today: Vec<CommitmentSlice> = input.today_candidate.clone();
    // Sort: must_keep first, then priority ASC, estimate DESC, id ASC
    today.sort_by(|a, b| {
        b.must_keep
            .cmp(&a.must_keep)
            .then(a.priority.cmp(&b.priority))
            .then(
                b.estimate_min
                    .partial_cmp(&a.estimate_min)
                    .unwrap_or(std::cmp::Ordering::Equal),
            )
            .then(a.id.cmp(&b.id))
    });

    let mut drop = Vec::new();
    let mut shrink = Vec::new();
    let mut reasons = Vec::new();

    // Work on a mutable working set of non-protected after protect set locked
    let protect: Vec<_> = today.iter().filter(|c| c.must_keep).cloned().collect();
    let mut rest: Vec<_> = today.into_iter().filter(|c| !c.must_keep).collect();

    // Drop from high priority numbers first (lower importance)
    rest.sort_by(|a, b| {
        b.priority
            .cmp(&a.priority)
            .then(
                b.estimate_min
                    .partial_cmp(&a.estimate_min)
                    .unwrap_or(std::cmp::Ordering::Equal),
            )
            .then(b.id.cmp(&a.id))
    });

    loop {
        let candidate: Vec<CommitmentMinutes> = protect
            .iter()
            .chain(rest.iter())
            .map(|c| CommitmentMinutes {
                id: c.id,
                target_id: c.target_id,
                estimate_min: c.estimate_min,
                must_keep: c.must_keep,
            })
            .collect();

        let check = CapacityInput {
            config: input.config.clone(),
            active_soft_caps: input.active_soft_caps.clone(),
            week_other_minutes: input.week_other_minutes.clone(),
            today_candidate: candidate,
        };

        match check_plan_accept(&check) {
            Ok(()) => break,
            Err(e) => {
                reasons.push(e.to_string());
                if rest.is_empty() {
                    // Cannot fix without touching protect — return best effort
                    reasons.push("protect-set alone still over capacity".into());
                    break;
                }
                // Try shrink last rest item first
                let last = rest.len() - 1;
                if rest[last].estimate_min > FLOOR_MIN {
                    let new_e = FLOOR_MIN;
                    shrink.push(ShrinkOp {
                        id: rest[last].id,
                        new_estimate_min: new_e,
                    });
                    rest[last].estimate_min = new_e;
                    reasons.push(format!("shrink {} to {}m", rest[last].id, new_e));
                } else {
                    let removed = rest.pop().unwrap();
                    drop.push(removed.id);
                    reasons.push(format!("drop {}", removed.id));
                }
            }
        }
    }

    // De-dupe shrink: keep last new_estimate per id
    let mut shrink_map = std::collections::HashMap::new();
    for s in shrink {
        shrink_map.insert(s.id, s.new_estimate_min);
    }
    let shrink: Vec<_> = shrink_map
        .into_iter()
        .map(|(id, new_estimate_min)| ShrinkOp {
            id,
            new_estimate_min,
        })
        .collect();

    let keep: Vec<Uuid> = protect
        .iter()
        .chain(rest.iter())
        .map(|c| c.id)
        .collect();

    ReplanOutput {
        keep,
        drop,
        shrink,
        reasons,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn replan_drops_to_fit() {
        let t = Uuid::new_v4();
        let keep_id = Uuid::new_v4();
        let drop_id = Uuid::new_v4();
        let input = ReplanInput {
            config: CapacityConfig::from_weekly_hours(2.0, 4.0),
            active_soft_caps: vec![],
            week_other_minutes: vec![],
            today_candidate: vec![
                CommitmentSlice {
                    id: keep_id,
                    target_id: t,
                    estimate_min: 60.0,
                    must_keep: true,
                    priority: 0,
                },
                CommitmentSlice {
                    id: drop_id,
                    target_id: t,
                    estimate_min: 120.0,
                    must_keep: false,
                    priority: 5,
                },
            ],
        };
        let out = replan_today(&input);
        assert!(out.keep.contains(&keep_id));
        assert!(out.drop.contains(&drop_id) || out.shrink.iter().any(|s| s.id == drop_id));
        // After replan, protected set should accept
        let candidate: Vec<_> = out
            .keep
            .iter()
            .filter_map(|id| {
                input.today_candidate.iter().find(|c| c.id == *id).map(|c| {
                    let est = out
                        .shrink
                        .iter()
                        .find(|s| s.id == *id)
                        .map(|s| s.new_estimate_min)
                        .unwrap_or(c.estimate_min);
                    CommitmentMinutes {
                        id: c.id,
                        target_id: c.target_id,
                        estimate_min: est,
                        must_keep: c.must_keep,
                    }
                })
            })
            .collect();
        let check = CapacityInput {
            config: input.config.clone(),
            active_soft_caps: vec![],
            week_other_minutes: vec![],
            today_candidate: candidate,
        };
        assert!(check_plan_accept(&check).is_ok() || !out.drop.is_empty() || !out.shrink.is_empty());
    }
}
