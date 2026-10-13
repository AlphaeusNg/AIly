# AIly feature roadmap

Research date: 2026-10-13. This increment follows the target, capacity, tutorial
and local-first product spine in the workspace heavy plan.

## Evidence and selected feature

Today offers 15, 25 and 50 minute focus sessions, pause/resume and early end.
A user with a ten-minute gap or a forty-minute commitment cannot choose that
length directly. [Microsoft's Focus documentation](https://support.microsoft.com/en-us/windows/experience/focus-stay-on-task-without-distractions-in-windows)
lets users choose session duration and configure future sessions. This supports
making duration a user choice; it does not establish an ideal work interval or
promise a productivity benefit.

[MDN's number-input documentation](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/number)
describes minimum, maximum and step constraints and warns that HTML constraints
alone cannot enforce validation. AIly will check the action boundary as well.

Selected: custom focus duration on Today, remembered locally. The 1–180 whole
minute range is an AIly product choice, not a medical or research recommendation.
Keep the existing quick starts; put the optional input in a collapsed disclosure
so phone layouts keep the main focus controls compact.

## Acceptance criteria

- A user can enter a whole number from 1 to 180 and start that duration by button
  or Enter. Invalid, blank or fractional entries cannot start a timer or alter
  permissions, block state or the remembered value.
- Remember the last successfully started custom duration, initially 25 minutes,
  in local state and its backup. Invalid imported preferences fall back to 25.
  Quick-start buttons do not replace the remembered custom value.
- Use the existing deferred focus actions, last-action-wins behavior, audit,
  pause/resume/early-end and consent gates. No permission is implicitly granted.
- A prepared PWA can use custom focus offline. Loading controls remains outside
  the first-paint module graph. The 320px layout has no horizontal overflow.
- Verify the complete local gate, Android JVM/build and APK metadata/signature.
  Package Windows through hosted installed-app checks. Physical-device dogfood
  remains a separate open task.

## Next priorities

| Priority | Capability | Evidence and completion gate |
|---|---|---|
| 1 | Associate a focus session with a chosen commitment | Today already ranks a next commitment; require explicit choice and separate planned time from measured usage. Completion never auto-advances a metric. |
| 2 | Session completion reflection | Existing review and audit provide foundations; ask for outcome/evidence without labeling elapsed timer time as measured productive work. Microsoft Focus's task integration is a reference, not a proposed account dependency. |
| 3 | Physical Android/Windows permission and restart journeys | Existing capability matrix and heavy plan require real device evidence before expanding native monitoring claims. Record consent, revocation, clock/restart and measurement-window behavior. |
| 4 | Today renderer extraction | AILY-07 remains partial; preserve first paint, keyboard behavior and offline shell while reducing shell orchestration. |
| Blocked | OS hard enforcement | The heavy plan requires a consented platform prototype with expiry, recovery and break-glass. Do not add process killing as a focus-setting feature. |

No calendar integration, account sign-in, automatic OS Do Not Disturb, background
tracking or break scheduler is included in this increment.

## Implementation evidence — 2026-10-14

Custom duration is implemented in Today and the existing deferred focus actions.
The complete Rust/Clippy/Node gate passed, including preference backup validation
and all four consent combinations; 19 Chromium journeys passed. Browser checks
cover button/Enter submission, invalid entries, reload persistence, quick-start
preference preservation, prepared offline custom focus and 320px overflow.
The Android build helper assembled and verified signed APK identity and native
version `0.1.11`; Android JVM tests also passed. Web stamp: `2026.10.14.1`.
Hosted Windows lifecycle/package checks and release publication follow the main
push. Physical-device journeys have not been performed by this increment.
