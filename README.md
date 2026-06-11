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

## Commands

| Command | Description |
|---|---|
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