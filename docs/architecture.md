# AIly architecture (Phase 0)

See north-star: `../../plans/aily-heavy-plan.md`.

## Now

| Layer | Tech |
|---|---|
| Domain | Rust crate `aily-core` (targets, capacity, replan, tutorial, blocks) |
| UI dogfood | Static web app `apps/web` (localStorage) + Capacitor Android shell |
| Ally propose | Pure JS `ally.js` — deterministic, local, no cloud / no model |
| Usage dogfood | Visibility/focus session tracker + manual samples |
| Blocks dogfood | Arm + try-open sim + break-glass countdown UI |
| Desktop | Tauri planned when WebKit GTK available |

## Ally propose (local only)

`proposeDayPlan` ranks active targets by journey progress, biases the first
slot toward today’s intention when titles match, snaps estimates to 15m, and
rejects anything that fails `checkPlanAccept`. The user must accept each item
(or “add all”); AIly never silently mutates the day plan.

## Next

- Real OS usage tracking hooks
- Real hard-block OS enforcement
- Optional on-device model for richer propose (still propose-only)
- Tauri shell wrapping the same UI + Rust core commands
