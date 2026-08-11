# AIly Continuous Improvement Progress

This file is the durable status, opportunity backlog, verification record, and
cycle log for autonomous improvement work. Product direction remains in
`/home/alph/projects/plans/aily-heavy-plan.md`.

Last updated: 2026-08-11 (workspace Cycle 139; AIly Cycle 24)

## Current state

- Product phase: Phase 0 dogfood executable shell plus the first Phase 1 native
  usage slice; local ally propose (JS+Rust), full daily loop, and
  consent-gated Android daily UsageStats reads.
- Deployment version: `2026.08.11.115`.
- Gate: Rust + target/store/usage/platform-usage/block/ally/journey/service-worker/shell + 55 CI
  policy assertions via `npm test`, plus five Android JVM shell/usage tests in a
  separate cached JDK 21 hosted job.
- Service-worker execution covers activation cleanup, installed-scope bypass,
  current-cache ownership, fetch lifetime, offline navigation, and cache-write
  failure isolation.
- Continuous improve loop on `main` (100+ commits since executable shell).

## Opportunity backlog

| Priority | Opportunity | Category | Impact | Effort / risk | Evidence / dependencies | Status |
|---|---|---|---|---|---|---|
| 1 | Extend and device-dogfood real OS usage tracking (Android/Windows/Linux) | Product spine | High: Android current-day reads landed; background and desktop hooks remain | Large / medium | Physical Android permission/read journey + platform APIs | In progress |
| 2 | Apply the Android JavaScript output cap after invalid-row rejection | Correctness / robustness | Medium: malformed native rows can consume the valid-sample quota and hide later totals | Small / low | Red adapter contract reproduced the issue before this cycle pivoted to critical cache isolation | Backlog |
| 3 | Real hard-block OS enforcement | Product spine | High: UI simulation only | Large / medium | Break-glass dogfood landed | Backlog |
| 4 | On-device model for richer propose (still propose-only) | Product | Medium | Large / medium | Heuristic ally.js landed | Backlog |
| — | Restrict service-worker fetches to AIly scope/current cache and own their lifetime | Correctness / isolation | Critical: the worker could intercept sibling requests, read foreign caches, and detach writes | Small-medium / low | Behavioral scope, ownership, lifetime, fallback, and write-failure fixture | Completed in Cycle 24 |
| — | Add a consent-gated Android UsageStats adapter | Product spine / privacy | High: Capacitor APK can show real current-day app totals without background collection | Medium / low | Native plugin, dual grants, bounded live results, adapter/JVM contracts | Completed in Cycle 23 |
| — | Protect foreign same-origin caches during service-worker activation | Correctness / isolation | Critical: activating AIly could evict offline data owned by other GitHub Pages projects | Small / low | Behavioral worker fixture with AIly, ChristoDay, and foreign cache names | Completed in Cycle 22 |
| — | Wire Android unit tests into CI with explicit Node/JDK setup | Test / DX | Medium | Small / low | Three compiled-shell tests plus 16 CI policy contracts | Completed in Cycle 21 |
| — | Make browser target progress direction-aware | Correctness / ally UX | Critical: wrong-way movement appeared complete and deprioritized worsening targets | Small / low | Shared browser helper + Rust/browser regressions | Completed in Cycle 20 |
| — | Local propose-only day planner + return nudge | Ally UX | High | Medium / low | ally.js + tests | Completed in Cycle 17 |
| — | AIly Android shell unit + instrumented tests | Test / DX | Medium | Small / low | Replaces Capacitor samples | Completed in Cycle 13 |
| — | Daily check-in + focus sessions | Ally UX | High | Small / low | Cycle 12 | Completed in Cycle 12 |
| — | In-app usage tracker + break-glass delay UI | Ally UX | High: honesty loop dogfood | Medium / low | Cycle 11 | Completed in Cycle 11 |
| — | Boot splash, assets, install banner, offline/PWA shell | UX / packaging | High: feels like a real app | Medium / low | Cycles 8–10 | Completed in Cycle 8–10 |
| — | Time-consciousness card + intentional commitment gate | Ally UX | High: owner personal goal | Small / low | Today + intention modal | Completed in Cycle 9 |
| — | Safe localStorage persist + export/import backup | Reliability | High: no throw on quota; portable data | Small / low | store.js + Setup | Completed in Cycle 8–10 |
| — | Enforce strict Clippy and modern workflow policy | Test / maintainability / security | High compounding value across all checks and deployments | Small-medium / low | 30 executable CI/Pages policy assertions | Completed in Cycle 7 |
| — | Give users a recovery path for invalid persisted commitments | Reliability / UX | Medium: malformed entries previously left capacity fail-closed with no reliable repair | Small / low | Quarantine plus explicit confirmed discard | Completed in Cycle 6 |
| — | Bring all Rust sources under `cargo fmt --check` in CI | Process / maintainability | Medium: makes formatting mechanically verifiable | Small / low | Three files had pre-existing drift | Completed in Cycle 5 |
| — | Add shared cross-language capacity/replan contract fixtures | Test / maintainability | High compounding value: prevents drift between Rust and browser ports | Medium / low | Five capacity and three replan scenarios | Completed in Cycle 4 |
| — | Reject non-finite and negative capacity inputs in Rust and JS | Correctness / robustness | High: invalid numbers bypassed capacity checks | Small / low | Reproduced in both public domain functions | Completed in Cycle 3 |
| — | Deep-merge and validate persisted web state | Bug / test gap | High: a partial or older state could crash startup | Small / low | Reproduced with a partial tutorial object | Completed in Cycle 2 |
| — | Preserve user priority during forced replans | Bug / test gap | Critical: wrong work was sacrificed | Small / low | Reproduced in both implementations | Completed in Cycle 1 |

