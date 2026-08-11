/**
 * Platform usage adapter boundary (Phase 2 scaffold).
 * Phase 0: only the in-tab session tracker is real.
 * OS backends plug in behind the same shape — never invent cloud exfil.
 */

/** @typedef {{ app: string, mins: number, ts: string, source?: string }} UsageSample */

/**
 * @returns {{
 *   id: string,
 *   label: string,
 *   capabilities: { session: boolean, perApp: boolean, realtime: boolean },
 *   async listTodaySamples(): Promise<UsageSample[]>,
 *   async requestPermission(): Promise<'granted'|'denied'|'unsupported'>,
 * }}
 */
export function createWebSessionBackend() {
  return {
    id: "web-session",
    label: "This tab (visibility + focus)",
    capabilities: { session: true, perApp: false, realtime: true },
    async listTodaySamples() {
      return [];
    },
    async requestPermission() {
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
    capabilities: { session: false, perApp: true, realtime: false },
    async listTodaySamples() {
      return [];
    },
    async requestPermission() {
      return "unsupported";
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
    // Real plugin not shipped — still return stub so UI can explain limits.
    return createAndroidUsageBackendStub();
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
    return "Android UsageStats adapter is scaffolded but not installed — samples stay manual/session-only.";
  }
  return backend.label || backend.id;
}
