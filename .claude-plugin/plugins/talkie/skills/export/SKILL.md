---
name: export
description: "/talkie:export 로 호출하면 talkie 결과 HTML 을 음성과 자막이 들어간 mp4 영상으로 뽑습니다. '영상으로 뽑아줘', 'mp4 로 만들어줘', '쇼츠로 올릴 파일', '유튜브에 올릴 영상' 같은 요청에 씁니다."
argument-hint: "<작업 폴더> [--size WxH] [--fps 30] [--start 초] [--end 초] [--no-subtitles]"
---

# /talkie:export

- 입력: `out/talkie.html`, `timeline.json`, `narration.mp3`
- 출력: `out/talkie.mp4` (H.264, AAC, `yuv420p`)
- 준비: `ffmpeg`, Chrome 또는 Playwright Chromium

## 절차

1. 앞부분만 먼저 뽑아 봅니다. 화면 크기와 자막 위치가 맞는지 프레임을 열어 봅니다.

   `${CLAUDE_PLUGIN_ROOT}/scripts/run.sh export_video.py --workspace <작업 폴더> --end 10 --output <작업 폴더>/out/preview.mp4`

2. 맞으면 전체를 백그라운드로 뽑습니다. 프레임 하나에 실제로 0.2~0.3초가 걸려서, 1분 영상(30fps)이면 7~9분이 걸립니다.

   `${CLAUDE_PLUGIN_ROOT}/scripts/run.sh export_video.py --workspace <작업 폴더>`

3. `ffprobe` 로 길이와 크기를 확인하고, 전환 구간 몇 곳의 프레임을 뽑아 직접 봅니다.

## 화면 크기

- 덱이 `window.DECK_STAGE_SIZE = { width, height }` 를 알리면 그 크기로 찍습니다. 세로 쇼츠 덱은 1080x1920 입니다.
- 알리지 않는 덱은 1920x1080 으로 찍습니다. 다르면 `--size 1080x1920` 처럼 직접 줍니다.
- 자막 글자 크기는 화면 짧은 변의 4% 입니다. 1080x1920 이면 43px 입니다.

## 시간을 맞추는 방식

- 화면을 실제 시간으로 녹화하지 않습니다. 플레이어를 멈춘 채 프레임 시각마다 점프해서 찍으므로, 프레임 수와 음성 길이가 항상 맞습니다.
- 어댑터가 멈추지 않은 CSS 애니메이션도 프레임 시각에 맞춰 진행시킵니다.
- 그래서 영상 품질은 어댑터의 `seekMotion` 이 그 시각 화면을 정확히 그리는지에 달려 있습니다. `/talkie:inspect` 를 통과한 결과로 뽑습니다.

## 보고

- 마지막에 출력되는 JSON 의 `passed`, `output`, `stageSize`, `durationSeconds`, `pageErrors` 를 그대로 보고합니다.
- `pageErrors` 가 있으면 영상이 만들어졌어도 완료라고 하지 않습니다.
- 확인한 프레임과 확인하지 않은 구간을 나눠 말합니다.
