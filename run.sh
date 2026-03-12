#!/usr/bin/env bash
set -euo pipefail

# Convenience script to serve the static site locally
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

python3 -m http.server 8000
