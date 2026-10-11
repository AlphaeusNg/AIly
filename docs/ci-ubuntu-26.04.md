# CI readiness: ubuntu-latest → Ubuntu 26.04

## Context

GitHub is moving the `ubuntu-latest` label to Ubuntu 26.04, rolling out from
2026-10-19 and completing by 2026-11-19.
See the [runner image announcement](https://github.com/actions/runner-images/issues/14748).

## Probe on 2026-10-09 (SGT)

A temporary probe workflow ran every AIly Linux job on the explicit
`ubuntu-26.04` label against main `70adf50`.
The image was `ubuntu-26.04` version `20260927.149.1`, Ubuntu 26.04.1 LTS.
[Probe run](https://github.com/AlphaeusNg/AIly/actions/runs/37822777357).
The probe was removed before merge; no deploy, upload, release or tag steps ran.

| Workflow / job | What ran on 26.04 | Result |
|---|---|---|
| ci.yml `test` | Rust stable + rustfmt/clippy; `npx playwright install --with-deps chromium` (Playwright 1.62.1); full `npm test` incl. 14 Chromium journeys | pass |
| ci.yml `android-test` | Temurin JDK 21.0.12; `npx cap sync android`; Gradle `:app:testDebugUnitTest` | pass |
| windows-installer.yml `android-apk` | Gradle test + `assembleDebug`; `tools/verify-android-apk.sh` (signed 0.1.7 APK verified); artifact upload skipped in probe | pass |
| windows-installer.yml `release` (Linux side) | `sha256sum` generate + verify on stand-in files; GitHub Release step not exercised | pass |
| pages.yml `deploy` | Checkout + stage `apps/web` into `_site`; configure/upload/deploy Pages not exercised | pass |
| windows-installer.yml `nsis` | Runs on `windows-latest` | not affected |

## Playwright

Playwright 1.62.1 maps Ubuntu 26.04 to its own officially supported
`ubuntu26.04-x64` host platform with a dedicated `--with-deps` package list
(t64 package names such as `libasound2t64`). `--with-deps chromium` installed
cleanly (9 new packages, 1 upgraded) with no unsupported-OS warning.

## Decision and limits

No workflow change needed; jobs stay on `ubuntu-latest`. If a future 26.04 image
update breaks a job, pin only that job to `ubuntu-24.04` with a dated comment and
link this note.
Not covered: deploy-pages, upload-artifact/download-artifact and the GitHub
Release action themselves. They are JavaScript actions independent of the
distro but were deliberately not run from a branch.
