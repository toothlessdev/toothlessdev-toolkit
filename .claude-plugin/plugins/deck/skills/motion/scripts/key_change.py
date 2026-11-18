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


def parse_clip(text):
    x, y, width, height = (int(value) for value in text.split(","))
    return {"x": x, "y": y, "width": width, "height": height}


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
    parser.add_argument("--clip", type=parse_clip, default=parse_clip("0,130,1600,665"), help="잴 영역 x,y,w,h. 제목과 캡션은 뺍니다")
    parser.add_argument("--warn-percent", type=int, default=30)
    args = parser.parse_args()

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, channel="chrome")
        page = browser.new_page(viewport={"width": 1600, "height": 900})
        page.goto(args.deck.resolve().as_uri())
        page.wait_for_timeout(args.wait_ms)

        previous = grab(page, args.clip)
        warned_keys = []
        for key in range(1, args.keys + 1):
            page.keyboard.press("ArrowRight")
            page.wait_for_timeout(args.wait_ms)
            current = grab(page, args.clip)
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
