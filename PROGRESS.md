# AIly Continuous Improvement Progress

This file is the durable status, opportunity backlog, verification record, and
cycle log for autonomous improvement work. Product direction remains in
`/home/alph/projects/plans/aily-heavy-plan.md`.

Last updated: 2026-08-27 (AIly Cycle 38)

## Current state

- Product phase: Phase 0 dogfood executable shell plus the first Phase 1 native
  usage slice; local ally propose (JS+Rust), full daily loop,
  consent-gated Android daily UsageStats reads, and consent-gated Windows
  foreground-process totals since the installed app opened.
- Deployment version: `2026.08.27.1`; Windows and Android package version `0.1.3`.
- Windows delivery is a scoped Edge/Chrome PWA, a local preview launcher, and a
  tested Tauri 2 NSIS release (`v0.1.3`, `AIly-setup.exe`, unsigned). The exact
  public installer has passed build, silent install, launch, and uninstall
  cleanup on `windows-latest`. OS hard-blocks are not in this build.
- Android delivery includes a public, direct-download, debug-signed
  `AIly-debug.apk`; package identity/version/signature and JVM tests gate each
  hosted artifact. Physical-device install and Usage Access dogfood remain.
- Releases include one generated `SHA256SUMS.txt` for the tested Windows and
  Android artifacts, with platform-native verification instructions.
- Gate: Rust + target/store/usage/platform-usage/block/ally/journey/service-worker/shell,
  three real Chromium storage-failure journeys, one Windows usage fixture, and 64 CI policy assertions via
  `npm test`, plus five Android JVM shell/usage tests in a separate cached JDK
  21 hosted job.
- Service-worker execution covers activation cleanup, installed-scope bypass,
  current-cache ownership, fetch lifetime, offline navigation, and cache-write
  failure isolation.
- Continuous improve loop on `main` (100+ commits since executable shell).

## Opportunity backlog

| Priority | Opportunity | Category | Impact | Effort / risk | Evidence / dependencies | Status |
|---|---|---|---|---|---|---|
| 1 | Extend and device-dogfood real OS usage tracking (Android/Windows/Linux) | Product spine | High: Android current-day reads and Windows session totals landed; Linux and physical-device dogfood remain | Large / medium | Physical Android permission/read journey + Windows package dogfood | In progress |
| — | Restrict the Tauri webview and prove packaged frontend/IPC readiness | Security / verification | High: a window handle and configured title could accept a blank or policy-blocked webview | Small-medium / low | Explicit CSP, external registration script, native ready handshake, fail-closed install lifecycle | Completed in Cycle 38 |
| — | Make package delivery recoverable and non-preemptible | Process / reliability | High: duplicate deliveries repeatedly canceled the several-minute Windows lifecycle proof | Small / low | Manual dispatch for CI/packages; same-ref/SHA package runs serialize instead of canceling | Completed in Cycle 37 |
| — | Consent-gated Windows foreground usage in the Tauri package | Product spine / privacy | High: Usage on Windows still meant “this tab” | Medium / low | Win32 aggregator, JS adapter, revoke clears totals, Chromium fixture | Completed in Cycle 37 |
| — | Browser-gate localStorage failure and label session-only recovery | Reliability / verification | High: in-memory changes worked but generic success copy obscured failed durability, and no browser gate covered the UI | Small-medium / low | Three mutation-backed Chromium journeys plus 63 CI policies | Completed in Cycle 36 |
| — | Publish verifiable checksums for unsigned/debug packages | Packaging / security | High: users could download tested packages but not independently identify their bytes | Small / low | Generated two-package manifest, docs/contracts, and a byte-exact public v0.1.1 asset | Completed in Cycle 35 |
| — | Ensure lifecycle-probe changes trigger the combined package gate | Packaging / process | High: the Windows verifier could change without exercising either installable artifact | Small / low | Package-wide workflow identity, path-filter contract, and green hosted Windows/Android jobs | Completed in Cycle 34 |
| — | Publish and continuously verify an installable Android dogfood APK | Packaging / correctness | High: docs claimed a Releases APK, but no APK existed and native metadata said version 1.0 | Small-medium / low | Public direct asset, aligned 0.1.1 metadata, JVM/build/archive/identity/signature gates | Completed in Cycle 33 |
| — | Run install, launch, and uninstall smoke on every Windows package build | Packaging / verification | High: prevents a buildable but unusable installer from being published | Small-medium / low | PowerShell lifecycle probe passed before artifact upload on `windows-latest` | Completed in Cycle 32 |
| — | Make every Windows install CTA download the released package directly | Packaging / UX | Medium: package existed, but install CTAs added a release-page detour | Small / low | Stable latest-asset URL resolves to verified `AIly-setup.exe` | Completed in Cycle 31 |
| — | Companion loop + honest Windows package story | Ally UX / packaging | High: return was a toast; accept-all hid drops; Windows still read as “open a site” | Medium / low | Return-nudge modal, accept-all preview, Today metric check-in, tested Tauri NSIS release | Completed in Cycles 29–30 |
| — | Today one-thing + capacity in clock hours | Ally UX | High: next action and planned time were still a list and raw minutes | Small / low | Existing ranking + formatClockHours | Completed in Cycle 28 |
| — | Collapse the phone tab bar and calm Today / intention density | Ally UX | High: 7 cramped tabs and action-dump rows hid the pause | Small / low | 5-tab + More sheet, row overflow, folded notices, Fewer checks | Completed in Cycle 27 |
| — | Make the Windows preview launcher parse and keep the PWA identity scoped | Correctness / packaging | High: Windows PowerShell could not parse the launcher; `id: "/"` collided with the portfolio origin | Small / low | ASCII launcher, extracted static server, relative manifest id, and 19 server assertions | Completed in Cycle 26 |
| — | Apply the Android JavaScript output cap after invalid-row rejection | Correctness / robustness | Medium | Small / low | Invalid prefixes, valid output ordering, and the independent 50-sample bound are directly covered | Completed in Cycle 25 |
| 2 | Real hard-block OS enforcement | Product spine | High: UI simulation only | Large / medium | Break-glass dogfood landed | Backlog |
| 3 | On-device model for richer propose (still propose-only) | Product | Medium | Large / medium | Heuristic ally.js landed | Backlog |
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

### Cycle 38 — Restrictive desktop CSP and real readiness proof (2026-08-27)

