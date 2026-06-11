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
| `om sense` | Probe workspace and print situation report |
| `om sense --json` | Machine-readable situation graph |
| `om sense --save` | Write `.openmangos/profile.yaml` |
| `om mode` | Show active mode + reasoning |
| `om mode debug` | Set mode override |
| `om mode --suggest` | Show suggested mode |
| `om pack` | Print Markdown context pack |
| `om pack --write` | Write `.openmangos/context-pack.{md,json}` |
| `om verify` | Run stack-appropriate verification checks |
| `om verify --dry-run` | List checks without running |
| `om wrap grok` | Launch backend with context + AGENTS.md sync |

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