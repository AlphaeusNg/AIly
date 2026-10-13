#!/usr/bin/env bash
# Build and verify AIly debug APK (Linux/WSL). Requires Android SDK + full JDK.
set -euo pipefail
build_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$build_root"

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
if [ -x "$HOME/.local/jdk-21/bin/javac" ]; then
  export JAVA_HOME="${JAVA_HOME:-$HOME/.local/jdk-21}"
fi
export PATH="${JAVA_HOME:+$JAVA_HOME/bin:}$PATH:${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools"

if ! command -v javac >/dev/null; then
  echo "javac not found. Install a full JDK (not JRE-only)." >&2
  exit 1
fi
if [ ! -d "$ANDROID_HOME/platforms" ]; then
  echo "ANDROID_HOME incomplete: $ANDROID_HOME" >&2
  exit 1
fi

package_version="$(node -p "require('./package.json').version")"
npx cap sync android
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
(cd android && ./gradlew assembleDebug ${JAVA_HOME:+-Dorg.gradle.java.home="$JAVA_HOME"})
apk_source="android/app/build/outputs/apk/debug/app-debug.apk"
bash tools/verify-android-apk.sh "$apk_source" "$package_version"
mkdir -p dist
cp -f "$apk_source" dist/AIly-debug.apk
echo "Built and verified dist/AIly-debug.apk ($package_version)"
ls -lh dist/AIly-debug.apk
