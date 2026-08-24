/** Static checks for the Windows Tauri package — no WebKit / no compile. */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

const required = [
  "src-tauri/Cargo.toml",
  "src-tauri/Cargo.lock",
  "src-tauri/tauri.conf.json",
  "src-tauri/build.rs",
  "src-tauri/src/main.rs",
  "src-tauri/src/lib.rs",
  "src-tauri/capabilities/default.json",
  "src-tauri/icons/32x32.png",
  "src-tauri/icons/128x128.png",
  "src-tauri/icons/128x128@2x.png",
  "src-tauri/icons/icon.ico",
  ".github/workflows/windows-installer.yml",
];
for (const rel of required) {
  assert.ok(existsSync(join(root, rel)), `missing desktop asset: ${rel}`);
}

const workspace = read("Cargo.toml");
assert.match(workspace, /members\s*=\s*\["crates\/aily-core"\]/, "desktop crate stays out of the Linux workspace");
assert.match(
  workspace,
  /exclude\s*=\s*\["src-tauri"\]/,
  "desktop crate is explicitly excluded so standalone cargo metadata works",
);

const cargo = read("src-tauri/Cargo.toml");
assert.match(cargo, /name\s*=\s*"aily-desktop"/, "desktop package is named aily-desktop");
assert.match(cargo, /tauri\s*=/, "desktop crate depends on Tauri");
assert.doesNotMatch(cargo, /aily-core/, "first installer does not compile aily-core into the shell");

const packageJson = JSON.parse(read("package.json"));
assert.equal(confVersion(cargo), packageJson.version, "desktop and npm package versions match");

const conf = JSON.parse(read("src-tauri/tauri.conf.json"));
assert.equal(conf.productName, "AIly");
assert.equal(conf.version, packageJson.version, "Tauri config and npm package versions match");
assert.equal(conf.identifier, "com.alphaeusng.aily");
assert.equal(conf.build.frontendDist, "../apps/web");
assert.deepEqual(conf.bundle.targets, ["nsis"]);
assert.equal(conf.app.windows[0].label, "main");
assert.equal(conf.bundle.windows.nsis.installMode, "currentUser");

const caps = JSON.parse(read("src-tauri/capabilities/default.json"));
assert.deepEqual(caps.windows, ["main"]);
assert.ok(
  (caps.permissions || []).every((p) => p === "core:default" || String(p).startsWith("core:")),
  "desktop capabilities stay on core permissions — no shell"
);

const workflow = read(".github/workflows/windows-installer.yml");
assert.match(workflow, /runs-on:\s*windows-latest/, "installer builds on windows-latest");
assert.match(workflow, /AIly-setup\.exe/, "CI publishes AIly-setup.exe");
assert.match(workflow, /--bundles nsis --ci/, "CI builds the NSIS bundle without prompts");
assert.match(workflow, /@tauri-apps\/cli@2\.11\.4/, "CI pins an exact Tauri CLI");
assert.match(workflow, /permissions:\s*\n\s+contents:\s*read/, "installer defaults to read-only repository access");
assert.match(
  workflow,
  /release:[\s\S]*if:\s*startsWith\(github\.ref, 'refs\/tags\/'\)[\s\S]*permissions:\s*\n\s+contents:\s*write/,
  "only the tag release job receives contents write",
);
assert.match(workflow, /actions\/upload-artifact@v7/, "installer uses current artifact upload");
assert.match(workflow, /actions\/download-artifact@v8/, "release downloads the verified installer artifact");
assert.match(workflow, /softprops\/action-gh-release@v3/, "tag builds use current release publishing");

const readme = read("README.md");
assert.match(readme, /AIly-setup\.exe/, "README names the Windows package");
assert.match(readme, /unsigned/i, "README says the first package is unsigned");
assert.match(readme, /PWA/, "README still documents the PWA path");

const install = read("docs/install-windows-android.md");
assert.match(install, /AIly-setup\.exe/, "install doc names the Windows package");
assert.match(install, /not the same product surface/, "install doc keeps PWA / package / preview distinct");
assert.match(install, /SmartScreen/, "install doc warns about unsigned SmartScreen");

console.log("test-desktop.mjs: Tauri Windows scaffold contracts ok");

function confVersion(cargoSource) {
  return cargoSource.match(/\[package\][\s\S]*?\nversion\s*=\s*"([^"]+)"/)?.[1];
}
