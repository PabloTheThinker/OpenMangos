# OpenMangos — Master Task List

Research-backed roadmap from [CONCEPT.md](./CONCEPT.md) (Factory, OpenCode, Aider, Conductor, Amazon Q, Cursor CLI, Verdent).  
**North star:** The terminal adapts to the problem. The model adapts to the terminal.

Legend: ✅ done · 🔄 in progress · ⬜ planned

---

## Phase 0 — Smart shell ✅

| # | Task | Status | Notes |
|---|------|--------|-------|
| 0.1 | `om sense` — probe + situation report | ✅ | Stack, infra, workflow, runtime, health |
| 0.2 | `om mode` — manual mode switch | ✅ | build / debug / infra / review / ship |
| 0.3 | `om pack` — context pack export | ✅ | Markdown + JSON |
| 0.4 | `om wrap <backend>` — provider wrapper | ✅ | OPENMANGOS_* env injection |
| 0.5 | `.openmangos/profile.yaml` | ✅ | User-tunable profile |
| 0.6 | Probes: git, node, python, docker, terraform, ports | ✅ | Phase 0 set |
| 0.7 | Probes: rust, k8s, vercel, fly | ✅ | Phase 1 swarm |
| 0.8 | Git repository + Apache-2.0 | ✅ | `master` branch |

---

## Phase 1 — Adaptive tools ✅

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1.1 | `om verify` — post-action verification | ✅ | Stack-aware steps |
| 1.2 | AGENTS.md hook on `om wrap` | ✅ | Managed OPENMANGOS markers |
| 1.3 | Dynamic tool registry | ✅ | `om tools` — per stack/mode |
| 1.4 | Mode affordances module | ✅ | `src/modes/definitions.ts` |
| 1.5 | `om suggest` — mode suggestion | ✅ | Standalone command |
| 1.6 | `.openmangos/config.yaml` schema | ✅ | Constraints, routing, plugins hook |
| 1.7 | `om init` — scaffold workspace | ✅ | profile + config + gitignore hint |
| 1.8 | CI probe (.github/workflows) | ✅ | GitHub Actions + alt CI files |
| 1.9 | Probe: monorepo (turbo/nx/pnpm) | ⬜ | Workspace topology |
| 1.10 | Probe: databases (local connection) | ⬜ | postgres/redis reachable |
| 1.11 | `om doctor` — self health check | ✅ | om + backends on PATH |

**Competitive gap filled:** Amazon Q infra discovery, Aider repo awareness — extended to infra symbols.

---

## Phase 2 — Multi-backend orchestration 🔄

| # | Task | Status | Notes |
|---|------|--------|-------|
| 2.1 | Unified session log | ✅ | `.openmangos/sessions/sessions.jsonl` |
| 2.2 | `om session ls/show` | ✅ | Cross-backend history |
| 2.3 | Task routing heuristics | ✅ | `om route "<task>"` |
| 2.4 | `om handoff --to <backend>` | ✅ | Keep situation + log |
| 2.5 | Mission-lite plan files | ✅ | `om mission plan` → plan.md |
| 2.6 | `om run` — sense + pack + wrap | ✅ | One-shot adaptive session |
| 2.7 | Plugin loader (config probes) | ✅ | `config.probes.extra_signals` |
| 2.8 | Post-wrap verify hook | ✅ | `--verify-on-exit` on wrap/run/handoff |
| 2.9 | Backend adapters as modules | ✅ | `src/adapters/backends/index.ts` |
| 2.10 | Model routing by role (Factory-style) | ✅ | `om roles` |

**Competitive gap filled:** Factory Missions orchestration — backend-agnostic, local-first.

---

## Phase 3 — Living framework 🔄

| # | Task | Status | Notes |
|---|------|--------|-------|
| 3.1 | AgentDrive integration | ✅ | `agentdrive experience record` on wrap |
| 3.2 | Cross-session memory recall | ✅ | `om recall` local + AgentDrive context-pack |
| 3.3 | Team-shared profiles | ✅ | `om team export` → team.yaml |
| 3.4 | TUI dashboard (optional) | ✅ | Full-screen `om`/`om tui`; situation strip, slash cmds, overlays |
| 3.5 | `om watch` — live situation refresh | ✅ | Poll + fs.watch triggers |
| 3.6 | Mission orchestrator | 🔄 | `om mission run` with verify gates; multi-worker ⬜ |
| 3.7 | Computer-use validation hook | ⬜ | UI smoke via playwright |
| 3.8 | OpenTelemetry export | ⬜ | Factory enterprise parity |
| 3.9 | Plugin marketplace spec | ⬜ | probes + modes packages |
| 3.10 | vektra-engine terminal bridge | ✅ | `om bridge push` + auto on wrap |

**Competitive gap filled:** Conductor persistent context + AgentDrive structural memory.

---

## Phase 4 — Production hardening ⬜

| # | Task | Status | Notes |
|---|------|--------|-------|
| 4.1 | npm publish `openmangos` | ⬜ | Global `om` install |
| 4.2 | Shell completions (bash/fish) | ⬜ | |
| 4.3 | Integration tests per probe | ⬜ | Fixture repos |
| 4.4 | Security: destructive op guardrails | ⬜ | infra mode blocks |
| 4.5 | Secret scanner pre-wrap | ⬜ | Factory Droid Shield pattern |
| 4.6 | Airgapped / offline mode | ⬜ | No network probes |
| 4.7 | Windows/WSL test matrix | ⬜ | |
| 4.8 | Documentation site | ⬜ | Mintlify or similar |

---

## Command surface (target)

```
om sense [--json] [--save]
om mode [name] [--suggest]
om suggest
om pack [--write] [--json]
om verify [--dry-run] [--json]
om tools [--json]
om init
om doctor
om route "<task>"
om run [backend]
om wrap [backend]
om handoff --to <backend>
om session [ls|show <id>|start]
om mission [plan "<goal>"|show]
```

---

## Architecture targets

```
openmangos/
├── core/       probe engine, situation, modes, config, session, router, mission
├── modes/      affordances, guardrails, palette per mode
├── probes/     pluggable detectors (+ ci, monorepo, db)
├── adapters/   backend-specific wrap hooks
├── verify/     post-action runners
├── plugins/    config-driven extensions
├── commands/   CLI command modules
└── ui/         terminal reports
```

---

## Vektra integration map

| System | Integration point | Phase |
|--------|-------------------|-------|
| AgentDrive | `om recall`, situation DNA | 3.1 |
| Grok Build | First-class wrap + skills | 0.4 ✅ |
| vektra-engine | Terminal bridge WS | 3.10 |
| Universal Brush | Design mode probe | 3.x |

---

*Updated: 2026-06-11 — v0.5.0 full-screen TUI (Factory/Codex/Claude patterns + situation strip)*