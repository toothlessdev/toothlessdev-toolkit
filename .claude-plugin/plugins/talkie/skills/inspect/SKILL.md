---
name: inspect
description: "/talkie:inspect 로 호출하면 결과 HTML 을 브라우저에서 돌려, 연속 재생한 화면과 슬라이더로 점프한 화면이 같은지 비교합니다."
disable-model-invocation: true
---

# /talkie:inspect

- 입력: `out/talkie.html`, `timeline.json`
- 출력: `inspect-report.json`, 실패 표본 이미지 `inspect/*.png`

## 절차

`${CLAUDE_PLUGIN_ROOT}/scripts/run.sh inspect_seek.py --workspace <작업 폴더>`

- 슬라이드마다 시각 두 개를 실제로 재생해 비교합니다. 슬라이드 수에 비례해 수 분이 걸립니다.
- 어댑터를 고친 뒤에는 `--slides 10,11` 처럼 걸린 슬라이드만 먼저 돌리고, 마지막에 전체를 돌립니다.

## 보고

- `passed` 가 false 면 실패한 슬라이드, 차이 비율, 이미지 경로, `pageErrors` 를 그대로 보고합니다.
- 임계값을 바꿔 통과시키지 않습니다.
- 이 검사는 쌓이는 상태의 어긋남을 찾습니다. 진행 중인 CSS 애니메이션은 끝낸 뒤 찍으므로, 전환 효과의 모양과 음성의 입 맞춤은 보장하지 않습니다.
