import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");
const packageJson = JSON.parse(read("package.json"));
const android = read("android/app/build.gradle");
const workflow = read(".github/workflows/windows-installer.yml");
const readme = read("README.md");
const installGuide = read("docs/install-windows-android.md");

const androidVersion = android.match(/versionName\s+["']([^"']+)["']/)?.[1];
assert.equal(
  androidVersion,
  packageJson.version,
  "Android versionName matches the shipped package version",
);
assert.match(android, /versionCode\s+[1-9]\d*/, "Android versionCode is positive");

assert.match(workflow, /^\s{2}android-apk:\s*$/m, "packaging has an Android APK job");
assert.match(workflow, /permissions:\s*\n\s+contents:\s*read/, "packaging defaults to read-only access");
assert.match(workflow, /android-apk:[\s\S]*timeout-minutes:\s*20/, "the APK job has a bounded timeout");
assert.match(workflow, /android-apk:[\s\S]*actions\/checkout@v7/, "the APK job uses checkout v7");
assert.match(workflow, /android-apk:[\s\S]*actions\/setup-node@v7[\s\S]*node-version:\s*["']24["']/, "the APK job uses Node 24");
assert.match(workflow, /android-apk:[\s\S]*actions\/setup-java@v5[\s\S]*java-version:\s*["']21["']/, "the APK job uses JDK 21");
assert.match(workflow, /android-apk:[\s\S]*npm ci --ignore-scripts[\s\S]*npx cap sync android/, "the APK job uses locked dependencies before Capacitor sync");
assert.match(
  workflow,
  /android-apk:[\s\S]*\.\/gradlew :app:testDebugUnitTest :app:assembleDebug --no-daemon/,
  "the APK job tests and assembles one Gradle invocation",
);
assert.match(workflow, /dist\/AIly-debug\.apk/, "the APK has a stable release asset name");
assert.match(
  workflow,
  /verify-android-apk\.sh[\s\S]*actions\/upload-artifact@v7/,
  "APK structure is verified before artifact upload",
);
assert.match(
  workflow,
  /release:[\s\S]*needs:\s*\[nsis, android-apk\][\s\S]*actions\/download-artifact@v8[\s\S]*AIly-debug\.apk/,
  "tag releases require and attach both verified packages",
);
assert.match(
  workflow,
  /release:[\s\S]*permissions:\s*\n\s+contents:\s*write/,
  "only the tag release job receives package publishing access",
);

const verifier = read("tools/verify-android-apk.sh");
assert.match(verifier, /unzip -tqq/, "APK verifier checks the archive");
assert.match(verifier, /aapt[^\n]*dump badging/, "APK verifier reads packaged metadata");
assert.match(verifier, /com\.alphaeusng\.aily/, "APK verifier checks the application ID");
assert.match(verifier, /versionName/, "APK verifier checks the packaged version");
assert.match(verifier, /apksigner[^\n]*verify/, "APK verifier checks the package signature");

for (const [label, source] of [
  ["README", readme],
  ["install guide", installGuide],
]) {
  assert.match(
    source,
    /releases\/latest\/download\/AIly-debug\.apk/,
    `${label} offers the direct latest Android package`,
  );
  assert.match(source, /debug/i, `${label} identifies the APK as a debug build`);
}

console.log("test-packaging.mjs: Android version, verified build, release, and docs contracts ok");
