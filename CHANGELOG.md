# Changelog

Notable changes to this project. Newest entries first.

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