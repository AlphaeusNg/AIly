//! AIly core domain — targets, capacity, replan, tutorial, block rules, ally propose.
//! Brand: **AIly** — Your AI Ally.

pub mod ally;
pub mod audit;
pub mod block;
pub mod capacity;
pub mod replan;
pub mod target;
pub mod tutorial;

pub use ally::{
    propose_day_plan, ExistingCommitment, Proposal, ProposeInput, ProposeOutput, TargetHint,
};
pub use audit::{AllyActionLog, Origin};
pub use block::{BlockMode, BlockRule, BreakGlassPolicy};
pub use capacity::{check_plan_accept, CapacityConfig, CapacityError, CapacityInput};
pub use replan::{replan_today, CommitmentSlice, ReplanInput, ReplanOutput};
pub use target::{Metric, MetricDirection, Target, TargetStatus};
pub use tutorial::{ChapterId, ChapterStatus, PermissionFlags, TutorialEngine, TutorialState};