**Why this won:** The installed app exposed Tauri's global invoke bridge while
its desktop CSP was `null`. Its lifecycle smoke accepted any window whose
configured title contained “AIly,” so a blank webview or a policy-blocked
frontend could still publish as a verified installer.

**Plan and success criteria**

1. Replace the null policy with a packaged-origin CSP that permits only the
   Tauri IPC endpoints and the minimum local asset capabilities AIly uses.
2. Remove inline executable script so `script-src 'self'` is enforceable.
3. Require packaged JavaScript to call a side-effect-free native command that
   marks the actual Windows window `AIly — Ready`.
4. Withhold the artifact unless silent install, exact ready title, and clean
   uninstall all pass under that policy.

**Changes**

- Added explicit default/script/style/image/connect/worker/object/frame/base/form
  directives. Scripts are packaged-origin only with no inline or eval escape;
  connections are limited to the packaged origin plus Tauri's documented IPC
  endpoints. Plugins, frames, and base rewriting are disabled.
- Moved service-worker registration from inline HTML into a small cached local
  module, preserving PWA behavior under the script policy.
- Added `desktop_ready`: the frontend calls it after initial render and native
  shell setup; Rust sets the real window title and returns a fixed
  acknowledgement. The browser title mirrors that state.
- Changed the installer probe from “some window titled AIly” to the exact
  native ready title. The configured fallback title is contractually forbidden
  from counterfeiting readiness.
- Bumped site/cache stamp to `2026.08.27.1` and package identities to `0.1.3`
  (including Android version code 3).

**Verification evidence**

- Test-first desktop and shell contracts failed on the absent CSP, external
  registration module, and ready handshake. After implementation, `npm test`
  passed 18 Rust tests/contracts, every JS/static gate, all four Chromium
  journeys, and 64 CI/Pages policy assertions; the Windows browser journey now
  proves the acknowledgement-driven ready title. The high-severity dependency
  audit reported zero vulnerabilities.
- The Linux host cannot compile the Tauri crate without GLib development
  packages, and its Java 21 image lacks `javac`; these environment limits were
  not treated as product proof. Hosted CI run `32991999966` supplied a complete
  environment and passed the canonical job in 1m29s plus Android in 1m06s.
- First package run `32992003531` compiled native tests and a 1,953,620-byte
  installer, then correctly failed and withheld it when the native title stayed
  `AIly — Your AI Ally`. This exposed that `document.title` is not the native
  Tauri window title; the test was preserved and the native command fixed.
- Corrected branch package run `32992940182` passed all three Windows native
  tests, built a 1,953,049-byte installer, installed AIly 0.1.3, reached the
  native ready state through frontend IPC, and uninstalled cleanly in 8m11s.
  Its Android job built, signed, and verified the 0.1.3 APK in 53 seconds.
- Annotated tag `v0.1.3` points to corrected commit `0002bef`. Tag run
  `32993791751` repeated Android verification in 55 seconds, the Windows native
  and installed-ready lifecycle in 10m18s, and release publication in 18
  seconds. Independent fresh release downloads passed `sha256sum -c`; the
  stable latest URLs returned HTTP 200 for `AIly-setup.exe` (1,952,531 bytes,
  SHA-256 `7da3783f11b10a01c28371d193cc3362f3fa7d14f1eea3dc48cdb59c7c27f390`),
  signed `AIly-debug.apk` (4,212,156 bytes, SHA-256
  `68fc2ad8fa3d46d06573680afde4a22704614198de07a91a0975292b01c63c1c`),
  and the 162-byte manifest.
- Pages run `32993115735` passed and production serves `2026.08.27.1` with the
  external registration module. Delayed redundant package runs were canceled;
  they did not replace the completed evidence runs.

**Scores**

| Dimension | Before | After | Evidence |
|---|---:|---:|---|
| Correctness / reliability | 6/10 | 10/10 | Installer proof now fails on a frontend/native readiness mismatch |
| Test coverage / verifiability | 5/10 | 10/10 | Browser acknowledgement plus installed native-title proof spans both sides of IPC |
| Maintainability | 7/10 | 9/10 | One tiny command owns the explicit desktop-ready contract |
| Performance / resources | 9/10 | 8/10 | Runtime cost is one startup IPC; clean Windows verification still takes ~8 minutes |
| Security / robustness | 4/10 | 10/10 | Desktop content and connections are explicitly bounded; scripts reject inline/eval |
| Developer / user experience | 7/10 | 9/10 | Published installers cannot silently open an unusable shell |

**Lesson / process improvement:** Observe the platform surface the test claims
to verify. A browser document title is not necessarily a native window title.
The first hosted failure was useful evidence: preserve strict lifecycle probes,
withhold failed artifacts, and move the signal to the real trust boundary.

**Next opportunity:** Cache safe Windows Cargo build outputs with a lockfile-
and-runner-specific key, while preserving fresh native tests, NSIS lifecycle,
and checksum gates. Three clean builds took 8–10 minutes each during this
cycle, making verification latency the clearest compounding process cost.

### Cycle 37 — Consent-gated Windows foreground usage (2026-08-25)

**Why this won:** Android UsageStats could show current-day totals, but the
Windows package still meant “this tab.” The unfinished Tauri adapter, Win32
aggregator, and Usage UI were already in the tree.

**Changes**

- Tauri commands start/stop a consent-gated foreground-process monitor and
  return bounded session totals (process name + minutes, no window titles).
- Web Usage adapter talks to those commands only after explicit consent.
- Revoke usage clears in-memory native totals immediately.
- Chromium fixture covers grant, Editor 2m render, and revoke.
- Package version `0.1.2`; site stamp `2026.08.25.7`.
- CI and package workflows can be manually recovered. Package runs now use a
  same-ref/SHA, non-preemptible concurrency group, so duplicate delivery cannot
  repeatedly cancel the expensive Windows lifecycle proof.

**Verification evidence**

- Local `npm ci --ignore-scripts && npm test` passed 18 Rust/core/contract
  tests, all JS/static gates, four real Chromium journeys, and 64 CI/Pages
  policy assertions. `npm audit --audit-level=high` reported zero findings;
  Android JVM tests passed separately.
- Hosted CI run `32990320520` passed both canonical and Android jobs at commit
  `aeb2ed6`. Manual package run `32989897186` then proved the starvation fix on
  the same commit: three Windows native tests passed; its 1,955,085-byte NSIS
  package installed, launched AIly 0.1.2, and uninstalled cleanly; Android
  produced and verified a signed 4,211,664-byte `com.alphaeusng.aily` 0.1.2 APK.
