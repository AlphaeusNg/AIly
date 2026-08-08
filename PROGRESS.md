# AIly Continuous Improvement Progress

This file is the durable status, opportunity backlog, verification record, and
cycle log for autonomous improvement work. Product direction remains in
`/home/alph/projects/plans/aily-heavy-plan.md`.

## Current state

- Product phase: Phase 0 dogfood (tutorial, targets, capacity/replan, local
  block-rule model, PWA, and Android shell).
- Baseline on 2026-08-09: all documented automated checks across the projects
  workspace passed when run from their respective repository roots.
- AIly baseline after Cycle 2: 11 Rust unit tests, JavaScript capacity and
  persisted-state tests, JavaScript syntax checks, and strict Clippy all pass.

## Opportunity backlog

| Priority | Opportunity | Category | Impact | Effort / risk | Evidence / dependencies | Status |
|---|---|---|---|---|---|---|
| 1 | Reject non-finite and negative capacity inputs in Rust and JS | Correctness / robustness | High: invalid numbers can bypass or distort capacity checks | Small / low | Public domain functions currently assume validated callers | Next |
| 2 | Add shared cross-language capacity/replan contract fixtures | Test / maintainability | High compounding value: prevents drift between Rust and browser ports | Medium / low | Rust and JS intentionally duplicate the same rules | Backlog |
| 3 | Bring all Rust sources under `cargo fmt --check` in CI | Process / maintainability | Medium: makes formatting mechanically verifiable | Small / low | Existing files predate a formatting gate | Backlog |
| 4 | Replace placeholder Android example tests with AIly shell checks | Test / DX | Medium: verifies the packaged surface rather than generated samples | Medium / medium | Requires Android SDK in CI or a focused JVM test path | Backlog |
| — | Deep-merge and validate persisted web state | Bug / test gap | High: a partial or older state could crash startup | Small / low | Reproduced with a partial tutorial object | Completed in Cycle 2 |
| — | Preserve user priority during forced replans | Bug / test gap | Critical: wrong work was sacrificed | Small / low | Reproduced in both implementations | Completed in Cycle 1 |

## Cycle log

### Cycle 1 — Preserve priority during forced replans (2026-08-09)

**Why this won:** The replanner ordered higher numeric priorities first (the
documented lower-importance work) but mutated the last item. A reproduced
two-item overload therefore dropped priority `0` (`important`) and kept
priority `5` (`optional`). This was a correctness failure in a core product
promise, with a small and reversible fix.

**Plan and success criteria**

1. Select the least-important non-protected commitment for shrink/drop in both
   the Rust source of truth and browser port.
2. Add regression tests to both implementations.
3. Verify priority `0` survives, priority `5` is sacrificed, `must_keep` remains
   protected, and the full suite stays green.

**Changes**

- Corrected the selection end in `crates/aily-core/src/replan.rs`.
- Made the matching correction in `apps/web/js/capacity.js`.
- Added Rust and JavaScript regression coverage for unequal priorities.

**Verification evidence**

- `npm test`: 11 Rust tests passed (up from 10), JavaScript capacity tests
  passed, and all web JavaScript syntax checks passed.
- `cargo clippy --all-targets --all-features -- -D warnings`: passed.
- `git diff --check`: passed.
- Before: `keep=[optional]`, `drop=[important]`.
- After: `keep=[important]`, `drop=[optional]`.

**Scores (change-specific)**

| Dimension | Before | After | Evidence |
|---|---:|---:|---|
| Correctness / reliability | 4/10 | 9/10 | Reproduced inverse behavior now matches the contract in both ports |
| Test coverage / verifiability | 5/10 | 8/10 | Regression exists in Rust and JS and runs in the standard suite |
| Maintainability | 6/10 | 7/10 | Selection intent is explicit beside the mutation |
| Performance | 8/10 | 8/10 | Negligible change for day-plan-sized collections |
| Security / safety | 8/10 | 8/10 | No security boundary changed |

**Lesson / process improvement:** Workspace checks must set an explicit
per-repository working directory. The first baseline harness omitted that and
produced false failures; the corrected harness ran each documented check in its
own repository and all passed. Future workspace sweeps should preserve this
mapping rather than relying on the caller's current directory.

**Next opportunity:** Make persisted-state loading tolerant of older, partial,
or malformed nested objects, with tests that reproduce the current startup
failure before the fix.

### Cycle 2 — Hydrate persisted state safely (2026-08-09)

**Why this won:** `loadState` merged only the root object. A partial but valid
saved tutorial object replaced every nested default, and the next render threw
while reading `tutorial.permissions.usage`. Persisted state is on every startup
path, so this small boundary fix improves reliability for upgrades and damaged
local storage.

**Plan and success criteria**

1. Restore nested defaults without discarding valid saved values.
2. Require valid permission booleans, chapter states, tabs, and render-safe
   collection shapes.
3. Cover partial state, malformed values, and corrupt JSON in the standard test
   command and CI.

**Changes**

- Added schema-aware `hydrateState` in `apps/web/js/store.js` and routed
  `loadState` through it.
- Added `usageSamples` to the default schema and normalized the collections
  whose entries are rendered directly.
- Added `tools/test-store.mjs` and wired it into `npm test` and GitHub Actions.

**Verification evidence**

- `npm test`: 11 Rust tests, capacity tests, new persisted-state tests, and all
  web JavaScript syntax checks passed.
- `cargo clippy --all-targets --all-features -- -D warnings`: passed.
- `git diff --check`: passed.
- Before: partial tutorial state raised `TypeError` while reading `usage`.
- After: the same payload loads with `permissions.usage === false` and retains
  its valid completed chapter.
- Malformed strings do not become permission grants; corrupt JSON returns a
  clean default state.

**Scores (change-specific)**

| Dimension | Before | After | Evidence |
|---|---:|---:|---|
| Correctness / reliability | 5/10 | 9/10 | Reproduced startup crash is removed across partial/malformed cases |
| Test coverage / verifiability | 3/10 | 8/10 | Persistence boundary now has a dedicated suite in local and CI commands |
| Maintainability | 5/10 | 8/10 | One named hydration boundary owns schema restoration |
| Performance | 9/10 | 9/10 | Linear normalization over small local collections |
| Security / safety | 6/10 | 8/10 | Only real booleans can restore permission grants |

**Lesson / process improvement:** Validate and normalize local data once at the
load boundary so render and domain code can rely on stable container shapes.
Tests should exercise both the pure hydrator and the storage-facing wrapper.

**Next opportunity:** Reject non-finite and negative capacity/estimate inputs in
both Rust and JavaScript so malformed callers cannot bypass capacity limits.
