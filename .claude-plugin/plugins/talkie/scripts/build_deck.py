"""덱 HTML 에 timeline, 어댑터, 고정 플레이어, 오디오를 넣어 결과물을 만듭니다.

- single: mp3 를 base64 로 넣은 HTML 파일 하나입니다. 파일만 전달해도 재생됩니다.
- hosted: index.html 과 narration.mp3 두 파일입니다. 아티팩트처럼 페이지 크기 제한이 있는 곳에 올릴 때 씁니다.
- compact: 음성을 모노 48kbps 로 다시 인코딩한 HTML 파일 하나입니다. 열무처럼 파일 하나만 받고 크기 제한이 있는 곳에 올릴 때 씁니다.
"""
import argparse
import base64
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

PLUGIN_ROOT = Path(__file__).parent.parent
PLAYER_PATH = PLUGIN_ROOT / "template" / "player.html"
COMPACT_BITRATE = "48k"


def escape_for_inline_script(text: str) -> str:
    return text.replace("</", "<\\/")


def inject_before_body_end(deck_html: str, injection: str) -> str:
    body_end_index = deck_html.rfind("</body>")
    if body_end_index < 0:
        raise SystemExit("덱 HTML 에서 </body> 를 찾지 못했습니다.")
    return deck_html[:body_end_index] + injection + deck_html[body_end_index:]


def build_injection(workspace: Path, audio_fields: dict) -> str:
    brief = json.loads((workspace / "brief.json").read_text())
    timeline = json.loads((workspace / "timeline.json").read_text())
    data = {"timeline": timeline, "accentColor": brief.get("accentColor"), **audio_fields}
    return (
        f"<script data-talkie-ui>window.__TALKIE_DATA__={escape_for_inline_script(json.dumps(data, ensure_ascii=False))};</script>"
        f"<script data-talkie-ui>{escape_for_inline_script((workspace / 'adapter.js').read_text())}</script>"
        f"{PLAYER_PATH.read_text()}"
    )


def encode_compact_mp3(mp3_path: Path) -> bytes:
    with tempfile.TemporaryDirectory() as temp_dir:
        output_path = Path(temp_dir) / "compact.mp3"
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", mp3_path, "-ac", "1", "-codec:a", "libmp3lame", "-b:a", COMPACT_BITRATE, output_path],
            check=True,
        )
        return output_path.read_bytes()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", type=Path, required=True)
    parser.add_argument("--mode", choices=["single", "hosted", "compact", "both"], default="both")
    args = parser.parse_args()

    workspace = args.workspace
    deck_html = (workspace / "deck.html").read_text()
    mp3_path = workspace / "narration.mp3"
    out_dir = workspace / "out"
    out_dir.mkdir(exist_ok=True)

    if args.mode in ("single", "both"):
        audio_base64 = base64.b64encode(mp3_path.read_bytes()).decode()
        single_path = out_dir / "talkie.html"
        single_path.write_text(inject_before_body_end(deck_html, build_injection(workspace, {"audioBase64": audio_base64})))
        print(f"{single_path} {single_path.stat().st_size / 1_000_000:.1f}MB")

    if args.mode == "compact":
        audio_base64 = base64.b64encode(encode_compact_mp3(mp3_path)).decode()
        compact_path = out_dir / "talkie-compact.html"
        compact_path.write_text(inject_before_body_end(deck_html, build_injection(workspace, {"audioBase64": audio_base64})))
        print(f"{compact_path} {compact_path.stat().st_size / 1_000_000:.1f}MB")

    if args.mode in ("hosted", "both"):
        hosted_dir = out_dir / "hosted"
        hosted_dir.mkdir(exist_ok=True)
        hosted_page = hosted_dir / "index.html"
        hosted_page.write_text(inject_before_body_end(deck_html, build_injection(workspace, {"audioUrl": "narration.mp3"})))
        shutil.copyfile(mp3_path, hosted_dir / "narration.mp3")
        print(f"{hosted_page} {hosted_page.stat().st_size / 1_000_000:.1f}MB, mp3 {mp3_path.stat().st_size / 1_000_000:.1f}MB")


if __name__ == "__main__":
    main()
