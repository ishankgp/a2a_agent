#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir"

if [[ -z "${VIRTUAL_ENV:-}" && -f ".venv/bin/activate" ]]; then
  # shellcheck disable=SC1091
  source ".venv/bin/activate"
fi

uvicorn services.triage.app:app --port 8001 --reload &
triage_pid=$!

uvicorn services.research.app:app --port 8002 --reload &
research_pid=$!

uvicorn services.review.app:app --port 8003 --reload &
review_pid=$!

uvicorn services.presentation.app:app --port 8004 --reload &
presentation_pid=$!

cleanup() {
  kill "$triage_pid" "$research_pid" "$review_pid" "$presentation_pid" 2>/dev/null || true
}
trap cleanup EXIT

python client/orchestrator.py