## Cycle log

### Cycle 24 — Isolate runtime caching and own fetch lifetimes (2026-08-11)

**Why this won:** The attached-device check confirmed that the planned physical
Android UsageStats journey remains externally blocked. Adapter review found a
small malformed-row cap defect, but version/cache inspection then exposed a
critical shared-origin issue: activation cleanup was safe while fetch handling
still intercepted sibling-project traffic, searched every origin cache, and
launched cache writes outside the fetch event lifetime. That new evidence
outranked the smaller adapter fix, which was reverted before shipping and
recorded in the backlog.

**Plan and success criteria**

1. Execute the checked-in worker under its production-like `/AIly/` scope.
2. Prove sibling paths are bypassed and only the current AIly cache can answer
   an AIly request, even when a foreign cache has a conflicting response.
3. Bind network refresh/cache writes to `event.waitUntil()` while preserving
   owned offline navigation and usable network responses when `cache.put` fails.

**Changes**

- Derived an explicit runtime boundary from `self.registration.scope` and
  bypassed cross-origin plus same-origin out-of-scope requests.
- Replaced origin-global `caches.match()` with reads from the current versioned
  AIly cache only.
- Shared one network/update promise between response logic and
  `event.waitUntil()`, with cache-write failure isolated from network delivery.
- Expanded the service-worker VM from activation-only coverage to executable
  activation, scope, cache-conflict, lifetime, offline-fallback, and denied-write
  scenarios.
- Documented cache ownership and bumped the coupled site/cache version to
  `2026.08.11.115`.

**Verification evidence**

- Test-first: the old worker registered a response for
  `/ChristoDay/js/app.js`, failing the out-of-scope contract with 1 interception
  instead of 0 before reaching the foreign-cache and lifetime assertions.
- The final focused worker suite passes every activation/runtime scenario;
  self-review added an owned-cache offline-navigation contract after the main
  fix was green.
- The complete Rust/browser/native, audit, syntax, JSON, diff, hosted CI, Pages,
  and live-version results are recorded in the workspace Cycle 139 summary.
- Correctness/reliability: 3/10 → 10/10 (only owned scope/cache data can answer).
- Verifiability: 4/10 → 10/10 (the real handler now executes across six failure
  and ownership boundaries).
