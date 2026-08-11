# packages/usage

OS app-usage monitor (Phase 2). **Not implemented yet.**

## Contract

Match the boundary in `apps/web/js/platform-usage.js`:

```js
{
  id, label,
  capabilities: { session, perApp, realtime },
  listTodaySamples(): Promise<Array<{ app, mins, ts, source? }>>,
  requestPermission(): Promise<'granted'|'denied'|'unsupported'>
}
```

## Current adapters

| id | Status |
|---|---|
| `web-session` | Live in `apps/web/js/usage.js` (tab visibility/focus) |
| `android-usagestats` | Stub only — see `docs/platform-hooks.md` |

## Rules

- Explicit tutorial grant before collection  
- Local-first; no silent cloud exfil  
- Feed the same `usageSamples` shape the web store already hydrates  
