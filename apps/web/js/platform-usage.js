/**
 * Platform usage adapter boundary.
 * Web/PWA: in-tab visibility/focus session only.
 * Android Capacitor: consent-gated current-day UsageStats when the plugin is present.
 * Windows Tauri: consent-gated foreground-process totals since this AIly process opened.
 * Never invent cloud exfil.
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
 * Fallback when the Capacitor Android shell is native but AilyUsage is missing.
 * The live adapter is `createAndroidUsageBackend`.
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
 * Bind the installed Tauri shell's consent-gated foreground-process monitor.
 * It measures only this AIly process lifetime, never historical Windows usage.
 * @param {(command: string, args?: object) => Promise<any>} invoke
 */
export function createWindowsUsageBackend(invoke) {
  let tracking = false;
  const setTracking = async (consented) => {
    const result = await invoke("set_windows_usage_tracking", { consented });
    tracking = result?.available === true && result?.tracking === true;
    return result;
  };
  return {
    id: "windows-foreground-session",
    label: "Windows foreground apps since AIly opened",
    available: typeof invoke === "function",
    capabilities: { session: false, perApp: true, realtime: true },
    async permissionStatus() {
      if (typeof invoke !== "function") return "unsupported";
      const result = await invoke("windows_usage_status");
      tracking = result?.tracking === true;
      return result?.available === true ? "granted" : "unsupported";
    },
    async requestPermission() {
      if (await this.permissionStatus() === "unsupported") return "unsupported";
      const result = await setTracking(true);
      return result?.tracking === true ? "granted" : "unsupported";
    },
    async revokePermission() {
      if (typeof invoke !== "function") return "unsupported";
      await setTracking(false);
      return "denied";
    },
    async listTodaySamples(options = {}) {
      if (options.consented !== true || typeof invoke !== "function") return [];
      if (!tracking) {
        const result = await setTracking(true);
        if (result?.tracking !== true) return [];
      }
      const result = await invoke("list_windows_session_usage", { consented: true });
      const day = /^\d{4}-\d{2}-\d{2}$/.test(result?.day || "")
        ? result.day
        : new Date().toLocaleDateString("en-CA");
      const samples = [];
      for (const row of Array.isArray(result?.samples) ? result.samples : []) {
        const processName = String(row?.processName || "").trim().slice(0, 200);
        const app = String(row?.label || "").trim().slice(0, 120);
        const foregroundMs = Number(row?.foregroundMs);
        if (
          !processName
          || !app
          || !Number.isFinite(foregroundMs)
          || foregroundMs < 60_000
        ) {
          continue;
        }
        samples.push({
          app,
          mins: Math.floor(foregroundMs / 60_000),
          ts: `${day}T12:00:00`,
          source: "windows-foreground-session",
          processName,
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
  const tauriInvoke = Object.hasOwn(env, "tauriInvoke")
    ? env.tauriInvoke
    : globalThis.__TAURI__?.core?.invoke;
  if (typeof tauriInvoke === "function") {
    return createWindowsUsageBackend(tauriInvoke);
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
  if (backend.id === "windows-foreground-session") {
    return "Windows local foreground totals since AIly opened — process names only; no titles, paths, or historical activity.";
  }
  return backend.label || backend.id;
}
