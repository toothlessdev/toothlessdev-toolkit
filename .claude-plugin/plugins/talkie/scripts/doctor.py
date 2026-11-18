"""대본 생성 같은 비싼 단계 전에 실행 환경에 빠진 도구가 없는지 확인합니다."""
import importlib.util
import json
import platform
import shutil
import sys


def check_command(name: str, install_hint: str) -> dict | None:
    return None if shutil.which(name) else {"name": name, "fix": install_hint}


def check_module(module_name: str, install_hint: str) -> dict | None:
    return None if importlib.util.find_spec(module_name) else {"name": module_name, "fix": install_hint}


def check_browser() -> dict | None:
    from playwright.sync_api import sync_playwright

    with sync_playwright() as playwright:
        for launch_options in ({"channel": "chrome"}, {}):
            try:
                playwright.chromium.launch(headless=True, **launch_options).close()
                return None
            except Exception:
                continue
    return {"name": "browser", "fix": "Chrome 을 설치하거나 scripts/run.sh -m playwright install chromium 을 실행합니다."}


def main():
    missing = [
        check_command("ffmpeg", "macOS 는 brew install ffmpeg, 그 외에는 배포판 패키지로 설치합니다."),
        check_module("supertonic", "uv sync 로 pyproject.toml 의존성을 설치합니다."),
        check_module("playwright", "uv sync 로 pyproject.toml 의존성을 설치합니다."),
    ]
    missing = [item for item in missing if item]
    if not any(item["name"] == "playwright" for item in missing):
        browser_problem = check_browser()
        if browser_problem:
            missing.append(browser_problem)

    warnings = []
    if importlib.util.find_spec("mlx_whisper") is None:
        warnings.append(f"{platform.system()} {platform.machine()} 에서는 Whisper 받아쓰기 검사를 건너뛰고 파형 검사만 합니다.")

    print(json.dumps({"ok": not missing, "missing": missing, "warnings": warnings}, ensure_ascii=False, indent=2))
    sys.exit(0 if not missing else 1)


if __name__ == "__main__":
    main()
