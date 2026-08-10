let meta = #{
    name: "aily-improve",
    description: "Continuous improve cycle for AIly: discover opportunities, ship one high-value fix, verify, update PROGRESS.md — biased toward seamless local ally UX and time-conscious intentionality",
    when_to_use: "When iterating on AIly to fix bugs, improve UX, or deepen the ally experience (time awareness + intentional choice)",
    phases: [
        #{ title: "Orient", detail: "PROGRESS, plan, repo health, git state" },
        #{ title: "Discover", detail: "parallel opportunity scan across product lenses" },
        #{ title: "Select", detail: "pick one small high-value cycle winner" },
        #{ title: "Implement", detail: "code the fix with tests" },
        #{ title: "Verify", detail: "npm test gate + adversarial claim check" },
        #{ title: "Document", detail: "PROGRESS cycle log + backlog" },
        #{ title: "Deliver", detail: "scratch report for the operator" },
    ],
};

// --- schemas --------------------------------------------------------------
let orient_schema = #{
    "type": "object",
    "required": ["ok", "summary", "cycle_hint", "backlog_top", "repo_ready"],
    "properties": #{
        "ok": #{ "type": "boolean" },
        "summary": #{ "type": "string" },
        "cycle_hint": #{ "type": "string" },
        "backlog_top": #{
            "type": "array",
            "maxItems": 8,
            "items": #{
                "type": "object",
                "required": ["title", "priority", "status"],
                "properties": #{
                    "title": #{ "type": "string" },
                    "priority": #{ "type": "string" },
                    "status": #{ "type": "string" },
                    "category": #{ "type": "string" },
                },
            },
        },
        "git_dirty": #{ "type": "boolean" },
        "repo_ready": #{ "type": "boolean" },
        "deployment_version": #{ "type": "string" },
        "warnings": #{
            "type": "array",
            "maxItems": 12,
            "items": #{ "type": "string" },
        },
        "product_phase": #{ "type": "string" },
    },
};

let opportunity_schema = #{
    "type": "object",
    "required": ["lens", "opportunities"],
    "properties": #{
        "lens": #{ "type": "string" },
        "opportunities": #{
            "type": "array",
            "maxItems": 6,
            "items": #{
                "type": "object",
                "required": ["title", "why", "evidence", "impact", "effort", "risk", "files"],
                "properties": #{
                    "title": #{ "type": "string" },
                    "why": #{ "type": "string" },
                    "evidence": #{ "type": "string" },
                    "impact": #{ "type": "string" },
                    "effort": #{ "type": "string" },
                    "risk": #{ "type": "string" },
                    "files": #{
                        "type": "array",
                        "maxItems": 12,
                        "items": #{ "type": "string" },
                    },
                    "ally_fit": #{ "type": "string" },
                    "score_hint": #{ "type": "number" },
                },
            },
        },
        "notes": #{ "type": "string" },
    },
};

let pick_schema = #{
    "type": "object",
    "required": ["title", "why_this_wins", "success_criteria", "plan_steps", "files", "category"],
    "properties": #{
        "title": #{ "type": "string" },
        "why_this_wins": #{ "type": "string" },
        "success_criteria": #{
            "type": "array",
            "maxItems": 8,
            "items": #{ "type": "string" },
        },
        "plan_steps": #{
            "type": "array",
            "maxItems": 10,
            "items": #{ "type": "string" },
        },
        "files": #{
            "type": "array",
            "maxItems": 16,
            "items": #{ "type": "string" },
        },
        "category": #{ "type": "string" },
        "ally_angle": #{ "type": "string" },
        "test_plan": #{
            "type": "array",
            "maxItems": 8,
            "items": #{ "type": "string" },
        },
        "skip": #{ "type": "boolean" },
        "skip_reason": #{ "type": "string" },
    },
};

let implement_schema = #{
    "type": "object",
    "required": ["ok", "summary", "files_touched", "tests_added"],
    "properties": #{
        "ok": #{ "type": "boolean" },
        "summary": #{ "type": "string" },
        "files_touched": #{
            "type": "array",
            "maxItems": 40,
            "items": #{ "type": "string" },
        },
        "tests_added": #{
            "type": "array",
            "maxItems": 16,
            "items": #{ "type": "string" },
        },
        "behavior_before": #{ "type": "string" },
        "behavior_after": #{ "type": "string" },
        "blockers": #{
            "type": "array",
            "maxItems": 12,
            "items": #{ "type": "string" },
        },
        "version_bumped": #{ "type": "boolean" },
    },
};

