#!/bin/sh
set -eu

plugin_root="$(cd "$(dirname "$0")/.." && pwd)"
script_name="$1"
shift

# 플러그인 설치 경로는 업데이트 때 바뀌므로 무거운 가상환경은 밖에 둡니다.
export UV_PROJECT_ENVIRONMENT="${TALKIE_ENV_DIR:-$HOME/.cache/talkie/venv}"
export UV_NATIVE_TLS=1

exec uv run --quiet --project "$plugin_root" python "$plugin_root/scripts/$script_name" "$@"