- Annotated tag `v0.1.2` points to that verified commit. Tag run `32990710962`
  passed Android in 54 seconds, Windows in 8m27s, and the release job in 10
  seconds. The Windows job built a 1,953,849-byte NSIS installer, ran all three
  native tests, and logged an exact installed launch from
  `C:\\Users\\runneradmin\\AppData\\Local\\AIly` before clean uninstall.
- The public, non-draft release contains exactly `AIly-setup.exe` (1,953,849
  bytes), signed `AIly-debug.apk` (4,211,664 bytes), and
  `SHA256SUMS.txt` (162 bytes). Independent fresh downloads passed
  `sha256sum -c`; stable latest URLs returned HTTP 200 with those byte counts.
  SHA-256 values are `814552d2bfc10329d7fa514b7274dc3b0ad7c0d6c04bc62fd96296581992261a`
  for the EXE and `dc2382103fbefb70858cd8f1195a2d4d72c26c6feb46397bf6be1aa28c409f19`
  for the APK.
- GitHub Pages run `32988869968` passed, and the live site serves the
  `2026.08.25.7` stamp.

**Scores**

| Dimension | Before | After | Evidence |
|---|---:|---:|---|
| Correctness / reliability | 4/10 | 9/10 | Installed Windows usage is real, consent-gated, bounded, and revoke-cleared |
| Test coverage / verifiability | 5/10 | 10/10 | Native, browser, install lifecycle, package identity, signature, and public-byte gates passed |
| Maintainability | 7/10 | 9/10 | Platform collection remains behind one shared usage adapter contract |
| Performance / resources | 8/10 | 8/10 | Five-second foreground sampling is bounded; full Windows packaging remains intentionally expensive |
| Security / robustness | 6/10 | 9/10 | No titles/paths/history leave the process, and exact public bytes are checksummed |
| Developer / user experience | 4/10 | 9/10 | A direct, tested Windows installer now delivers the advertised native capability |

**Lesson / process improvement:** A green branch package is not equivalent to
a published product. Close delivery cycles by exercising the tag-only release
path and independently downloading its public assets. Long-running lifecycle
proofs must queue duplicate deliveries instead of allowing them to preempt one
another indefinitely.

**Next opportunity:** Add an explicit, restrictive Tauri CSP and strengthen the
Windows installer smoke so it proves frontend JavaScript and native IPC reached
a ready state. A window handle and static configured title can otherwise accept
a blank or policy-blocked webview.

### Cycle 36 — Browser-gate failed durability and honest recovery (2026-08-25)

**Why this won:** A workspace scan surfaced an old persistence follow-up even
though `saveState()` and `persist()` already returned safe results. Mutation in
a real browser confirmed target creation and quarantine recovery stayed usable
when `localStorage.setItem` threw, but the actions still announced ordinary
success and no installed-browser gate protected that behavior. Converting the
stale hypothesis into evidence exposed a smaller honesty and verification gap.

**Plan and success criteria**

1. Force `QuotaExceededError` at the real browser storage boundary, not in a
   source-text assertion.
2. Prove target input and recovery remain usable in memory, show the persistent
   failed-save state, and truthfully return to stored data after reload.
3. Use the existing `persist()` result for action-specific durable/session-only
   messages without changing successful behavior.
4. Add the locked Chromium suite to the canonical local and hosted gates.

**Changes**

- Added exact Playwright 1.62.1 tooling and three Chromium journeys covering
  target creation, quarantine discard, backup import, demo reset, and reload
  truth under a forced browser storage-write failure.
- Added `persistWithOutcome()` over the existing safe persistence result.
  Successful writes keep their prior copy; failed target/recovery actions now
  say explicitly that the change exists only for this session and what will
  happen on refresh.
- Made the canonical `npm test` gate run the browser suite. Hosted CI now installs
  locked dependencies and Chromium under a bounded 15-minute job; five new
  workflow contracts enforce the install/order/runtime and exact runner version.
- Ignored browser artifacts, documented local Chromium setup, and bumped the web
  and service-worker cache stamp to `2026.08.25.6`.

**Verification evidence**

- Pre-edit manual mutation proof: target creation produced two visible targets,
  a persistent failed-save badge, and one stored target after reload; quarantine
  removal worked in-session and the damaged record returned after reload.
- Test-first: the first real journey saw generic failure plus `Target created.`
  instead of the required session-only outcome. Its recovery fixture also taught
  the test to open the product's collapsed notice group before interacting.
- `npm ci --ignore-scripts && npm test` passed 18 Rust tests/contracts, every JS
  domain/worker/shell/desktop/package/server gate, all 3 Chromium journeys,
  recursive syntax, and 63 CI/Pages policy assertions.
- `npm audit --audit-level=high` found zero vulnerabilities; lockfile integrity
  and `git diff --check` passed.
- Hosted CI run `32780421072` passed the Chromium-capable canonical gate in
  56s and the Android JVM job in 41s; Pages run `32780421030` deployed the
  live `2026.08.25.6` stamp.
- Package run `32780421051` passed: Android built and verified in 46s, while
  Windows produced the 1,928,762-byte NSIS installer and then installed,
  launched, and uninstalled AIly 0.1.1 successfully in a 5m51s job.

**Scores**

| Dimension | Before | After | Evidence |
|---|---:|---:|---|
| Correctness / reliability | 8/10 | 10/10 | Four recovery/input actions distinguish durable and session-only outcomes |
| Test coverage / verifiability | 4/10 | 10/10 | Real Chromium mutates Storage and proves UI plus reload behavior in CI |
| Maintainability | 7/10 | 9/10 | One outcome helper owns success/failure copy selection |
| Performance / resources | 9/10 | 8/10 | Canonical CI adds one browser install and a ~4s three-journey suite |
| Security / robustness | 8/10 | 9/10 | Storage denial is a first-class tested boundary, not a source claim |
| Developer / user experience | 5/10 | 9/10 | Users know which changes disappear and the recovery action remains usable |

**Lesson / process improvement:** Read the newest cycle's next opportunity, not
the physical tail of a reverse-chronological log. When a stale hypothesis is
already fixed, mutation-test it before editing; preserve the proven behavior
and convert the remaining observability gap into the smallest verified change.

**Next opportunity:** Install the exact released APK on a physical Android
device and exercise first launch, Usage Access grant, bounded current-day reads,
revocation, and uninstall. The local machine still has no attached target, so
rotate repositories until that external dependency changes.

