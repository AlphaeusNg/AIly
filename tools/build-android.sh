#!/usr/bin/env bash
# Build AIly debug APK (Linux/WSL). Requires Android SDK + JDK with javac.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

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

npx cap sync android
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
(cd android && ./gradlew assembleDebug ${JAVA_HOME:+-Dorg.gradle.java.home="$JAVA_HOME"})
mkdir -p dist
cp -f android/app/build/outputs/apk/debug/app-debug.apk "dist/AIly-0.1.0-debug.apk"
echo "Built dist/AIly-0.1.0-debug.apk"
ls -lh "dist/AIly-0.1.0-debug.apk"
