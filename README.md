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

### Windows (fastest)

1. After deploy: open **Edge/Chrome** → [https://alphaeusng.github.io/AIly/](https://alphaeusng.github.io/AIly/)
2. **Install app** (PWA) → runs in its own window.
3. Or clone on Windows and double-click `tools\serve-windows.bat` (needs Python or Node).

### Android

1. Chrome → same GitHub Pages URL → **Install app** / Add to Home screen.  
2. Or install the debug APK from [Releases](https://github.com/AlphaeusNg/AIly/releases) (`AIly-*-debug.apk`).  
   - Enable “Install unknown apps” for your file manager if needed.

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
npm test

# Android (needs Android SDK + JDK)
export ANDROID_HOME=$HOME/Android/Sdk   # or your SDK path
export JAVA_HOME=$HOME/.local/jdk-21    # or system JDK
npx cap sync android
cd android && ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

The canonical `npm test` gate checks Rust formatting, strict Clippy warnings,
Rust unit and shared-contract tests, browser-domain suites, CI/Pages policy,
and recursive web, tool, and service-worker syntax.

## Repo layout

| Path | Role |
|---|---|
| `apps/web` | PWA UI (tutorial, targets, Today, blocks…) |
| `android/` | Capacitor Android shell |
| `crates/aily-core` | Rust domain (capacity, replan, tutorial gates) |
| `docs/` | Architecture, install, privacy, blocking |
| `dist/` | Local build artifacts (not always committed) |

## Status

**Phase 0 dogfood executable shell** (`2026.08.11.75`):

- Boot splash + brand assets, PWA install/update banners, offline page  
- Time-consciousness meter + intentional check before ≥30m commitments  
- Daily intention check-in + focus sessions (soft-arm / auto-disarm)  
- **Local propose-only ally planner** (JS + Rust) — Ask AIly to propose a plan  
- Clone yesterday, must-keep / priority controls, target pause/complete  
- In-app attention tracker + honesty prompt for off-limits app samples  
- Break-glass countdown + configurable delay; try-open simulation  
- Weekly journey stats + reflection; evening review badges  
- Display density / reduce-motion; keyboard help (`?`, `Esc`, `1–7`)  
- Safe local persist, prune, export/import/share backup  
- Android: `npx cap sync android && npm run android:build` · `npm run android:test`  
- Setup → **Load sample journey** for instant dogfood  
- Local web: `npm run web` · gate: `npm test`

**Later:** real OS usage tracking + hard app blocking; sealed DB; optional local AI.

## Docs

- [Windows & Android install](docs/install-windows-android.md)
- [Architecture](docs/architecture.md)
- [Tutorial](docs/tutorial.md)
- [Privacy](docs/privacy.md)
- [Blocking](docs/blocking.md)
- Plan: `/home/alph/projects/plans/aily-heavy-plan.md`

## License

MIT — see [LICENSE](LICENSE).
