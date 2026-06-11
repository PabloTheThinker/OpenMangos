# OpenMangos

Adaptive terminal framework for Vektra Industries. Senses your workspace, builds a situation graph, adapts mode and context, and wraps any AI coding CLI.

See [CONCEPT.md](./CONCEPT.md) for the full vision and competitive research.

## Install (local dev)

```bash
cd "/home/pablothethinker/Vektra Industries/Software/OpenMangos"
npm install
npm run build
npm link   # optional: global `om` command
```

Or run without linking:

```bash
npm run dev -- sense
```

## Architecture (phased)

**Phase 1 (now):** OpenMangos is the **adaptive orchestration layer** — it does not replace OpenCode or Warp.

| Layer | Tool | Role |
|--------|------|------|
| Substrate | **OpenMangos (`om`)** | Sense, mode, route, context pack, verify, memory |
| Agent (OSS) | **OpenCode** | Default agent runtime (MIT) |
| Terminal ADE | **Warp** (optional) | Host tabs for Claude/Codex/OpenCode |

**Phase 2 (later):** Full Grok Build-style terminal experience built on top once orchestration is proven.

## Terminal experience

Running **`om`** probes the workspace, shows a **backend picker** if you have multiple agents installed, then launches with full context.

```bash
om              # picker (opencode, grok, claude, …)
om opencode     # direct launch
om grok -y      # skip picker
om backends --set opencode   # remember choice
```

Preview orchestrator TUI: **`om tui`** (not the final Grok-style shell).

| Key / input | Action |
|---|---|
| `Tab` | Cycle mode (build → debug → infra → review → ship) |
| `Shift+Tab` | Cycle backend |
| `Ctrl+G` | Run routed session (`sense` + `pack` + `wrap`) |
| `Ctrl+O` | Sessions overlay |
| `Ctrl+T` | Mission plan overlay |
| `!` | Bash mode (run shell command) |
| `?` or `/help` | Shortcuts panel |
| Plain text | Route task → suggests backend + mode |
| `/sense`, `/wrap`, … | Full slash palette |

Use `om sense`, `om run grok`, etc. for non-interactive CLI mode.

## Commands

| Command | Description |
|---|---|
| `om` / `om boot` | Adaptive bootstrap → agent launch |
| `om tui` | Preview orchestrator TUI |
| `om init` | Scaffold `.openmangos/` (profile, config) |
| `om sense` | Probe workspace and print situation report |
| `om suggest` | Show suggested mode + reasoning |
| `om mode [name]` | Show or set mode |
| `om tools` | Adaptive tool palette for current mode/stack |
| `om pack [--write]` | Export context pack |
| `om verify [--dry-run]` | Stack-appropriate verification |
| `om route "task"` | Suggest backend + mode for a task |
| `om run [backend]` | Sense + pack + wrap (one shot) |
| `om wrap [backend]` | Launch backend with full context |
| `om handoff --to claude` | Switch backend, keep session log |
| `om session ls` | List recent sessions |
| `om mission plan "goal"` | Generate phased mission plan |
| `om doctor` | Check om + backends on PATH |
| `om recall` | Local memory + AgentDrive context |
| `om remember` | Persist situation snapshot |
| `om roles` | Factory-style role → backend routing |
| `om watch` | Live situation refresh |
| `om bridge status/push` | Vektra engine WebSocket sync |
| `om mission run` | Run plan phases with verify gates |
| `om team export` | Committable team.yaml |
| `om wrap --verify-on-exit` | Auto-verify after AI session |

## Probes

- **Git** — branch, dirty files, last commit
- **Node** — package.json, TypeScript, frameworks, test runner
- **Python** — pyproject/requirements, pytest, venv
- **Rust** — Cargo.toml, edition, binaries
- **Docker** — compose, Dockerfile, running containers
- **Kubernetes** — manifests, Helm charts
- **Terraform** — `.tf` files, CLI availability
- **Vercel** — vercel.json, linked project
- **Fly.io** — fly.toml, app + region
- **Ports** — common dev ports via `ss`

## AGENTS.md hook

`om wrap` syncs a managed `<!-- OPENMANGOS:START -->` … `<!-- OPENMANGOS:END -->` section into `AGENTS.md` with mode, stack, verification commands, and env var reference. Content outside the markers is preserved.

## Environment variables (`om wrap`)

| Variable | Purpose |
|---|---|
| `OPENMANGOS_ROOT` | Workspace root |
| `OPENMANGOS_MODE` | Active mode (`build`, `debug`, `infra`, `review`, `ship`) |
| `OPENMANGOS_CONTEXT` | Path to JSON situation pack |
| `OPENMANGOS_CONTEXT_MD` | Path to Markdown context pack |
| `OPENMANGOS_PROFILE` | Path to `.openmangos/profile.yaml` |

## License

Apache-2.0