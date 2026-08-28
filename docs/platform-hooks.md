# Platform hooks (usage Phase 1 / blocking Phase 2)

The web/PWA remains honest about its limits. Native shells now have the first
real, read-only OS usage slices: Capacitor Android (current-day UsageStats) and
the installed Windows Tauri package (foreground process totals since AIly opened).

## Usage tracking

| Platform | Candidate APIs | Dogfood today |
|---|---|---|
| Web / PWA | Visibility + focus (this tab only) | Implemented |
| Android | UsageStatsManager (special access) | Android-reported current-day foreground totals in Capacitor APK |
| Windows | Win32 foreground-process aggregator in the installed Tauri shell | Consent-gated process-name totals since AIly opened; no titles, paths, or historical lookup |
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
2. Windows foreground-session totals in the installed package — shipped (not ETW; this AIly process lifetime only)
3. Device-backed Android permission/read journey test and day-boundary accuracy dogfood — remaining (needs a physical device)
4. Device-dogfood Windows session accuracy on a real PC
5. Android soft overlay for armed keys during focus
6. Linux/macOS after dogfood metrics prove the loop

Keep domain logic in `aily-core` / pure JS modules; platform code is a thin adapter.

## Code boundary

| File | Role |
|---|---|
| `apps/web/js/platform-usage.js` | Backend select + honesty strings |
| `apps/web/js/usage.js` | Sample merge + visibility session tracker |
| `android/app/src/main/java/com/alphaeusng/aily/AilyUsagePlugin.java` | Consent check, OS grant/status/settings, bounded local read |
| `src-tauri/src/windows_usage.rs` | Consent-gated Win32 foreground aggregator for this process lifetime |
| `tools/test-platform-usage.mjs` | Boundary tests |

`selectUsageBackend()` selects the Capacitor Android plugin inside that shell, or
the Tauri invoke bridge inside the installed Windows package. A web/PWA session
still uses visibility/focus tracking. Native reads require tutorial consent
(Android also needs the independently revocable Usage Access grant). Results are
capped at 50 app totals and kept in memory rather than copied into AIly backups.
UsageStats is an OS aggregate, so device dogfood still needs to characterize
day-boundary accuracy. Windows totals are session-scoped: they reset when AIly
exits or consent is revoked.
