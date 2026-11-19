# /// script
# requires-python = ">=3.10"
# dependencies = ["playwright", "pillow"]
# ///
"""키를 한 번 누를 때 그림 영역의 픽셀이 얼마나 바뀌는지 잽니다.

변화량이 큰 키가 스토리보드에서 페이지 모핑으로 정한 키인지 대조하는 데 씁니다.
정전 효과나 시뮬레이션 재시작도 수치를 올리므로 합격선이 아니라 다시 볼 곳을 찾는 신호입니다.
"""
import argparse
import io
from pathlib import Path

from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright

PIXEL_DIFFERENCE_THRESHOLD = 30
DEFAULT_STAGE_SIZE = {"width": 1600, "height": 900}
TITLE_HEIGHT_RATIO = 0.145
CAPTION_HEIGHT_RATIO = 0.115


def parse_clip(text):
    x, y, width, height = (int(value) for value in text.split(","))
    return {"x": x, "y": y, "width": width, "height": height}


def read_stage_size(page):
    stage_size = page.evaluate("window.DECK_STAGE_SIZE ?? null")
    if not stage_size or not stage_size.get("width") or not stage_size.get("height"):
        return DEFAULT_STAGE_SIZE
    return {"width": round(stage_size["width"]), "height": round(stage_size["height"])}


def picture_area_of(stage_size):
    top = round(stage_size["height"] * TITLE_HEIGHT_RATIO)
    bottom = round(stage_size["height"] * (1 - CAPTION_HEIGHT_RATIO))
    return {"x": 0, "y": top, "width": stage_size["width"], "height": bottom - top}


def grab(page, clip):
    image = Image.open(io.BytesIO(page.screenshot(clip=clip))).convert("RGB")
    return image.resize((image.width // 2, image.height // 2))


def changed_percent(before, after):
    difference = ImageChops.difference(before, after).convert("L")
    histogram = difference.point(lambda value: 255 if value > PIXEL_DIFFERENCE_THRESHOLD else 0).histogram()
    return round(histogram[255] / sum(histogram) * 100)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("deck", type=Path)
    parser.add_argument("--keys", type=int, required=True, help="누를 키 횟수")
    parser.add_argument("--wait-ms", type=int, default=8000, help="키마다 움직임이 끝나기를 기다리는 시간")
    parser.add_argument("--clip", type=parse_clip, help="잴 영역 x,y,w,h. 생략하면 무대에서 제목과 캡션 높이를 뺀 그림 영역입니다")
    parser.add_argument("--warn-percent", type=int, default=30)
    args = parser.parse_args()

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, channel="chrome")
        page = browser.new_page(viewport=DEFAULT_STAGE_SIZE)
        page.goto(args.deck.resolve().as_uri())
        stage_size = read_stage_size(page)
        if stage_size != DEFAULT_STAGE_SIZE:
            page.set_viewport_size(stage_size)
            page.reload()
        page.wait_for_timeout(args.wait_ms)
        clip = args.clip or picture_area_of(stage_size)

        previous = grab(page, clip)
        warned_keys = []
        for key in range(1, args.keys + 1):
            page.keyboard.press("ArrowRight")
            page.wait_for_timeout(args.wait_ms)
            current = grab(page, clip)
            percent = changed_percent(previous, current)
            is_warned = percent > args.warn_percent
            if is_warned:
                warned_keys.append(key)
            print(f"{key:>3}->{key + 1:<3} {percent:>3}% {'페이지 모핑으로 정한 키인지 확인' if is_warned else ''}".rstrip())
            previous = current
        browser.close()

    print(f"{args.keys}번 중 {len(warned_keys)}번이 {args.warn_percent}% 초과: {warned_keys}")


if __name__ == "__main__":
    main()