### Cycle 35 — Publish verifiable package checksums (2026-08-25)

**Why this won:** Physical Android dogfood remains externally blocked. The
newly discoverable Windows executable is unsigned and the APK is debug-signed,
but the release contained no checksum file. Users could obtain the tested
artifacts without a repository-published way to verify their bytes.

**Plan and success criteria**

1. Generate a deterministic manifest only from the Windows and Android
   artifacts downloaded by the tag release job.
2. Publish that manifest beside both packages and contract-lock its ordering.
3. Give Windows and WSL/macOS users copy-paste verification commands.
4. Backfill v0.1.1 from its exact hosted bytes and prove the stable latest URL
   returns the byte-identical manifest.

**Changes**

- The tag release job now runs `sha256sum` over `AIly-setup.exe` and
  `AIly-debug.apk` after both verified job artifacts are downloaded, then
  attaches `SHA256SUMS.txt` with the packages.
- Packaging contracts require manifest generation, pre-publication ordering,
  release attachment, both documentation links, and both platform commands.
- README and the install guide link the stable latest checksum asset. The guide
  provides a fail-closed PowerShell comparison and `sha256sum -c` path.
- Backfilled the existing v0.1.1 release with a 162-byte manifest generated
  from its downloaded assets, not a local rebuild.
- Bumped the PWA/service-worker cache stamp to `2026.08.25.5`.

**Verification evidence**

- Test-first: the focused package suite failed on the absent workflow manifest
  before implementation and passes afterward.
- `npm test` passed Rust formatting, strict Clippy, 18 Rust tests/contracts,
  every browser/domain/worker/shell/desktop/package/server suite, recursive
  syntax, and 58 CI/Pages workflow assertions. `npm audit --audit-level=high`
  found zero vulnerabilities; whitespace checks passed.
- Downloaded v0.1.1 assets were identified as a 1,926,333-byte NSIS executable
  and a 4,210,142-byte signed APK. Their SHA-256 values are
  `48adc9635ca2286a8b6a4229f79b539333b51d124bfd00cdc3a01d50d0faf24d`
  and `d5b201124a04edd8cfd8051a8d9c507f130ce9fd2d4483875fa2d958995e2b69`.
- `sha256sum -c SHA256SUMS.txt` returned `OK` for both. The stable latest URL
  resolves to an attachment with HTTP 200, 162 bytes, and manifest SHA-256
  `37956e1ac7e14c254ef4872cd28248bbca1633e4abd00e5adb5e23e74a9c2994`;
  a byte comparison with the uploaded source passed.
- Hosted CI run `32777585102` passed the canonical gate in 28 seconds and its
  Android JVM job in 47 seconds; Pages run `32777585100` deployed `.5`.
  Package run `32777585133` rebuilt/tested/verified Android in 46 seconds and
  built, installed, window-checked, uninstalled, and uploaded Windows in 5m18s.
  Its tag-only release job skipped on `main` as intended.

**Scores**

| Dimension | Before | After | Evidence |
|---|---:|---:|---|
| Correctness / reliability | 7/10 | 9/10 | Future releases derive identity from the exact two tested artifacts |
| Test coverage / verifiability | 5/10 | 10/10 | Workflow, attachment, docs, commands, and hosted bytes are all checked |
| Maintainability | 8/10 | 9/10 | One stable manifest covers both packages and future versions |
| Performance / resources | 9/10 | 9/10 | Hashing two small artifacts adds negligible release-only work |
| Security / robustness | 5/10 | 9/10 | Users can detect corrupt or substituted package bytes before install |
| Developer / user experience | 6/10 | 9/10 | Stable link plus native commands replace undocumented manual trust |

**Lesson / process improvement:** Generate integrity metadata from the exact
artifacts that crossed lifecycle/package verification, never from a rebuild.
Test publication ordering and backfill the current public release so docs do
not advertise a future-only safety control.

**Next opportunity:** Install the exact released APK on a physical Android
device and exercise first launch, Usage Access grant, bounded current-day
reads, revocation, and uninstall. The local machine still has no attached
target, so rotate repositories until that external dependency changes.

### Cycle 34 — Make package-verifier changes exercise both packages (2026-08-25)

**Why this won:** AIly's hosted workflow now builds both Windows and Android,
but it still presented itself as `windows-installer`. More importantly, its
path filter did not include `tools/test-windows-installer.ps1`, so a regression
in the real install/window/uninstall probe could merge without running the
package workflow it protects.

**Plan and success criteria**

1. Give the combined workflow and its stale-run concurrency group a
   package-wide identity.
2. Require changes to the Windows lifecycle probe to trigger the package gate.
3. Lock both policies into the canonical local suite.
4. Prove the edited workflow still completes both hosted package jobs.

**Changes**

- Renamed the displayed workflow and concurrency group from Windows-only to
  package-wide terminology while retaining the stable workflow filename.
- Added the Windows lifecycle probe to the push path filter.
- Added regression contracts for the workflow identity, concurrency grouping,
  and lifecycle-probe trigger.

**Verification evidence**

- Test-first: the new packaging contract failed on the Windows-only workflow
  name and the absent lifecycle-probe path before implementation.
- `npm test` passed 18 Rust tests/contracts, every browser-domain/worker/shell/
  desktop/packaging/server suite, recursive syntax, and 58 workflow assertions;
  `git diff --check` also passed.
- Hosted package run `32773059017` selected the renamed `packages` workflow.
  Android test/build/archive/identity/version/signature verification passed in
  53s; Windows NSIS build/install/window/uninstall verification passed in
  5m10s. CI `32773058927` and Pages `32773058942` also passed.

**Scores**

| Dimension | Before | After | Evidence |
|---|---:|---:|---|
| Correctness / reliability | 7/10 | 9/10 | Changes to the install verifier now exercise the packages it protects |
| Test coverage / verifiability | 7/10 | 10/10 | Local trigger policies and both real hosted package paths passed |
| Maintainability | 7/10 | 9/10 | Workflow identity now describes its Windows and Android scope |
| Performance / resources | 8/10 | 8/10 | Existing parallel bounded jobs are unchanged |
| Security / robustness | 9/10 | 9/10 | Artifact validation and permissions are unchanged and remain gated |
| Developer / user experience | 7/10 | 9/10 | Actions now exposes one accurately named package gate |

**Lesson / process improvement:** A verifier is only protective when edits to
the verifier retrigger the artifact lifecycle. Treat path filters and workflow
identity as tested delivery behavior, especially after expanding a workflow's
scope.

