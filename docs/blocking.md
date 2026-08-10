# Blocking (productivity ally)

AIly is **not** Covenant Eyes for moral filtering. It is **self-admin productivity blocking**:

1. You pick off-limits apps.
2. You grant ally admin in the tutorial.
3. You arm rules for focus windows (or start a focus session from daily check-in).
4. **Break-glass** always works (delay + reason, logged, optional daily limit).

## Phase 0 dogfood (current)

| Capability | Status |
|---|---|
| Create soft/hard rules | UI model |
| Arm / disarm | UI model; requires usage + admin grants |
| Try-open simulation | Match app key against armed rules |
| Break-glass | Countdown delay + required reason + daily limit check |
| Focus session auto-arm | Soft-arms existing rules for N minutes |
| OS kill / firewall | **Not yet** — Phase 2 |

## Platform honesty

Hard OS-level blocks depend on the OS. Until hooks ship, the web/Android shell
simulates enforcement in-app so the journey (consent → arm → glass) is
exercisable. Real enforcement is Phase 2.

## Safety

- Never arm without tutorial grants.
- System-critical apps should be allowlisted before hard kill policies.
- No shame copy on unlock — ally tone, logged reason only.
