#!/usr/bin/env bash
# Full OpenMangos smoke test — unit tests, install, onboard, AgentDrive, core commands.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
WORKSPACE="$ROOT"
PASS=0
FAIL=0
SKIP=0

if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
  G='\033[0;32m' R='\033[0;31m' Y='\033[0;33m' C='\033[0;36m' B='\033[1m' N='\033[0m'
else
  G='' R='' Y='' C='' B='' N=''
fi

step() { echo -e "\n${B}${C}▸ $*${N}"; }
ok()   { echo -e "  ${G}✓${N} $*"; PASS=$((PASS + 1)); }
bad()  { echo -e "  ${R}✗${N} $*"; FAIL=$((FAIL + 1)); }
skip() { echo -e "  ${Y}○${N} $*"; SKIP=$((SKIP + 1)); }

run() {
  local label="$1"
  shift
  if "$@"; then
    ok "$label"
  else
    bad "$label"
    return 1
  fi
}

http_ok() {
  local url="$1"
  local code
  code="$(curl -fsSL -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")"
  [[ "$code" == "200" ]]
}

step "1/10 — npm test"
run "unit tests (43+)" npm test

step "2/10 — build + link from source"
run "npm run build" npm run build
run "npm link" npm link
export PATH="$(npm prefix -g)/bin:${HOME}/.local/bin:${PATH}"
run "om on PATH" command -v om

step "3/10 — curl install URLs"
run "openmangos install URL 200" http_ok "https://vektraindustries.com/openmangos/install"
run "agentdrive install URL 200" http_ok "https://vektraindustries.com/agentdrive/install"
run "agentdrive install is canonical script" bash -c 'curl -fsSL "https://raw.githubusercontent.com/PabloTheThinker/AgentDrive/main/install.sh" | head -1 | grep -q "#!/usr/bin/env bash"'

step "4/10 — om reset (fresh state)"
run "om reset -y" om reset -y -C "$WORKSPACE"

step "5/10 — install checks"
run "om install --check" om install --check

step "6/10 — onboard (AgentDrive + workspace)"
if om onboard -y --with-agentdrive -C "$WORKSPACE" 2>&1; then
  ok "om onboard -y --with-agentdrive"
else
  bad "om onboard -y --with-agentdrive"
fi

step "7/10 — AgentDrive"
export PATH="${HOME}/.local/bin:${HOME}/.agentdrive/venv/bin:${PATH}"
if command -v agentdrive >/dev/null 2>&1 || [[ -x "${HOME}/.agentdrive/venv/bin/agentdrive" ]]; then
  run "agentdrive on PATH" command -v agentdrive
  if agentdrive --version >/dev/null 2>&1 || agentdrive doctor >/dev/null 2>&1; then
    ok "agentdrive verify"
  else
    bad "agentdrive verify"
  fi
else
  skip "agentdrive not installed (install may have been skipped or failed)"
fi

step "8/10 — doctor + drive"
if om doctor -C "$WORKSPACE" 2>&1; then ok "om doctor"; else bad "om doctor"; fi
if om drive status -C "$WORKSPACE" 2>&1; then ok "om drive status"; else bad "om drive status"; fi

step "9/10 — sense + pack"
if om sense -C "$WORKSPACE" 2>&1 | head -20; then ok "om sense"; else bad "om sense"; fi
if om pack --write -C "$WORKSPACE" 2>&1; then
  ok "om pack --write"
  if [[ -f "$WORKSPACE/.openmangos/context-pack.md" ]]; then
    ok "context-pack.md written"
  else
    bad "context-pack.md missing"
  fi
else
  bad "om pack --write"
fi

step "10/10 — install state + version"
if [[ -f "${HOME}/.openmangos/install.yaml" ]]; then
  ok "~/.openmangos/install.yaml exists"
else
  bad "~/.openmangos/install.yaml missing"
fi
VER="$(om --version 2>/dev/null || true)"
if [[ -n "$VER" ]]; then ok "om version: $VER"; else bad "om --version empty"; fi

echo ""
echo -e "${B}Smoke summary${N}: ${G}${PASS} passed${N}, ${R}${FAIL} failed${N}, ${Y}${SKIP} skipped${N}"
if [[ "$FAIL" -gt 0 ]]; then exit 1; fi
echo -e "${G}SMOKE_PASS${N}"