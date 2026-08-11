# packages/usage

OS app-usage monitor boundary. The first read-only Android adapter is implemented
as a local Capacitor plugin; background and desktop monitors are not.

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

## Rules

- Explicit tutorial grant before collection  
- Local-first; no silent cloud exfil  
- Feed the same `usageSamples` shape the web store already hydrates  
