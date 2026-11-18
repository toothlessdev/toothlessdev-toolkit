---
name: enhance
description: "/talkie:enhance 로 호출하면 움직임이 없는 슬라이드에 내용을 설명하는 애니메이션을 추가합니다. brief.json 의 enhanceMotion 이 true 일 때만 파이프라인에 들어갑니다."
disable-model-invocation: true
---

# /talkie:enhance

- 입력: `deck.html`, `script.json`
- 출력: 고친 `deck.html`, 원본 백업 `deck.original.html`
- 선택 단계입니다. 다른 단계는 이 스킬이 없어도 동작합니다.

## 쓸 스킬

1. 사용 가능한 스킬 목록에 `animate` 가 있으면 실행합니다.
2. 없으면 `${CLAUDE_PLUGIN_ROOT}/skills/enhance/references/motion-rules.md` 를 따르고, 건너뛴 스킬 이름을 결과에 적습니다.

## 지키는 것

- 글자가 나타나는 효과를 추가하지 않습니다. 슬라이드의 구조나 흐름을 보여 주는 움직임만 넣습니다.
- 대본 줄과 맞춰 시작하도록 대본의 해당 줄에 `stageDirection` 을 적습니다.
- 새 움직임은 시간 값으로 다시 그릴 수 있게 만듭니다. `setTimeout` 으로 상태를 쌓지 않습니다.
