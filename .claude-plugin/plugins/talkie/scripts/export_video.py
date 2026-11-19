"""결과 HTML 을 프레임마다 그 시각으로 점프해 찍고, 합친 음성과 묶어 mp4 로 만듭니다.

화면을 실제 시간으로 녹화하지 않습니다. 녹화는 화면을 찍는 속도에 따라 프레임이 빠지고 음성과 어긋납니다.
대신 플레이어를 멈춘 채 프레임 시각마다 jumpTo 로 점프해 찍으므로, 프레임 수와 음성 길이가 항상 맞습니다.
그래서 결과는 어댑터의 seekMotion 이 그 시각의 화면을 정확히 그리는지에 달려 있습니다. inspect 를 통과한 덱을 씁니다.
"""
import argparse
import json
import math
import subprocess
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

DEFAULT_STAGE_SIZE = {"width": 1920, "height": 1080}
AUDIO_READY_TIMEOUT_MS = 120_000
JPEG_QUALITY = 92
SUBTITLE_SIZE_RATIO = 0.04
PROGRESS_STEP_PERCENT = 10

EXPORT_STYLE = """
.talkie-bar { display: none !important; }
.talkie-subtitle {
    transition: none !important;
    transform: translate(-50%, 0) !important;
    font-size: var(--talkie-export-subtitle-size) !important;
    max-width: 88vw !important;
}
"""


def launch_browser(playwright):
    launch_args = ["--autoplay-policy=no-user-gesture-required", "--hide-scrollbars"]
    try:
        return playwright.chromium.launch(headless=True, channel="chrome", args=launch_args)
    except Exception:
        return playwright.chromium.launch(headless=True, args=launch_args)


def parse_size(text: str) -> dict:
    width, height = (int(value) for value in text.lower().split("x"))
    return {"width": width, "height": height}


def read_stage_size(page) -> dict:
    stage_size = page.evaluate("() => window.DECK_STAGE_SIZE ?? null")
    if not stage_size or not stage_size.get("width") or not stage_size.get("height"):
        return DEFAULT_STAGE_SIZE
    return {"width": round(stage_size["width"]), "height": round(stage_size["height"])}


def open_player(page, page_path: Path, stage_size: dict, shows_subtitles: bool):
    page.set_viewport_size(stage_size)
    page.goto(page_path.as_uri())
    page.wait_for_function("() => window.__talkie && window.__talkie.getState() === 'ready'", timeout=AUDIO_READY_TIMEOUT_MS)
    page.evaluate("() => window.deckReady ?? null")

    subtitle_size_pixels = round(min(stage_size["width"], stage_size["height"]) * SUBTITLE_SIZE_RATIO)
    style = EXPORT_STYLE if shows_subtitles else EXPORT_STYLE + ".talkie-subtitle { display: none !important; }"
    page.add_style_tag(content=style)
    page.evaluate(f"() => document.documentElement.style.setProperty('--talkie-export-subtitle-size', '{subtitle_size_pixels}px')")

    page.evaluate("() => window.__talkie.start()")
    page.wait_for_timeout(300)
    page.evaluate("() => window.__talkie.pause()")


# 어댑터가 멈추지 않고 실제 시간으로 흐르게 둔 CSS 애니메이션을 프레임 시각에 묶습니다.
# 한 프레임을 찍는 데 실제로 0.2초 넘게 걸려서, 그대로 두면 영상에서는 전환이 몇 배 빨리 끝납니다.
# 처음 본 프레임의 시각과 진행 위치를 기억해 두고, 그 뒤로는 영상 시각만큼만 진행시킵니다.
CAPTURE_FRAME_SCRIPT = """([seconds]) => new Promise((resolve) => {
    window.__talkie.jumpTo(seconds);
    const drivenAnimations = (window.__talkieExportDriven ??= new WeakMap());
    for (const animation of document.getAnimations()) {
        let anchor = drivenAnimations.get(animation);
        if (!anchor) {
            if (animation.playState !== "running") continue;
            anchor = { seconds, currentTimeMs: animation.currentTime ?? 0 };
            drivenAnimations.set(animation, anchor);
        }
        animation.pause();
        animation.currentTime = anchor.currentTimeMs + (seconds - anchor.seconds) * 1000;
    }
    requestAnimationFrame(() => requestAnimationFrame(resolve));
})"""


