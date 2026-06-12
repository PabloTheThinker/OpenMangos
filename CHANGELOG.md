# Changelog

Notable changes to this project. Newest entries first.

---

## 2026-06-12 — Canonical Vektra URL `/openmango`

### Changed

- Install and website links → `https://vektraindustries.com/openmango` (README, `install.sh`, smoke test)
- npm slug and `~/.openmangos/` paths unchanged

---

## 2026-06-11 — Mascot v2

### Changed

- **`assets/openmangos-mascot.png`** — regenerated from `~/Pictures/Open Mangos Mascotv2.png` (transparent cutout, **Open Mango** name badge)
- **`assets/openmangos-mascot-logo.png`** · **`openmangos-logo-text*.svg`** — README wordmark embed refreshed
- Vektra: **`public/openmangos-portrait.png`** · **`openmangos-mark.png`** · **`openmangos-hero.jpg`**

---

## 2026-06-11 — OpenMango canonical branding

### Added

- **`src/core/brand.ts`** — `PRODUCT_NAME = 'OpenMango'`; technical slug unchanged (`openmangos`, `.openmangos/`, `OPENMANGOS_*`)

### Changed

- **v0.12.0** — user-facing copy, CLI descriptions, context packs, AGENTS.md prose, TUI, and install messaging use **OpenMango**
- Technical identifiers unchanged: npm `openmangos`, repo `OpenMangos`, `OpenMangosConfig`, `<!-- OPENMANGOS:START -->`

### Verify

```bash
cd "Vektra Industries/Software/OpenMangos" && npm test && npm run build
```

---

## 2026-06-11 — Reset clears learning loop

### Fixed

- **`om reset`** explicitly clears `.openmangos/learning/` (skills, session digests, events, recall cache) and session logs
- **`om reset --keep-global`** from `~` now preserves `install.yaml` while still wiping learning/memory (was deleting everything)

### Changed

- **v0.11.7** — reset confirmation lists learning/skills paths

---

## 2026-06-11 — Skill readability & formatting

### Added

- **`src/learning/skill-format.ts`** — structured SKILL.md bodies (summary, at-a-glance table, when to use, what we did, lineage)
- **`om skills format`** — reformat existing skills for readability
- Grouped **`om skills list`** output by category with one-line summaries

### Changed

- **v0.11.6** — recall uses compact excerpts + markdown table; junk tags filtered; false pitfalls (exit null) removed

---

## 2026-06-11 — Session-intent skill naming

### Added

- **`src/learning/skill-naming.ts`** — skills named from OpenCode session title / primary user goal (e.g. `build-three-js-mango-creation-opencode`)
- **`om skills delete <slug>`** — prune stale or poorly named skills

### Changed

- **v0.11.5** — primary learned skill uses human description (`Three.js mango creation via opencode`); slug derived from intent, not `*-session-mango` topic forks
- Recall / AGENTS.md nudge shows descriptions first; junk follow-up goals (`close it`) filtered from naming
- Removed noisy per-word topic child skills; procedure lives in the session-named operator skill

---

## 2026-06-11 — OpenCode 1.17+ transcript capture (SQLite/CLI)

### Fixed

- **Session capture missed live sessions** — OpenCode ≥1.17 stores sessions in SQLite (`opencode.db`), not legacy JSON files under `storage/session/global/`
- Capture now uses `opencode session list` + `opencode export` (with JSON-file fallback for older installs)

### Added

- **`om learn capture`** — backfill transcript digest and derive session skills for a past `om wrap` session

### Changed

- **v0.11.4** — learning exit message includes transcript summary when captured

---

## 2026-06-11 — Session transcript capture for skill development

### Added

