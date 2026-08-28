# AIly

**Your AI Ally** (written **AIly**, spoken *AY-lee*). A local-first companion for the **targets you set**.

**[Open the PWA](https://alphaeusng.github.io/AIly/)** · [Windows installer](https://github.com/AlphaeusNg/AIly/releases/latest/download/AIly-setup.exe) · [Android APK](https://github.com/AlphaeusNg/AIly/releases/latest/download/AIly-debug.apk)

The hosted app *is* the demo. Install it, or use **Load sample journey** to see a day of targets without setup.

AIly walks you through setup (no terminal), tracks the journey, can watch app usage (with consent), and block distractions you already decided are off-limits. Accountability for productivity, not moral filtering. Data stays on the device.

## Try it

**Fastest:** Chrome or Edge → [https://alphaeusng.github.io/AIly/](https://alphaeusng.github.io/AIly/) → **Install app**. Then **Load sample journey**.

**Windows:** download [`AIly-setup.exe`](https://github.com/AlphaeusNg/AIly/releases/latest/download/AIly-setup.exe) (unsigned dogfood; SmartScreen may warn). That is a Start Menu app wrapping the same UI, not OS hard-blocks.

**Android:** same URL → Add to Home screen, or the [debug APK](https://github.com/AlphaeusNg/AIly/releases/latest/download/AIly-debug.apk). Verify hashes with [`SHA256SUMS.txt`](https://github.com/AlphaeusNg/AIly/releases/latest/download/SHA256SUMS.txt).

PWA, `.exe`, and APK are three different things. The PWA will not give you OS admin or app blocks.

## What is in this phase

Dogfood shell (`2026.08.27.1`): boot splash, daily intention, focus sessions, a local propose-only planner, Today targets, consent-gated usage totals on Android and Windows, weekly journey stats, export/import backup. Later: OS hard-blocks, sealed DB, optional local AI.

## Docs

- [Windows and Android install](docs/install-windows-android.md)
- [Architecture](docs/architecture.md)
- [Tutorial](docs/tutorial.md)
- [Privacy](docs/privacy.md)
- [Blocking](docs/blocking.md)

## Develop

```bash
cd apps/web
python3 -m http.server 8765
# http://127.0.0.1:8765/

npm ci
npx playwright install chromium
npm test
```

`apps/web` is the PWA UI (and Tauri frontend). `src-tauri/` builds the Windows NSIS installer. `android/` is the Capacitor shell. `crates/aily-core` is the Rust domain.

MIT. See [LICENSE](LICENSE).