let verify_schema = #{
    "type": "object",
    "required": ["pass", "gate_ran", "gate_ok", "claims_ok", "notes"],
    "properties": #{
        "pass": #{ "type": "boolean" },
        "gate_ran": #{ "type": "boolean" },
        "gate_ok": #{ "type": "boolean" },
        "claims_ok": #{ "type": "boolean" },
        "notes": #{ "type": "string" },
        "gate_output_tail": #{ "type": "string" },
        "failed_claims": #{
            "type": "array",
            "maxItems": 12,
            "items": #{ "type": "string" },
        },
        "score_after": #{
            "type": "object",
            "properties": #{
                "correctness": #{ "type": "number" },
                "ux_ally": #{ "type": "number" },
                "tests": #{ "type": "number" },
                "maintainability": #{ "type": "number" },
            },
        },
    },
};

let document_schema = #{
    "type": "object",
    "required": ["ok", "summary", "progress_updated"],
    "properties": #{
        "ok": #{ "type": "boolean" },
        "summary": #{ "type": "string" },
        "progress_updated": #{ "type": "boolean" },
        "cycle_label": #{ "type": "string" },
        "next_opportunity": #{ "type": "string" },
    },
};

// --- helpers --------------------------------------------------------------
fn trimmed(s) {
    if type_of(s) == "string" {
        s.trim();
        s
    } else {
        ""
    }
}

fn default_root() {
    "/home/alph/projects/AIly"
}

fn default_plan_path() {
    "/home/alph/projects/plans/aily-heavy-plan.md"
}

fn resolve_root(a) {
    if a == () { return default_root(); }
    let r = a.root;
    if r == () { return default_root(); }
    let t = trimmed(r);
    if t == "" { return default_root(); }
    t
}

fn resolve_plan_path(a) {
    if a == () { return default_plan_path(); }
    let p = a.plan_path;
    if p == () { return default_plan_path(); }
    let t = trimmed(p);
    if t == "" { return default_plan_path(); }
    t
}

fn resolve_focus(a) {
    if a == () { return ""; }
    let f = a.focus;
    if f == () { return ""; }
    trimmed(f)
}

fn resolve_cycles(a) {
    // Bound agent spend: default 1, hard max 3 per run.
    if a == () { return 1; }
    let c = a.cycles;
    if c == () { return 1; }
    if type_of(c) == "i64" || type_of(c) == "f64" || type_of(c) == "i32" || type_of(c) == "f32" {
        if c < 1 { return 1; }
        if c > 3 { return 3; }
        return c;
    }
    1
}

fn resolve_dry_run(a) {
    if a == () { return false; }
    let d = a.dry_run;
    if d == () { return false; }
    d == true
}

fn resolve_skip_progress(a) {
    if a == () { return false; }
    let s = a.skip_progress;
    if s == () { return false; }
    s == true
}

fn north_star_block() {
    let s = "";
    s += "PRODUCT NORTH STAR (do not dilute):\n";
    s += "AIly (Your AI Ally) is a seamless local-first ally that helps the user achieve targets they set.\n";
    s += "Owner personal intent: make the user conscious of time spent and help them ask whether they really want to be doing this — intentional choice, not shame.\n";
    s += "Personality: ally not nanny; firm on the user's rules; kind tone; break-glass always for hard blocks.\n";
    s += "Hard rules: no cloud exfil of usage; blocks cannot arm without tutorial admin consent + usage grant; local-first; zero-terminal free path.\n";
    s += "Prefer small reversible changes with tests over large refactors.\n";
    s
}

