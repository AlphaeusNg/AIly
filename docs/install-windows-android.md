# Install & test AIly on Windows and Android

Your Ubuntu box is **WSL** — native desktop GUI apps (and some browser PWA installs) are awkward there. **Test on Windows host and/or an Android phone.**

Brand: **AIly** — *Your AI Ally*

These three paths are **not the same product surface**. Copy and UI must keep them distinct.

| Path | Installs as | Data | OS usage / hard blocks |
|---|---|---|---|
| Browser **PWA** | Edge/Chrome app, scoped to `/AIly/` | That browser profile (`localStorage`) | No |
| **AIly-setup.exe** (Tauri / NSIS) | Start Menu + desktop shortcut | WebView2 profile under the app’s data dir | Not in this build |
| `tools\serve-windows.bat` | Nothing — local preview server | Temporary localhost origin | No |

---

## Verify package integrity

The Windows executable is unsigned and the Android APK is a debug build. After
downloading either package, also download the release's
[`SHA256SUMS.txt`](https://github.com/AlphaeusNg/AIly/releases/latest/download/SHA256SUMS.txt)
into the same folder and compare before opening or transferring it.

Windows PowerShell (`AIly-setup.exe`):

```powershell
$expected = ((Select-String -Path .\SHA256SUMS.txt -Pattern '  AIly-setup.exe$').Line -split '\s+')[0]
$actual = (Get-FileHash .\AIly-setup.exe -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actual -ne $expected) { throw "AIly-setup.exe checksum mismatch" }
```

Linux/macOS/WSL (either or both downloaded packages):

```bash
sha256sum -c SHA256SUMS.txt --ignore-missing
```

Expect an `OK` result for every package present. A mismatch means do not install
the file; delete it and download it again from the official AIly release.

---

## Windows

### Option A — Download `AIly-setup.exe` (packaged app)

1. On **Windows**, [download **`AIly-setup.exe`** directly](https://github.com/AlphaeusNg/AIly/releases/latest/download/AIly-setup.exe), or inspect [the latest GitHub Release](https://github.com/AlphaeusNg/AIly/releases/latest) first.
2. First dogfood builds are **unsigned** — SmartScreen / “Windows protected your PC” is expected. Use **More info → Run anyway** only if you built or trust this repo.
3. Install per-user (no admin required). Auto-start is **off**.
4. Launch **AIly** from the Start Menu. Same tutorial / Today / propose loop as the web app.

This is **not** OS enforcement. Break-glass and block rules still simulate until Ship C.

Build it yourself on Windows (not WSL):

```text
cd AIly
npm ci
npx --yes @tauri-apps/cli@2 build --bundles nsis
# Artifact: src-tauri/target/release/bundle/nsis/*-setup.exe
```

`src-tauri` is **not** a Cargo workspace member so Linux `npm test` does not need WebKit GTK.

### Option B — Install as a PWA from GitHub Pages

1. On **Windows**, open **Edge** or **Chrome**.
2. Go to: `https://alphaeusng.github.io/AIly/`
3. Click **Install PWA** in the banner, or ⋮ → **Install AIly**.
4. AIly opens in its own window. Data stays in that browser profile.

The installed app identity is scoped to `/AIly/`, not the portfolio site root.

### Option C — Run from a local clone on Windows

This starts a **local preview server**. It is not a packaged installer.

1. Clone the repo on Windows (not only WSL), or copy the `apps/web` folder out of WSL:
   ```text
   \\wsl$\Ubuntu\home\alph\projects\AIly
   ```
2. Double-click `tools\serve-windows.bat`  
   (needs **Python 3** or **Node** on Windows PATH)
3. Browser opens `http://127.0.0.1:8765/`
4. Install as PWA same as Option B (localhost works for install in Chromium).

### Option D — Static open (limited)

Opening `index.html` via `file://` may break the service worker. Prefer A, B, or C.

---

## Android

### Option A — Add to Home screen (PWA)

1. Open Chrome on the phone.
2. Visit `https://alphaeusng.github.io/AIly/`
3. Menu → **Install app** / **Add to Home screen**.
4. Launch AIly from the home screen icon.

### Option B — Debug APK (Capacitor)

On Android, [download **`AIly-debug.apk`** directly](https://github.com/AlphaeusNg/AIly/releases/latest/download/AIly-debug.apk), or inspect [the latest GitHub Release](https://github.com/AlphaeusNg/AIly/releases/latest) first. This is an unsigned debug build for dogfood, not a Play Store release. Enable **Install unknown apps** only if you trust this repository.

To build the same debug package yourself with Android Studio / SDK:

```bash
# On a machine with Android Studio / SDK:
cd AIly
npm ci
npx cap sync android
cd android && ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

Install APK on a device with USB debugging, or copy the APK to the phone.

To enable Android-reported daily app totals, open **Usage**, choose **Open Android usage
access**, enable AIly in the system list, and return to the app. AIly does not
read those totals until both the in-app tutorial consent and this system grant
are present. Revoking either turns the integration off.

---

## WSL note

WSL can **develop** and **build** artifacts; **daily product testing** should be on:

- Windows package (`AIly-setup.exe`) or Windows browser/PWA, or
- Physical Android device against the hosted URL / APK.

---

## What works today vs later

| Feature | Windows PWA | Windows package | Android PWA | Capacitor APK |
|---|---|---|---|---|
| Tutorial, targets, Today, Review | yes | yes | yes | yes |
| Local data | browser profile | app data dir | browser profile | app storage |
| OS app usage tracking | not yet | not yet | not yet | current-day foreground totals (consent + Usage Access) |
| OS hard app blocks | not yet | not yet | not yet | Phase 2 / Ship C |

The web/PWA remains a complete companion loop. The Windows package wraps that
same UI. The Capacitor APK adds the first read-only native hook. Background
collection and hard enforcement remain later phases.
