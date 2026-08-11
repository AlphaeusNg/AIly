# Platform hooks (usage Phase 1 / blocking Phase 2)

The web/PWA remains honest about its limits. The Capacitor Android shell now has
the first real, read-only OS usage slice.

## Usage tracking

| Platform | Candidate APIs | Dogfood today |
|---|---|---|
| Web / PWA | Visibility + focus (this tab only) | Implemented |
| Android | UsageStatsManager (special access) | Android-reported current-day foreground totals in Capacitor APK |
| Windows | UI Automation / ETW (elevated) | Not started |
| Linux | Wayland limits; X11 `_NET_WM` | Not started |
| macOS | Screen Time / Accessibility | Not started |

**Product rules (unchanged):** explicit tutorial grant; local-first; no silent cloud exfil.

## Hard blocks

| Platform | Candidate | Dogfood today |
|---|---|---|
| Web | Try-open simulation + break-glass UI | Implemented |
| Android | Accessibility overlay / Digital Wellbeing-style | Not started |
| Desktop | Per-OS policy (cgroup, AppLocker, etc.) | Not started |

**Safety:** cannot arm without usage + admin grants; break-glass always; no shame copy.

## Implementation order (suggested)

1. Android UsageStats → per-app daily totals into `usageSamples` shape — shipped
2. Device-backed permission/read journey test and day-boundary accuracy dogfood
3. Android soft overlay for armed keys during focus
4. Windows/Linux after dogfood metrics prove the loop

Keep domain logic in `aily-core` / pure JS modules; platform code is a thin adapter.

## Code boundary

| File | Role |
|---|---|
| `apps/web/js/platform-usage.js` | Backend select + honesty strings |
| `apps/web/js/usage.js` | Sample merge + visibility session tracker |
| `android/app/src/main/java/com/alphaeusng/aily/AilyUsagePlugin.java` | Consent check, OS grant/status/settings, bounded local read |
| `tools/test-platform-usage.mjs` | Boundary tests |

`selectUsageBackend()` selects the registered native plugin only inside the
Capacitor Android shell. A web/PWA session still uses visibility/focus tracking.
Native reads require both tutorial consent and Android's independently
revocable Usage Access grant, return at most 50 app totals, and are kept in
memory rather than copied into AIly backups. UsageStats is an OS aggregate, so
device dogfood still needs to characterize day-boundary accuracy.
