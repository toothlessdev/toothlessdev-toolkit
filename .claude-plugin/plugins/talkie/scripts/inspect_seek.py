"""연속 재생으로 도달한 화면과 슬라이더로 점프한 화면이 같은지 비교합니다.

슬라이드마다 시각 두 개를 고르고 화면 세 장을 찍습니다.
- continuous: 잠깐 앞에서부터 실제로 재생해 도달합니다.
- jump-forward: 첫 슬라이드에서 점프합니다.
- jump-backward: 마지막 슬라이드에서 점프합니다.

진행 중인 CSS 애니메이션은 찍기 전에 끝내서, 쌓이는 상태가 어긋난 경우만 차이로 잡습니다.
"""
import argparse
import io
import json
import sys
from pathlib import Path

from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright

VIEWPORT = {"width": 1280, "height": 720}
PLAY_LEAD_SECONDS = 4
PIXEL_CHANNEL_TOLERANCE = 24
MAX_DIFFERENT_PIXEL_RATIO = 0.005
MAX_AUDIO_DRIFT_SECONDS = 0.3
AUDIO_READY_TIMEOUT_MS = 120_000


def choose_sample_seconds(slide: dict) -> list[float]:
    duration_seconds = slide["endSeconds"] - slide["startSeconds"]
    return [slide["startSeconds"] + duration_seconds * 0.45, slide["endSeconds"] - min(0.5, duration_seconds * 0.1)]


def measure_different_pixel_ratio(first: Image.Image, second: Image.Image) -> float:
    difference = ImageChops.difference(first.convert("RGB"), second.convert("RGB"))
    channel_masks = [channel.point(lambda value: 255 if value > PIXEL_CHANNEL_TOLERANCE else 0) for channel in difference.split()]
    any_channel = ImageChops.lighter(ImageChops.lighter(channel_masks[0], channel_masks[1]), channel_masks[2])
    return sum(1 for value in any_channel.getdata() if value) / (first.width * first.height)


def launch_browser(playwright):
    launch_args = ["--autoplay-policy=no-user-gesture-required"]
    try:
        return playwright.chromium.launch(headless=True, channel="chrome", args=launch_args)
    except Exception:
        return playwright.chromium.launch(headless=True, args=launch_args)


def capture(page) -> Image.Image:
    page.evaluate("() => { window.__talkie.finishAnimations(); document.documentElement.toggleAttribute('data-talkie-hide-ui', true); }")
    page.wait_for_timeout(120)
    page.evaluate("() => window.__talkie.finishAnimations()")
    image = Image.open(io.BytesIO(page.screenshot())).copy()
    page.evaluate("() => document.documentElement.removeAttribute('data-talkie-hide-ui')")
    return image


def jump(page, seconds: float):
    page.evaluate("(seconds) => window.__talkie.jumpTo(seconds)", seconds)
    page.wait_for_timeout(120)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", type=Path, required=True)
    parser.add_argument("--slides", help="검사할 slideIndex 를 쉼표로 적습니다. 비우면 전부 검사합니다.")
    args = parser.parse_args()

    timeline = json.loads((args.workspace / "timeline.json").read_text())
    page_path = (args.workspace / "out" / "talkie.html").resolve()
    failure_dir = args.workspace / "inspect"
    failure_dir.mkdir(exist_ok=True)

    selected_indexes = {int(value) for value in args.slides.split(",")} if args.slides else None
    slides = [slide for slide in timeline["slides"] if selected_indexes is None or slide["slideIndex"] in selected_indexes]
    last_slide_seconds = timeline["slides"][-1]["startSeconds"] + 0.1

    page_errors: list[str] = []
    samples = []
    with sync_playwright() as playwright:
        browser = launch_browser(playwright)
        page = browser.new_page(viewport=VIEWPORT)
        page.on("pageerror", lambda error: page_errors.append(str(error)))
        page.goto(page_path.as_uri())
        page.wait_for_function("() => window.__talkie && window.__talkie.getState() === 'ready'", timeout=AUDIO_READY_TIMEOUT_MS)

        audio_duration_seconds = page.evaluate("() => window.__talkie.getAudioDurationSeconds()")
        page.evaluate("() => window.__talkie.start()")
        page.wait_for_timeout(300)
        page.evaluate("() => window.__talkie.pause()")

        for slide in slides:
            for sample_seconds in choose_sample_seconds(slide):
                page.evaluate("([seconds, lead]) => window.__talkie.playUntil(seconds, lead)", [sample_seconds, PLAY_LEAD_SECONDS])
                continuous = capture(page)

                jump(page, 0.1)
                jump(page, sample_seconds)
                jump_forward = capture(page)

                jump(page, last_slide_seconds)
                jump(page, sample_seconds)
                jump_backward = capture(page)

                forward_ratio = measure_different_pixel_ratio(continuous, jump_forward)
                backward_ratio = measure_different_pixel_ratio(continuous, jump_backward)
                shown_slide_index = page.evaluate("() => window.__talkie.getShownSlideIndex()")
                passed = (
                    forward_ratio <= MAX_DIFFERENT_PIXEL_RATIO
                    and backward_ratio <= MAX_DIFFERENT_PIXEL_RATIO
                    and shown_slide_index == slide["slideIndex"]
                )

                sample = {
                    "slideIndex": slide["slideIndex"],
                    "seconds": round(sample_seconds, 2),
                    "forwardDifferentPixelRatio": round(forward_ratio, 5),
                    "backwardDifferentPixelRatio": round(backward_ratio, 5),
                    "shownSlideIndex": shown_slide_index,
                    "passed": passed,
                }
                if not passed:
                    stem = f"slide-{slide['slideIndex']:02d}-{sample_seconds:.1f}"
                    continuous.save(failure_dir / f"{stem}-continuous.png")
                    jump_forward.save(failure_dir / f"{stem}-jump-forward.png")
                    jump_backward.save(failure_dir / f"{stem}-jump-backward.png")
                samples.append(sample)
                print(json.dumps(sample, ensure_ascii=False), flush=True)
        browser.close()

    audio_drift_seconds = abs(audio_duration_seconds - timeline["durationSeconds"])
    failed_samples = [sample for sample in samples if not sample["passed"]]
    report = {
        "passed": not failed_samples and not page_errors and audio_drift_seconds <= MAX_AUDIO_DRIFT_SECONDS,
        "sampleCount": len(samples),
        "failedSamples": failed_samples,
        "pageErrors": page_errors,
        "audioDurationSeconds": round(audio_duration_seconds, 3),
        "timelineDurationSeconds": timeline["durationSeconds"],
        "failureImagesDir": str(failure_dir),
    }
    (args.workspace / "inspect-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps({key: report[key] for key in ("passed", "sampleCount", "pageErrors", "audioDurationSeconds", "timelineDurationSeconds")} | {"failedSampleCount": len(failed_samples)}, ensure_ascii=False))
    sys.exit(0 if report["passed"] else 1)


if __name__ == "__main__":
    main()
