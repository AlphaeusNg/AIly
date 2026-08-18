# AIly — agent notes

**Brand:** **AIly** (stylized capital **I**) — *Your AI Ally*  
**Plan:** `/home/alph/projects/plans/aily-heavy-plan.md`  
**Workflows:**  
- Multi-mode (research/architecture/implement/…): `~/.grok/workflows/aily.rhai`  
- Continuous improve cycles: `~/.grok/workflows/aily-improve.rhai` (also `AIly/.grok/workflows/aily-improve.rhai`)

## Product spine

1. Targets the user sets (metrics required).  
2. Guided **tutorial** for non-technical setup (everything in-app).  
3. **App usage tracking** (with consent).  
4. **Self-admin productivity blocks** (Covenant Eyes *shape*, productivity *substance*) + break-glass.  
5. Local-first; auto bootstrap; no terminal for free path.

## Repo layout

| Path | Role |
|---|---|
| `crates/aily-core` | Domain: targets, capacity, replan, tutorial state, block rules model |
| `apps/web` | Phase 0 UI dogfood (static HTML/CSS/JS) — also the Tauri frontend |
| `src-tauri/` | Tauri 2 Windows NSIS shell (`AIly-setup.exe`). Not a workspace member. |
| `docs/` | Architecture, tutorial, privacy, blocking |
| `packages/*` | Placeholders for usage/block/tutorial services |

Do not add `src-tauri` to the Cargo workspace — Linux `npm test` must stay WebKit-free. Core logic stays in Rust.

## Rules

- Do not invent cloud exfil of usage.  
- Blocks cannot arm without tutorial admin consent + usage grant.  
- Break-glass always available for hard blocks.  
- Bump `apps/web/js/version.js` `SITE_VERSION.id` on ship as `YYYY.MM.DD.N`.  
- Run the complete local gate with `npm test`.

## Commands

```bash
source "$HOME/.cargo/env"
cd /home/alph/projects/AIly
npm test
JAVA_HOME="$HOME/.local/jdk-21" npm run android:test
python3 -m http.server 8765 --directory apps/web
# open http://127.0.0.1:8765/
```

## Continuous improve workflow

```text
/workflow aily-improve
/workflow aily-improve {"cycles": 2}
/workflow aily-improve {"dry_run": true}
/workflow aily-improve {"focus": "time consciousness intentional pause"}
```

Each cycle: orient → parallel discover (5 lenses) → select one fix → implement → `npm test` + claim check → update `PROGRESS.md`.  
North star baked in: seamless local ally; conscious of time; help the user ask whether they really want to be doing this.
