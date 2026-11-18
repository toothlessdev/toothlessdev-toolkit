"""스킬에 들어 있는 폰트를 base64 로 담은 @font-face CSS 를 출력합니다."""

import base64
import sys
from pathlib import Path

FONTS = {
    "suit": ("SUIT Variable", "SUIT-Variable.woff2"),
    "pretendard": ("Pretendard Variable", "PretendardVariable.woff2"),
}


def main() -> None:
    if len(sys.argv) != 2 or sys.argv[1] not in FONTS:
        sys.exit("사용법: font_face_css.py suit|pretendard")

    family_name, file_name = FONTS[sys.argv[1]]
    font_path = Path(__file__).resolve().parent.parent / "assets" / file_name
    encoded_font = base64.b64encode(font_path.read_bytes()).decode()

    print(
        f'@font-face{{font-family:"{family_name}";font-style:normal;'
        f"font-weight:100 900;font-display:swap;"
        f'src:url("data:font/woff2;base64,{encoded_font}") format("woff2")}}'
    )


if __name__ == "__main__":
    main()
