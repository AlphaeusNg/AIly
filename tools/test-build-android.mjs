/** Run the production build helper against a tiny, isolated toolchain fixture. */
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const fixture = mkdtempSync(join(tmpdir(), "aily-build-helper-"));
try {
  for (const dir of ["tools", "bin", "sdk/platforms", "android/app/build/outputs/apk/debug", "dist"]) {
    mkdirSync(join(fixture, dir), { recursive: true });
  }
  copyFileSync(new URL("./build-android.sh", import.meta.url), join(fixture, "tools/build-android.sh"));
  writeFileSync(join(fixture, "package.json"), JSON.stringify({ version: "9.8.7" }));
  const executable = (path, source) => writeFileSync(join(fixture, path), `#!/bin/sh\nset -eu\n${source}\n`, { mode: 0o755 });
  executable("bin/javac", "exit 0");
  executable("bin/npx", 'test "$*" = "cap sync android"');
  executable("android/gradlew", 'test "$1" = "assembleDebug"; printf built-apk > app/build/outputs/apk/debug/app-debug.apk');
  executable("tools/verify-android-apk.sh", `test "$1" = "android/app/build/outputs/apk/debug/app-debug.apk"
 test "$2" = "9.8.7"
 test "$(cat "$1")" = "built-apk"
 test "$(cat dist/AIly-debug.apk)" = "previous-apk"
 if [ "\${FAIL_VERIFY:-0}" = "1" ]; then exit 1; fi`);
  const env = { ...process.env, ANDROID_HOME: join(fixture, "sdk"), JAVA_HOME: join(fixture), PATH: `${join(fixture, "bin")}:${process.env.PATH}` };
  const run = (extra = {}) => spawnSync("bash", ["tools/build-android.sh"], { cwd: fixture, env: { ...env, ...extra }, encoding: "utf8" });
  const staged = join(fixture, "dist/AIly-debug.apk");
  writeFileSync(staged, "previous-apk");
  const failure = run({ FAIL_VERIFY: "1" });
  assert.notEqual(failure.status, 0, "verification failures stop staging");
  assert.equal(readFileSync(staged, "utf8"), "previous-apk", "failed verification preserves the previous artifact");
  const success = run();
  assert.equal(success.status, 0, success.stderr);
  assert.equal(readFileSync(staged, "utf8"), "built-apk", "verified APK uses the canonical release asset name");
  assert.match(success.stdout, /AIly-debug\.apk \(9\.8\.7\)/, "output names the package's current version");
  assert.equal(readFileSync(join(fixture, "android/local.properties"), "utf8"), `sdk.dir=${join(fixture, "sdk")}\n`);
  console.log("test-build-android.mjs: current version, canonical asset, verification and failure preservation passed");
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
