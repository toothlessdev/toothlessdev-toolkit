---
name: voice
description: "/talkie:voice 로 호출하면 narration.json 을 Supertonic 으로 합성하고 받아쓰기와 파형으로 검증합니다."
disable-model-invocation: true
---

# /talkie:voice

- 입력: `brief.json`, `narration.json`
- 출력: `voice/lines/*.wav`, `voice/manifest.json`, `voice/verify-report.json`
- 합성과 검증은 스크립트가 합니다. 이 스킬은 실행과 실패 판단만 맡습니다.

## 절차

1. 합성과 검증을 실행합니다. 이미 있는 줄은 건너뛰고, 검증에 걸린 줄은 지운 뒤 다시 합성합니다. 최대 3회 반복합니다.

   `${CLAUDE_PLUGIN_ROOT}/scripts/run.sh render_voice.py --workspace <작업 폴더>`

2. 출력의 `unresolved` 에 줄이 있으면 사람에게 들어 볼 줄로 보고합니다. `speak` 와 `transcript` 를 비교해 발음 문제면 `narration.json` 의 그 줄을 고칩니다.
