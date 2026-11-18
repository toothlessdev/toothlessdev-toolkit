"""narration.json 의 줄을 Supertonic 으로 합성해 줄별 wav 와 voice/manifest.json 을 만듭니다.

줄 내용과 음성 설정의 해시로 파일을 저장해서, 다시 돌리면 바뀌었거나 검증에서 지워진 줄만 합성합니다.
"""
import argparse
import hashlib
import json
import subprocess
import tempfile
import time
from pathlib import Path

import numpy as np
import onnxruntime
import soundfile as sf
import supertonic.loader
import truststore

# 사내망처럼 TLS 를 재서명하는 환경에서는 certifi 로 모델 다운로드가 실패합니다.
truststore.inject_into_ssl()

from supertonic import TTS  # noqa: E402

TOTAL_STEPS = 16
# 모델 속도를 1.25 로 올리면 짧은 문장의 음절을 삼킵니다("검색도 됩니다" 가 "됩니다" 로 들림).
# 그래서 모델은 이 속도까지만 쓰고, 나머지는 합성 뒤 음정을 유지한 채 빠르게 합니다.
MAX_MODEL_SPEED = 1.05
SILENCE_THRESHOLD = 0.01
SILENCE_MARGIN_SECONDS = 0.05


def choose_onnx_providers() -> list[str]:
    available = onnxruntime.get_available_providers()
    return [provider for provider in ("CoreMLExecutionProvider", "CPUExecutionProvider") if provider in available]


def trim_silence(wav: np.ndarray, sample_rate: int) -> np.ndarray:
    voiced_indexes = np.flatnonzero(np.abs(wav) > SILENCE_THRESHOLD)
    if voiced_indexes.size == 0:
        return wav
    margin = int(SILENCE_MARGIN_SECONDS * sample_rate)
    return wav[max(0, voiced_indexes[0] - margin) : voiced_indexes[-1] + margin]


def change_tempo(wav: np.ndarray, sample_rate: int, tempo: float) -> np.ndarray:
    with tempfile.TemporaryDirectory() as temp_dir:
        input_path, output_path = Path(temp_dir) / "input.wav", Path(temp_dir) / "output.wav"
        sf.write(input_path, wav, sample_rate)
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", input_path, "-filter:a", f"atempo={tempo}", output_path],
            check=True,
        )
        stretched, _ = sf.read(output_path, dtype="float32")
    return stretched


def line_wav_path(lines_dir: Path, speak: str, voice: str, speed: float) -> Path:
    digest = hashlib.sha256(f"{voice}|{speed}|{MAX_MODEL_SPEED}|{TOTAL_STEPS}|{speak}".encode()).hexdigest()[:20]
    return lines_dir / f"{digest}.wav"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", type=Path, required=True)
    args = parser.parse_args()

    brief = json.loads((args.workspace / "brief.json").read_text())
    narration = json.loads((args.workspace / "narration.json").read_text())
    voice, speed = brief["voice"], brief["speechSpeed"]

    lines_dir = args.workspace / "voice" / "lines"
    lines_dir.mkdir(parents=True, exist_ok=True)

    wav_path_by_id = {line["id"]: line_wav_path(lines_dir, line["speak"], voice, speed) for line in narration["lines"]}
    pending_lines = [line for line in narration["lines"] if not wav_path_by_id[line["id"]].exists()]

    started_at = time.time()
    if pending_lines:
        # SDK 기본값은 CPU 전용이라 내부 기본 provider 목록을 바꿉니다. 그래서 supertonic 버전을 고정합니다.
        supertonic.loader.DEFAULT_ONNX_PROVIDERS = choose_onnx_providers()
        tts = TTS(auto_download=True)
        style = tts.get_voice_style(voice_name=voice)
        model_speed = min(speed, MAX_MODEL_SPEED)
        for line in pending_lines:
            wav, _ = tts.synthesize(line["speak"], voice_style=style, lang="ko", speed=model_speed, total_steps=TOTAL_STEPS)
            trimmed = trim_silence(np.asarray(wav, dtype=np.float32).squeeze(), tts.sample_rate)
            paced = trimmed if speed == model_speed else change_tempo(trimmed, tts.sample_rate, speed / model_speed)
            sf.write(wav_path_by_id[line["id"]], paced, tts.sample_rate)

    manifest_lines = []
    for line in narration["lines"]:
        info = sf.info(wav_path_by_id[line["id"]])
        manifest_lines.append({
            "id": line["id"],
            "speak": line["speak"],
            "wav": str(wav_path_by_id[line["id"]].relative_to(args.workspace)),
            "samples": info.frames,
            "sampleRate": info.samplerate,
        })
    (args.workspace / "voice" / "manifest.json").write_text(json.dumps({"lines": manifest_lines}, ensure_ascii=False, indent=2))

    total_seconds = sum(line["samples"] / line["sampleRate"] for line in manifest_lines)
    print(f"{voice} x{speed}: {len(manifest_lines)}줄, 새로 합성 {len(pending_lines)}줄, 음성 {total_seconds / 60:.1f}분, 걸린 시간 {time.time() - started_at:.0f}초")


if __name__ == "__main__":
    main()
