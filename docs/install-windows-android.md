# Install & test AIly on Windows and Android

Your Ubuntu box is **WSL** — native desktop GUI apps (and some browser PWA installs) are awkward there. **Test on Windows host and/or an Android phone.**

Brand: **AIly** — *Your AI Ally*

---

## Windows (recommended first)

There is **no native Windows installer** (no `.exe`, `.msi`, or `.msix`) yet. The
desktop shell is still future work. “Install on Windows” means installing the
hosted **Progressive Web App** in Edge or Chrome.

### Option A — Install as app from GitHub Pages (easiest)

After this repo is on GitHub Pages:

1. On **Windows**, open **Edge** or **Chrome**.
2. Go to: `https://alphaeusng.github.io/AIly/`
3. Click **Install** / **App available** / ⋮ → **Install AIly**.
4. AIly opens in its own window (standalone PWA). Data stays in that browser profile (localStorage).

The installed app identity is scoped to `/AIly/`, not the portfolio site root.

### Option B — Run from a local clone on Windows

This starts a **local preview server**. It is not a packaged installer.

1. Clone the repo on Windows (not only WSL), or copy the `apps/web` folder out of WSL:
   ```text
   \\wsl$\Ubuntu\home\alph\projects\AIly
   ```
2. Double-click `tools\serve-windows.bat`  
   (needs **Python 3** or **Node** on Windows PATH)
3. Browser opens `http://127.0.0.1:8765/`
4. Install as PWA same as Option A (localhost works for install in Chromium).

### Option C — Static open (limited)

Opening `index.html` via `file://` may break the service worker. Prefer A or B.

---

## Android

### Option A — Add to Home screen (PWA)

1. Open Chrome on the phone.
2. Visit `https://alphaeusng.github.io/AIly/`
3. Menu → **Install app** / **Add to Home screen**.
4. Launch AIly from the home screen icon.

### Option B — Debug APK (Capacitor)

Built when Android SDK is available (see `android/` after `npx cap add android`):

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

- Windows browser/PWA, or  
- Physical Android device against the hosted URL / APK.

---

## What works today vs later

| Feature | Windows PWA | Android PWA | Capacitor APK |
|---|---|---|---|
| Tutorial, targets, Today, Review | yes | yes | yes |
| Local data (localStorage) | yes | yes | yes |
| OS app usage tracking | not yet | not yet | current-day foreground totals (consent + Usage Access) |
| OS hard app blocks | not yet | not yet | Phase 2 |

The web/PWA remains a local dogfood shell. The Capacitor APK adds the first
read-only native hook; background collection and hard enforcement remain later
phases.
