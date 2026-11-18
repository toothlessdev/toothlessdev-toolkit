"""파이프라인 단계 사이의 JSON 산출물을 스키마와 교차 규칙으로 검사합니다.

사용법: run.sh validate.py <brief|script|narration|motions> --workspace <dir>
"""
import argparse
import json
import re
import sys
from pathlib import Path

from jsonschema import Draft202012Validator

SCHEMA_DIR = Path(__file__).parent.parent / "schemas"

# 합성 모델이 제멋대로 읽는 글자입니다. 숫자와 영문은 모두 한글 발음으로 풀어야 합니다.
UNPRONOUNCED = re.compile(r"[A-Za-z0-9%#$&*+=/\\<>_`~^|{}\[\]…“”‘’]")


def read_json(path: Path) -> dict:
    return json.loads(path.read_text())


def check_schema(kind: str, document: dict) -> list[str]:
    schema = read_json(SCHEMA_DIR / f"{kind}.schema.json")
    return [f"{'/'.join(map(str, error.path))}: {error.message}" for error in Draft202012Validator(schema).iter_errors(document)]


def list_script_line_ids(workspace: Path) -> list[str]:
    script = read_json(workspace / "script.json")
    return [line["id"] for slide in script["slides"] for line in slide["lines"]]


def check_script(workspace: Path, script: dict) -> list[str]:
    errors = []
    slide_indexes = [slide["slideIndex"] for slide in script["slides"]]
    if slide_indexes != list(range(len(slide_indexes))):
        errors.append(f"slideIndex 가 0부터 빠짐없이 이어지지 않습니다: {slide_indexes}")
    line_ids = [line["id"] for slide in script["slides"] for line in slide["lines"]]
    duplicates = sorted({line_id for line_id in line_ids if line_ids.count(line_id) > 1})
    if duplicates:
        errors.append(f"줄 id 중복: {duplicates}")
    return errors


def check_narration(workspace: Path, narration: dict) -> list[str]:
    expected_ids = list_script_line_ids(workspace)
    actual_ids = [line["id"] for line in narration["lines"]]
    errors = []
    if sorted(expected_ids) != sorted(actual_ids):
        missing = sorted(set(expected_ids) - set(actual_ids))
        extra = sorted(set(actual_ids) - set(expected_ids))
        errors.append(f"줄 id 불일치. 빠짐: {missing}, 추가됨: {extra}")
    for line in narration["lines"]:
        leftover = UNPRONOUNCED.findall(line["speak"])
        if leftover:
            errors.append(f"{line['id']}: 발음으로 풀지 않은 글자 {sorted(set(leftover))}: {line['speak']}")
    return errors


def check_motions(workspace: Path, motions: dict) -> list[str]:
    script = read_json(workspace / "script.json")
    line_ids_by_slide = {slide["slideIndex"]: {line["id"] for line in slide["lines"]} for slide in script["slides"]}
    names_by_slide: dict[int, set[str]] = {}
    for motion in motions["motions"]:
        names_by_slide.setdefault(motion["slideIndex"], set()).add(motion["name"])

    errors = []
    for motion in motions["motions"]:
        slide_index, start_after = motion["slideIndex"], motion["startAfter"]
        label = f"슬라이드 {slide_index} {motion['name']}"
        if slide_index not in line_ids_by_slide:
            errors.append(f"{label}: 없는 슬라이드입니다.")
            continue
        if start_after["type"] in ("lineStart", "lineEnd") and start_after.get("ref") not in line_ids_by_slide[slide_index]:
            errors.append(f"{label}: 이 슬라이드에 없는 줄을 가리킵니다: {start_after.get('ref')}")
        if start_after["type"] == "motionEnd" and start_after.get("ref") not in names_by_slide[slide_index]:
            errors.append(f"{label}: 이 슬라이드에 없는 motion 을 가리킵니다: {start_after.get('ref')}")
    return errors


CROSS_CHECK_BY_KIND = {"script": check_script, "narration": check_narration, "motions": check_motions}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("kind", choices=["brief", "script", "narration", "motions"])
    parser.add_argument("--workspace", type=Path, required=True)
    args = parser.parse_args()

    document = read_json(args.workspace / f"{args.kind}.json")
    errors = check_schema(args.kind, document)
    if not errors and args.kind in CROSS_CHECK_BY_KIND:
        errors = CROSS_CHECK_BY_KIND[args.kind](args.workspace, document)

    print(json.dumps({"ok": not errors, "errors": errors}, ensure_ascii=False, indent=2))
    sys.exit(0 if not errors else 1)


if __name__ == "__main__":
    main()