**Next opportunity:** Install the exact released APK on a physical Android
device and exercise first launch, Usage Access grant, bounded current-day
reads, revocation, and uninstall. The local machine still has no attached
Android target, so rotate repositories until that external dependency changes.

### Cycle 33 — Publish a verified Android dogfood package (2026-08-25)

**Why this won:** The README told Android users to install an
`AIly-*-debug.apk` from Releases, but the latest release contained only the
Windows executable. The native project also reported version `1.0` while every
other package surface reported `0.1.1`. The first Android UsageStats slice was
therefore documented as installable without an actual matching release asset.

**Plan and success criteria**

1. Align the packaged Android identity with version `0.1.1`.
2. Test and assemble the APK from locked dependencies on a hosted JDK 21 runner.
3. Reject malformed, wrong-package, wrong-version, or unsigned artifacts before
   upload; make future tag releases depend on both Windows and Android packages.
4. Publish the exact green hosted artifact and require the documented stable
   latest-download URL to return the Android package.

**Changes**

- Set Android `versionName` to `0.1.1`, matching npm, Tauri, and the release.
- Added an Android package job beside NSIS packaging. It synchronizes Capacitor,
  runs the JVM suite and debug assembly together, verifies the archive entries,
  application ID, version, and signature, then uploads `AIly-debug.apk`.
- Made tag publication depend on both package jobs and attach both verified
  assets with write permission isolated to the release job.
- Added 17 package-delivery contracts to the canonical local gate and increased
  workflow-policy coverage from 57 to 58 assertions.
- Replaced the nonexistent Releases instruction with a stable direct APK link
  plus explicit debug/unknown-source trust guidance.
- Published `AIly-debug.apk` to v0.1.1 and bumped the web/cache stamp to
  `2026.08.25.4`.

**Verification evidence**

- Test-first: the new package contract failed on Android `versionName "1.0"`
  versus package version `0.1.1` before implementation.
- Local Gradle ran five JVM tests and 104 tasks successfully. The resulting APK
  is 4,210,142 bytes, package `com.alphaeusng.aily`, version `0.1.1`, min SDK 23,
  target SDK 35, and verifies under Android debug signature schemes v1 and v2.
- `npm test` passed 18 Rust tests/contracts, every browser-domain/worker/shell/
  desktop/server suite, the new packaging contracts, recursive syntax, and 58
  workflow assertions. `npm audit --audit-level=high` found zero vulnerabilities.
- Hosted package run `32770633801` passed Android in 1m52s and the Windows
  build/install/window/uninstall lifecycle in 5m19s. CI `32770633839` and Pages
  `32770633833` also passed.
- The published hosted artifact has SHA-256
  `d5b201124a04edd8cfd8051a8d9c507f130ce9fd2d4483875fa2d958995e2b69`;
  the stable latest URL returns HTTP 200,
  `application/vnd.android.package-archive`, and the exact 4,210,142 bytes.

**Scores**

| Dimension | Before | After | Evidence |
|---|---:|---:|---|
| Correctness / reliability | 3/10 | 9/10 | Advertised Android delivery now exists with matching native version identity |
| Test coverage / verifiability | 4/10 | 10/10 | JVM, assembly, archive, identity, version, signature, and hosted upload are gated |
| Maintainability | 6/10 | 9/10 | One stable asset name and one reusable verifier replace manual release assumptions |
| Performance / resources | 8/10 | 8/10 | Packaging adds a bounded parallel hosted job; runtime is unchanged |
| Security / robustness | 5/10 | 9/10 | Signature and exact app identity are checked; debug/unknown-source risk is explicit |
| Developer / user experience | 2/10 | 9/10 | Android users now receive a direct real package instead of an empty release search |

**Lesson / process improvement:** Documentation that names an artifact is a
delivery contract. Audit the public release, align native metadata, validate the
produced binary rather than only its build task, and publish the same artifact
that passed hosted checks.

**Next opportunity:** Install this exact APK on a physical Android device and
exercise first launch, Usage Access grant, bounded current-day reads, revocation,
and uninstall. Until a device is attached, rotate repositories rather than
claiming emulator or static evidence as physical dogfood.

### Cycle 32 — Gate every Windows artifact with its installed lifecycle (2026-08-25)

**Why this won:** v0.1.1 was installed, launched, and removed successfully on
the Windows host, but that was a one-release manual proof. Future branch and
tag builds could still upload an installer that compiles yet fails to install
or start. Automating the lifecycle on the existing `windows-latest` runner is
the highest-leverage follow-up to the user-requested install verification.

**Plan and success criteria**

1. Silently install the staged NSIS package into a clean current-user profile.
2. Require exact versioned uninstall metadata and the installed desktop binary.
3. Launch the installed binary and observe a real AIly-titled window.
4. Stop it, invoke its own silent uninstaller, and prove registry/install-path
   cleanup even when an earlier assertion fails.
5. Run this before artifact upload and lock that ordering in the local gate.

**Changes**

- Added `tools/test-windows-installer.ps1`, a fail-closed lifecycle probe with
  best-effort cleanup in `finally`.
- Inserted the probe after staging and before upload in
  `windows-installer.yml`; the expected version comes from `package.json`.
- Extended desktop policy checks for the script, silent install, real window,
  uninstall metadata, cleanup, and workflow ordering.
- Coupled the web and service-worker cache stamp at `2026.08.25.3` for the
  automatic Pages deployment created by this main-branch cycle.

**Verification evidence**

- Test-first: `test-desktop.mjs` failed on the missing lifecycle probe.
- The focused desktop contract and Windows PowerShell 5.1 parser now pass.
- `npm test` passed Rust formatting/strict Clippy, 18 Rust tests/contracts,
  every browser-domain/worker/shell/desktop/server suite, recursive syntax,
  and 57 CI/Pages policy assertions. Locked standalone desktop metadata,
  PowerShell 5.1 parsing, diff whitespace, and the zero-vulnerability npm audit
  also passed.
- Windows run `32766220076` built a 1,927,366-byte installer, installed exact
  version 0.1.1 to `C:\Users\runneradmin\AppData\Local\AIly`, launched an
  AIly-titled window, removed it through its own uninstaller, and reported
  clean lifecycle success before artifact upload. The job passed in 4m38s.
- CI run `32766219847` (including Android JVM tests) and Pages run
  `32766219823` also passed for commit `84f3b3a`.

**Scores**

