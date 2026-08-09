# AIly Continuous Improvement Progress

This file is the durable status, opportunity backlog, verification record, and
cycle log for autonomous improvement work. Product direction remains in
`/home/alph/projects/plans/aily-heavy-plan.md`.

Last updated: 2026-08-10 (Cycle 87 across the projects workspace; AIly Cycle 7)

## Current state

- Product phase: Phase 0 dogfood (tutorial, targets, capacity/replan, local
  block-rule model, PWA, and Android shell).
- Baseline on 2026-08-09: all documented automated checks across the projects
  workspace passed when run from their respective repository roots.
- AIly baseline after Cycle 7: 12 Rust unit tests, 2 Rust shared-contract
  integration tests, 4 JavaScript suites (including 40 persistence/recovery
  assertions), 30 CI/Pages policy assertions, recursive syntax checks, strict
  Clippy, and Rust formatting all pass through one canonical local/CI gate.
- Invalid persisted commitments are quarantined with safe summaries and cannot
  enter capacity checks; Today offers a confirmed, audited discard path.
- CI uses read-only permissions, bounded/cancelable Node 24 jobs, and current
  checkout/setup-node majors; Pages uses current Node 24 action majors with only
  its required deploy permissions.
- Deployment version: `2026.08.10.1`.

## Opportunity backlog

| Priority | Opportunity | Category | Impact | Effort / risk | Evidence / dependencies | Status |
|---|---|---|---|---|---|---|
| 1 | Handle localStorage write failures without breaking recovery or input actions | Reliability / UX | Medium: privacy/quota failures can still throw through `persist()` | Small / low | Follow the boolean save/status pattern proven in sibling local-first apps | Next |
| 2 | Replace placeholder Android example tests with AIly shell checks | Test / DX | Medium: verifies the packaged surface rather than generated samples | Medium / medium | Requires Android SDK in CI or a focused JVM test path | Backlog |
| — | Enforce strict Clippy and modern workflow policy | Test / maintainability / security | High compounding value across all checks and deployments | Small-medium / low | 30 executable CI/Pages policy assertions | Completed in Cycle 7 |
| — | Give users a recovery path for invalid persisted commitments | Reliability / UX | Medium: malformed entries previously left capacity fail-closed with no reliable repair | Small / low | Quarantine plus explicit confirmed discard | Completed in Cycle 6 |
| — | Bring all Rust sources under `cargo fmt --check` in CI | Process / maintainability | Medium: makes formatting mechanically verifiable | Small / low | Three files had pre-existing drift | Completed in Cycle 5 |
| — | Add shared cross-language capacity/replan contract fixtures | Test / maintainability | High compounding value: prevents drift between Rust and browser ports | Medium / low | Five capacity and three replan scenarios | Completed in Cycle 4 |
| — | Reject non-finite and negative capacity inputs in Rust and JS | Correctness / robustness | High: invalid numbers bypassed capacity checks | Small / low | Reproduced in both public domain functions | Completed in Cycle 3 |
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

### Cycle 3 — Reject invalid capacity numbers (2026-08-09)

**Why this won:** JavaScript comparisons with `NaN` are false, so a `NaN`
weekly capacity or estimate returned `{ ok: true }`; negative estimates also
reduced totals. Rust exposed the same unchecked numeric fields. Capacity is a
core correctness boundary, so invalid inputs must fail explicitly rather than
silently weaken it.

**Plan and success criteria**

1. Reject non-finite/negative capacities, soft caps, and estimates in both
   implementations; reject non-positive/non-finite nights and malformed JS
   collection shapes.
2. Return a stable `invalid_input`/`InvalidInput` error and useful browser copy.
3. Add parity coverage and keep every existing check green.

**Changes**

- Added `CapacityError::InvalidInput` and validation at the start of Rust
  `check_plan_accept`.
- Added matching JavaScript validation and an `invalid_input` user-facing label.
- Extended both capacity suites with invalid-number regression cases.

**Verification evidence**

- `npm test`: 12 Rust tests (up from 11), both JavaScript suites, and syntax
  checks passed.
