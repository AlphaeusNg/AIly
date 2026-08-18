import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createStaticServer, parseServeArgs, resolveSafePath } from "./serve-static.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const web = join(root, "apps/web");
let assertions = 0;

function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}

const parsed = parseServeArgs(["--port", "9123", "--root", web, "--host", "127.0.0.1"]);
assert.equal(parsed.port, 9123);
assert.equal(parsed.host, "127.0.0.1");
assert.equal(parsed.root, web);
assertions += 3;

assert.throws(() => parseServeArgs(["--port", "0"]), /invalid port/);
assert.throws(() => parseServeArgs(["--port", "65536"]), /invalid port/);
assertions += 2;

const indexPath = resolveSafePath(web, "/");
assert.equal(indexPath, join(web, "index.html"));
assert.equal(resolveSafePath(web, "/manifest.webmanifest"), join(web, "manifest.webmanifest"));
assert.equal(resolveSafePath(web, "/css/app.css"), join(web, "css/app.css"));
assert.equal(resolveSafePath(web, "/%2e%2e/package.json"), join(web, "package.json"));
assert.equal(resolveSafePath(web, "/..\\..\\package.json"), null);
assert.equal(resolveSafePath(web, "/%00hidden"), null);
assertions += 6;

const fixture = mkdtempSync(join(tmpdir(), "aily-serve-"));
try {
  writeFileSync(join(fixture, "index.html"), "<!doctype html><title>AIly preview</title>");
  writeFileSync(join(fixture, "manifest.webmanifest"), '{"name":"AIly"}');
  const server = createStaticServer({ root: fixture });
  await new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", (err) => (err ? reject(err) : resolve()));
  });
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  try {
    const home = await fetch(`${base}/`);
    assert.equal(home.status, 200);
    assert.match(home.headers.get("content-type") || "", /text\/html/);
    assert.match(await home.text(), /AIly preview/);

    const manifest = await fetch(`${base}/manifest.webmanifest`);
    assert.equal(manifest.status, 200);
    assert.match(manifest.headers.get("content-type") || "", /application\/manifest\+json/);

    const missing = await fetch(`${base}/no-such-file`);
    assert.equal(missing.status, 404);

    const blocked = await fetch(`${base}/..%5c..%5cpackage.json`);
    assert.equal(blocked.status, 403);
    assertions += 7;
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
} finally {
  rmSync(fixture, { recursive: true, force: true });
}

check(true, "fixture server cleaned up");
console.log(`test-serve-static.mjs: ${assertions} assertions passed`);
