#!/usr/bin/env bash
set -euo pipefail

github_token="$(printenv 'INPUT_GITHUB-TOKEN' || true)"
anthropic_key="$(printenv 'INPUT_ANTHROPIC-API-KEY' || true)"
config_path="$(printenv 'INPUT_CONFIG' || true)"
leaderboard_secret="$(printenv 'INPUT_LEADERBOARD-SECRET' || true)"

export GITHUB_TOKEN="${github_token}"
export ANTHROPIC_API_KEY="${anthropic_key}"
export LEADERBOARD_SECRET="${leaderboard_secret}"

args=(check)

if [[ -n "${config_path}" && -f "${config_path}" ]]; then
  args+=(--config "${config_path}")
fi

if [[ -n "${github_token}" ]]; then
  args+=(--post-github-comment)
fi

exec docrunner "${args[@]}"
