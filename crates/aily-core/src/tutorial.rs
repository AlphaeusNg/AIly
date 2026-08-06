//! Guided tutorial state machine — non-technical setup path.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ChapterId {
    MeetAily = 0,
    FirstTarget = 1,
    Capacity = 2,
    AttentionMap = 3,
    OffLimits = 4,
    AllyAdmin = 5,
    StayInTouch = 6,
    SmarterAily = 7,
}

impl ChapterId {
    pub fn all() -> &'static [ChapterId] {
        &[
            ChapterId::MeetAily,
            ChapterId::FirstTarget,
            ChapterId::Capacity,
            ChapterId::AttentionMap,
            ChapterId::OffLimits,
            ChapterId::AllyAdmin,
            ChapterId::StayInTouch,
            ChapterId::SmarterAily,
        ]
    }

    pub fn title(self) -> &'static str {
        match self {
            ChapterId::MeetAily => "Meet AIly",
            ChapterId::FirstTarget => "Your first Target",
            ChapterId::Capacity => "Your capacity",
            ChapterId::AttentionMap => "Attention map",
            ChapterId::OffLimits => "Off-limits apps",
            ChapterId::AllyAdmin => "Ally admin",
            ChapterId::StayInTouch => "Stay in touch",
            ChapterId::SmarterAily => "Smarter AIly",
        }
    }

    pub fn required_for_ready(self) -> bool {
        matches!(
            self,
            ChapterId::MeetAily | ChapterId::FirstTarget | ChapterId::Capacity
        )
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ChapterStatus {
    Pending,
    Done,
    Skipped,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PermissionFlags {
    pub usage: bool,
    pub notifications: bool,
    pub block_admin: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TutorialState {
    pub chapters: Vec<(ChapterId, ChapterStatus)>,
    pub permissions: PermissionFlags,
}

impl Default for TutorialState {
    fn default() -> Self {
        Self {
            chapters: ChapterId::all()
                .iter()
                .map(|c| (*c, ChapterStatus::Pending))
                .collect(),
            permissions: PermissionFlags::default(),
        }
    }
}

pub struct TutorialEngine {
    state: TutorialState,
}

impl TutorialEngine {
    pub fn new() -> Self {
        Self {
            state: TutorialState::default(),
        }
    }

    pub fn from_state(state: TutorialState) -> Self {
        Self { state }
    }

    pub fn state(&self) -> &TutorialState {
        &self.state
    }

    pub fn complete(&mut self, id: ChapterId) {
        self.set(id, ChapterStatus::Done);
    }

    pub fn skip(&mut self, id: ChapterId) {
        self.set(id, ChapterStatus::Skipped);
    }

    fn set(&mut self, id: ChapterId, status: ChapterStatus) {
        if let Some(entry) = self.state.chapters.iter_mut().find(|(c, _)| *c == id) {
            entry.1 = status;
        }
    }

    pub fn grant_usage(&mut self) {
        self.state.permissions.usage = true;
        self.complete(ChapterId::AttentionMap);
    }

    pub fn grant_block_admin(&mut self) {
        self.state.permissions.block_admin = true;
        self.complete(ChapterId::AllyAdmin);
    }

    pub fn grant_notifications(&mut self) {
        self.state.permissions.notifications = true;
        self.complete(ChapterId::StayInTouch);
    }

    /// Blocks cannot arm until usage + admin consent.
    pub fn can_arm_blocks(&self) -> bool {
        self.state.permissions.usage && self.state.permissions.block_admin
    }

    /// Ready for journey UI (required chapters done).
    pub fn is_ready(&self) -> bool {
        ChapterId::all()
            .iter()
            .filter(|c| c.required_for_ready())
            .all(|c| {
                self.state
                    .chapters
                    .iter()
                    .any(|(id, st)| id == c && *st == ChapterStatus::Done)
            })
    }

    pub fn next_pending(&self) -> Option<ChapterId> {
        self.state
            .chapters
            .iter()
            .find(|(_, st)| *st == ChapterStatus::Pending)
            .map(|(c, _)| *c)
    }

    pub fn checklist(&self) -> Vec<(ChapterId, ChapterStatus, &'static str)> {
        self.state
            .chapters
            .iter()
            .map(|(c, st)| (*c, *st, c.title()))
            .collect()
    }
}

impl Default for TutorialEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blocks_require_grants() {
        let mut e = TutorialEngine::new();
        assert!(!e.can_arm_blocks());
        e.grant_usage();
        assert!(!e.can_arm_blocks());
        e.grant_block_admin();
        assert!(e.can_arm_blocks());
    }

    #[test]
    fn ready_after_required_chapters() {
        let mut e = TutorialEngine::new();
        assert!(!e.is_ready());
        e.complete(ChapterId::MeetAily);
        e.complete(ChapterId::FirstTarget);
        e.complete(ChapterId::Capacity);
        assert!(e.is_ready());
    }
}
