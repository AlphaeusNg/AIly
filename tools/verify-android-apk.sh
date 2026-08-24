#!/usr/bin/env bash
set -euo pipefail

apk_path="${1:-}"
expected_version="${2:-}"
if [[ -z "$apk_path" || -z "$expected_version" || ! -f "$apk_path" ]]; then
  echo "Usage: $0 path/to/AIly-debug.apk expected-version" >&2
  exit 2
fi

byte_count="$(wc -c < "$apk_path")"
if (( byte_count < 100000 )); then
  echo "APK is unexpectedly small: ${byte_count} bytes" >&2
  exit 1
fi

if [[ "$(od -An -tx1 -N4 "$apk_path" | tr -d ' \n')" != "504b0304" ]]; then
  echo "APK does not begin with a ZIP local-file header" >&2
  exit 1
fi

unzip -tqq "$apk_path"
entries="$(unzip -Z1 "$apk_path")"
for required_entry in AndroidManifest.xml classes.dex resources.arsc; do
  if ! awk -v required="$required_entry" '$0 == required { found = 1 } END { exit !found }' <<< "$entries"; then
    echo "APK is missing required entry: $required_entry" >&2
    exit 1
  fi
done

sdk_root="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
if [[ -z "$sdk_root" || ! -d "$sdk_root/build-tools" ]]; then
  echo "ANDROID_HOME or ANDROID_SDK_ROOT must point to an Android SDK" >&2
  exit 1
fi

mapfile -t build_tool_dirs < <(
  find "$sdk_root/build-tools" -mindepth 1 -maxdepth 1 -type d -print | sort -V
)
if (( ${#build_tool_dirs[@]} == 0 )); then
  echo "No Android build-tools installation found" >&2
  exit 1
fi
latest_build_tools="${build_tool_dirs[${#build_tool_dirs[@]} - 1]}"
aapt_path="$latest_build_tools/aapt"
apksigner_path="$latest_build_tools/apksigner"
if [[ ! -x "$aapt_path" || ! -x "$apksigner_path" ]]; then
  echo "Latest Android build-tools lack aapt or apksigner: $latest_build_tools" >&2
  exit 1
fi

badging="$("$aapt_path" dump badging "$apk_path")"
package_line="${badging%%$'\n'*}"
if [[ "$package_line" != *"name='com.alphaeusng.aily'"* ]]; then
  echo "APK package identity is not com.alphaeusng.aily: $package_line" >&2
  exit 1
fi
if [[ "$package_line" != *"versionName='$expected_version'"* ]]; then
  echo "APK version does not match $expected_version: $package_line" >&2
  exit 1
fi
if ! signature_output="$("$apksigner_path" verify "$apk_path" 2>&1)"; then
  echo "$signature_output" >&2
  exit 1
fi

echo "Verified Android APK: com.alphaeusng.aily ${expected_version}, ${byte_count} bytes, signed"
