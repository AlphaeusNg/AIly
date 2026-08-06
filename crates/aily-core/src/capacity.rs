//! Capacity checks for plan.accept (AIly journey hours).

use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapacityConfig {
    /// Global weekly capacity in hours.
    pub weekly_capacity_hours: f64,
    /// Soft daily cap in minutes (default weekly*60 / nights_per_week).
    pub daily_soft_cap_minutes: f64,
}

impl CapacityConfig {
    pub fn from_weekly_hours(hours: f64, nights_per_week: f64) -> Self {
        let n = nights_per_week.max(1.0);
        Self {
            weekly_capacity_hours: hours.max(0.0),
            daily_soft_cap_minutes: (hours * 60.0 / n).max(15.0),
        }
    }

    pub fn weekly_capacity_minutes(&self) -> f64 {
        self.weekly_capacity_hours * 60.0
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitmentMinutes {
    pub id: Uuid,
    pub target_id: Uuid,
    pub estimate_min: f64,
    pub must_keep: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TargetSoftCap {
    pub target_id: Uuid,
    pub soft_capacity_hours: f64,
    pub priority: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapacityInput {
    pub config: CapacityConfig,
    /// Active targets that have soft caps (when ≥2 active, sum soft ≤ global).
    pub active_soft_caps: Vec<TargetSoftCap>,
    /// Other days this ISO week (pending ∪ done estimates).
    pub week_other_minutes: Vec<CommitmentMinutes>,
    /// Today candidate commitments.
    pub today_candidate: Vec<CommitmentMinutes>,
}

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum CapacityError {
    #[error("global weekly capacity exceeded")]
    GlobalOver,
    #[error("target soft capacity exceeded for {0}")]
    GoalSoftOver(Uuid),
    #[error("sum of soft capacities exceeds weekly capacity")]
    SoftSumOver,
    #[error("daily soft cap exceeded")]
    DailyOver,
}

pub fn check_plan_accept(input: &CapacityInput) -> Result<(), CapacityError> {
    // D14-style: if ≥2 soft caps present, sum ≤ weekly hours
    if input.active_soft_caps.len() >= 2 {
        let sum: f64 = input.active_soft_caps.iter().map(|s| s.soft_capacity_hours).sum();
        if sum > input.config.weekly_capacity_hours + 1e-9 {
            return Err(CapacityError::SoftSumOver);
        }
    }

    let mut week_total = 0.0_f64;
    let mut per_goal: std::collections::HashMap<Uuid, f64> = std::collections::HashMap::new();

    for c in input.week_other_minutes.iter().chain(input.today_candidate.iter()) {
        week_total += c.estimate_min;
        *per_goal.entry(c.target_id).or_insert(0.0) += c.estimate_min;
    }

    if week_total > input.config.weekly_capacity_minutes() + 1e-9 {
        return Err(CapacityError::GlobalOver);
    }

    let today_sum: f64 = input.today_candidate.iter().map(|c| c.estimate_min).sum();
    if today_sum > input.config.daily_soft_cap_minutes + 1e-9 {
        return Err(CapacityError::DailyOver);
    }

    for soft in &input.active_soft_caps {
        let used = per_goal.get(&soft.target_id).copied().unwrap_or(0.0);
        let cap = soft.soft_capacity_hours * 60.0;
        if used > cap + 1e-9 {
            return Err(CapacityError::GoalSoftOver(soft.target_id));
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn uid() -> Uuid {
        Uuid::new_v4()
    }

    #[test]
    fn accepts_under_budget() {
        let t = uid();
        let input = CapacityInput {
            config: CapacityConfig::from_weekly_hours(10.0, 4.0),
            active_soft_caps: vec![TargetSoftCap {
                target_id: t,
                soft_capacity_hours: 10.0,
                priority: 0,
            }],
            week_other_minutes: vec![],
            today_candidate: vec![CommitmentMinutes {
                id: uid(),
                target_id: t,
                estimate_min: 60.0,
                must_keep: false,
            }],
        };
        assert!(check_plan_accept(&input).is_ok());
    }

    #[test]
    fn rejects_global_over() {
        let t = uid();
        let input = CapacityInput {
            config: CapacityConfig::from_weekly_hours(1.0, 4.0),
            active_soft_caps: vec![],
            week_other_minutes: vec![],
            today_candidate: vec![CommitmentMinutes {
                id: uid(),
                target_id: t,
                estimate_min: 120.0,
                must_keep: false,
            }],
        };
        assert_eq!(check_plan_accept(&input), Err(CapacityError::GlobalOver));
    }

    #[test]
    fn rejects_soft_sum_over() {
        let a = uid();
        let b = uid();
        let input = CapacityInput {
            config: CapacityConfig::from_weekly_hours(10.0, 4.0),
            active_soft_caps: vec![
                TargetSoftCap {
                    target_id: a,
                    soft_capacity_hours: 6.0,
                    priority: 0,
                },
                TargetSoftCap {
                    target_id: b,
                    soft_capacity_hours: 6.0,
                    priority: 1,
                },
            ],
            week_other_minutes: vec![],
            today_candidate: vec![],
        };
        assert_eq!(check_plan_accept(&input), Err(CapacityError::SoftSumOver));
    }

    #[test]
    fn rejects_goal_soft_over() {
        let a = uid();
        let b = uid();
        let input = CapacityInput {
            config: CapacityConfig::from_weekly_hours(20.0, 4.0),
            active_soft_caps: vec![
                TargetSoftCap {
                    target_id: a,
                    soft_capacity_hours: 2.0,
                    priority: 0,
                },
                TargetSoftCap {
                    target_id: b,
                    soft_capacity_hours: 2.0,
                    priority: 1,
                },
            ],
            week_other_minutes: vec![],
            today_candidate: vec![CommitmentMinutes {
                id: uid(),
                target_id: a,
                estimate_min: 200.0,
                must_keep: false,
            }],
        };
        assert!(matches!(
            check_plan_accept(&input),
            Err(CapacityError::GoalSoftOver(_))
        ));
    }
}
