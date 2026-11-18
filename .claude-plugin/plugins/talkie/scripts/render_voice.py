"""합성과 검증을 걸러진 줄이 없을 때까지 반복합니다.

워크플로 에이전트가 명령을 여러 번 실행하게 하면 토큰이 많이 들고 실행을 빠뜨릴 수 있어서, 반복은 여기서 합니다.
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
MAX_ROUNDS = 3


def run_step(script_name: str, workspace: Path, *extra_args: str) -> int:
    return subprocess.run([sys.executable, SCRIPT_DIR / script_name, "--workspace", workspace, *extra_args]).returncode


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", type=Path, required=True)
    parser.add_argument("--skip-verify", action="store_true")
    args = parser.parse_args()

    for round_number in range(1, MAX_ROUNDS + 1):
        if run_step("synthesize.py", args.workspace) != 0:
            print(json.dumps({"ok": False, "step": "synthesize", "rounds": round_number}))
            sys.exit(1)

        if args.skip_verify:
            print(json.dumps({"ok": True, "verified": False, "rounds": round_number}))
            return

        is_last_round = round_number == MAX_ROUNDS
        verify_args = ["--keep-rejected"] if is_last_round else []
        if run_step("verify_audio.py", args.workspace, *verify_args) == 0:
            print(json.dumps({"ok": True, "verified": True, "rounds": round_number, "unresolved": []}))
            return

    # 받아쓰기 오류일 수도 있어서 파이프라인을 세우지 않고, 사람이 들어볼 줄로 넘깁니다.
    report = json.loads((args.workspace / "voice" / "verify-report.json").read_text())
    print(json.dumps({"ok": True, "verified": True, "rounds": MAX_ROUNDS, "unresolved": report["rejected"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