def capture_frame_at(page, seconds: float) -> bytes:
    page.evaluate(CAPTURE_FRAME_SCRIPT, [seconds])
    return page.screenshot(type="jpeg", quality=JPEG_QUALITY)


def start_encoder(output_path: Path, audio_path: Path, fps: int, start_seconds: float, duration_seconds: float):
    command = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "image2pipe", "-framerate", str(fps), "-c:v", "mjpeg", "-i", "-",
        "-ss", f"{start_seconds:.3f}", "-t", f"{duration_seconds:.3f}", "-i", str(audio_path),
        "-map", "0:v", "-map", "1:a",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart", "-shortest",
        str(output_path),
    ]
    return subprocess.Popen(command, stdin=subprocess.PIPE)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", type=Path, required=True)
    parser.add_argument("--output", type=Path, help="기본값은 <작업 폴더>/out/talkie.mp4 입니다")
    parser.add_argument("--fps", type=int, default=30)
    parser.add_argument("--start", type=float, default=0.0, help="자를 구간의 시작 초. 일부만 먼저 확인할 때 씁니다")
    parser.add_argument("--end", type=float, help="자를 구간의 끝 초. 비우면 끝까지입니다")
    parser.add_argument("--size", type=parse_size, help="화면 크기 WxH. 비우면 덱의 window.DECK_STAGE_SIZE, 그것도 없으면 1920x1080 입니다")
    parser.add_argument("--no-subtitles", action="store_true", help="자막을 영상에 넣지 않습니다")
    args = parser.parse_args()

    timeline = json.loads((args.workspace / "timeline.json").read_text())
    page_path = (args.workspace / "out" / "talkie.html").resolve()
    audio_path = (args.workspace / "narration.mp3").resolve()
    output_path = (args.output or args.workspace / "out" / "talkie.mp4").resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    end_seconds = min(args.end or timeline["durationSeconds"], timeline["durationSeconds"])
    duration_seconds = end_seconds - args.start
    if duration_seconds <= 0:
        sys.exit("--end 가 --start 보다 커야 합니다")
    frame_count = math.ceil(duration_seconds * args.fps)

    page_errors: list[str] = []
    with sync_playwright() as playwright:
        browser = launch_browser(playwright)
        page = browser.new_page(viewport=DEFAULT_STAGE_SIZE, device_scale_factor=1)
        page.on("pageerror", lambda error: page_errors.append(str(error)))
        page.goto(page_path.as_uri())
        stage_size = args.size or read_stage_size(page)
        open_player(page, page_path, stage_size, shows_subtitles=not args.no_subtitles)

        encoder = start_encoder(output_path, audio_path, args.fps, args.start, duration_seconds)
        next_progress_percent = PROGRESS_STEP_PERCENT
        for frame_index in range(frame_count):
            encoder.stdin.write(capture_frame_at(page, args.start + frame_index / args.fps))
            progress_percent = (frame_index + 1) * 100 / frame_count
            if progress_percent >= next_progress_percent:
                print(f"{int(progress_percent)}% ({frame_index + 1}/{frame_count} 프레임)", flush=True)
                next_progress_percent += PROGRESS_STEP_PERCENT
        encoder.stdin.close()
        encoder_exit_code = encoder.wait()
        browser.close()

    report = {
        "passed": encoder_exit_code == 0 and not page_errors,
        "output": str(output_path),
        "stageSize": stage_size,
        "fps": args.fps,
        "frameCount": frame_count,
        "durationSeconds": round(duration_seconds, 3),
        "pageErrors": page_errors,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    sys.exit(0 if report["passed"] else 1)


if __name__ == "__main__":
    main()
