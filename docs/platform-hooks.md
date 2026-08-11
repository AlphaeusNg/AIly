# Platform hooks (Phase 2 spine)

Phase 0 dogfood is honest about limits. This note is the **scaffold** for real OS work.

## Usage tracking

| Platform | Candidate APIs | Dogfood today |
|---|---|---|
| Web / PWA | Visibility + focus (this tab only) | Implemented |
| Android | UsageStatsManager (permission) | Shell only |
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

1. Android UsageStats → per-app daily totals into `usageSamples` shape  
2. Android soft overlay for armed keys during focus  
3. Windows/Linux after dogfood metrics prove the loop  

Keep domain logic in `aily-core` / pure JS modules; platform code is a thin adapter.

## Code boundary (Phase 0)

| File | Role |
|---|---|
| `apps/web/js/platform-usage.js` | Backend select + honesty strings |
| `apps/web/js/usage.js` | Sample merge + visibility session tracker |
| `tools/test-platform-usage.mjs` | Boundary tests |

`selectUsageBackend()` returns the Android stub on native Android so the UI can
say “not installed” instead of lying about OS coverage.