fn path_under_root(path, root) {
    if type_of(path) != "string" { return false; }
    if path == "" { return false; }
    // Absolute under root, or relative (no .. escape)
    if path == root { return true; }
    let prefix = root + "/";
    if path.len() >= prefix.len() {
        // simple starts_with without regex
        let i = 0;
        let ok = true;
        while i < prefix.len() {
            if path[i] != prefix[i] {
                ok = false;
                break;
            }
            i += 1;
        }
        if ok { return true; }
    }
    // relative path: reject .. segments
    if path[0] == '/' {
        return false;
    }
    // reject if contains ".." as path segment (simple scan)
    let j = 0;
    while j + 1 < path.len() {
        if path[j] == '.' && path[j + 1] == '.' {
            return false;
        }
        j += 1;
    }
    true
}

fn filter_files(files, root) {
    let out = [];
    if files == () { return out; }
    let i = 0;
    while i < files.len() {
        let f = files[i];
        if path_under_root(f, root) {
            out.push(f);
        }
        i += 1;
    }
    out
}

// --- args -----------------------------------------------------------------
let root = resolve_root(args);
let plan_path = resolve_plan_path(args);
let focus = resolve_focus(args);
let max_cycles = resolve_cycles(args);
let dry_run = resolve_dry_run(args);
let skip_progress = resolve_skip_progress(args);
let progress_path = root + "/PROGRESS.md";
let agents_path = root + "/AGENTS.md";

log("aily-improve root=" + root + " cycles=" + max_cycles.to_string() + " dry_run=" + dry_run.to_string() + " focus=" + focus);

// Accumulated run report pieces
let cycle_reports = [];
let cycle_index = 0;
let any_shipped = false;
let last_fp = "";

