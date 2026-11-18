"""합성한 줄을 받아쓰기와 파형으로 검사하고, 어긋난 줄의 wav 를 지웁니다.

지운 줄은 synthesize.py 를 다시 돌리면 그 줄만 새로 합성됩니다.
판정 기준:
- 받아쓴 한글이 원문보다 확연히 깁니다: 끝에 군소리가 붙었습니다.
- 한자나 가나가 섞여 나옵니다: 다른 언어로 새어 나갔습니다.
- 한글 유사도가 낮습니다: 다른 말을 했습니다.
- 원문에 없는 군소리로 시작합니다: 첫 프레임에서 머뭇거림을 생성했습니다.
"""
import argparse
import difflib
import importlib.util
import json
import re
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
import truststore

truststore.inject_into_ssl()

WHISPER_REPO = "mlx-community/whisper-large-v3-turbo"
# 0.6 으로는 문장 절반을 삼킨 줄도 통과했습니다.
MIN_SIMILARITY_RATIO = 0.85
MAX_EXTRA_LENGTH_RATIO = 1.2
FOREIGN_SCRIPT = re.compile(r"[぀-ヿ一-鿿]")
LEADING_FILLER = re.compile(r"^(어+|음+|아+|오+|으+|에+|흠+|엄+)[\s,.…~]")
# "하. 아니 진짜" 처럼 대본이 짧은 말로 시작해 쉬면, 파형이 앞머리 군소리와 같은 모양이 됩니다.
STARTS_WITH_SHORT_UTTERANCE = re.compile(r"^[가-힣]{1,2}[,.?!]")


def find_leading_blip(wav: np.ndarray, sample_rate: int) -> str | None:
    """Whisper 는 짧은 군소리를 받아쓰기에서 지우는 경향이 있어서 파형으로도 봅니다."""
    frame_length = int(0.02 * sample_rate)
    frame_count = len(wav) // frame_length
    if frame_count == 0:
        return "너무 짧음"

    frames = wav[: frame_count * frame_length].reshape(frame_count, frame_length)
    frame_rms = np.sqrt(np.mean(frames**2, axis=1))
    is_voiced = frame_rms > max(0.01, frame_rms.max() * 0.08)

    voiced_frames = np.flatnonzero(is_voiced)
    if voiced_frames.size == 0:
        return "소리 없음"
    first_voiced = voiced_frames[0]
    if is_voiced[first_voiced:].all():
        return None
    first_silent_after = first_voiced + np.argmin(is_voiced[first_voiced:])
    next_voiced = voiced_frames[voiced_frames > first_silent_after]
    if next_voiced.size == 0:
        return None

    blip_seconds = (first_silent_after - first_voiced) * 0.02
    gap_seconds = (next_voiced[0] - first_silent_after) * 0.02
    if blip_seconds < 0.3 and gap_seconds >= 0.2:
        return f"앞머리 군소리 {blip_seconds * 1000:.0f}ms, 뒤 무음 {gap_seconds * 1000:.0f}ms"
    return None


def keep_hangul(text: str) -> str:
    return re.sub(r"[^가-힣]", "", text)


def keep_words(text: str) -> str:
    return re.sub(r"[^가-힣A-Za-z0-9]", "", text).lower()


def judge_transcript(speak: str, display: str, transcript: str) -> str | None:
    if FOREIGN_SCRIPT.search(transcript):
        return "다른 언어 글자가 섞임"

    filler = LEADING_FILLER.match(transcript)
    if filler and not speak.startswith(filler.group(1)):
        return f"원문에 없는 군소리 '{filler.group(1)}' 로 시작"

    # Whisper 는 "엠에스에스 여덟 곳" 을 "MSS 8곳" 으로 받아쓰므로 발음 텍스트와 자막 원문 양쪽에 비교합니다.
    expected_pairs = [(keep_hangul(speak), keep_hangul(transcript)), (keep_words(display), keep_words(transcript))]
    if all(len(heard) > len(expected) * MAX_EXTRA_LENGTH_RATIO + 2 for expected, heard in expected_pairs):
        return f"원문보다 김 (받아쓰기 {transcript!r})"

    similarity_ratio = max(difflib.SequenceMatcher(None, expected, heard).ratio() for expected, heard in expected_pairs)
    if similarity_ratio < MIN_SIMILARITY_RATIO:
        return f"유사도 낮음 {similarity_ratio:.2f}"
    return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", type=Path, required=True)
    parser.add_argument("--keep-rejected", action="store_true", help="마지막 시도에서는 걸린 줄을 지우지 않고 보고만 합니다.")
    args = parser.parse_args()

    manifest = json.loads((args.workspace / "voice" / "manifest.json").read_text())
    script = json.loads((args.workspace / "script.json").read_text())
    display_by_id = {line["id"]: line["display"] for slide in script["slides"] for line in slide["lines"]}

    transcribe = None
    if importlib.util.find_spec("mlx_whisper"):
        import mlx_whisper

        transcribe = lambda wav_path: mlx_whisper.transcribe(  # noqa: E731
            str(wav_path), path_or_hf_repo=WHISPER_REPO, language="ko", condition_on_previous_text=False
        )["text"].strip()

    rejected = []
    for line in manifest["lines"]:
        wav_path = args.workspace / line["wav"]
        wav, sample_rate = sf.read(wav_path, dtype="float32")
        transcript = transcribe(wav_path) if transcribe else ""
        blip_reason = None if STARTS_WITH_SHORT_UTTERANCE.match(line["speak"]) else find_leading_blip(wav, sample_rate)
        reason = blip_reason or (judge_transcript(line["speak"], display_by_id[line["id"]], transcript) if transcribe else None)
        if reason:
            if not args.keep_rejected:
                wav_path.unlink()
            rejected.append({"id": line["id"], "reason": reason, "speak": line["speak"], "transcript": transcript})

    report = {
        "checkedLineCount": len(manifest["lines"]),
        "rejected": rejected,
        "usedTranscription": transcribe is not None,
    }
    (args.workspace / "voice" / "verify-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps({key: report[key] for key in ("checkedLineCount", "usedTranscription")} | {"rejectedCount": len(rejected)}, ensure_ascii=False))
    sys.exit(1 if rejected else 0)


if __name__ == "__main__":
    main()