- Maintainability: 7/10 → 9/10 (scope, cache, and lifetime ownership are one
  explicit policy shared with the repository's activation namespace).
- Performance/resources: 6/10 → 9/10 (sibling traffic bypasses AIly and runtime
  writes have a bounded browser lifetime).
- Security/isolation: 3/10 → 10/10 (foreign cache data cannot contaminate AIly
  responses and AIly cannot absorb sibling resources).

**Lesson / process improvement:** Reprioritize immediately when new destructive
evidence outranks an unshipped small fix, and revert the smaller experiment
cleanly rather than bundling unrelated work. Cache-prefix-safe activation does
not imply fetch isolation: every shared-origin PWA needs executable checks for
scope, current-cache reads, and event-owned writes.

**Next opportunity:** A physical Android permission/read journey remains the
product-spine priority when hardware is attached. The next local adapter fix is
to make invalid native rows stop consuming the 50-valid-sample JavaScript quota.
Workspace next: skip another zero-delta profile audit and rotate to VerseKeep.

### Cycle 23 — Read Android daily usage behind dual consent (2026-08-11)

**Why this won:** Real OS usage was the top durable product-spine gap and both
the heavy plan and prior cycle named Android UsageStats as the first reversible
slice. Permission status, a user-initiated Settings handoff, and bounded local
reads deliver real value without yet accepting the risk of background
collection or enforcement.

**Plan and success criteria**

1. Require tutorial consent and Android's independently revocable Usage Access
   grant before any cross-app usage read or block-arming eligibility.
2. Register a thin local Capacitor plugin that returns only bounded current-day
   foreground aggregates and never schedules, persists, or uploads them.
3. Normalize the native result into the existing browser usage shape while
   preserving the web/PWA session tracker.
4. Prove consent gating, Settings flow, invalid-row rejection, capping,
   registration, native compilation, and the complete existing gate.

**Changes**

- Declared `PACKAGE_USAGE_STATS` and registered local `AilyUsagePlugin` before
  Capacitor creates its bridge.
- Added native permission status, explicit Usage Access Settings handoff, and a
  consent-enforcing `listTodayUsage` method. Results are sorted, sanitized, and
  capped at 50; package labels safely fall back to package keys when Android's
  visibility policy hides metadata.
- Replaced the Android stub at runtime with a real adapter that independently
  requires `{ consented: true }`, validates/caps the native envelope, and maps
  milliseconds into the existing usage-sample shape.
- Made native startup fail closed until the OS grant is confirmed, reconciled
  revocation on resume, and kept native totals in memory so exports/backups do
  not silently acquire app-usage data. Web/PWA behavior remains the existing
  visibility/focus session tracker.
- Made in-app revocation immediately clear the native memory snapshot and
  explain that Android's separate system grant must be revoked in Settings.
- Added refresh/status UI and explicit copy distinguishing live Android totals
  from removable saved manual samples.
- Expanded adapter, shell/native-source, and Android JVM contracts; documented
  the platform, privacy, architecture, install, and package boundaries; bumped
  the coupled Pages/PWA version/cache to `2026.08.11.114`.

**Verification evidence**

- Test-first: the JavaScript contract failed because no real Android adapter
  export existed; the Android JVM suite failed because the plugin and
  registration did not exist.
- Self-review then found that in-app revocation stopped future reads but left
  the last memory-only totals visible. A new shell contract failed first; the
  revoke path now clears them synchronously.
- Focused adapter tests prove denied→Settings, already-granted short-circuit,
  zero native calls without explicit consent, malformed-row rejection, mapping,
  and the independent 50-row JavaScript cap.
- Five Android JVM tests pass, including plugin annotation/method/registration
  reflection and deterministic sort/drop/cap behavior. A post-sync
  `assembleDebug` passed all 139 Gradle tasks; the APK contains the `.114` web
  assets, requested UsageStats permission, AIly activity, and plugin dex class.
- `npm test` passed Rust formatting and strict Clippy, 16 Rust unit + two
  shared-contract tests, all browser-domain/service-worker suites, 19 shell
  assets plus the new native source contracts, and 55 workflow policies.
- Recursive syntax, package audit with zero vulnerabilities, JSON checks, and
  `git diff --check` passed.
- Honest limit: no physical Android device was attached in this cycle, so the
  OEM Settings return journey and UsageStats day-boundary accuracy remain the
  next device-backed verification target. Android documents that usage results
  are OS aggregates whose interval may be expanded.

**Scores (change-specific)**

| Dimension | Before | After | Evidence |
|---|---:|---:|---|
| Correctness / reliability | 2/10 | 8/10 | Real read path fails closed across both grants and reconciles revocation; device journey remains |
| Test coverage / verifiability | 3/10 | 9/10 | JS boundary, native shape/aggregation, source contracts, JVM compile, and APK build are gated |
| Maintainability | 5/10 | 8/10 | One thin plugin and one backend contract isolate platform code from domain/UI logic |
| Performance / resources | 6/10 | 9/10 | On-demand/resume reads, one-minute UI refresh bound, 50-row cap, no background service |
| Privacy / safety | 5/10 | 9/10 | Dual consent, local-only live data, no backup/cloud copy, no enforcement scope |
| User experience | 3/10 | 8/10 | In-app Settings handoff, status, refresh, denial recovery; OEM device proof remains |

**Lesson / process improvement:** Special Android access is not a normal
runtime permission. Model user tutorial intent and OS AppOps state as separate,
revocable gates, register local plugins before the Capacitor bridge loads, and
test the web wrapper's no-consent path by asserting the native function is never
called. Keep the first platform slice read-only and memory-only so device
dogfood can inform persistence/background design.

**Next opportunity:** Run a device-backed Android permission/read journey and
characterize UsageStats accuracy across local midnight, lock/unlock, and grant
revocation before adding background collection. Workspace next: skip the GitHub
profile after two zero-delta audits and rotate to VerseKeep.

### Cycle 22 — Protect shared-origin caches during activation (2026-08-11)

**Why this won:** The backlog's next product step is real OS usage tracking,
but inspection found that AIly's service worker deleted every cache name except
its current one during activation. Cache Storage is shared across an origin, so
on `alphaeusng.github.io` an AIly update could erase ChristoDay or another
project's offline cache. The workspace objectives rank this current correctness
and isolation defect above beginning a larger capability.

**Plan and success criteria**

1. Execute the checked-in service worker's activation handler against current,
   obsolete AIly, ChristoDay, and unrelated cache names.
2. Delete only obsolete AIly-owned versions while preserving all foreign names.
3. Keep client claiming in the activation lifetime and make the behavior part
   of the canonical local/hosted gate.

**Changes**

- Added a named `aily-` cache ownership prefix and limited activation deletion
  to non-current cache names within that prefix.
- Added `tools/test-service-worker.mjs`, which evaluates the real worker in a
  controlled VM, invokes activation, and asserts exact deletion plus client
  claiming.
- Added the behavioral suite to `npm test` and a workflow-policy assertion so
  future gate drift cannot silently remove it (55 policies, up from 54).
- Bumped the coupled Pages/PWA version and cache to `2026.08.11.113` and updated
  the README's dogfood version.

**Verification evidence**

- Test-first: activation deleted `christoday-2026.08.11.3` and
  `other-project-offline-v1` alongside `aily-obsolete-test`, reproducing the
  cross-project eviction before the fix.
- Final worker test deleted exactly `aily-obsolete-test`, preserved both foreign
  sentinels and the current cache, and awaited `clients.claim()`.
- `npm test`: Rust formatting and strict Clippy passed; 16 Rust unit and two
  shared-contract tests passed; all browser-domain, service-worker, 19 shell,
  and 55 workflow/Pages policy checks passed.
- `npm run android:test`: three JVM shell tests passed; 71 Gradle tasks were
  successful/up-to-date under JDK 21.
- JavaScript/JSON checks, version/cache parity, package audit with zero
  vulnerabilities, and `git diff --check` passed.

**Scores (change-specific)**

| Dimension | Before | After | Evidence |
|---|---:|---:|---|
| Correctness / reliability | 3/10 | 10/10 | Updates remove obsolete AIly state without mutating other projects' caches |
| Test coverage / verifiability | 4/10 | 10/10 | The real activation handler is executed with exact origin-wide sentinels |
| Maintainability | 6/10 | 9/10 | Cache ownership is explicit and guarded by the canonical gate |
| Performance / resources | 9/10 | 9/10 | Cleanup remains one small linear pass over cache names |
| Security / isolation | 3/10 | 10/10 | Destructive storage mutation is constrained to the worker's namespace |

**Lesson / process improvement:** A product backlog should not outrank new
evidence of a destructive correctness defect. Service-worker scope and Cache
Storage ownership are different boundaries; reuse a behavioral foreign-cache
fixture across every PWA sharing an origin, not just a source regex.

**Next opportunity:** Begin the first reversible Android UsageStats slice:
declare usage access, expose permission status/settings and bounded local
aggregate reads through a thin Capacitor plugin, require both tutorial consent
and OS grant, and keep enforcement out of scope. Workspace next: rotate to the
GitHub profile repository.

### Cycle 21 — Run meaningful Android shell tests in CI (2026-08-11)

**Why this won:** AIly already packaged a Capacitor Android shell and had a
local JVM suite, but `main` could regress native compilation or shell identity
while the Rust/web-only hosted job stayed green. Automating the existing native
boundary compounds at much lower effort and permission risk than beginning the
large real-usage-hook architecture slice.

**Plan and success criteria**

1. Make the JVM suite assert compiled AIly shell types rather than constants
   alone.
2. Run it in a separate, bounded JDK 21 CI job with Gradle dependency caching.
3. Enforce the job, runtime, cache, working directory, and exact command through
   the existing workflow-policy suite.
4. Preserve the complete Rust/web gate and prove both jobs on a fresh runner.

**Changes**

- Added an independent `android-test` job using checkout/setup-node v7, locked
  npm installation, Capacitor sync, Temurin 21 through `actions/setup-java@v5`,
  Gradle caching scoped to native build definitions, a 15-minute bound, and the
  checked-in wrapper.
- Runs `:app:testDebugUnitTest --no-daemon` from `android/`; the documented npm
  command now uses that same daemon-free invocation.
- Expanded workflow policy from 38 to 54 assertions so removal or drift of the
  Android job, Node/JDK runtimes, npm/Gradle caches, generated inputs, directory,
  ordering, or task fails the canonical `npm test`.
- Strengthened the JVM suite from two to three tests: it now reads the compiled
  `MainActivity` package and proves the entry point inherits Capacitor's
  `BridgeActivity`, while retaining the brand/tagline checks.
- Documented the native gate and bumped the web/service-worker version to
  `2026.08.11.108` because every push also deploys Pages.

**Verification evidence**

- Baseline: the full Rust/web gate passed and the prior two-test Android suite
  completed locally under OpenJDK 21 in 8 seconds.
- Test-first workflow policy failed because no separate Android job existed.
- The first strengthened JVM test failed at compile time because this build
  intentionally does not generate `BuildConfig`; the test was corrected to
  inspect the real `MainActivity` package instead of enabling unused production
  build machinery solely for verification.
- The first hosted job then exposed a local-cache blind spot: ignored Capacitor
  plugin inputs did not exist on a clean checkout. The workflow now installs
  the exact npm lockfile and runs `npx cap sync android` before Gradle; six new
  policy assertions lock those prerequisites and their order.
- A clean-input simulation moved the ignored plugin/assets/config outputs aside;
  `npm ci` plus Capacitor sync recreated them, then 51 Gradle tasks executed and
  all three JVM tests passed in 7 seconds.
- `npm run android:test`: three tests, zero failures/errors; 71 Gradle tasks
  completed successfully in 6 seconds.
- `npm test`: all 16 Rust unit, two shared-contract, browser-domain, 19 shell,
  and 54 workflow/Pages policy checks passed.
- JavaScript/Java syntax, package audit, version/cache parity, and
  `git diff --check`: passed.

**Scores (change-specific)**

| Dimension | Before | After | Evidence |
|---|---:|---:|---|
| Correctness / reliability | 7/10 | 9/10 | Native source and generated Android build now gate every change |
| Test coverage / verifiability | 6/10 | 10/10 | Meaningful JVM shell tests run locally and in an independent hosted job |
| Maintainability | 7/10 | 9/10 | One npm/Gradle command is shared by docs and enforced CI policy |
| Performance / resources | 7/10 | 8/10 | Parallel job isolates native cost; Gradle inputs are cached and daemon is bounded |
| Security / robustness | 7/10 | 9/10 | Read-only job uses explicit JDK/action majors and the validated wrapper URL |

**Lesson / process improvement:** A test that compares two literals protects no
integration boundary. Native shell tests should reference compiled app types;
when a proposed assertion requires enabling otherwise-unused build output,
prefer a smaller observable contract rather than expanding production solely
for test convenience. [Official `setup-java` documentation](https://github.com/actions/setup-java)
confirms v5 supports JDK 21 and Gradle caching.

**Next opportunity:** Begin the first reversible real usage-tracking slice: an
Android permission/read adapter that remains local, explicit-consent gated, and
separate from enforcement. Workspace next: rotate to the GitHub profile repo.

### Cycle 20 — Preserve metric direction in progress and ally ranking (2026-08-11)

**Why this won:** The browser UI and local ally measured absolute movement from
baseline. For a target increasing from 0 to 100, moving to -50 therefore looked
50% complete; moving to -100 looked 100% complete. AIly then ranked that
worsening target behind genuinely progressing work. This contradicted the Rust
domain model and the product's root promise to track measurable target journeys.

**Plan and success criteria**

1. Use signed movement toward the target for both upward and downward metrics.
2. Clamp wrong-way movement to 0 and target overshoot to 100.
3. Make the Targets UI and propose-only ally consume one browser implementation.
4. Lock Rust/browser direction behavior and offline packaging in the full gate.

**Changes**

- Added `target.js` with shared `metricProgressRatio` and
  `metricProgressPct` helpers.
- Replaced duplicate absolute-distance calculations in `app.js` and `ally.js`.
- Added nine browser metric contracts and a planner regression proving a
  wrong-way target is ranked at zero progress.
- Added Rust downward/wrong-way coverage for the already direction-aware source
  of truth.
- Added the new suite to `npm test`, enforced it in workflow policy, precached
  the module, and bumped the web/PWA version to `2026.08.11.96`.

**Verification evidence**

- Test-first: the metric suite failed because no shared target module existed;
  the ally regression independently selected the 10%-complete target instead of
  the worsening one.
- `npm test`: Rust formatting and strict Clippy passed; 16 Rust unit and 2
  integration tests passed; 9 browser direction contracts, planner regression,
  every existing domain suite, 19 shell assets/contracts, and 38 workflow/Pages
  policies passed.
- Recursive web/tool/service-worker syntax, package audit, local served web
  preview, and `git diff --check` passed.

**Scores (change-specific)**

| Dimension | Before | After | Evidence |
|---|---:|---:|---|
| Correctness / reliability | 3/10 | 10/10 | Wrong-way movement is 0 in UI and planner for upward/downward metrics |
| Test coverage / verifiability | 6/10 | 10/10 | Rust, browser, planner, offline shell, and CI policy cover the contract |
| Maintainability | 5/10 | 9/10 | One browser metric primitive replaces two divergent calculations |
| Performance | 10/10 | 10/10 | Constant-time arithmetic; no dependency or network cost |
| User / ally experience | 3/10 | 10/10 | Journey meters and proposals now reflect actual direction toward the target |

**Lesson / process improvement:** Absolute distance is not progress when a
metric has direction. Domain behavior duplicated across runtime layers should
share a primitive within each language and receive explicit upward, downward,
wrong-way, and overshoot contracts.

**Next opportunity:** Wire the existing Android JVM unit suite into hosted CI
with an explicit JDK/SDK contract. Workspace next: rotate to the GitHub profile
repository for the next breadth cycle.

### Cycle 19 — Off-limits usage honesty (2026-08-11)

**Why this won:** Logging time on a blocked app should trigger a conscious
pause — core ally job without needing OS hooks yet.

**Changes**

- Confirm before logging usage that matches an armed block rule.
- Clear all usage samples action.
- README refresh for propose + shell commands.

**Verification:** `npm test`.

### Cycle 18 — Native back, weekly review, setup controls (2026-08-11)

**Why this won:** Android must feel like an app (back closes overlays), and
Review should show a week-level honesty mirror; Setup needs revoke/capacity.

**Changes**

- Capacitor backButton + appStateChange listeners.
- Review weekly journey stats (planned/done/usage/glass).
- Setup capacity editor; revoke usage/admin; block delete + disarm-all.
- `npm run android:test` script.

**Verification:** `npm test`; `npm run android:test`.

### Cycle 17 — Local propose-only ally planner (2026-08-11)

**Why this won:** “Your AI Ally” needs a plan voice without cloud exfil or a
multi‑GB model. Deterministic local proposals close that loop for dogfood.

**Changes**

- `apps/web/js/ally.js`: `proposeDayPlan` + `returnNudge`.
- Today: Ask AIly to propose / accept one / accept all / clear.
- Return-from-away toast after ≥5m hidden (intention / focus aware).
- `tools/test-ally.mjs` in the npm gate; architecture doc updated.

**Verification:** full `npm test` green.

### Cycle 16 — Intention capacity warning + docs honesty (2026-08-11)

**Why this won:** The intention gate should show capacity risk before confirm;
docs must match dogfood so we do not overclaim OS enforcement.

**Changes**

- Intention modal includes capacity preview error text when over budget.
- Privacy + blocking docs updated for session tracking and simulation limits.

**Verification:** `npm test`.

### Cycle 15 — Capacity preflight + readable activity (2026-08-11)

**Why this won:** Adding work past capacity should warn immediately; audit
should read like an ally log, not raw tool IDs.

**Changes**

- Capacity preview on commitment add; toast when over budget.
- Friendly activity labels for common tools.

**Verification:** `npm test`.

### Cycle 14 — Target journey visuals (2026-08-11)

**Why this won:** Targets without visible journey progress feel like a form,
not an ally.

**Changes**

- Empty-hero first-target CTA with logo.
- Per-target progress meter + % journey copy.
- Skip link for accessibility; version/README refresh.

**Verification:** `npm test`.

### Cycle 13 — Review honesty + Android shell tests (2026-08-11)

**Why this won:** Closing the day loop and proving the packaged app identity.

**Changes**

- Evening banner → Review; Review shows daily intention + open/done counts.
- Quick commitment chips (deep work / admin / break) with intention gate.
- Notification permission request on tutorial grant.
- Replaced Capacitor example tests with `com.alphaeusng.aily` unit +
  instrumented tests; local unit tests pass.

**Verification:** `npm test`; `:app:testDebugUnitTest`.

### Cycle 12 — Daily intention + focus session (2026-08-11)

**Why this won:** Time consciousness needs a morning pause, not only per-
commitment friction. Focus sessions make blocks meaningful for dogfood.

**Changes**

- Check-in modal after tutorial-ready first open each day.
- Persisted `dailyIntention`, `focusSessionEndsAt`, `lastCheckInDate`.
- Optional focus length arms existing rules when admin grants exist.
- Today chip + edit; tray countdown; end-early action.

**Verification:** `npm test` green.

### Cycle 11 — Usage tracker + break-glass delay (2026-08-11)

**Why this won:** Spine gaps were “samples only” and “instant unlock.” A real
ally needs automatic attention logging when granted and a delay+reason glass.

**Changes**

- `apps/web/js/usage.js`: append/merge samples, day totals, app summary,
  visibility/focus session tracker.
- `apps/web/js/block.js`: policy helpers, countdown readiness, daily limit,
  try-open match.
- Usage panel bars; auto-track AIly time when permission on.
- Break-glass modal with live countdown; try-open simulation form.
- Tests wired into `npm test` (usage + block + policy assertions).

**Verification:** full `npm test` green.

**Next opportunity:** Daily intentional check-in; then real OS hooks.

### Cycle 10 — Executable packaging polish (2026-08-10)

**Why this won:** Users need a shippable binary + portable backup, not only a
static page. Capacitor splash/status-bar config, APK rebuild, export/import,
mobile bottom nav, and keyboard tab shortcuts make dogfood feel like an app.

**Changes**

- Capacitor SplashScreen + StatusBar config; `npx cap sync android`; debug APK
  at `dist/AIly-0.1.0-debug.apk`.
- Setup: export/import JSON backup (`aily.backup.v1`).
- Mobile sticky bottom nav; keys `1`–`7` for tabs; toasts replace several alerts.
- Version `2026.08.10.4`; SW cache bumped.

**Verification:** `npm test` green; `./gradlew assembleDebug` with
`JAVA_HOME=$HOME/.local/jdk-21` green.

**Next opportunity:** Real OS usage tracking and hard-block enforcement.

### Cycle 9 — Time consciousness + intentional choice (2026-08-10)

**Why this won:** Owner goal is conscious time and “do I really want this?” —
the ally differentiator vs a plain to-do list.

**Changes**

- Today “Time consciousness” capacity meter + ally line (plan vs soft cap,
  usage samples, session minutes).
- Intention modal before adding ≥30m commitments; session skip option.
- Tutorial meet copy names the pause/intention job.
- Usage panel summarizes today’s logged attention.

**Verification:** store/shell assertions for intention + time copy; full gate.

### Cycle 8 — Boot splash, assets, safe persist, PWA install (2026-08-10)

**Why this won:** First paint and storage failure handling define whether the
product feels like an app or a fragile demo.

**Changes**

- Boot splash with logo/wordmark assets; preload; minimum display time.
- `saveState` returns `{ok}` without throwing; round-trip verify; toast on fail.
- Install banner + `beforeinstallprompt`; online/offline pill.
- SW caches assets/icons; partial cache install resilience.

**Verification:** expanded `test-store.mjs` (persist fail paths, shell HTML/SW);
full `npm test`.

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
