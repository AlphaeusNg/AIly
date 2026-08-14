/**
 * Platform usage adapter boundary (Phase 2 scaffold).
 * Phase 0: only the in-tab session tracker is real.
 * OS backends plug in behind the same shape — never invent cloud exfil.
 */

/** @typedef {{ app: string, mins: number, ts: string, source?: string, packageName?: string }} UsageSample */

/**
 * @returns {{
 *   id: string,
 *   label: string,
 *   available?: boolean,
 *   capabilities: { session: boolean, perApp: boolean, realtime: boolean },
 *   async listTodaySamples(): Promise<UsageSample[]>,
 *   async permissionStatus(): Promise<'granted'|'denied'|'unsupported'>,
 *   async requestPermission(): Promise<'granted'|'settings_opened'|'unsupported'>,
 * }}
 */
export function createWebSessionBackend() {
  return {
    id: "web-session",
    label: "This tab (visibility + focus)",
    available: true,
    capabilities: { session: true, perApp: false, realtime: true },
    async listTodaySamples() {
      return [];
    },
    async requestPermission() {
      return "granted";
    },
    async permissionStatus() {
      return "granted";
    },
  };
}

/**
 * Placeholder for Android UsageStatsManager (not wired yet).
 * Exists so UI/docs can talk about the same contract.
 */
export function createAndroidUsageBackendStub() {
  return {
    id: "android-usagestats",
    label: "Android UsageStats (not installed)",
    available: false,
    capabilities: { session: false, perApp: true, realtime: false },
    async listTodaySamples() {
      return [];
    },
    async requestPermission() {
      return "unsupported";
    },
    async permissionStatus() {
      return "unsupported";
    },
  };
}

/**
 * Bind AIly's local Capacitor UsageStats plugin to the shared usage shape.
 * Native reads require an explicit consent argument even after Android grants
 * usage access; this prevents an incidental render from crossing the boundary.
 * @param {object} plugin
 */
export function createAndroidUsageBackend(plugin) {
  return {
    id: "android-usagestats",
    label: "Android-reported daily app totals",
    available: true,
    capabilities: { session: false, perApp: true, realtime: false },
    async permissionStatus() {
      if (typeof plugin?.getPermissionStatus !== "function") return "unsupported";
      const result = await plugin.getPermissionStatus();
      return result?.granted === true ? "granted" : "denied";
    },
    async requestPermission() {
      const status = await this.permissionStatus();
      if (status === "granted" || status === "unsupported") return status;
      if (typeof plugin?.openUsageAccessSettings !== "function") return "unsupported";
      await plugin.openUsageAccessSettings();
      return "settings_opened";
    },
    async listTodaySamples(options = {}) {
      if (options.consented !== true || typeof plugin?.listTodayUsage !== "function") {
        return [];
      }
      const result = await plugin.listTodayUsage({ consented: true });
      if (result?.permission !== "granted" || !Array.isArray(result.samples)) return [];
      const day = /^\d{4}-\d{2}-\d{2}$/.test(result.day || "")
        ? result.day
        : new Date().toLocaleDateString("en-CA");
      const samples = [];
      for (const row of result.samples) {
        const packageName = String(row?.packageName || "").trim().slice(0, 200);
        const app = String(row?.label || "").trim().slice(0, 120);
        const foregroundMs = Number(row?.foregroundMs);
        if (!packageName || !app || !Number.isFinite(foregroundMs) || foregroundMs <= 0) {
          continue;
        }
        samples.push({
          app,
          mins: Math.max(1, Math.round(foregroundMs / 60000)),
          ts: `${day}T12:00:00`,
          source: "android-usagestats",
          packageName,
        });
        if (samples.length === 50) break;
      }
      return samples;
    },
  };
}

/**
 * Pick the best available backend for this runtime.
 * @param {{ isNative?: boolean, platform?: string }} env
 */
export function selectUsageBackend(env = {}) {
  const native = !!(env.isNative ?? globalThis.Capacitor?.isNativePlatform?.());
  const platform = String(
    env.platform || globalThis.Capacitor?.getPlatform?.() || "web"
  ).toLowerCase();
  if (native && platform === "android") {
    const plugin = Object.hasOwn(env, "plugin")
      ? env.plugin
      : globalThis.Capacitor?.Plugins?.AilyUsage;
    return plugin ? createAndroidUsageBackend(plugin) : createAndroidUsageBackendStub();
  }
  return createWebSessionBackend();
}

/**
 * Human-readable honesty line for the Usage panel.
 * @param {{ id: string, label: string, capabilities: object }} backend
 */
export function usageBackendHonesty(backend) {
  if (!backend) return "No usage backend selected.";
  if (backend.id === "web-session") {
    return "Tracking this AIly tab only (visible + focused). Other apps are manual samples until OS hooks ship.";
  }
  if (backend.id === "android-usagestats") {
    if (backend.available) {
      return "Android local daily totals — read only after tutorial consent and the system usage-access grant.";
    }
    return "Android UsageStats adapter is scaffolded but not installed — samples stay manual/session-only.";
  }
  return backend.label || backend.id;
}
