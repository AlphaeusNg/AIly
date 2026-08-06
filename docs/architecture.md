# AIly architecture (Phase 0)

See north-star: `../../plans/aily-heavy-plan.md`.

## Now

| Layer | Tech |
|---|---|
| Domain | Rust crate `aily-core` (targets, capacity, replan, tutorial, blocks) |
| UI dogfood | Static web app `apps/web` (localStorage) |
| Desktop | Tauri planned when WebKit GTK available |

## Next

- Usage monitor service (OS hooks)
- Block controller (enforce + break-glass)
- Tauri shell wrapping the same UI + Rust core commands
