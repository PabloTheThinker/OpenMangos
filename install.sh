#!/usr/bin/env bash
#
# OpenMangos Installer
#
# One-liner (recommended):
#   curl -fsSL https://vektraindustries.com/openmangos/install | bash
#
# With options:
#   curl -fsSL https://vektraindustries.com/openmangos/install | bash -s -- --no-onboard
#   OM_BRANCH=main curl -fsSL ... | bash
#
set -euo pipefail

if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
  CYAN='\033[0;36m'
  GREEN='\033[0;32m'
  YELLOW='\033[0;33m'
  RED='\033[0;31m'
  BOLD='\033[1m'
  NC='\033[0m'
else
  CYAN='' GREEN='' YELLOW='' RED='' BOLD='' NC=''
fi

log() { echo -e "${CYAN}→${NC} $*"; }
success() { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }
error() { echo -e "${RED}✗${NC} $*"; }

REPO="${OM_REPO:-https://github.com/PabloTheThinker/OpenMangos.git}"
BRANCH="${OM_BRANCH:-main}"
OM_HOME="${OM_HOME:-$HOME/.openmangos}"
SRC_DIR="${OM_SRC:-$OM_HOME/src}"
OM_ONBOARD_YES="${OM_ONBOARD_YES:-1}"
OM_WITH_OPENCODE="${OM_WITH_OPENCODE:-1}"
OM_WITH_AGENTDRIVE="${OM_WITH_AGENTDRIVE:-ask}"
RUN_ONBOARD=1

while [[ $# -gt 0 ]]; do
  case $1 in
    --branch) BRANCH="$2"; shift 2 ;;
    --no-onboard) RUN_ONBOARD=0; shift ;;
    --no-opencode) OM_WITH_OPENCODE=0; shift ;;
    --with-agentdrive) OM_WITH_AGENTDRIVE=1; shift ;;
    --no-agentdrive) OM_WITH_AGENTDRIVE=0; shift ;;
    --help|-h)
      echo "Usage: install.sh [--branch NAME] [--no-onboard] [--no-opencode] [--with-agentdrive|--no-agentdrive]"
      exit 0
      ;;
    *) shift ;;
  esac
done

print_banner() {
  echo ""
  echo -e "${BOLD}${YELLOW}🥭 OpenMangos Installer${NC}"
  echo "The terminal adapts to the problem. The model adapts to the terminal."
  echo ""
}

ensure_node() {
  if ! command -v node >/dev/null 2>&1; then
    error "Node.js 20+ is required — https://nodejs.org"
    exit 1
  fi
  local major
  major="$(node -p "process.versions.node.split('.')[0]")"
  if [[ "${major}" -lt 20 ]]; then
    error "Node ${major} detected — OpenMangos requires Node 20+"
    exit 1
  fi
  success "Node $(node --version)"
}

ensure_git() {
  if ! command -v git >/dev/null 2>&1; then
    error "git is required to install OpenMangos"
    exit 1
  fi
}

ensure_npm_path() {
  local npm_bin
  npm_bin="$(npm prefix -g 2>/dev/null)/bin"
  case ":$PATH:" in
    *":${npm_bin}:"*) ;;
    *) export PATH="${npm_bin}:$PATH" ;;
  esac
}

checkout_source() {
  mkdir -p "$OM_HOME"
  if [[ -d "${SRC_DIR}/.git" ]]; then
    log "Updating OpenMangos source at ${SRC_DIR}"
    git -C "$SRC_DIR" fetch origin "$BRANCH" --depth 1 2>/dev/null || git -C "$SRC_DIR" fetch origin
    git -C "$SRC_DIR" checkout "$BRANCH" 2>/dev/null || true
    git -C "$SRC_DIR" pull --ff-only origin "$BRANCH" 2>/dev/null || git -C "$SRC_DIR" pull --ff-only || true
  else
    log "Cloning OpenMangos (${BRANCH})"
    rm -rf "$SRC_DIR"
    git clone --depth 1 --branch "$BRANCH" "$REPO" "$SRC_DIR"
  fi

  if [[ ! -f "${SRC_DIR}/package.json" ]]; then
    error "Invalid checkout — no package.json in ${SRC_DIR}"
    exit 1
  fi
  success "Source ready: ${SRC_DIR}"
}

build_and_link() {
  cd "$SRC_DIR"
  log "npm install"
  npm install --no-fund --no-audit

  log "npm run build"
  npm run build

  log "npm link (global om)"
  npm link

  ensure_npm_path

  if ! command -v om >/dev/null 2>&1; then
    error "om not on PATH after npm link"
    echo "  Add to your shell profile:"
    echo "    export PATH=\"$(npm prefix -g)/bin:\$PATH\""
    exit 1
  fi

  local ver
  ver="$(om --version 2>/dev/null || echo 'linked')"
  success "om ${ver}"
}

run_onboard() {
  if [[ "$RUN_ONBOARD" -eq 0 ]]; then
    warn "Skipped onboarding (--no-onboard)"
    return
  fi

  local args=(onboard --install)
  if [[ "$OM_ONBOARD_YES" == "1" ]]; then
    args+=(--yes)
  fi
  if [[ "$OM_WITH_OPENCODE" == "1" ]]; then
    args+=(--with-opencode)
  fi
  if [[ "$OM_WITH_AGENTDRIVE" == "1" ]]; then
    args+=(--with-agentdrive)
  fi

  log "om ${args[*]}"
  om "${args[@]}"
}

print_done() {
  echo ""
  success "OpenMangos ready"
  echo "  om              adaptive bootstrap → agent"
  echo "  om onboard      rerun setup wizard"
  echo "  om update       rebuild from source"
  echo "  om sense        probe workspace"
  echo ""
  echo "Install source: ${SRC_DIR}"
  echo "One-liner: curl -fsSL https://vektraindustries.com/openmangos/install | bash"
  echo ""
}

print_banner
ensure_node
ensure_git
checkout_source
build_and_link
run_onboard
print_done