| Dimension | Before | After | Evidence |
|---|---:|---:|---|
| Correctness / reliability | 7/10 | 9/10 | Every staged package must exercise the installed lifecycle |
| Test coverage / verifiability | 5/10 | 10/10 | Build-only verification becomes install/window/uninstall verification |
| Maintainability | 8/10 | 9/10 | One reusable PowerShell probe owns Windows lifecycle checks |
| Performance / resources | 8/10 | 8/10 | A short smoke step is added to the existing Windows runner |
| Security / robustness | 8/10 | 9/10 | Clean baseline, exact version, own uninstaller, and cleanup are enforced |
| Developer / user experience | 7/10 | 9/10 | Uploaded artifacts are tested the way a user actually runs them |

**Lesson / process improvement:** Compile success is not install success.
Package workflows should cross the install boundary before upload, then use
the installed product's own metadata and uninstaller for cleanup.

**Next opportunity:** Complete the physical Android UsageStats permission/read/
revocation dogfood journey when a device is attached; otherwise rotate after
the hosted Windows lifecycle is green.

### Cycle 31 — Make Windows install a direct download (2026-08-25)

**Why this won:** The Windows package was finally real and install-tested, but
the in-app “Download Windows package” control still opened the release page and
required the user to find the asset. With physical Android dogfood externally
blocked, removing that avoidable install detour was the highest-impact local
packaging improvement.

**Plan and success criteria**

1. Require the app, no-JavaScript banner, README, and install guide to expose
   GitHub's stable `releases/latest/download/AIly-setup.exe` asset URL.
2. Preserve the release-notes link and unsigned/SmartScreen disclosure.
3. Verify the public URL resolves to an attachment for the released v0.1.1
   asset, then run the complete project gate.

**Changes**

- Pointed both rendered Setup and install-banner CTAs directly at the latest
  named Windows asset; the static HTML works even before JavaScript runs.
- Made README and Windows install instructions offer the direct package first,
  with the release page retained for inspection.
- Strengthened shell and desktop documentation contracts to reject a return to
  release-page-only install links.
- Bumped the web and service-worker cache stamp to `2026.08.25.2`.

**Verification evidence**

- Test-first: shell and desktop suites both failed because app/HTML/docs lacked
  the direct latest-asset URL.
- The direct URL followed two redirects to HTTP 200 with
  `application/octet-stream` attachment metadata for `AIly-setup.exe`.
- GitHub release metadata confirms v0.1.1 is published (not draft/prerelease)
  with one uploaded 1,926,333-byte `AIly-setup.exe` asset.
- `npm test` passed Rust format/strict Clippy, 18 Rust tests, shared fixtures,
  all browser-domain/worker/shell/desktop/server suites, recursive syntax, and
  57 CI/Pages policy assertions.
- Hosted CI run `32761143347` passed both the Linux/Rust gate and Android JVM
  job; Pages run `32761143351` deployed successfully, and the live site served
  version `2026.08.25.2` plus the direct asset URL.
- Windows run `32761143599` rebuilt and staged `AIly-setup.exe` successfully in
  5m39s, proving the updated embedded frontend remains NSIS-bundleable.

**Scores (change-specific)**

| Dimension | Before | After | Evidence |
|---|---:|---:|---|
| Correctness / reliability | 8/10 | 10/10 | Every advertised download target resolves to the named released asset |
| Test coverage / verifiability | 6/10 | 10/10 | App, pre-JS HTML, README, and install guide are contract-locked |
| Maintainability | 8/10 | 9/10 | One stable latest-asset convention avoids per-release URL churn |
| Performance / resources | 8/10 | 9/10 | One release-page navigation and click are removed |
| Security / robustness | 9/10 | 9/10 | Official GitHub asset path and unsigned warning remain explicit |
| Developer / user experience | 5/10 | 10/10 | “Download” now starts the actual installer download |

**Lesson / process improvement:** Verify delivery from the user's CTA, not
only from release metadata. A published artifact can still be unnecessarily
hard to obtain if product surfaces link to its container instead of the asset.

**Next opportunity:** Run the physical Android UsageStats permission/read/
revocation dogfood journey when a device is attached. Until then, rotate to a
different clean repository rather than simulating hardware evidence.

### Cycle 30 — Repair, release, and install-test Windows packaging (2026-08-25)

**Why this won:** The README promised `AIly-setup.exe`, but the only hosted
Windows run had failed and the latest release had no Windows asset. A package
that exists only as an unexecuted scaffold is a correctness and trust defect.

**Plan and success criteria**

1. Reproduce the hosted failure locally and make standalone Tauri Cargo
   metadata deterministic.
2. Build and upload NSIS on `windows-latest`, with write permission isolated to
   the tag-only release job.
3. Lock package/config/Cargo versions and binary icon constraints in tests.
4. Publish `v0.1.1` only after a branch artifact passes.
5. Download the public release asset on Windows; silently install, launch the
   app window, uninstall, and prove cleanup.

**Changes**

- Explicitly excluded `src-tauri` from the Linux workspace, added its lockfile,
  and aligned npm, Cargo, and Tauri versions at `0.1.1`.
- Pinned Tauri CLI `2.11.4`, used `--bundles nsis --ci`, and upgraded artifact
  actions. Repository contents are read-only by default; only the tag release
  job receives write access.
- Replaced the hand-built PNG-in-ICO with Tauri's generator, retaining only the
  four Windows inputs. Desktop tests now parse PNG/ICO dimensions and bit depth.
- Published release `v0.1.1` with public `AIly-setup.exe`; bumped the web/cache
  deployment stamp to `2026.08.25.1`.

**Verification evidence**

- Test-first: standalone `cargo metadata` failed because `src-tauri` sat under
  but outside the root workspace. After that fix, hosted run `32756225011`
  reached compilation and exposed the second defect: the custom ICO embedded a
  16-bit PNG unsupported by Tauri's Windows resource compiler.
- Local `npm test` passes 16 Rust unit tests, two shared contracts, all JS/core/
  worker/shell/desktop/server/workflow suites, 19 shell assets, and 57 workflow
  assertions. `cargo metadata --locked`, Python compile, JSON parsing,
  `npm audit --audit-level=high` (zero vulnerabilities), and a fresh Android
  JVM run (`71` Gradle tasks) pass.
- Branch Windows run `32757153170`, CI run `32757153216`, and Pages run
  `32757153164` passed. Tag run `32758105722` rebuilt NSIS and attached the
  artifact through the tag-only release job.
