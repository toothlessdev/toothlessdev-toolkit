"""대본, 합성 음성, 애니메이션 순서를 절대 시각으로 풀어 timeline.json 과 narration.mp3 를 만듭니다."""
import argparse
import json
import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf

SLIDE_LEAD_IN_SECONDS = 0.4
DEFAULT_HOLD_SECONDS = 1.2
MP3_BITRATE = "96k"


def read_json(path: Path) -> dict:
    return json.loads(path.read_text())


def resolve_motion_starts(slide_start_seconds: float, motions: list[dict], line_times_by_id: dict[str, dict]) -> dict[str, float]:
    start_by_name: dict[str, float] = {}
    motion_by_name = {motion["name"]: motion for motion in motions}

    def resolve(motion: dict, visiting: tuple[str, ...]) -> float:
        name = motion["name"]
        if name in start_by_name:
            return start_by_name[name]
        if name in visiting:
            raise SystemExit(f"motion 순서에 순환이 있습니다: {' -> '.join(visiting + (name,))}")

        start_after = motion["startAfter"]
        kind = start_after["type"]
        if kind == "slideStart":
            base_seconds = slide_start_seconds
        elif kind == "lineStart":
            base_seconds = line_times_by_id[start_after["ref"]]["startSeconds"]
        elif kind == "lineEnd":
            base_seconds = line_times_by_id[start_after["ref"]]["endSeconds"]
        else:
            previous = motion_by_name[start_after["ref"]]
            if previous["durationSeconds"] is None:
                raise SystemExit(f"{name}: 끝나지 않는 motion {previous['name']} 뒤에 이어 붙일 수 없습니다.")
            base_seconds = resolve(previous, visiting + (name,)) + previous["durationSeconds"]

        start_by_name[name] = base_seconds + motion.get("delaySeconds", 0)
        return start_by_name[name]

    for motion in motions:
        resolve(motion, ())
    return start_by_name


def build(workspace: Path) -> tuple[dict, np.ndarray, int]:
    script = read_json(workspace / "script.json")
    manifest = read_json(workspace / "voice" / "manifest.json")
    motions_document = read_json(workspace / "motions.json")
    hold_seconds = motions_document.get("holdSecondsAfterSlide", DEFAULT_HOLD_SECONDS)

    voice_by_id = {line["id"]: line for line in manifest["lines"]}
    sample_rate = manifest["lines"][0]["sampleRate"]
    chunks: list[np.ndarray] = []
    cursor_samples = 0

    def append_silence(sample_count: int):
        nonlocal cursor_samples
        chunks.append(np.zeros(sample_count, dtype=np.float32))
        cursor_samples += sample_count

    slides = []
    for slide in script["slides"]:
        slide_start_samples = cursor_samples
        append_silence(int(SLIDE_LEAD_IN_SECONDS * sample_rate))

        timed_lines = []
        for line in slide["lines"]:
            voice_line = voice_by_id[line["id"]]
            wav, wav_rate = sf.read(workspace / voice_line["wav"], dtype="float32")
            if wav_rate != sample_rate:
                raise SystemExit(f"{line['id']}: 샘플레이트가 다릅니다 ({wav_rate}, 기준 {sample_rate})")

            start_seconds = cursor_samples / sample_rate
            chunks.append(wav)
            cursor_samples += len(wav)
            timed_lines.append({
                "id": line["id"],
                "text": line["display"],
                "startSeconds": round(start_seconds, 3),
                "endSeconds": round(cursor_samples / sample_rate, 3),
            })
            append_silence(int(line["pauseAfterSeconds"] * sample_rate))

        slide_start_seconds = slide_start_samples / sample_rate
        speech_end_seconds = cursor_samples / sample_rate
        slide_motions = [motion for motion in motions_document["motions"] if motion["slideIndex"] == slide["slideIndex"]]
        start_by_name = resolve_motion_starts(slide_start_seconds, slide_motions, {line["id"]: line for line in timed_lines})

        timed_motions = [
            {"name": motion["name"], "startSeconds": round(start_by_name[motion["name"]], 3), "durationSeconds": motion["durationSeconds"]}
            for motion in slide_motions
        ]
        motion_end_seconds = max(
            (motion["startSeconds"] + motion["durationSeconds"] for motion in timed_motions if motion["durationSeconds"] is not None),
            default=slide_start_seconds,
        )

        slide_end_seconds = max(speech_end_seconds, motion_end_seconds) + hold_seconds
        append_silence(round(slide_end_seconds * sample_rate) - cursor_samples)

        slides.append({
            "slideIndex": slide["slideIndex"],
            "title": slide["title"],
            "startSeconds": round(slide_start_seconds, 3),
            "endSeconds": round(cursor_samples / sample_rate, 3),
            "lines": timed_lines,
            "motions": timed_motions,
        })

    timeline = {"durationSeconds": round(cursor_samples / sample_rate, 3), "slides": slides}
    return timeline, np.concatenate(chunks), sample_rate


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", type=Path, required=True)
    args = parser.parse_args()

    timeline, audio, sample_rate = build(args.workspace)

    wav_path = args.workspace / "narration.wav"
    sf.write(wav_path, audio, sample_rate)
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", wav_path, "-codec:a", "libmp3lame", "-b:a", MP3_BITRATE, args.workspace / "narration.mp3"],
        check=True,
    )
    wav_path.unlink()

    (args.workspace / "timeline.json").write_text(json.dumps(timeline, ensure_ascii=False, indent=2))
    print(f"슬라이드 {len(timeline['slides'])}장, 전체 {timeline['durationSeconds'] / 60:.1f}분, mp3 {(args.workspace / 'narration.mp3').stat().st_size / 1_000_000:.1f}MB")


if __name__ == "__main__":
    main()
