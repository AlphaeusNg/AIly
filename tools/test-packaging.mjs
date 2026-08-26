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
const checksumUrl = "https://github.com/AlphaeusNg/AIly/releases/latest/download/SHA256SUMS.txt";

const androidVersion = android.match(/versionName\s+["']([^"']+)["']/)?.[1];
assert.equal(
  androidVersion,
  packageJson.version,
  "Android versionName matches the shipped package version",
);
assert.match(android, /versionCode\s+[1-9]\d*/, "Android versionCode is positive");

assert.match(workflow, /^name:\s*packages\s*$/m, "the combined workflow has a package-wide identity");
assert.match(
  workflow,
  /group:\s*packages-complete-\$\{\{ github\.workflow \}\}-\$\{\{ github\.ref \}\}-\$\{\{ github\.sha \}\}/,
  "duplicate package runs for one commit share a non-preemptible group",
);
assert.match(
  workflow,
  /cancel-in-progress:\s*false/,
  "a duplicate delivery cannot starve the Windows install lifecycle proof",
);
assert.match(
  workflow,
  /paths:[\s\S]*tools\/test-windows-installer\.ps1/,
  "Windows lifecycle-probe changes trigger real package verification",
);
assert.match(workflow, /uses:\s*actions\/cache@v5/, "Windows Cargo caching uses the official Node 24 action");
assert.match(
  workflow,
  /path:\s*\|\s*\n\s+~\/.cargo\/registry\s*\n\s+~\/.cargo\/git\s*\n\s+src-tauri\/target/,
  "Windows caching covers Cargo downloads and compiled outputs",
);
assert.match(
  workflow,
  /key:\s*windows-tauri-v1-\$\{\{ runner\.os \}\}-\$\{\{ runner\.arch \}\}-\$\{\{ hashFiles\('src-tauri\/Cargo\.lock'\) \}\}/,
  "the Windows cache is isolated by schema, OS, architecture, and exact dependency lock",
);
assert.match(
  workflow,
  /restore-keys:\s*\|\s*\n\s+windows-tauri-v1-\$\{\{ runner\.os \}\}-\$\{\{ runner\.arch \}\}-/,
  "dependency changes may reuse only same-platform Cargo work",
);
assert.doesNotMatch(workflow, /enableCrossOsArchive:\s*true/, "Windows build outputs never cross OS boundaries");
assert.match(
  workflow,
  /Restore Windows Cargo cache[\s\S]*Clear cached final package outputs[\s\S]*Test Windows native contracts[\s\S]*Build NSIS installer/,
  "cached final binaries are removed before unconditional native tests and rebuild",
);
assert.match(
  workflow,
  /Remove-Item[^\n]*release\/aily-desktop\.exe[\s\S]*Remove-Item[^\n]*release\/bundle/,
  "cache reuse cannot supply the final executable or installer bundle",
);
assert.doesNotMatch(
  workflow,
  /if:\s*steps\.cargo-cache\.outputs\.cache-hit/,
  "cache hits never skip verification or packaging",
);
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
assert.match(
  workflow,
  /working-directory:\s*dist[\s\S]*sha256sum AIly-setup\.exe AIly-debug\.apk > SHA256SUMS\.txt/,
  "tag releases generate one checksum manifest from both tested packages",
);
assert.match(
  workflow,
  /files:[\s\S]*dist\/AIly-setup\.exe[\s\S]*dist\/AIly-debug\.apk[\s\S]*dist\/SHA256SUMS\.txt/,
  "tag releases attach the checksum manifest beside both packages",
);
assert.ok(
  workflow.indexOf("sha256sum AIly-setup.exe AIly-debug.apk")
    < workflow.indexOf("softprops/action-gh-release@v3"),
  "checksums are generated before release publication",
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
  assert.match(source, new RegExp(checksumUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${label} links the published checksum manifest`);
}
assert.match(installGuide, /Get-FileHash[^\n]*AIly-setup\.exe[^\n]*SHA256/, "install guide verifies the Windows package with PowerShell");
assert.match(installGuide, /sha256sum -c SHA256SUMS\.txt --ignore-missing/, "install guide verifies transferred packages with sha256sum");

console.log("test-packaging.mjs: Android version, verified build, release, and docs contracts ok");