- The public release asset is a 1,926,333-byte PE32 NSIS installer with SHA-256
  `48adc9635ca2286a8b6a4229f79b539333b51d124bfd00cdc3a01d50d0faf24d`.
  Windows reports `NotSigned`, matching the documented SmartScreen warning.
- On Windows, the public package installed per-user as version `0.1.1`, launched
  `aily-desktop.exe` with window title `AIly - Your AI Ally`, then its own silent
  uninstaller removed the process, registry entry, install directory, and
  shortcuts. Temporary test copies were removed.

**Scores (change-specific)**

| Dimension | Before | After | Evidence |
|---|---:|---:|---|
| Correctness / reliability | 2/10 | 10/10 | Public package completes install, launch, and uninstall |
| Test coverage / verifiability | 3/10 | 10/10 | Workspace, versions, workflow policy, PNG/ICO, hosted and Windows runtime proofs |
| Maintainability | 5/10 | 9/10 | Locked standalone crate and official icon generator replace implicit/manual behavior |
| Performance / resources | 8/10 | 8/10 | Runtime unchanged; reproducible cold release build is under seven minutes |
| Security / robustness | 4/10 | 9/10 | Read-only default token; tag-only release write; unsigned state disclosed |
| Developer / user experience | 3/10 | 9/10 | Latest release now contains the named one-click Windows package |

**Lesson / process improvement:** A packaging scaffold is not delivery. Exercise
Cargo's real workspace boundary, validate binary asset encodings, require a
green branch artifact, then install the exact public release before advertising
it. Hosted failures were retained as evidence and fixed rather than bypassed.

**Next opportunity:** Rotate to CardFitSG for its official-source catalog review
before `reviewBy` 2026-08-28. AIly's next hardware-dependent step remains a
physical Android UsageStats permission/read dogfood run.

### Cycle 29 — Companion questions and Windows package scaffold (2026-08-18)

**Why this won:** Coming back was a toast. Accept-all could silently skip
items. “Install” claimed more than a PWA. The owner wants a downloadable
companion, not a GitHub Pages demo.

**Plan and success criteria**

1. Return-from-away asks “Still protecting {intention}?” with yes / change / choose next.
2. Accept-all shows what would add, skip, and remaining room before mutating.
3. Today can log the next target’s metric without leaving the page.
4. Install banner and Setup name PWA vs `AIly-setup.exe` vs OS blocks separately.
5. Scaffold Tauri 2 + NSIS CI without adding WebKit to Linux `npm test`.
6. Couple `SITE_VERSION` and the service-worker cache at `2026.08.18.5`.

**Changes**

- `returnNudge` is now a structured question; `previewAcceptAll` is pure.
- Return-nudge modal, Today check-in, backup reminder, honest install copy.
- `src-tauri/` (not a workspace member) + `windows-installer.yml` → `AIly-setup.exe`.
- Docs and README distinguish PWA, Windows package, and preview launcher.

**Verification evidence**

- `npm test` (includes `test-desktop.mjs` and updated ally/shell/workflow contracts).

### Cycle 28 — One thing and clock-time capacity (2026-08-18)

**Why this won:** Today still opened as a list. The ally already ranked
commitments; the next action and the day’s load needed to be spoken first.

**Plan and success criteria**

1. Surface one next pending commitment at the top of Today (title, minutes,
   Done) using the existing must-keep / priority / length ranking.
2. Keep the rest of the list below, visually quieter, without duplicating the
   featured item.
3. Add clock-hour copy on the time-consciousness card from existing minutes.
   Do not change Rust capacity math.
4. Couple `SITE_VERSION` and the service-worker cache at `2026.08.18.4`.

**Changes**

- `pickNextCommitment` / `rankCommitments` in `ally.js`.
- `formatClockHours` in `journey.js`; Today renders “You've planned 9h of a 7h day.”
- One-thing card at the top of Today; remaining rows use `.today-rest`.
- Shell, store, ally, and journey tests lock the contracts.

**Verification evidence**

- `npm test` is the gate. Android plugins untouched.

**Next opportunity:** Device-dogfood Android UsageStats and real hard-block
OS enforcement.

### Cycle 27 — Calm the phone shell and Today pause (2026-08-18)

**Why this won:** The web PWA is the dogfood surface, and the phone bar still
showed all seven tabs in a wrapping 4-column grid. Today rows dumped eight
actions beside the title, extra banners stacked above the list, and the
intention modal put snooze/skip next to the only real choice. Those were
visible UX wins that did not need Android hardware.

**Plan and success criteria**

1. Collapse the phone bar to Today / Targets / Review / Usage + More, with
   Blocks, Setup, and Activity in a bottom sheet. Keep keyboard 1–7.
2. Today rows show title, minutes, and Done; the rest lives behind ⋯.
   Must-keep uses a left accent. Extra banners fold unless they are danger.
3. Intention modal: “Yes — protect this time” stays the only primary,
   “Not now” is secondary, snooze/skip sit under “Fewer checks”.
4. Couple `SITE_VERSION` and the service-worker cache at `2026.08.18.2`.

**Changes**

- Phone nav is a 5-column grid; desktop keeps the full side list.
- More sheet reuses `modal-backdrop` and docks to the bottom on small screens.
- Commitment overflow menu + `today-notices` disclosure + must-keep accent.
- Intention snooze/skip moved under a muted disclosure.
- Shell and journey tests lock the 5+More contract and 1–7 shortcuts.

**Verification evidence**

- `npm test` is the gate (Rust + JS + workflow). Android `assembleDebug`
  skipped because these changes are web-only.
- Tests assert nav order, More trigger, 5-column phone grid, overflow menu,
  folded notices, Fewer checks, and keyboard 1–7.

**Scores (change-specific)**

| Dimension | Before | After | Evidence |
|---|---:|---:|---|
| Correctness / reliability | 8/10 | 8/10 | Same tabs and actions; 1–7 unchanged |
| Test coverage / verifiability | 6/10 | 9/10 | Shell + journey lock nav, overflow, intention |
| Maintainability | 7/10 | 8/10 | Overflow/more reuse existing modal + details |
| Performance / resources | 8/10 | 8/10 | No new network or native work |
| Security / robustness | 8/10 | 8/10 | Local-only; no plugin or cloud change |
| Developer / user experience | 4/10 | 8/10 | Phone bar, rows, and intention are quieter |

**Lesson / process improvement:** Phone chrome should keep four daily verbs
visible and park setup-grade destinations under More. A pause screen must
not present skip as a peer of the protected-time choice.