- `cargo clippy --all-targets --all-features -- -D warnings`: passed.
- `git diff --check`: passed.
- Before: `NaN` week, `NaN` estimate, `-500` estimate, and infinite soft cap all
  returned `{ ok: true }` in JavaScript.
- After: all four return `{ ok: false, error: "invalid_input" }`; Rust covers
  `NaN`, infinities, and negative values with the same fail-closed result.

**Scores (change-specific)**

| Dimension | Before | After | Evidence |
|---|---:|---:|---|
| Correctness / reliability | 3/10 | 9/10 | Four reproduced bypass classes now fail explicitly in both ports |
| Test coverage / verifiability | 5/10 | 8/10 | Invalid boundary cases run in the standard Rust and JS suites |
| Maintainability | 6/10 | 8/10 | Each domain boundary has one early validation block and stable error |
| Performance | 9/10 | 9/10 | One linear validation pass over already-small plan collections |
| Security / safety | 6/10 | 8/10 | Malformed callers can no longer weaken capacity enforcement |

**Lesson / process improvement:** HTML input constraints and storage hydration
are useful defenses, but public domain functions must validate independently.
Boundary regressions should be reproduced in every maintained implementation.

**Next opportunity:** Replace hand-maintained duplicate cases with shared JSON
contract fixtures consumed by Rust and JavaScript, reducing future semantic
drift in the capacity/replan ports.

### Cycle 4 — Share the capacity/replan contract (2026-08-09)

**Why this won:** Rust is the intended domain source of truth while the Phase 0
browser app carries a JavaScript port. Separate tests could approve different
behavior. One executable scenario set compounds future test work and makes
semantic drift visible in both stacks.

**Plan and success criteria**

1. Represent normal capacity outcomes and safety-critical replan invariants in
   a language-neutral fixture.
2. Execute every named scenario in Rust and JavaScript.
3. Compare exact error codes and keep/drop/shrink sets while retaining focused
   unit regressions.

**Changes**

- Added `tests/capacity-contract.json` with five capacity and three replan
  scenarios.
- Added Rust integration consumers in
  `crates/aily-core/tests/capacity_contract.rs`.
- Added `tools/test-capacity-contract.mjs` and wired it into `npm test` and CI.

**Verification evidence**

- `npm test`: 12 Rust unit tests, 2 Rust contract integration tests, all 8
  shared scenarios in JavaScript, store/capacity suites, and syntax checks
  passed.
- `cargo clippy --all-targets --all-features -- -D warnings`: passed.
- `git diff --check`: passed.
- Contract coverage includes accept, global/daily/soft-sum/goal-soft errors,
  must-keep protection, numeric priority, and shrink-before-drop behavior.

**Scores (change-specific)**

| Dimension | Before | After | Evidence |
|---|---:|---:|---|
| Correctness / reliability | 7/10 | 9/10 | Both ports are checked against identical expected outcomes |
| Test coverage / verifiability | 6/10 | 9/10 | Eight shared cases run in both language stacks and CI |
| Maintainability | 6/10 | 8/10 | New parity scenarios are authored once rather than duplicated |
| Performance | 9/10 | 9/10 | Small JSON fixture adds negligible test time |
| Security / safety | 8/10 | 8/10 | Safety invariants gain coverage; runtime boundary is unchanged |

**Lesson / process improvement:** When an implementation is intentionally
ported, keep focused language tests but add a small shared behavioral contract.
Compare observable results, not internal ordering or implementation details.

**Next opportunity:** Format the existing Rust sources once and add
`cargo fmt --all -- --check` to CI so future diffs remain mechanically clean.

### Cycle 5 — Enforce Rust formatting (2026-08-09)

**Why this won:** The repository's formatting check failed on three existing
source files, so formatting could not be used as a reliable gate. A one-time
mechanical cleanup plus enforcement has low risk and reduces noise in every
future Rust change.

**Plan and success criteria**

1. Apply only rustfmt's output to the existing Rust workspace.
2. Make the canonical local test command and CI reject format drift.
3. Keep all behavioral checks green and make developer docs point to the full
   gate.

**Changes**

