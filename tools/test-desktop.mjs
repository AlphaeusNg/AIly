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
  "src-tauri/src/windows_usage.rs",
  "src-tauri/capabilities/default.json",
  "src-tauri/icons/32x32.png",
  "src-tauri/icons/128x128.png",
  "src-tauri/icons/128x128@2x.png",
  "src-tauri/icons/icon.ico",
  "tools/test-windows-installer.ps1",
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
assert.match(cargo, /windows-sys\s*=/, "Windows foreground usage uses the checked-in Win32 binding");
assert.doesNotMatch(cargo, /aily-core/, "first installer does not compile aily-core into the shell");

const packageJson = JSON.parse(read("package.json"));
assert.equal(confVersion(cargo), packageJson.version, "desktop and npm package versions match");
assert.equal(
  packageJson.scripts["desktop:icons"],
  "python3 tools/gen-tauri-icons.py",
  "desktop icons use the checked-in generator",
);
const iconGenerator = read("tools/gen-tauri-icons.py");
assert.match(iconGenerator, /@tauri-apps\/cli@2\.11\.4/, "icon generation pins the Tauri CLI");
assert.doesNotMatch(iconGenerator, /struct\.pack|write_bytes/, "icon generation does not hand-build ICO files");

for (const [rel, width, height] of [
  ["src-tauri/icons/32x32.png", 32, 32],
  ["src-tauri/icons/128x128.png", 128, 128],
  ["src-tauri/icons/128x128@2x.png", 256, 256],
]) {
  const meta = pngMeta(readFileSync(join(root, rel)));
  assert.deepEqual(
    meta,
    { width, height, bitDepth: 8 },
    `${rel} contains a correctly sized 8-bit PNG that Tauri can compile`,
  );
}
const icoImages = icoPngMetas(readFileSync(join(root, "src-tauri/icons/icon.ico")));
assert.ok(icoImages.length >= 1, "Windows ICO contains PNG images");
assert.ok(icoImages.some(({ width, height }) => width === 256 && height === 256), "Windows ICO contains a 256px image");
assert.ok(icoImages.every(({ bitDepth }) => bitDepth === 8), "every Windows ICO image uses Tauri-compatible 8-bit PNGs");

const conf = JSON.parse(read("src-tauri/tauri.conf.json"));
assert.equal(conf.productName, "AIly");
assert.equal(conf.version, packageJson.version, "Tauri config and npm package versions match");
assert.equal(conf.identifier, "com.alphaeusng.aily");
assert.equal(conf.build.frontendDist, "../apps/web");
assert.deepEqual(conf.bundle.targets, ["nsis"]);
assert.equal(conf.app.windows[0].label, "main");
assert.equal(conf.app.withGlobalTauri, true, "vanilla JS receives Tauri's documented global invoke bridge");
assert.equal(conf.bundle.windows.nsis.installMode, "currentUser");
assert.notEqual(
  conf.app.windows[0].title,
  "AIly — Ready",
  "the configured fallback title cannot counterfeit frontend readiness",
);
const csp = Object.fromEntries(
  String(conf.app.security.csp || "")
    .split(";")
    .map((directive) => directive.trim().split(/\s+/))
    .filter(([name]) => name)
    .map(([name, ...sources]) => [name, sources]),
);
assert.deepEqual(csp["default-src"], ["'self'"], "desktop content defaults to its packaged origin");
assert.deepEqual(csp["script-src"], ["'self'"], "desktop scripts reject inline and remote execution");
assert.deepEqual(
  csp["connect-src"],
  ["'self'", "ipc:", "http://ipc.localhost"],
  "desktop connections are limited to packaged content and Tauri IPC",
);
assert.deepEqual(csp["object-src"], ["'none'"], "desktop plugins are disabled");
assert.deepEqual(csp["frame-src"], ["'none'"], "desktop frames are disabled");
assert.deepEqual(csp["base-uri"], ["'none'"], "desktop base URL rewriting is disabled");
assert.deepEqual(csp["worker-src"], ["'self'"], "desktop workers stay on the packaged origin");
assert.ok(!String(conf.app.security.csp).includes("'unsafe-eval'"), "desktop CSP never permits eval");

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
  /Test Windows native contracts[\s\S]*cargo test --manifest-path src-tauri\/Cargo\.toml[\s\S]*Build NSIS installer/,
  "native unit tests run before the Windows installer build",
);
assert.match(
  workflow,
  /release:[\s\S]*if:\s*startsWith\(github\.ref, 'refs\/tags\/'\)[\s\S]*permissions:\s*\n\s+contents:\s*write/,
  "only the tag release job receives contents write",
);

