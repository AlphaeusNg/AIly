# AIly

**Your AI Ally** — local-first companion that helps you **achieve the targets you set**.

AIly walks you through setup (no terminal), tracks your journey, can watch app usage (with consent), and block distractions you already decided are off-limits — accountability for **productivity**, not moral filtering.

## Brand

| | |
|---|---|
| Written | **AIly** (`AI` + `ly`, capital **I**) |
| Tagline | *Your AI Ally* |
| Spoken | **AY-lee** (recommended) |

## Test on Windows & Android (you’re on WSL)

Your Ubuntu environment is **WSL** — use **Windows host** and/or a **phone** for product testing.

Full guide: **[docs/install-windows-android.md](docs/install-windows-android.md)**

### Windows

These are **three different things**. Do not collapse them:

| Path | What you get | What you do not get |
|---|---|---|
| **PWA** | Edge/Chrome “Install app”, localStorage in that browser profile | OS admin, app blocks, a Start Menu `.exe` |
| **AIly-setup.exe** | Start Menu / desktop app wrapping the same `apps/web` UI (unsigned dogfood) | SmartScreen reputation, OS hard-blocks |
| **Preview launcher** | `tools\serve-windows.bat` for local web | An installer |

1. **[Download `AIly-setup.exe`](https://github.com/AlphaeusNg/AIly/releases/latest/download/AIly-setup.exe)** directly, or inspect the [latest release notes](https://github.com/AlphaeusNg/AIly/releases/latest) first. Unsigned; SmartScreen may warn. Auto-start stays off.
2. **Or install the hosted PWA:** Edge/Chrome → [https://alphaeusng.github.io/AIly/](https://alphaeusng.github.io/AIly/) → **Install app**. Scoped to `/AIly/`.
3. **Or preview:** clone on Windows and double-click `tools\serve-windows.bat` (needs Python or Node).

### Android

1. Chrome → same GitHub Pages URL → **Install app** / Add to Home screen.  
2. Or **[download `AIly-debug.apk`](https://github.com/AlphaeusNg/AIly/releases/latest/download/AIly-debug.apk)** directly, or inspect [Releases](https://github.com/AlphaeusNg/AIly/releases) first. This is an unsigned debug build for dogfood, not a Play Store release.
   - Enable “Install unknown apps” for your file manager if needed, and install only if you trust this repository.

For either package, download [`SHA256SUMS.txt`](https://github.com/AlphaeusNg/AIly/releases/latest/download/SHA256SUMS.txt) and compare the file hash before opening it. The [install guide](docs/install-windows-android.md#verify-package-integrity) includes PowerShell and `sha256sum` commands.

### Local web (any OS)

```bash
cd apps/web
python3 -m http.server 8765
# open http://127.0.0.1:8765/
```

## Develop

```bash
source "$HOME/.cargo/env"   # if needed
npm ci
npx playwright install chromium
npm test

# Android (needs Android SDK + JDK)
export ANDROID_HOME=$HOME/Android/Sdk   # or your SDK path
export JAVA_HOME=$HOME/.local/jdk-21    # or system JDK
npx cap sync android
cd android && ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

The canonical `npm test` gate checks Rust formatting, strict Clippy warnings,
Rust unit and shared-contract tests, browser-domain suites, real Chromium
storage-failure journeys, CI/Pages policy, and recursive web, tool, and
service-worker syntax. CI also runs
`npm run android:test` in a separate cached Temurin 21 job; run it locally after
native-shell changes.

## Repo layout

| Path | Role |
|---|---|
| `apps/web` | PWA UI (tutorial, targets, Today, blocks…) — also the Tauri frontend |
| `src-tauri/` | Tauri 2 Windows shell (NSIS `AIly-setup.exe`); not a workspace member |
| `android/` | Capacitor Android shell |
| `crates/aily-core` | Rust domain (capacity, replan, tutorial gates) |
| `docs/` | Architecture, install, privacy, blocking |
| `dist/` | Local build artifacts (not always committed) |

## Status

**Phase 0 dogfood shell + first Android usage slice** (`2026.08.25.3`):

- Boot splash + brand assets, PWA install/update banners, scope-isolated offline page
- Time-consciousness meter + intentional check before ≥30m commitments  
- Daily intention check-in + focus sessions (soft-arm / auto-disarm)  
- **Local propose-only ally planner** (JS + Rust) — Ask AIly to propose a plan  
- Clone yesterday, must-keep / priority controls, target pause/complete  
- In-app attention tracker + honesty prompt for off-limits app samples  
- Capacitor Android: consent-gated local daily app totals via UsageStats
- Break-glass countdown + configurable delay; try-open simulation  
- Weekly journey stats + reflection; evening review badges  
- Display density / reduce-motion; keyboard help (`?`, `Esc`, `1–7`)  
- Safe local persist, prune, export/import/share backup  
- Android: `npx cap sync android && npm run android:build` · `npm run android:test`  
- Setup → **Load sample journey** for instant dogfood  
- Local web: `npm run web` · gate: `npm test`

- Return-from-away is a real question; accept-all shows drop/skip preview; Today can log a target number
- Windows package scaffold (`src-tauri/`) builds `AIly-setup.exe` on `windows-latest` — unsigned, no OS blocks yet

**Later:** OS usage/hard-blocks after a real Windows process exists (Ship C); sealed DB; optional local AI.

## Docs

- [Windows & Android install](docs/install-windows-android.md)
- [Architecture](docs/architecture.md)
- [Tutorial](docs/tutorial.md)
- [Privacy](docs/privacy.md)
- [Blocking](docs/blocking.md)
- Plan: `/home/alph/projects/plans/aily-heavy-plan.md`

## License

MIT — see [LICENSE](LICENSE).
