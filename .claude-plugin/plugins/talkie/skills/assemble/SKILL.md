---
name: assemble
description: "/talkie:assemble 로 호출하면 음성과 애니메이션 순서를 타임라인으로 계산하고, 덱에 어댑터와 고정 플레이어를 넣어 결과 HTML 을 만듭니다."
disable-model-invocation: true
---

# /talkie:assemble

- 입력: `deck.html`, `script.json`, `voice/manifest.json`, `motions.json`, `adapter.js`, `brief.json`
- 출력: `timeline.json`, `narration.mp3`, `out/talkie.html`, `out/hosted/`

## 절차

1. `${CLAUDE_PLUGIN_ROOT}/scripts/run.sh build_timeline.py --workspace <작업 폴더>`
2. `${CLAUDE_PLUGIN_ROOT}/scripts/run.sh build_deck.py --workspace <작업 폴더>`

## 지키는 것

- 타임라인 시각을 손으로 고치지 않습니다. 순서가 틀렸으면 `motions.json` 을 고치고 다시 계산합니다.
- `template/player.html` 을 결과물에 맞춰 고치지 않습니다.
