import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tools/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 20_000,
  expect: { timeout: 8_000 },
  reporter: [["line"]],
  use: {
    baseURL: "http://127.0.0.1:4175",
    browserName: "chromium",
  },
  webServer: {
    command: "python3 -m http.server 4175 --directory apps/web",
    url: "http://127.0.0.1:4175/",
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
});