**Next opportunity:** Device-dogfood Android UsageStats and real hard-block
OS enforcement. On the web side, a first-run Today empty state that is as
quiet as this hierarchy.

### Cycle 26 — Fix Windows preview launch and PWA identity (2026-08-18)

**Why this won:** The last human request asked to verify a Windows install.
There is still no native installer, but the verification found two executable
local defects: `tools/serve-windows.ps1` failed to parse under Windows
PowerShell, and `manifest.webmanifest` used `"id": "/"`, so Edge identified the
app as the portfolio origin rather than `/AIly/`. Those outranked the still
blocked physical Android journey.

**Plan and success criteria**

1. Reproduce the PowerShell parse failure and the root-id collision.
2. Replace the quoted `node -e` fallback with a tested static server and keep
   the launcher ASCII so Windows PowerShell 5.1 can parse it without a BOM.
3. Scope the PWA identity to `./` and document that Windows install is a PWA,
   not a packaged `.exe` / `.msi`.

**Changes**

- Extracted `tools/serve-static.mjs` with argument parsing, path-safe resolution,
  and loopback serving.
- Rewrote `tools/serve-windows.ps1` to call that server, stay ASCII, and say it
  is not a native installer.
- Changed the manifest `id` from `/` to `./` so hosted identity stays under
  `/AIly/` and localhost preview stays on its own origin.
- Added shell and HTTP contracts for the launcher and static server.
- Documented the missing native installer and bumped the coupled site/cache
  version to `2026.08.18.1`.

**Verification evidence**

- Test-first: the previous launcher failed Windows PowerShell parse (`string is
  missing the terminator`) because of the `node -e` one-liner and a UTF-8 em
  dash that Windows-1252 reads as a closing quote.
- After the ASCII rewrite, `Parser::ParseFile` returned `PARSE_OK`.
- `node tools/test-serve-static.mjs`: 19 passed, including 403 on backslash
  traversal and correct `application/manifest+json`.
- Live preview on `127.0.0.1:8766` served `index.html` and the scoped
  manifest (`id: "./"`), returned 403/404 on traversal/missing paths.
- `npm test`: complete Rust/web/native gate passed, including the new server
  test and 56 CI/Pages policy assertions.

**Scores (change-specific)**

| Dimension | Before | After | Evidence |
|---|---:|---:|---|
| Correctness / reliability | 3/10 | 9/10 | Launcher parses; PWA id no longer claims `/` |
| Test coverage / verifiability | 2/10 | 9/10 | ASCII, no `node -e`, path safety, and HTTP contracts |
| Maintainability | 4/10 | 9/10 | One extracted server instead of a quoted one-liner |
| Performance / resources | 8/10 | 8/10 | Loopback preview only |
| Security / robustness | 5/10 | 9/10 | Traversal rejected; server binds 127.0.0.1 |
| Developer / user experience | 4/10 | 8/10 | Docs now distinguish PWA install from a native package |

**Lesson / process improvement:** Treat Windows PowerShell 5.1 as an ANSI
parser. Keep `.ps1` files ASCII (or UTF-8 with BOM) and never embed a second
language in a double-quoted command. Manifest `id` must be scope-relative;
`"/"` is the origin root on GitHub Pages.

**Next opportunity:** Run the physical Android permission/read/revocation and
local-midnight journey when hardware is attached. A packaged Windows artifact
(Tauri or signed MSIX) remains future work. Workspace next: rotate to the
portfolio, the oldest remaining non-profile backlog.

### Cycle 25 — Cap valid Android usage samples (2026-08-14)

**Why this won:** The higher-level physical Android UsageStats journey remained
blocked with no attached device. The top executable local defect was already
reproduced in the backlog: the JavaScript adapter sliced the first 50 native
rows before validation, so malformed rows could consume the quota and hide
later valid daily totals.

**Plan and success criteria**

1. Put 50 invalid rows before 55 valid rows and reproduce missing output.
2. Preserve native ordering while returning the first 50 valid samples only.
3. Keep consent, permission, normalization, and bounded-resource contracts green.

**Changes**

- Moved the Android adapter's output bound after row validation using an
  early-exit loop, so invalid rows do not consume valid-sample capacity and the
  adapter stops as soon as 50 valid results are collected.
- Extended the usage sample type contract with the existing optional Android
  package identity field.
- Added a regression fixture with 50 invalid prefix rows and 55 valid rows,
  asserting exact first/last retained package order and a 50-sample result.
- Replaced two stale date-specific release assertions with a deploy-format
  check and exact site-version/service-worker-cache parity, so future dates do
  not require weakening or manually extending the gate.
- Bumped the coupled site/cache version and README stamp to `2026.08.14.1`.

**Verification evidence**

- Test-first: the adapter returned 0 samples instead of 50 because the invalid
  prefix exhausted the pre-validation slice.
- The focused adapter contract passes after the bounded early-exit fix.
- The first full gate exposed August 10–11 date regexes in two release tests;
  both now enforce stable format/parity invariants, and the canonical gate
  passes on the August 14 stamp.
- The complete Rust/web/native, dependency, syntax, JSON, diff, hosted CI,
  Pages, and live-version results are recorded in the workspace Cycle 148
  completion summary.
- Correctness/reliability: 4/10 → 10/10 (valid totals cannot be crowded out by
  malformed native rows).
- Verifiability: 5/10 → 10/10 (invalid-prefix behavior, ordering, and cap are
  directly asserted).
- Maintainability: 7/10 → 9/10 (one explicit loop owns validation and bounded
  collection; the sample type matches its returned shape).
- Performance/resources: 6/10 → 9/10 (collection stops at 50 valid samples
  instead of transforming all remaining rows).
- Privacy/safety: 9/10 → 9/10 (dual consent and local-only behavior are
  unchanged).
- User experience: 5/10 → 9/10 (valid Android totals remain visible despite
  malformed neighbors).

**Lesson / process improvement:** Apply caps to accepted domain values rather
than raw transport positions. When moving a cap after validation, use bounded
iteration instead of normalizing the complete untrusted envelope and slicing
later; correctness and resource control should improve together. Release tests
should validate timeless format and cross-artifact parity rather than encode a
short-lived calendar allowlist.

**Next opportunity:** Run the physical Android permission/read/revocation and
local-midnight journey when hardware is attached. Workspace next: rotate to
VerseKeep, continuing to skip the profile repo after repeated zero-delta audits.

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