// =========================================================================
// CYCLE LOOP
// =========================================================================
while cycle_index < max_cycles {
    let cycle_n = cycle_index + 1;
    log("=== improve cycle " + cycle_n.to_string() + "/" + max_cycles.to_string() + " ===");

    // --- Orient -----------------------------------------------------------
    phase("Orient");
    let op = "";
    op += north_star_block();
    op += "\nYou are orienting improve cycle " + cycle_n.to_string() + " for AIly.\n";
    op += "Repo root: " + root + "\n";
    op += "Plan: " + plan_path + "\n";
    op += "PROGRESS: " + progress_path + "\n";
    if focus != "" {
        op += "Operator focus bias: " + focus + "\n";
    }
    op += "\nREQUIRED TOOL USE (read-only):\n";
    op += "1) read_file " + progress_path + " — extract current state, next backlog items (status Next/Backlog), last cycle number, deployment version.\n";
    op += "2) read_file " + agents_path + " and skim " + plan_path + " vision/principles if present.\n";
    op += "3) list_dir " + root + "; check apps/web, crates/aily-core, tools exist.\n";
    op += "4) Shell: git -C " + root + " status --short ; git -C " + root + " log -3 --oneline\n";
    op += "5) Optionally peek apps/web/js/version.js for SITE_VERSION.\n";
    op += "Set repo_ready=true only if core paths exist. cycle_hint = suggested next cycle number label (e.g. Cycle 8).\n";
    op += "backlog_top: up to 8 open items from PROGRESS (not Completed).\n";
    op += "Do not invent backlog rows not in the file.\n";

    let orient = agent(op, #{
        label: "orient:c" + cycle_n.to_string(),
        capability_mode: "read-only",
        output_schema: orient_schema,
    });

    if orient == () || !orient.success || orient.output == () {
        cycle_reports.push("Cycle " + cycle_n.to_string() + ": orient failed.");
        break;
    }
    let o = orient.output;
    log("orient ok=" + o.ok.to_string() + " ready=" + o.repo_ready.to_string() + " hint=" + o.cycle_hint);
    if o.repo_ready != true {
        complete(#{
            ok: false,
            error: "repo_not_ready",
            summary: o.summary,
            root: root,
        });
    }

    // --- Discover ---------------------------------------------------------
    phase("Discover");
    let lenses = [
        "time-consciousness and intentional choice UX (pause, ask do you want this, surface time spent vs target)",
        "seamless local ally UX (copy tone, flows, friction, offline/PWA feel, empty states)",
        "correctness reliability and persistence bugs (store, capacity, replan, recovery)",
        "product spine gaps (targets, Today capacity, tutorial gates, blocks break-glass, usage consent)",
        "tests DX and maintainability that unlock safer iteration",
    ];

    let jobs = [];
    let li = 0;
    while li < lenses.len() {
        let lens = lenses[li];
        let dp = "";
        dp += north_star_block();
        dp += "\nDiscover improvement opportunities for AIly. Cycle " + cycle_n.to_string() + ".\n";
        dp += "Your lens ONLY: " + lens + "\n";
        dp += "Root: " + root + "\n";
        if focus != "" {
            dp += "Operator focus bias (still honor your lens): " + focus + "\n";
        }
        dp += "Orient summary: " + o.summary + "\n";
        if o.backlog_top != () {
            dp += "Known open backlog (may reuse if still valid with fresh evidence):\n";
            let bi = 0;
            while bi < o.backlog_top.len() {
                let b = o.backlog_top[bi];
                dp += "- [" + b.status + "] " + b.title + "\n";
                bi += 1;
            }
        }
        dp += "\nREQUIRED:\n";
        dp += "- Use grep/read_file/list_dir under " + root + " only. Inspect real code (apps/web/js, crates/aily-core, tools, docs).\n";
        dp += "- Each opportunity needs concrete evidence (file + behavior observed). No memory-only claims.\n";
        dp += "- Prefer shippable-in-one-cycle work (small/medium). Skip multi-week platform work unless it is a thin vertical slice.\n";
        dp += "- ally_fit: how this serves time consciousness / intentional goals / seamless ally UX.\n";
        dp += "- score_hint 1-10 overall attractiveness for THIS cycle (impact/effort, ally fit, safety).\n";
        dp += "- Max 6 opportunities. Empty list only after thorough search under your lens with notes of what you checked.\n";
        dp += "- files must be paths under the repo (relative preferred).\n";

        jobs.push(#{
            prompt: dp,
            label: "discover:" + li.to_string() + ":c" + cycle_n.to_string(),
            capability_mode: "read-only",
            output_schema: opportunity_schema,
        });
        li += 1;
    }

    let dresults = parallel(jobs);
    let all_ops = [];
    let discover_md = "";
    let di = 0;
    while di < dresults.len() {
        let r = dresults[di];
        if r == () || !r.success || r.output == () {
            discover_md += "\n### Lens failed: " + lenses[di] + "\n";
        } else {
            let pack = r.output;
            discover_md += "\n### " + pack.lens + "\n";
            if pack.opportunities != () {
                let oi = 0;
                while oi < pack.opportunities.len() {
                    let opp = pack.opportunities[oi];
                    // Scope files to repo
                    let safe_files = filter_files(opp.files, root);
                    // Also accept relative files already filtered by path_under_root
                    if opp.files != () && safe_files.len() == 0 {
                        // try treating as relative: re-check each with path_under_root relative rules
                        let fi = 0;
                        while fi < opp.files.len() {
                            let f = opp.files[fi];
                            if path_under_root(f, root) {
                                safe_files.push(f);
                            }
                            fi += 1;
                        }
                    }
                    let entry = #{
                        title: opp.title,
                        why: opp.why,
                        evidence: opp.evidence,
                        impact: opp.impact,
                        effort: opp.effort,
                        risk: opp.risk,
                        files: safe_files,
                        ally_fit: if opp.ally_fit != () { opp.ally_fit } else { "" },
                        score_hint: if opp.score_hint != () { opp.score_hint } else { 5 },
                        lens: pack.lens,
                    };
                    all_ops.push(entry);
                    discover_md += "- **" + opp.title + "** (score≈" + entry.score_hint.to_string() + "): " + opp.why + "\n";
                    oi += 1;
                }
            }
        }
        di += 1;
    }

    log("discovered opportunities=" + all_ops.len().to_string());

    if all_ops.len() == 0 {
        cycle_reports.push("Cycle " + cycle_n.to_string() + ": no opportunities found.");
        break;
    }

    // Stall detection across cycles in this run
    let titles_blob = "";
    let ti = 0;
    while ti < all_ops.len() {
        titles_blob += all_ops[ti].title + "|";
        ti += 1;
    }
    let fp = fingerprint(titles_blob);
    if last_fp != "" && fp == last_fp {
        log("opportunity set fingerprint unchanged; stopping further cycles");
        cycle_reports.push("Cycle " + cycle_n.to_string() + ": stalled (same opportunity set as prior cycle).");
        break;
    }
    last_fp = fp;

    // --- Select -----------------------------------------------------------
    phase("Select");
    let pick_prompt = "";
    pick_prompt += north_star_block();
    pick_prompt += "\nPick exactly ONE opportunity for AIly improve cycle " + cycle_n.to_string() + ".\n";
    pick_prompt += "Orient: " + o.summary + "\n";
    if o.cycle_hint != () {
        pick_prompt += "Suggested cycle label: " + o.cycle_hint + "\n";
    }
    if focus != "" {
        pick_prompt += "Operator focus bias: " + focus + "\n";
    }
    pick_prompt += "\nCandidates (JSON-ish list):\n";
    let ci = 0;
    while ci < all_ops.len() {
        let c = all_ops[ci];
        pick_prompt += (ci + 1).to_string() + ") " + c.title + "\n";
        pick_prompt += "   lens: " + c.lens + "\n";
        pick_prompt += "   why: " + c.why + "\n";
        pick_prompt += "   evidence: " + c.evidence + "\n";
        pick_prompt += "   impact/effort/risk: " + c.impact + " / " + c.effort + " / " + c.risk + "\n";
        pick_prompt += "   ally_fit: " + c.ally_fit + "\n";
        pick_prompt += "   score_hint: " + c.score_hint.to_string() + "\n";
        if c.files != () {
            pick_prompt += "   files: ";
            let fi = 0;
            while fi < c.files.len() {
                if fi > 0 { pick_prompt += ", "; }
                pick_prompt += c.files[fi];
                fi += 1;
            }
            pick_prompt += "\n";
        }
        ci += 1;
    }
    pick_prompt += "\nSelection rules (in order):\n";
    pick_prompt += "1) Evidence-backed and doable in one cycle with tests.\n";
    pick_prompt += "2) Prefer correctness/reliability blockers over polish when both are high impact.\n";
    pick_prompt += "3) When impact/effort similar, prefer time-consciousness / intentional-choice / seamless ally UX.\n";
    pick_prompt += "4) Prefer PROGRESS backlog 'Next' if still valid with fresh evidence.\n";
    pick_prompt += "5) Avoid scope that needs real OS usage/hard block APIs unless a pure UI/model slice.\n";
    pick_prompt += "6) skip=true only if NOTHING is safe to ship this cycle (explain skip_reason).\n";
    pick_prompt += "Return a concrete plan_steps, success_criteria, test_plan, files list, category, ally_angle.\n";
    pick_prompt += "You may re-read files under " + root + " to confirm feasibility before picking.\n";

    let pick = agent(pick_prompt, #{
        label: "select:c" + cycle_n.to_string(),
        capability_mode: "read-only",
        output_schema: pick_schema,
    });

    if pick == () || !pick.success || pick.output == () {
        cycle_reports.push("Cycle " + cycle_n.to_string() + ": select agent failed.");
        break;
    }
    let chosen = pick.output;
    if chosen.skip == true {
        let reason = if chosen.skip_reason != () { chosen.skip_reason } else { "selector skipped" };
        cycle_reports.push("Cycle " + cycle_n.to_string() + ": skipped — " + reason);
        break;
    }

    // Enforce file scope
    let chosen_files = filter_files(chosen.files, root);
    if chosen.files != () && chosen_files.len() == 0 {
        // relative files
        let fi = 0;
        while fi < chosen.files.len() {
            if path_under_root(chosen.files[fi], root) {
                chosen_files.push(chosen.files[fi]);
            }
            fi += 1;
        }
    }
    log("selected: " + chosen.title + " files=" + chosen_files.len().to_string());

    if dry_run {
        let dry_md = "# AIly improve dry-run — cycle " + cycle_n.to_string() + "\n\n";
        dry_md += "## Would ship\n\n**" + chosen.title + "**\n\n";
        dry_md += chosen.why_this_wins + "\n\n";
        dry_md += "### Plan\n";
        if chosen.plan_steps != () {
            let pi = 0;
            while pi < chosen.plan_steps.len() {
                dry_md += (pi + 1).to_string() + ". " + chosen.plan_steps[pi] + "\n";
                pi += 1;
            }
        }
        dry_md += "\n### Discover pool\n" + discover_md + "\n";
        cycle_reports.push(dry_md);
        // dry_run does one cycle only of planning
        break;
    }

    // --- Implement --------------------------------------------------------
    phase("Implement");
    let ip = "";
    ip += north_star_block();
    ip += "\nImplement ONE AIly improvement cycle.\n";
    ip += "Repo: " + root + " (work only here)\n";
    ip += "Title: " + chosen.title + "\n";
    ip += "Why: " + chosen.why_this_wins + "\n";
    if chosen.ally_angle != () {
        ip += "Ally angle: " + chosen.ally_angle + "\n";
    }
    ip += "Category: " + chosen.category + "\n";
    ip += "\nSuccess criteria:\n";
    if chosen.success_criteria != () {
        let si = 0;
        while si < chosen.success_criteria.len() {
            ip += "- " + chosen.success_criteria[si] + "\n";
            si += 1;
        }
    }
    ip += "\nPlan steps:\n";
    if chosen.plan_steps != () {
        let pi = 0;
        while pi < chosen.plan_steps.len() {
            ip += (pi + 1).to_string() + ". " + chosen.plan_steps[pi] + "\n";
            pi += 1;
        }
    }
    ip += "\nExpected files (may adjust if needed, stay in repo):\n";
    let fi = 0;
    while fi < chosen_files.len() {
        ip += "- " + chosen_files[fi] + "\n";
        fi += 1;
    }
    ip += "\nTest plan:\n";
    if chosen.test_plan != () {
        let ti2 = 0;
        while ti2 < chosen.test_plan.len() {
            ip += "- " + chosen.test_plan[ti2] + "\n";
            ti2 += 1;
        }
    }
    ip += "\nREQUIRED:\n";
    ip += "1) Read existing code before editing. Match style (static HTML/CSS/JS + Rust aily-core).\n";
    ip += "2) Implement the smallest change that meets success criteria. No drive-by refactors.\n";
    ip += "3) Add/adjust tests under tools/*.mjs and/or crates/aily-core tests as appropriate.\n";
    ip += "4) If you change user-facing web behavior, bump apps/web/js/version.js SITE_VERSION.id as YYYY.MM.DD.N (today 2026-08-10 or actual date).\n";
    ip += "5) Do NOT commit or push. Do NOT edit files outside " + root + ".\n";
    ip += "6) Do NOT rewrite " + plan_path + ".\n";
    ip += "7) You may leave PROGRESS.md to the document phase — optional light touch only if needed.\n";
    ip += "8) Run targeted checks while iterating; full npm test runs in Verify phase too.\n";
    ip += "9) Set ok=false with blockers if the change is unsafe or blocked — do not invent product decisions.\n";
    ip += "10) Record behavior_before and behavior_after with concrete observations.\n";

    let im = agent(ip, #{
        label: "implement:c" + cycle_n.to_string(),
        capability_mode: "all",
        output_schema: implement_schema,
    });

    if im == () || !im.success || im.output == () {
        cycle_reports.push("Cycle " + cycle_n.to_string() + ": implement agent failed for: " + chosen.title);
        break;
    }
    let impl = im.output;
    // Scope check files_touched
    let touched = filter_files(impl.files_touched, root);
    if impl.files_touched != () {
        let fi2 = 0;
        while fi2 < impl.files_touched.len() {
            let f = impl.files_touched[fi2];
            if path_under_root(f, root) {
                // avoid dupes simple push
                let found = false;
                let k = 0;
                while k < touched.len() {
                    if touched[k] == f { found = true; break; }
                    k += 1;
                }
                if !found { touched.push(f); }
            } else {
                log("dropped out-of-root path claim: " + f);
            }
            fi2 += 1;
        }
    }
    log("implement ok=" + impl.ok.to_string() + " files=" + touched.len().to_string());

    if impl.ok != true {
        let block_md = "Cycle " + cycle_n.to_string() + " implement blocked: " + impl.summary;
        if impl.blockers != () {
            let bi = 0;
            while bi < impl.blockers.len() {
                block_md += " | " + impl.blockers[bi];
                bi += 1;
            }
        }
        cycle_reports.push(block_md);
        break;
    }

    // --- Verify -----------------------------------------------------------
    phase("Verify");
    let vp = "";
    vp += north_star_block();
    vp += "\nVerify the AIly improvement just implemented.\n";
    vp += "Repo: " + root + "\n";
    vp += "Change title: " + chosen.title + "\n";
    vp += "Implement summary: " + impl.summary + "\n";
    if impl.behavior_before != () {
        vp += "Claimed before: " + impl.behavior_before + "\n";
    }
    if impl.behavior_after != () {
        vp += "Claimed after: " + impl.behavior_after + "\n";
    }
    vp += "Files claimed:\n";
    let fi3 = 0;
    while fi3 < touched.len() {
        vp += "- " + touched[fi3] + "\n";
        fi3 += 1;
    }
    vp += "\nREQUIRED:\n";
    vp += "1) cd " + root + " && source \"$HOME/.cargo/env\" 2>/dev/null; npm test\n";
    vp += "   Record gate_ran, gate_ok, and a short gate_output_tail (last ~40 lines of output or error).\n";
    vp += "2) Adversarially re-read touched files. Confirm claims with evidence. Fail closed: claims_ok=false if you cannot verify.\n";
    vp += "3) pass=true only if gate_ok AND claims_ok.\n";
    vp += "4) Optional score_after 1-10 for correctness, ux_ally, tests, maintainability.\n";
    vp += "5) List failed_claims if any.\n";
    vp += "Do not fix code in this step unless a one-line syntax fix is trivial AND you re-run npm test; prefer reporting failure.\n";

    let ver = agent(vp, #{
        label: "verify:c" + cycle_n.to_string(),
        capability_mode: "execute",
        output_schema: verify_schema,
    });

    let verified = false;
    let ver_notes = "";
    if ver != () && ver.success && ver.output != () {
        verified = ver.output.pass == true;
        ver_notes = ver.output.notes;
        log("verify pass=" + verified.to_string() + " gate_ok=" + ver.output.gate_ok.to_string());
    } else {
        ver_notes = "Verify agent failed; treat as not verified.";
        log("verify agent failed");
    }

    // One repair attempt if gate failed but implement thought it worked
    if !verified {
        phase("Implement");
        let fixp = "";
        fixp += north_star_block();
        fixp += "\nRepair the failed verification for: " + chosen.title + "\n";
        fixp += "Repo: " + root + "\n";
        fixp += "Verify notes: " + ver_notes + "\n";
        if ver != () && ver.success && ver.output != () {
            if ver.output.gate_output_tail != () {
                fixp += "Gate tail:\n" + ver.output.gate_output_tail + "\n";
            }
            if ver.output.failed_claims != () {
                fixp += "Failed claims:\n";
                let fci = 0;
                while fci < ver.output.failed_claims.len() {
                    fixp += "- " + ver.output.failed_claims[fci] + "\n";
                    fci += 1;
                }
            }
        }
        fixp += "\nFix only what is broken for this cycle. Re-run npm test before finishing.\n";
        fixp += "Return same implement schema. ok=true only if tests pass.\n";

        let fix = agent(fixp, #{
            label: "repair:c" + cycle_n.to_string(),
            capability_mode: "all",
            output_schema: implement_schema,
        });

        if fix != () && fix.success && fix.output != () && fix.output.ok == true {
            impl = fix.output;
            // re-verify once
            let vp2 = "";
            vp2 += "Re-verify AIly repair for: " + chosen.title + "\n";
            vp2 += "Repo: " + root + "\n";
            vp2 += "Summary: " + impl.summary + "\n";
            vp2 += "REQUIRED: cd " + root + " && source \"$HOME/.cargo/env\" 2>/dev/null; npm test\n";
            vp2 += "Re-read changed files. pass=true only if gate_ok and claims_ok.\n";
            let ver2 = agent(vp2, #{
                label: "reverify:c" + cycle_n.to_string(),
                capability_mode: "execute",
                output_schema: verify_schema,
            });
            if ver2 != () && ver2.success && ver2.output != () {
                verified = ver2.output.pass == true;
                ver_notes = ver2.output.notes;
            }
        }
    }

    if !verified {
        cycle_reports.push("Cycle " + cycle_n.to_string() + " NOT verified: " + chosen.title + " — " + ver_notes);
        // still document failure lightly? stop loop
        break;
    }

    any_shipped = true;

    // --- Document ---------------------------------------------------------
    phase("Document");
    if !skip_progress {
        let docp = "";
        docp += north_star_block();
        docp += "\nUpdate AIly PROGRESS.md for a completed improve cycle.\n";
        docp += "File: " + progress_path + "\n";
        docp += "Cycle hint from orient: " + o.cycle_hint + "\n";
        docp += "Title: " + chosen.title + "\n";
        docp += "Why it won: " + chosen.why_this_wins + "\n";
        docp += "Implement summary: " + impl.summary + "\n";
        if impl.behavior_before != () {
            docp += "Before: " + impl.behavior_before + "\n";
        }
        if impl.behavior_after != () {
            docp += "After: " + impl.behavior_after + "\n";
        }
        docp += "Files:\n";
        let fi4 = 0;
        while fi4 < touched.len() {
            docp += "- " + touched[fi4] + "\n";
            fi4 += 1;
        }
        docp += "Verify: passed. Notes: " + ver_notes + "\n";
        docp += "\nREQUIRED:\n";
        docp += "1) read_file PROGRESS.md fully enough to preserve structure.\n";
        docp += "2) Bump Last updated date; note this cycle number (AIly Cycle N).\n";
        docp += "3) Mark the shipped opportunity Completed in the backlog table; promote a sensible Next if missing.\n";
        docp += "4) Append a Cycle N log section matching existing style (why, plan, changes, verification, scores if known, lesson, next opportunity).\n";
        docp += "5) Keep tone factual. Do not invent test counts — cite verify notes.\n";
        docp += "6) progress_updated=true only if you wrote the file successfully.\n";

        let doc = agent(docp, #{
            label: "document:c" + cycle_n.to_string(),
            capability_mode: "read-write",
            output_schema: document_schema,
        });
        if doc != () && doc.success && doc.output != () {
            log("document ok=" + doc.output.ok.to_string() + " updated=" + doc.output.progress_updated.to_string());
        } else {
            log("document agent failed — cycle still shipped; operator should update PROGRESS.md");
        }
    }

    let shipped = "";
    shipped += "## Cycle " + cycle_n.to_string() + " shipped: " + chosen.title + "\n\n";
    shipped += chosen.why_this_wins + "\n\n";
    shipped += impl.summary + "\n\n";
    shipped += "Verified: true\n";
    if ver_notes != "" {
        shipped += "Notes: " + ver_notes + "\n";
    }
    cycle_reports.push(shipped);

    cycle_index += 1;
}

