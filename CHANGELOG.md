# Changelog

Notable changes to this project. Newest entries first.

---

## 2026-06-11 — v0.6.0 orchestration-first (OpenCode + bootstrap)

### Added

- **Default `om`** → adaptive bootstrap (`sense` + `pack` + launch agent) instead of custom TUI
- **`om boot`** — explicit bootstrap with `--task`, `--dry-run`, `--verify-on-exit`
- **OpenCode adapter** — `opencode.json` sync, mode→`build`/`plan` agent, `-f context-pack.md`
- **`om init`** scaffolds `.opencode/plugins/openmangos.ts` + `/sense` `/verify` commands
- **`wrapAndLaunch`** — unified wrap path for run/wrap/handoff/TUI with backend launch plans
- **Warp host detection** in `om doctor` (`WARP_IS_LOCAL_SHELL_SESSION`)
- **Unit tests** — `npm test` (router, bootstrap, OpenCode adapter)

### Changed

- Default preferred backend → **opencode** (OSS-first fallback chain)
- `om tui` retained as preview shell; full Grok Build-style TUI deferred until orchestration proven
- Version 0.6.0

### Verify

```bash
npm test
om boot --dry-run
om init && om run opencode
```

---

## 2026-06-11 — v0.5.0 full-screen terminal experience

### Added

- **`om` / `om tui`** — full-screen adaptive terminal (default when no args)
- Always-visible **situation strip** — mode, stack, infra, health, backend (OpenMangos differentiator vs Factory/Codex static shells)
- **Slash commands** — `/sense`, `/mode`, `/tools`, `/route`, `/run`, `/wrap`, `/verify`, `/pack`, `/mission`, `/sessions`, `/recall`, `/doctor`, `/help`
- **Keyboard shortcuts** (Factory/Codex/Claude patterns) — Tab mode, Shift+Tab backend, Ctrl+G run, Ctrl+O sessions, Ctrl+T mission, `!` bash, `?` help
- Plain-text task input → automatic route suggestion before launch
- Mango/amber-on-dark theme in `src/tui/`

### Changed

- `om` with no subcommand launches TUI instead of Commander help
- Version 0.5.0

### Verify

```bash
npm run build && npm link
om          # full-screen TUI
om tui -C . # explicit launch
om sense    # CLI still works
```

---

## 2026-06-11 — v0.4.0 Phase 3 living framework

### Added

- `om recall` — local memory snapshots + AgentDrive `experience context-pack`
- `om remember` — explicit situation persistence
- `om roles` — Factory-style orchestrator/implementer/validator/research routing
- `om watch` — live situation refresh (poll + fs.watch)
- `om bridge status/push` — Vektra engine WebSocket situation sync
- `om mission run` — phased mission execution with verification gates
- `om team export` — committable `team.yaml`
- `--verify-on-exit` on `wrap`, `run`, `handoff`
- AgentDrive auto-record on wrap (`agentdrive experience record`)
- Local memory at `.openmangos/memory/snapshots.jsonl`
- Backend adapter modules with role metadata
- `ws` dependency for Vektra bridge

### Changed

- Default config enables AgentDrive + Vektra bridge
- Version 0.4.0

### Verify

```bash
om remember && om recall --local && om roles && om mission run
```

---

## 2026-06-11 — v0.3.0 complete tool push

### Added

- `TASKLIST.md` — research-backed master roadmap
- `om init`, `om tools`, `om suggest`, `om doctor`
- `om route`, `om run`, `om handoff --to <backend>`
- `om session ls/show` — JSONL session log
- `om mission plan/show` — Factory-inspired mission-lite plans
- `src/modes/definitions.ts` — affordances, guardrails, palette per mode
- `src/core/config.ts` — `.openmangos/config.yaml` with backend routing
- `src/core/tools.ts` — dynamic tool registry
- `src/core/router.ts` — task → backend/mode heuristics
- CI probe (GitHub Actions, GitLab, CircleCI, Jenkins)
- CLI modularized into `src/commands/register.ts`

### Changed

- `om wrap` records sessions; injects `OPENMANGOS_SESSION`, `OPENMANGOS_BACKEND`
- Context pack includes mode palette
- Version 0.3.0

### Verify

```bash
om doctor && om tools && om route "fix auth test" && om mission plan "ship v0.3"
```

---

## 2026-06-11 — Phase 1 (agent swarm)

### Added

- `om verify` — stack-aware verification (`npm test`, `tsc`, `pytest`, `cargo test`, `terraform validate`, `docker compose ps`, `git status`)
- `om verify --dry-run` and `--json` output modes
- AGENTS.md hook on `om wrap` — managed OpenMangos section with mode, stack, verification hints
- Probes: **Rust** (Cargo.toml), **Kubernetes** (manifests, Helm), **Vercel**, **Fly.io**
- Git repository initialized (`5656fd6` initial, Phase 1 follow-up commit)

### Changed

- Version `0.2.0`
- README expanded with verify, new probes, AGENTS.md hook

### Verify

```bash
npm run build
om verify --dry-run
om verify
om wrap grok   # syncs AGENTS.md + launches backend
```

---

## 2026-06-11 — Phase 0 spike

### Added

- TypeScript CLI (`om`) with `sense`, `mode`, `pack`, and `wrap` commands
- Probe registry: git, node, python, docker, terraform, ports
- Situation graph builder with explainable mode resolution
- `.openmangos/profile.yaml` persistence
- Context pack export (Markdown + JSON) for AI backends
- Backend wrapper with `OPENMANGOS_*` environment injection (grok, claude, opencode, codex, cursor)
- `CONCEPT.md` competitive research and architecture doc
- `README.md` with install and command reference

### Verify

```bash
cd "/home/pablothethinker/Vektra Industries/Software/OpenMangos"
npm install && npm run build
npm run dev -- sense
npm run dev -- pack --write
npm run dev -- mode --suggest
```