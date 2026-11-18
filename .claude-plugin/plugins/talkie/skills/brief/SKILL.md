---
name: brief
description: "/talkie:brief 로 호출하면 발표의 청중, 톤, 길이, 목소리를 물어 brief.json 을 만듭니다. talkie 파이프라인의 첫 단계입니다."
disable-model-invocation: true
---

# /talkie:brief

- 입력: 덱 경로, 기존 대본이 있으면 그 경로
- 출력: `<작업 폴더>/brief.json` (`${CLAUDE_PLUGIN_ROOT}/schemas/brief.schema.json`)

## 절차

1. 덱을 먼저 훑어 슬라이드 수와 주제를 파악합니다. 덱에서 알 수 있는 것은 묻지 않습니다.
2. AskUserQuestion 으로 한 번에 묻습니다. 네 가지를 넘기면 나눠 묻습니다.
   - 청중: 누가 듣는지
   - 톤: 예를 들어 사내 공유, 컨퍼런스, 강의
   - 길이: 목표 분
   - 대본: 새로 쓰기, 기존 대본이나 덱의 발표자 노트 그대로 쓰기(`keep`). 노트를 쓰면 `existingScriptPath` 를 뺍니다.
3. 묻지 않은 값은 기본값을 씁니다. 기본값을 쓴 항목을 응답에 한 줄로 적습니다.
   - `voice`: `F1`
   - `speechSpeed`: `1.25`
   - `enhanceMotion`: `false`. 사용자가 애니메이션 추가를 요청했을 때만 `true` 입니다.
   - `accentColor`: 덱의 강조색을 찾아 넣고, 못 찾으면 뺍니다.
4. `run.sh validate.py brief --workspace <작업 폴더>` 를 통과시킵니다.
