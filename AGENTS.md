# AIly — agent notes

Visitor-facing docs live in [README.md](README.md). This file is for agents and local workflow.

**Brand:** **AIly** (stylized capital **I**) — *Your AI Ally*  
**Plan:** `/home/alph/projects/plans/aily-heavy-plan.md`  
**Workflows:**  
- Multi-mode (research/architecture/implement/…): `~/.grok/workflows/aily.rhai`  
- Continuous improve cycles: `~/.grok/workflows/aily-improve.rhai` (also `AIly/.grok/workflows/aily-improve.rhai`)

## Product spine

1. Targets the user sets (metrics required).  
2. Guided **tutorial** for non-technical setup (everything in-app).  
3. **App usage tracking** (with consent).  
4. **Self-admin productivity blocks** (Covenant Eyes *shape*, productivity *substance*) + break-glass.  
5. Local-first; auto bootstrap; no terminal for free path.

## Install surfaces (do not collapse these)

| Path | What you get | What you do not get |
|---|---|---|
| **PWA** | Edge/Chrome “Install app”, localStorage in that browser profile | OS admin, app blocks, a Start Menu `.exe` |
| **AIly-setup.exe** | Start Menu / desktop app wrapping the same `apps/web` UI (unsigned dogfood) | SmartScreen reputation, OS hard-blocks |
| **Preview launcher** | `tools\serve-windows.bat` for local web | An installer |
| **Android PWA / APK** | Home screen or unsigned `AIly-debug.apk` | Play Store release |

Verify packages with `SHA256SUMS.txt` before opening. Full guide: `docs/install-windows-android.md`.

## Repo layout

| Path | Role |
|---|---|
| `crates/aily-core` | Domain: targets, capacity, replan, tutorial state, block rules model |
| `apps/web` | Phase 0 UI dogfood (static HTML/CSS/JS) — also the Tauri frontend |
| `src-tauri/` | Tauri 2 Windows NSIS shell (`AIly-setup.exe`). Not a workspace member. |
| `android/` | Capacitor Android shell |
| `docs/` | Architecture, tutorial, privacy, blocking |
| `packages/*` | Placeholders for usage/block/tutorial services |

Do not add `src-tauri` to the Cargo workspace — Linux `npm test` must stay WebKit-free. Core logic stays in Rust.

## Status (Phase 0 dogfood `2026.08.27.1`)

Boot splash + brand assets, PWA install/update banners, scope-isolated offline page, time-consciousness meter, daily intention check-in, focus sessions, local propose-only ally planner, clone yesterday, must-keep / priority controls, target pause/complete, in-app attention tracker, Capacitor Android consent-gated UsageStats, Tauri Windows consent-gated foreground process totals (process names only), break-glass countdown, weekly journey stats, display density / reduce-motion, keyboard help (`?`, `Esc`, `1–7`), safe local persist/export/import, **Load sample journey**. Later: OS hard-blocks (Ship C), sealed DB, optional local AI.

## Rules

- Do not invent cloud exfil of usage.  
- Windows usage is foreground-process aggregation since the installed app opened: consent first, process names only, no titles or full paths.
- Blocks cannot arm without tutorial admin consent + usage grant.  
- Break-glass always available for hard blocks.  
- Bump `apps/web/js/version.js` `SITE_VERSION.id` on ship as `YYYY.MM.DD.N`.  
- Run the complete local gate with `npm test`.

## Commands

```bash
source "$HOME/.cargo/env"
cd /home/alph/projects/AIly
npm ci
npx playwright install chromium
npm test
# On Windows: cargo test --manifest-path src-tauri/Cargo.toml --locked
JAVA_HOME="$HOME/.local/jdk-21" npm run android:test
python3 -m http.server 8765 --directory apps/web
# open http://127.0.0.1:8765/

# Android (needs Android SDK + JDK)
export ANDROID_HOME=$HOME/Android/Sdk
export JAVA_HOME=$HOME/.local/jdk-21
npx cap sync android
cd android && ./gradlew assembleDebug
```

Canonical `npm test` checks Rust formatting, strict Clippy warnings, Rust unit and shared-contract tests, browser-domain suites, real Chromium storage-failure journeys, CI/Pages policy, and recursive web/tool/service-worker syntax. CI also runs `npm run android:test` in a separate cached Temurin 21 job.

## Continuous improve workflow

```text
/workflow aily-improve
/workflow aily-improve {"cycles": 2}
/workflow aily-improve {"dry_run": true}
/workflow aily-improve {"focus": "time consciousness intentional pause"}
```

Each cycle: orient → parallel discover (5 lenses) → select one fix → implement → `npm test` + claim check → update `PROGRESS.md`.  
North star: seamless local ally; conscious of time; help the user ask whether they really want to be doing this.