- **`src/learning/session-capture.ts`** — on wrap exit, reads OpenCode session storage (`~/.local/share/opencode/storage`) and builds a `SessionDigest` (user goals, commands, tools, files, topics, failures)
- **Persisted digests** — `.openmangos/learning/sessions/<om-session-id>.json`
- **Transcript-driven skills** — parent skills get `## Session Procedure`; child skills: `*-session-procedure`, `*-session-<topic>`, `*-session-pitfalls`
- **`getSessionWindow()`** — joins start/end entries for accurate OpenCode time matching

### Changed

- **v0.11.3** — learning loop uses session transcript (not only exit code / situation graph) for `learnedFrom`, procedure sections, and derived children

### Verify

```bash
cd "Vektra Industries/Software/OpenMangos" && npm test
om wrap opencode   # complete a session, then:
ls ~/.openmangos/learning/sessions/
om skills list
```

---

## 2026-06-11 — Personal home bootstrap + personal-shell skill

### Added

- **Home `~` bootstrap** — empty stack tagged `personal`; derives `*-personal-shell` child skill
- Bootstrap tips when workspace is personal or bare (no repo detected)

### Changed

- **v0.11.2** — skill slugs from home become `build-personal-opencode` (not generic `build-opencode`)

---

## 2026-06-11 — Skill derivation (learning develops new skills)

### Added

- **`src/learning/develop.ts`** — child skills from sessions: infra, recovery, verified, mode-drift, nudge forks, playbooks
- **`om learn develop`** — scan recent events and spawn derived skills
- **Skill lineage** — `parent_skill` + `derived_from` in SKILL.md frontmatter

### Changed

- **v0.11.1** — `learning.auto_develop` (default true); failures derive recovery skills; successes fork specializations

---

## 2026-06-11 — Mangos learning loop (Hermes-style self-learning)

### Added

- **`src/learning/`** — closed learning loop on Mangos Drive: observe session exit → extract SKILL.md → recall into context pack
- **Skills** — `.openmangos/learning/skills/<slug>/SKILL.md` (agentskills.io-compatible frontmatter)
- **CLI** — `om learn status|nudge|events`, `om skills list|show|recall`
- **Wrap exit hook** — successful sessions auto-create/update skills; failures log events only
- **Context pack + AGENTS.md** — recalled skills + Hermes-style nudge injected before launch
- **Env** — `OPENMANGOS_LEARNING`, `OPENMANGOS_SKILLS`, `OPENMANGOS_SKILLS_PATH`
- **AgentDrive** — skill writes also `experience record` with SKILL.md as reasoning file

### Changed

- **v0.11.0** — `learning` config block (`enabled`, `auto_learn`, `auto_recall`, `nudge_agents`)

### Verify

```bash
npm test
om learn status
om wrap opencode   # exit 0 → skill created
om skills list
```

---

## 2026-06-11 — OpenMango positioning (open bet vs closed agent tiers)

### Changed

- **README.md** · **CONCEPT.md** — OpenMango alias, open-source operator-layer positioning (public terminal + memory vs walled premium agent surfaces)

---

## 2026-06-11 — Full smoke test + AgentDrive install fix

### Added

- **`scripts/smoke-test.sh`** — end-to-end: tests, reset, onboard, doctor, drive, sense, pack, curl URLs

### Fixed

- **AgentDrive piped install** — vektra route now proxies canonical `install.sh` (not `scripts/install.sh` wrapper); `installAgentDrive()` falls back to raw GitHub if vektra serves wrapper

### Verify

```bash
bash scripts/smoke-test.sh   # SMOKE_PASS
```

---

## 2026-06-11 — AgentDrive optional install during setup

### Added

- **`installAgentDrive()`** — curls `https://vektraindustries.com/agentdrive/install`, verifies `agentdrive --version` or `doctor`
- **Onboarding prompt** — if AgentDrive missing: “Install AgentDrive for Mangos Drive memory?” (default yes)
- **`om install --with-agentdrive`** · **`om onboard --with-agentdrive`**
- **`install.sh`** flags: `--with-agentdrive` · `--no-agentdrive` (passes through to `om onboard`)
- **Python 3** prerequisite check in `om install` / onboard step 2