- Formatted `audit.rs`, `lib.rs`, and `target.rs` with stable rustfmt.
- Prepended `cargo fmt --all -- --check` to `npm test`.
- Added the rustfmt component and formatting step to GitHub Actions.
- Updated `AGENTS.md` and `README.md` to use `npm test` as the canonical gate.

**Verification evidence**

- Before: `cargo fmt --all -- --check` exited 1 with diffs in three files.
- After: `npm test` passes its formatting gate, 12 Rust unit tests, 2 contract
  integration tests, 3 JavaScript suites, and syntax checks.
- `cargo clippy --all-targets --all-features -- -D warnings`: passed.
- `git diff --check`: passed.

**Scores (change-specific)**

| Dimension | Before | After | Evidence |
|---|---:|---:|---|
| Correctness / reliability | 8/10 | 8/10 | Runtime behavior is intentionally unchanged |
| Test coverage / verifiability | 6/10 | 9/10 | Format drift is now rejected locally and remotely |
| Maintainability | 6/10 | 9/10 | Entire Rust workspace is canonical and stays that way |
| Performance | 9/10 | 9/10 | No runtime change; formatting check is sub-second locally |
| Developer experience | 6/10 | 8/10 | One documented command runs every current local gate |

**Lesson / process improvement:** A check that already fails at baseline cannot
protect future work. Normalize once, then add the check to the canonical local
command and CI in the same cycle.

**Next opportunity:** Normalize or quarantine invalid persisted commitments so
the new fail-closed capacity error also gives users a clear recovery path.

### Cycle 6 — Quarantine invalid persisted commitments (2026-08-10)

**Why this won:** Cycle 2 restored collection shapes, but retained every
object-shaped commitment. Missing IDs, impossible dates, invalid estimates, or
malformed flags could therefore make capacity fail closed; entries without a
usable ID could not be repaired by Drop, and Force replan was not guaranteed to
fix them.

**Plan and success criteria**

1. Keep valid and older-compatible commitments active while quarantining
   malformed containers and records.
2. Preserve only bounded, display-safe summaries and reasons for recovery.
3. Keep quarantined data out of capacity and offer an explicit, confirmed user
   removal action that preserves valid work.
4. Make hydration idempotent so saved quarantine metadata never duplicates.

**Changes**

- Added real-calendar and commitment-field normalization at the persisted-state
  boundary, including ID, target, description, estimate, boolean, priority, and
  status checks.
- Default older missing `mustKeep`, `priority`, and `status` values without
  discarding otherwise valid work.
- Added a 100-entry bounded quarantine containing only sanitized ID, text, and
  reason strings; arbitrary malformed objects do not survive into render state.
- Added a tested `discardInvalidCommitments` domain action.
- Added a Today warning that lists up to three safe summaries, explains that
  they no longer block the plan, and requires confirmation before audited
  removal.

**Verification evidence**

- Test-first: the focused suite failed at module instantiation because the new
  discard/quarantine API did not exist.
- `node tools/test-store.mjs`: 40 hydration and recovery assertions passed,
  including malformed container, negative estimate, impossible date, missing
  ID, primitive record, compatibility defaults, capacity isolation,
  idempotence, and discard preservation.
- `npm test`: formatting, 12 Rust unit tests, 2 Rust contract tests, all 8 shared
  JS scenarios, store/capacity suites, and JavaScript syntax passed.
- `cargo clippy --all-targets --all-features -- -D warnings`: passed.
- `npm audit --audit-level=high`: 0 vulnerabilities; `git diff --check`: passed.

**Scores (change-specific)**

| Dimension | Before | After | Evidence |
|---|---:|---:|---|
| Correctness / reliability | 5/10 | 9/10 | Invalid records cannot enter Today or capacity; valid work survives |
| Test coverage / verifiability | 6/10 | 9/10 | Forty persistence/recovery assertions cover boundary and recovery action |
| Maintainability | 6/10 | 8/10 | One hydration boundary owns compatibility, rejection, and bounded summaries |
| User experience | 3/10 | 9/10 | The plan self-recovers and gives a visible, confirmed cleanup path |
| Security / safety | 6/10 | 9/10 | Arbitrary stored objects are replaced by capped, sanitized metadata |

