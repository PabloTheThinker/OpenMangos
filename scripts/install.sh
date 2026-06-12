#!/usr/bin/env bash
# Compatibility wrapper — delegates to canonical root install.sh
#
# Prefer:
#   curl -fsSL https://vektraindustries.com/openmango/install | bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CANONICAL="$ROOT/install.sh"

if [[ ! -f "$CANONICAL" ]]; then
  echo "error: canonical installer not found at $CANONICAL" >&2
  exit 1
fi

if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
  echo -e "\033[0;33m⚠\033[0m scripts/install.sh is a compatibility wrapper."
  echo "  Canonical: curl -fsSL https://vektraindustries.com/openmango/install | bash"
  echo ""
fi

exec bash "$CANONICAL" "$@"