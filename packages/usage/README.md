# packages/usage

OS app-usage monitor boundary. Read-only adapters exist for Android (Capacitor
UsageStats, current local day) and Windows (Tauri foreground-process totals
since this AIly process opened). Background collection, Linux, and macOS are
not implemented.

## Contract

Match the boundary in `apps/web/js/platform-usage.js`:

```js
{
  id, label,
  capabilities: { session, perApp, realtime },
  permissionStatus(): Promise<'granted'|'denied'|'unsupported'>,
  listTodaySamples({ consented }): Promise<Array<{ app, mins, ts, source? }>>,
  requestPermission(): Promise<'granted'|'settings_opened'|'unsupported'>
}
```

## Current adapters

| id | Status |
|---|---|
| `web-session` | Live in `apps/web/js/usage.js` (tab visibility/focus) |
| `android-usagestats` | Capacitor APK: bounded current-day OS aggregates; web fallback remains a stub |
| `windows-foreground-session` | Installed Tauri package: consent-gated process names for this AIly lifetime; no titles, paths, or history |

## Rules

- Explicit tutorial grant before collection  
- Local-first; no silent cloud exfil  
- Feed the same `usageSamples` shape the web store already hydrates  