const desktopLib = read("src-tauri/src/lib.rs");
assert.match(desktopLib, /WindowsUsageState/, "desktop manages native usage state");
assert.match(desktopLib, /set_windows_usage_tracking/, "desktop registers the consent command");
assert.match(desktopLib, /list_windows_session_usage/, "desktop registers the aggregate command");
assert.match(desktopLib, /fn desktop_ready/, "desktop exposes a side-effect-free readiness handshake");
assert.match(desktopLib, /AIly frontend ready/, "desktop readiness uses a fixed native acknowledgement");
assert.match(
  desktopLib,
  /set_title\("AIly — Ready"\)/,
  "the readiness command marks the actual native window for lifecycle verification",
);
const desktopApp = read("apps/web/js/app.js");
assert.match(desktopApp, /invoke\("desktop_ready"\)/, "frontend proves the native bridge is callable");
assert.match(desktopApp, /document\.title\s*=\s*"AIly — Ready"/, "successful IPC marks the window ready");
const windowsUsage = read("src-tauri/src/windows_usage.rs");
assert.match(windowsUsage, /GetForegroundWindow/, "monitor samples only the foreground window");
assert.match(windowsUsage, /QueryFullProcessImageNameW/, "monitor resolves the foreground process executable");
assert.doesNotMatch(windowsUsage, /GetWindowText/, "monitor never collects window titles");
assert.match(windowsUsage, /consented/, "native reads retain an explicit consent boundary");
assert.match(windowsUsage, /MAX_SAMPLES:\s*usize\s*=\s*50/, "native output has a hard row cap");
assert.match(workflow, /actions\/upload-artifact@v7/, "installer uses current artifact upload");
assert.match(workflow, /actions\/download-artifact@v8/, "release downloads the verified installer artifact");
assert.match(workflow, /softprops\/action-gh-release@v3/, "tag builds use current release publishing");
assert.match(
  workflow,
  /Test installed AIly[\s\S]*tools\/test-windows-installer\.ps1[\s\S]*actions\/upload-artifact@v7/,
  "Windows install, launch, and uninstall smoke runs before artifact upload",
);

const installerSmoke = read("tools/test-windows-installer.ps1");
assert.match(installerSmoke, /InstallerPath/, "smoke receives the staged installer path");
assert.match(installerSmoke, /ArgumentList\s+"\/S"/, "smoke runs the installer silently");
assert.match(installerSmoke, /MainWindowTitle/, "smoke waits for a real AIly window");
assert.match(
  installerSmoke,
  /MainWindowTitle\s+-ne\s+"AIly — Ready"/,
  "smoke requires the frontend-and-IPC readiness title",
);
assert.match(installerSmoke, /UninstallString/, "smoke uses the installed app's own uninstaller");
assert.match(installerSmoke, /Test-Path/, "smoke verifies installed files and cleanup");

const readme = read("README.md");
assert.match(readme, /AIly-setup\.exe/, "README names the Windows package");
assert.match(readme, /releases\/latest\/download\/AIly-setup\.exe/, "README offers the direct latest Windows asset");
assert.match(readme, /unsigned/i, "README says the first package is unsigned");
assert.match(readme, /PWA/, "README still documents the PWA path");
assert.match(readme, /process names only/i, "README bounds Windows usage data");

const install = read("docs/install-windows-android.md");
assert.match(install, /AIly-setup\.exe/, "install doc names the Windows package");
assert.match(install, /releases\/latest\/download\/AIly-setup\.exe/, "install doc offers the direct latest Windows asset");
assert.match(install, /not the same product surface/, "install doc keeps PWA / package / preview distinct");
assert.match(install, /SmartScreen/, "install doc warns about unsigned SmartScreen");
assert.match(install, /since (AIly opened|launch)/i, "install doc says Windows totals are session-scoped");
assert.match(install, /never reads window titles/i, "install doc states the Windows privacy boundary");

const privacy = read("docs/privacy.md");
assert.match(privacy, /foreground process every five seconds/i, "privacy doc states the sample cadence");
assert.match(privacy, /never window titles or full executable paths/i, "privacy doc states excluded Windows data");
assert.match(privacy, /stops and clears native totals on revoke/i, "privacy doc states revocation behavior");

console.log("test-desktop.mjs: Tauri Windows scaffold contracts ok");

function confVersion(cargoSource) {
  return cargoSource.match(/\[package\][\s\S]*?\nversion\s*=\s*"([^"]+)"/)?.[1];
}

function pngMeta(bytes, offset = 0) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.ok(bytes.subarray(offset, offset + signature.length).equals(signature), "asset contains a PNG payload");
  assert.equal(bytes.subarray(offset + 12, offset + 16).toString("ascii"), "IHDR");
  return {
    width: bytes.readUInt32BE(offset + 16),
    height: bytes.readUInt32BE(offset + 20),
    bitDepth: bytes[offset + 24],
  };
}

function icoPngMetas(bytes) {
  assert.equal(bytes.readUInt16LE(0), 0, "ICO reserved header is zero");
  assert.equal(bytes.readUInt16LE(2), 1, "asset is a Windows icon");
  const count = bytes.readUInt16LE(4);
  return Array.from({ length: count }, (_, index) => {
    const entry = 6 + index * 16;
    const payloadOffset = bytes.readUInt32LE(entry + 12);
    return pngMeta(bytes, payloadOffset);
  });
}