### Changed

- **`resolveAgentDriveBin`** — looks at `~/.local/bin/agentdrive` and `~/.agentdrive/venv/bin/agentdrive` (removed dev-machine hardcoded path)

### Verify

```bash
om install --check          # agentdrive row fixable if missing
om onboard                  # prompts for AgentDrive when absent
om onboard -y --with-agentdrive
curl -fsSL https://vektraindustries.com/openmangos/install | bash -s -- --with-agentdrive
```

---

## 2026-06-11 — Session summary: v0.10.x ship + brand launch

End-to-end pass: **product lifecycle**, **distribution**, **Vektra presence**, **GitHub brand**, **mascot character**.

### Accomplished

| Area | What shipped |
|---|---|
| **Lifecycle** | `om install` · `om onboard` · `om update` · `om uninstall` · `om reset` · Mangos Drive provision |
| **Distribution** | `curl -fsSL https://vektraindustries.com/openmangos/install \| bash` → `~/.openmangos/src` |
| **Memory** | User-scoped Mangos Drive (`mangos-<user>-<workspace>` + personal swarm) on AgentDrive |
| **Vektra site** | `/openmangos` product page, install script routes, mango theme, ILO-style character hero |
| **GitHub** | Apple-style README, single OpenClaw-style logo (`<picture>` light/dark) |
| **Mascot** | v1 generated → ILO hero layout → **v2 user asset** (hard hat, tool belt, name badge) |
| **Docs** | `assets/MASCOT.md` — source path, colors, variation workflow |

### Brand assets (current)

- `assets/openmangos-mascot.png` — canonical mascot (transparent, 863×1152)
- `assets/openmangos-mascot-logo.png` — README SVG embed
- `assets/openmangos-logo-text.svg` / `openmangos-logo-text-dark.svg` — GitHub hero logo
- Vektra: `public/openmangos-portrait.png` · `openmangos-mark.png`

### Verify

```bash
npm test                                    # 40 tests
curl -fsSL https://vektraindustries.com/openmangos/install | bash
om drive status && om doctor
```

- GitHub README: https://github.com/PabloTheThinker/OpenMangos
- Product page: https://vektraindustries.com/openmangos

### Not done this session (see TASKLIST.md)

- `npm publish` global install without git clone
- First-class AgentDrive drive registry (manifest + swarm dirs today)
- Docs site, shell completions, probe integration tests

---

## 2026-06-11 — v0.10.3 curl installer + Vektra product page

### Added

- **Canonical `install.sh`** — `curl -fsSL https://vektraindustries.com/openmangos/install | bash`
- Clones `github.com/PabloTheThinker/OpenMangos` → `~/.openmangos/src`, build, link, onboard
- **Vektra site** — `/openmangos` product page + `/openmangos/install` script route

### Verify

```bash
curl -fsSL https://vektraindustries.com/openmangos/install | bash
# or local:
bash install.sh --no-onboard
```

---

## 2026-06-11 — v0.10.2 `om update` + `om uninstall`

### Added

- **`om update`** — git pull (if repo), `npm install`, build, relink; or `--global` for npm global upgrade
- **`om update --check`** — current version + published version (npm-global installs)
- **`om uninstall`** — remove `om` from PATH; prompts to keep or purge data
- **`om uninstall --keep-data`** — CLI only; keeps `~/.openmangos`, workspace `.openmangos/`, Mangos swarms
- **`om uninstall --purge`** — uninstall + full data wipe (reset scope)

### Fixed

- **`om reset`** — missing `join` import in confirmation output

### Verify

```bash
om update --check
om update
om uninstall --keep-data -y
om uninstall --purge -y
```

---

## 2026-06-11 — v0.10.1 `om reset` fresh start

### Added

- **`om reset`** — clear `~/.openmangos`, workspace `.openmangos/`, Mangos Drive swarms, and AGENTS.md section