**Lesson / process improvement:** Fail-closed validation needs a recovery
surface. Quarantine untrusted records before domain logic, retain only the
minimum safe explanation, and test that rehydrating repaired state is
idempotent before adding a destructive discard control.

**Next opportunity:** Add strict Clippy to CI so the locally proven warning
policy compounds on every future change. Workspace next: pivot to AlpArcade's
small/low-risk achievement-persistence boundary to keep improvement breadth.

### Cycle 7 — Enforce the complete verification/deployment policy (2026-08-10)

**Why this won:** Strict Clippy passed only as an extra manual command, while
the supposedly complete `npm test` gate and hosted CI omitted it. The same
inspection found deprecated checkout/setup-node and Pages action runtimes,
end-of-life Node 20, no CI least privilege/timeout/cancellation, and no
executable protection against workflow regression. Fixing this one boundary
protects every existing Rust and JavaScript contract plus every web deploy.

**Plan and success criteria**

1. Put strict Clippy and every current check behind the canonical `npm test`.
2. Modernize CI and Pages with supported official majors and bounded,
   least-privilege jobs.
3. Add a test-first policy spanning the local gate and both workflows.
4. Reproduce the complete gate, dependency audit, and staged web deployment
   locally before publishing the accumulated verified series.

**Changes**

- Added strict `cargo clippy --all-targets --all-features -- -D warnings` to
  `npm test`, between format and Rust test gates.
- Added `tools/test-workflows.mjs` with 30 trigger, permission, concurrency,
  timeout, runtime, command, staging, and deprecated-major assertions.
- Replaced CI's duplicated command list with the canonical gate; installed both
  rustfmt and Clippy; upgraded checkout/setup-node to v7 and Node to 24 LTS;
  added `contents: read`, ref-scoped cancellation, and a ten-minute timeout.
- Upgraded Pages to checkout v7, configure-pages v6,
  upload-pages-artifact v5, and deploy-pages v5; retained only required Pages
  permissions and added a ten-minute job timeout.
- Expanded syntax coverage to every web module, test tool, and service worker.
- Documented the full gate and bumped the web/PWA version to `2026.08.10.1`.

**Verification evidence**

- Test-first: the new policy suite failed on missing read-only CI permissions
  before implementation.
- Official GitHub releases identify configure-pages v6,
  upload-pages-artifact v5, and deploy-pages v5 as current Node 24 majors;
  checkout/setup-node v7 and Node 24 LTS were independently verified.
- `npm test`: formatting and strict Clippy passed; 12 Rust unit and 2 Rust
  integration tests passed; all 8 shared JS scenarios, capacity smoke, 40
  persistence/recovery assertions, and 30 workflow policies passed.
- Recursive web/tool/service-worker syntax passed.
- `npm audit --audit-level=high`: 0 vulnerabilities.
- Local Pages-equivalent staging produced 21 web files only; a retrying HTTP
  preview served the app shell, service worker, and `2026.08.10.1` version.
- `git diff --check`: passed.

**Scores (change-specific)**

| Dimension | Before | After | Evidence |
|---|---:|---:|---|
| Correctness / reliability | 7/10 | 9/10 | One canonical gate runs identically locally and in hosted CI |
| Test coverage / verifiability | 6/10 | 10/10 | Strict lint and 30 workflow/deploy policies cannot drift silently |
| Maintainability | 6/10 | 9/10 | Recursive discovery and one command replace duplicated workflow lists |
| Security / robustness | 5/10 | 9/10 | Supported Node 24 actions, least privilege, and bounded jobs are enforced |
| Developer experience | 6/10 | 9/10 | One fast command validates both domain stacks and delivery infrastructure |

**Lesson / process improvement:** A “complete” local gate must include the
strictest check developers rely on, or green local runs provide false
confidence. Treat CI and deployment as one chain: test current action majors,
permissions, bounds, staging scope, and the exact canonical command together.
When release documentation and README examples disagree, verify the official
latest release API before encoding a major.

**Next opportunity:** Make `persist()` return a safe durability result and keep
input/recovery actions working when localStorage writes fail, with an honest UI
status. Workspace next: rotate after publishing this infrastructure-focused
AIly cycle.
