use std::collections::{HashMap, HashSet};

use aily_core::capacity::{
    check_plan_accept, CapacityConfig, CapacityError, CapacityInput, CommitmentMinutes,
    TargetSoftCap,
};
use aily_core::replan::{replan_today, CommitmentSlice, ReplanInput};
use serde::Deserialize;
use uuid::Uuid;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Contract {
    capacity_cases: Vec<CapacityCase>,
    replan_cases: Vec<ReplanCase>,
}

#[derive(Deserialize)]
struct CapacityCase {
    name: String,
    input: FixtureInput,
    expected: CapacityExpected,
}

#[derive(Deserialize)]
struct ReplanCase {
    name: String,
    input: FixtureInput,
    expected: ReplanExpected,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FixtureInput {
    weekly_capacity_hours: f64,
    nights_per_week: f64,
    soft_caps: Vec<SoftCapFixture>,
    week_other: Vec<CommitmentFixture>,
    today: Vec<CommitmentFixture>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SoftCapFixture {
    target_id: Uuid,
    hours: f64,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CommitmentFixture {
    id: Uuid,
    target_id: Uuid,
    estimate_min: f64,
    must_keep: bool,
    #[serde(default)]
    priority: i32,
}

#[derive(Deserialize)]
struct CapacityExpected {
    ok: bool,
    error: Option<String>,
}

#[derive(Deserialize)]
struct ReplanExpected {
    keep: Vec<Uuid>,
    drop: Vec<Uuid>,
    shrink: Vec<ShrinkExpected>,
    untouched: Vec<Uuid>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ShrinkExpected {
    id: Uuid,
    new_estimate_min: f64,
}

fn contract() -> Contract {
    serde_json::from_str(include_str!("../../../tests/capacity-contract.json"))
        .expect("capacity contract fixture must be valid")
}

fn capacity_input(input: &FixtureInput) -> CapacityInput {
    CapacityInput {
        config: CapacityConfig::from_weekly_hours(
            input.weekly_capacity_hours,
            input.nights_per_week,
        ),
        active_soft_caps: input
            .soft_caps
            .iter()
            .map(|soft| TargetSoftCap {
                target_id: soft.target_id,
                soft_capacity_hours: soft.hours,
                priority: 0,
            })
            .collect(),
        week_other_minutes: input.week_other.iter().map(commitment_minutes).collect(),
        today_candidate: input.today.iter().map(commitment_minutes).collect(),
    }
}

fn commitment_minutes(commitment: &CommitmentFixture) -> CommitmentMinutes {
    CommitmentMinutes {
        id: commitment.id,
        target_id: commitment.target_id,
        estimate_min: commitment.estimate_min,
        must_keep: commitment.must_keep,
    }
}

fn error_code(error: &CapacityError) -> &'static str {
    match error {
        CapacityError::InvalidInput => "invalid_input",
        CapacityError::GlobalOver => "global_over",
        CapacityError::GoalSoftOver(_) => "goal_soft_over",
        CapacityError::SoftSumOver => "soft_sum_over",
        CapacityError::DailyOver => "daily_over",
    }
}

#[test]
fn rust_capacity_matches_shared_contract() {
    for case in contract().capacity_cases {
        let result = check_plan_accept(&capacity_input(&case.input));
        assert_eq!(result.is_ok(), case.expected.ok, "{}", case.name);
        if let Some(expected_error) = case.expected.error {
            let actual = result.as_ref().expect_err(&case.name);
            assert_eq!(error_code(actual), expected_error, "{}", case.name);
        }
    }
}

#[test]
fn rust_replan_matches_shared_contract() {
    for case in contract().replan_cases {
        let input = ReplanInput {
            config: CapacityConfig::from_weekly_hours(
                case.input.weekly_capacity_hours,
                case.input.nights_per_week,
            ),
            active_soft_caps: capacity_input(&case.input).active_soft_caps,
            week_other_minutes: case
                .input
                .week_other
                .iter()
                .map(commitment_minutes)
                .collect(),
            today_candidate: case
                .input
                .today
                .iter()
                .map(|commitment| CommitmentSlice {
                    id: commitment.id,
                    target_id: commitment.target_id,
                    estimate_min: commitment.estimate_min,
                    must_keep: commitment.must_keep,
                    priority: commitment.priority,
                })
                .collect(),
        };
        let output = replan_today(&input);
        let keep: HashSet<_> = output.keep.into_iter().collect();
        let drop: HashSet<_> = output.drop.into_iter().collect();
        let shrink: HashMap<_, _> = output
            .shrink
            .into_iter()
            .map(|item| (item.id, item.new_estimate_min))
            .collect();

        assert_eq!(
            keep,
            case.expected.keep.into_iter().collect(),
            "{}",
            case.name
        );
        assert_eq!(
            drop,
            case.expected.drop.into_iter().collect(),
            "{}",
            case.name
        );
        let expected_shrink: HashMap<_, _> = case
            .expected
            .shrink
            .into_iter()
            .map(|item| (item.id, item.new_estimate_min))
            .collect();
        assert_eq!(shrink, expected_shrink, "{}", case.name);
        for id in case.expected.untouched {
            assert!(!drop.contains(&id), "{} dropped untouched work", case.name);
            assert!(
                !shrink.contains_key(&id),
                "{} shrank untouched work",
                case.name
            );
        }
    }
}