### Verify

```bash
om reset -y
om onboard
```

---

## 2026-06-11 — v0.10.0 install + terminal onboarding

### Added

- **`om install`** — build, link, optional OpenCode install, prerequisite checks (`--check`)
- **`om onboard`** — 6-step terminal wizard: prerequisites → workspace → Mangos Drive → backend → ready
- **`scripts/install.sh`** — one-shot installer (npm install, build, link, onboard)
- **First-run prompt** — bare `om` offers onboarding before bootstrap (`OPENMANGOS_SKIP_ONBOARD=1` to skip)
- **Global install state** — `~/.openmangos/install.yaml` tracks onboarding completion
- **Shared prompts** — `src/ui/prompt.ts` for terminal input

### Onboarding steps

```
[1/6] Welcome
[2/6] Prerequisites (node, om, backends, AgentDrive)
[3/6] Workspace setup (om init)
[4/6] Mangos Drive provision
[5/6] Preferred agent backend
[6/6] Ready + next steps
```

### Verify

```bash
./scripts/install.sh
om install --check
om onboard --yes
cat ~/.openmangos/install.yaml
om
```

---

## 2026-06-11 — v0.9.1 Mangos Drive doctor + `om drive`

### Added

- **`om drive status`** — manifest, swarm ids, AgentDrive linkage
- **`om drive provision`** — create or repair Mangos Drive + swarm directories
- **Doctor / heal** — Mangos Drive checks; `om heal` auto-provisions when missing
- **AGENTS.md** — Mangos Drive section synced on `om wrap`

### Verify

```bash
om drive status
om doctor
om heal
```

---

## 2026-06-11 — v0.9.0 Mangos Drive (user-scoped AgentDrive namespace)

### Added

- **Mangos Drive** — OpenMangos provisions a named user drive (`mangos-<username>`) on first `om init` / `om pack --write` / bootstrap
- **Workspace + personal swarms** — `mangos-<user>-<workspace>` and `mangos-<user>-personal` under `~/.agentdrive/swarms/`
- **Manifest** — `.openmangos/mangos-drive.yaml` records drive id, display name, and swarm ids
- **AgentDrive `instance_name`** — set to `Mangos Drive` (configurable via `agentdrive.mangos_display_name`)
- **`om recall` / `om remember`** — route through Mangos Drive swarms instead of a hardcoded swarm id
- **Context pack** — Mangos Drive section + workspace/personal recall sections

### Config

| Key | Default | Purpose |
|---|---|---|
| `agentdrive.auto_provision` | `true` | Create Mangos Drive on first use |
| `agentdrive.mangos_display_name` | `Mangos Drive` | Human-readable drive name |
| `agentdrive.recall_personal` | `true` | Merge personal swarm into context pack |
| `agentdrive.swarm_id` | *(unset)* | Optional override; legacy swarms still work |

### Verify

```bash
om init
cat .openmangos/mangos-drive.yaml
om pack --write && grep -i "Mangos Drive" .openmangos/context-pack.md
om boot opencode --dry-run
om remember
```

---

## 2026-06-11 — v0.8.2 AgentDrive recall in bootstrap context pack

### Added

- **Auto-recall** — every `om` / `om boot` launch merges AgentDrive `experience context-pack` into `.openmangos/context-pack.md`
- **Local memory** — last 5 project snapshots also merged into context pack
- **`agentdrive.auto_recall`** config (default `true`; set `false` to skip)
- **`om pack`** / dry-run bootstrap use the same enriched pack builder

### Flow

```
sense → recall (AgentDrive + local) → pack → record → launch
```

### Verify

```bash
om pack --write
grep -A2 "Cross-session memory" .openmangos/context-pack.md
om boot opencode --dry-run
```

---

## 2026-06-11 — v0.8.1 OpenCode free-model auth detection

### Fixed

