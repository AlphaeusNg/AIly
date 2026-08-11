import assert from "node:assert/strict";
import {
  createAndroidUsageBackendStub,
  createWebSessionBackend,
  selectUsageBackend,
  usageBackendHonesty,
} from "../apps/web/js/platform-usage.js";

const web = createWebSessionBackend();
assert.equal(web.id, "web-session");
assert.equal(web.capabilities.session, true);
assert.equal(await web.requestPermission(), "granted");
assert.deepEqual(await web.listTodaySamples(), []);

const android = createAndroidUsageBackendStub();
assert.equal(android.id, "android-usagestats");
assert.equal(android.capabilities.perApp, true);
assert.equal(await android.requestPermission(), "unsupported");

assert.equal(selectUsageBackend({ isNative: false }).id, "web-session");
assert.equal(
  selectUsageBackend({ isNative: true, platform: "android" }).id,
  "android-usagestats"
);
assert.equal(selectUsageBackend({ isNative: true, platform: "ios" }).id, "web-session");

assert.match(usageBackendHonesty(web), /tab only/i);
assert.match(usageBackendHonesty(android), /not installed/i);

console.log("test-platform-usage.mjs: usage backend boundary ok");