// --- Deliver --------------------------------------------------------------
phase("Deliver");
let final_md = "# AIly continuous improve report\n\n";
final_md += "_Workflow: aily-improve | root: `" + root + "` | dry_run: " + dry_run.to_string() + " | shipped_any: " + any_shipped.to_string() + "_\n\n";
final_md += north_star_block() + "\n";
final_md += "## Cycles\n\n";
let ri = 0;
while ri < cycle_reports.len() {
    final_md += cycle_reports[ri] + "\n\n";
    ri += 1;
}
if cycle_reports.len() == 0 {
    final_md += "(no cycle output)\n";
}
final_md += "\n## How to re-run\n\n";
final_md += "```text\n/workflow aily-improve\n/workflow aily-improve {\"cycles\": 2}\n/workflow aily-improve {\"dry_run\": true}\n/workflow aily-improve {\"focus\": \"intentional pause when starting distraction\"}\n```\n";
final_md += "\nGate: `cd " + root + " && npm test`\n";
final_md += "Preview: `npm run web` → http://127.0.0.1:8765/\n";

let path = write_scratch_file("aily-improve-report.md", final_md);
log("report: " + path);

complete(#{
    ok: any_shipped || dry_run,
    dry_run: dry_run,
    shipped: any_shipped,
    cycles_requested: max_cycles,
    cycles_completed: cycle_reports.len(),
    path: path,
    root: root,
    summary: if dry_run {
        "Dry-run improve plan written"
    } else if any_shipped {
        "Shipped " + cycle_reports.len().to_string() + " verified improve cycle(s)"
    } else {
        "No cycle shipped — see report"
    },
    report: final_md,
});