- **False `opencode not authenticated` warning** when using built-in free models (Big Pickle, Zen free tier, etc.) without `auth.json` credentials
- Doctor now reports `✓ opencode auth (free models)` when `opencode models` lists `opencode/*` built-ins

### Verify

```bash
om doctor   # should show opencode auth with free models, not a warning
```

---

## 2026-06-11 — v0.8.0 adaptive healing system

### Added

- **Healing modules** — workspace, profile drift, om link, OpenCode, backend auth probes
- **Pre-bootstrap auto-heal** — `om` / `om boot` runs quick heal before launch (`auto_heal: true` in config)
- **`om boot --no-heal`** / **`OPENMANGOS_NO_HEAL=1`** — opt out
- **Doctor** now checks: workspace files, profile drift, backend auth (grok/claude/opencode/codex), om link staleness

### Heal actions

| Issue | Auto-fix |
|---|---|
| Missing `.openmangos/` | Create profile + config |
| Profile prefers missing backend | Repoint to OSS-first available |
| Stale/conflicting OpenCode | Upgrade + remove duplicates |
| autoupdate hang | Disable in project + global config |
| Missing OpenCode plugin | Scaffold `.opencode/` integration |
| om not on PATH (dev) | `npm link` from package root |

### Verify

```bash
om doctor
om heal
om boot --dry-run    # shows heal pass on real boot
om boot --no-heal    # skip auto-heal
```

---

## 2026-06-11 — v0.7.0 adaptive healing (`om heal`)

### Added

- **`om heal`** — auto-fix fixable backend issues (alias for `om doctor --fix`)
- **`om doctor --fix`** — upgrade stale OpenCode, remove conflicting binaries, disable autoupdate hang, scaffold missing `.opencode` integration
- **`/heal`** in preview TUI · **`om doctor --json`** structured report

### Philosophy

OpenMangos doctor is now **diagnose → heal → re-check**: sense problems, apply safe fixes, verify recovery.

### Verify

```bash
om doctor
om heal          # or: om doctor --fix
om doctor --json
```

---

## 2026-06-11 — v0.6.3 fix OpenCode update pending hang

### Fixed

- OpenCode stuck on **pending update** at startup — `syncOpenCodeConfig` now sets `autoupdate: false` in project `opencode.json` (npm installs hang on autoupdate download)
- Stale **1.4.10** binary shadowing newer install when `~/.npm-global/bin` precedes nvm on PATH

### Added

- **`om doctor`** OpenCode health: version vs npm latest, conflicting-binary warning (same-version duplicates ignored), upgrade hints

### Verify

```bash
opencode --version          # should be 1.17.3+
om doctor                   # version + no outdated warning
om opencode                 # TUI opens without update spinner
npm install -g opencode-ai@latest --prefix ~/.npm-global   # if doctor shows stale binary
```

---

## 2026-06-11 — v0.6.2 fix OpenCode TUI launch

### Fixed

- OpenCode showed **help text and exited** — `-f` is `opencode run` only, not TUI
- Invalid `_openmangos` key in `opencode.json` broke OpenCode config validation
- TUI launch now uses `opencode` + `instructions` / `default_agent` in synced config

### Verify

```bash
om opencode   # should open OpenCode TUI, not help
```

---

## 2026-06-11 — v0.6.1 backend picker + `om opencode` shorthand

### Added

- **`om opencode` / `om grok`** — launch shorthand (was only `om boot opencode`)
- **Interactive backend picker** when multiple agents on PATH (`om` in a TTY)
- **`om backends`** — list installed backends; `om backends --set opencode`
- **`om boot --yes`** — skip picker; **`om boot --pick`** — force picker

### Fixed

- Default launch no longer silently uses stale `profile.backends.preferred: grok` over OpenCode
- OSS-first default when skipping picker: opencode → codex → grok → …

### Verify

```bash
om opencode --dry-run
om backends --set opencode
om   # picker if multiple installed
```

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