import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ci = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");
const pages = readFileSync(join(root, ".github/workflows/pages.yml"), "utf8");
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const gate = packageJson.scripts?.test || "";
let assertions = 0;

function check(source, pattern, message) {
  assert.match(source, pattern, message);
  assertions += 1;
}

check(ci, /^name:\s*ci\s*$/m, "CI has a stable name");
check(ci, /push:\s*\n\s+branches:\s*\[main\]/, "CI runs on main pushes");
check(ci, /^\s{2}pull_request:\s*$/m, "CI runs on pull requests");
check(ci, /permissions:\s*\n\s+contents:\s*read/, "CI has read-only repository access");
check(ci, /concurrency:[\s\S]*group:\s*ci-.*github\.workflow.*github\.ref/, "CI groups duplicate ref runs");
check(ci, /cancel-in-progress:\s*true/, "CI cancels stale runs");
check(ci, /timeout-minutes:\s*10/, "CI has a bounded timeout");
check(ci, /uses:\s*actions\/checkout@v7/, "CI uses checkout v7");
check(ci, /uses:\s*actions\/setup-node@v7/, "CI uses setup-node v7");
check(ci, /node-version:\s*["']24["']/, "CI uses Node 24 LTS");
check(ci, /uses:\s*dtolnay\/rust-toolchain@stable[\s\S]*components:\s*rustfmt,\s*clippy/, "CI installs rustfmt and Clippy");
check(ci, /run:\s*npm test\b/, "CI runs the canonical local gate");

const androidJob = ci.split("\n  android-test:\n")[1];
assert.ok(androidJob, "CI has a separate Android unit-test job");
assertions += 1;
check(androidJob, /runs-on:\s*ubuntu-latest/, "Android tests use a hosted Linux runner");
check(androidJob, /timeout-minutes:\s*15/, "Android tests have a bounded timeout");
check(androidJob, /uses:\s*actions\/checkout@v7/, "Android tests use checkout v7");
check(androidJob, /uses:\s*actions\/setup-node@v7/, "Android tests use setup-node v7");
check(androidJob, /node-version:\s*["']24["']/, "Android sync uses Node 24 LTS");
check(androidJob, /cache:\s*npm/, "Android tests cache locked npm dependencies");
check(androidJob, /run:\s*npm ci --ignore-scripts\b/, "Android tests install exact Capacitor dependencies");
check(androidJob, /run:\s*npx cap sync android\b/, "Android tests regenerate ignored Capacitor inputs");
check(androidJob, /uses:\s*actions\/setup-java@v5/, "Android tests use setup-java v5");
check(androidJob, /distribution:\s*["']?temurin["']?/, "Android tests use Temurin");
check(androidJob, /java-version:\s*["']21["']/, "Android tests use JDK 21");
check(androidJob, /cache:\s*["']?gradle["']?/, "Android tests cache Gradle dependencies");
check(androidJob, /working-directory:\s*android/, "Android tests run from the native project");
check(
  androidJob,
  /run:\s*\.\/gradlew :app:testDebugUnitTest --no-daemon\b/,
  "Android tests run the JVM suite without a persistent daemon",
);
assert(
  androidJob.indexOf("npm ci --ignore-scripts") < androidJob.indexOf("npx cap sync android")
    && androidJob.indexOf("npx cap sync android") < androidJob.indexOf("./gradlew"),
  "Android dependencies and generated inputs must exist before Gradle runs",
);
assertions += 1;

check(gate, /cargo fmt --all -- --check/, "local gate enforces Rust formatting");
check(gate, /cargo clippy --all-targets --all-features -- -D warnings/, "local gate enforces strict Clippy");
check(gate, /cargo test/, "local gate runs Rust tests");
check(gate, /node tools\/test-target\.mjs/, "local gate runs target progress tests");
check(gate, /node tools\/test-usage\.mjs/, "local gate runs usage helper tests");
check(gate, /node tools\/test-platform-usage\.mjs/, "local gate runs platform usage adapter tests");
check(gate, /node tools\/test-block\.mjs/, "local gate runs block helper tests");
check(gate, /node tools\/test-ally\.mjs/, "local gate runs ally propose tests");
check(gate, /node tools\/test-ally-rust-contract\.mjs/, "local gate runs ally shared contract tests");
check(gate, /node tools\/test-journey\.mjs/, "local gate runs journey helper tests");
check(gate, /node tools\/test-service-worker\.mjs/, "local gate runs service-worker ownership tests");
check(gate, /node tools\/test-shell\.mjs/, "local gate runs shell integrity tests");
check(gate, /node tools\/test-workflows\.mjs/, "local gate enforces workflow policy");
check(gate, /find apps\/web\/js[\s\S]*node --check/, "local gate syntax-checks every web module");
check(gate, /find tools[\s\S]*node --check/, "local gate syntax-checks every test tool");
check(gate, /node --check apps\/web\/sw\.js/, "local gate syntax-checks the service worker");

check(pages, /^name:\s*pages\s*$/m, "Pages has a stable name");
check(pages, /permissions:[\s\S]*contents:\s*read[\s\S]*pages:\s*write[\s\S]*id-token:\s*write/, "Pages has only required deploy permissions");
check(pages, /concurrency:[\s\S]*group:\s*pages[\s\S]*cancel-in-progress:\s*true/, "Pages cancels stale deployments");
check(pages, /timeout-minutes:\s*10/, "Pages job has a bounded timeout");
check(pages, /uses:\s*actions\/checkout@v7/, "Pages uses checkout v7");
check(pages, /uses:\s*actions\/configure-pages@v6/, "Pages uses configure-pages v6");
check(pages, /uses:\s*actions\/upload-pages-artifact@v5/, "Pages uses upload-pages-artifact v5");
check(pages, /uses:\s*actions\/deploy-pages@v5/, "Pages uses deploy-pages v5");
check(pages, /cp -a apps\/web\/\. _site\//, "Pages stages only the web app at site root");
check(pages, /path:\s*_site/, "Pages uploads the staged site only");

assert.doesNotMatch(
  `${ci}\n${pages}`,
  /actions\/(?:checkout|setup-node)@v4|node-version:\s*["']20["']|upload-pages-artifact@v3/,
  "deprecated action and Node majors stay removed",
);
assertions += 1;

console.log(`test-workflows.mjs: ${assertions} CI/Pages policy assertions passed`);
