---
name: talkie
description: "장표 HTML 이나 Claude 아티팩트에 대본, 음성, 자막, 유튜브식 재생 컨트롤을 입혀 새 HTML 로 만듭니다. /talkie:talkie <덱 경로 또는 아티팩트 URL> 로 호출합니다. '발표자료에 내레이션 붙여줘', '장표를 영상처럼 재생되게 해줘', '덱에 음성이랑 자막 넣어줘' 같은 요청에 씁니다."
argument-hint: "<덱 HTML 경로 또는 아티팩트 URL> [--skip-verify]"
---

# /talkie:talkie

- 파이프라인 순서만 책임집니다. 각 단계의 판단은 단계 스킬에 있고, 실행 순서는 `produce` 워크플로에 있습니다.
- 이 스킬 호출이 곧 Workflow 도구 사용 승인입니다.
- PPTX 는 받지 않습니다.

## 입력

`$ARGUMENTS`

## 절차

1. 환경 확인
   - `${CLAUDE_PLUGIN_ROOT}/scripts/run.sh doctor.py` 를 실행합니다.
   - `ok` 가 false 면 빠진 항목과 `fix` 를 보여 주고 멈춥니다. `warnings` 는 그대로 전달합니다.

2. 작업 폴더 준비
   - 덱 이름으로 `<현재 폴더>/.talkie/<덱 이름>/` 을 만듭니다.
   - 덱을 그 폴더의 `deck.html` 로 복사합니다. 입력이 아티팩트 URL 이면 Artifact 도구의 read 로 받은 파일을 복사합니다.
   - 원본 덱은 고치지 않습니다.

3. 브리프 작성
   - `${CLAUDE_PLUGIN_ROOT}/skills/brief/SKILL.md` 를 따라 `brief.json` 을 만듭니다. 사용자에게 묻는 일은 이 단계에서 끝냅니다.

4. 대본 만들기
   - Workflow 도구를 `name: "talkie:produce"`, `args: { "stage": "draft", "pluginRoot": "${CLAUDE_PLUGIN_ROOT}", "workspace": "<작업 폴더 절대 경로>" }` 로 호출합니다.
   - 끝나면 `script.json` 의 슬라이드 수, 줄 수, 예상 길이와 대본을 보여 주고 승인을 받습니다.
   - 고칠 곳이 있으면 `script.json` 을 고친 뒤 `run.sh validate.py script --workspace <작업 폴더>` 를 다시 통과시킵니다.
   - `scriptSource` 가 `keep` 이어도 변환 결과를 보여 줍니다.

5. 결과물 만들기
   - 승인 후 같은 워크플로를 `stage: "build"` 로 호출합니다. `brief.json` 의 `enhanceMotion` 값을 `args.enhanceMotion` 으로 함께 넘깁니다.
   - 입력에 `--skip-verify` 가 있으면 `args.skipVerify` 를 `true` 로 넘깁니다. 음성 검증과 슬라이더 검사를 건너뜁니다.

6. 결과 보고
   - `status` 가 `failed` 면 실패한 단계와 원인을 먼저 말하고 완료라고 하지 않습니다.
   - `status` 가 `done-unverified` 면 음성과 슬라이더 탐색을 검증하지 않았다고 함께 말합니다.
   - 결과 파일을 알립니다.
     - `out/talkie.html`: 파일 하나로 재생되는 판입니다.
     - `out/hosted/`: 페이지와 mp3 를 나눈 판입니다. 아티팩트로 올릴 때 씁니다.
   - `inspect-report.json` 의 실패 표본과, 음성 결과의 `unresolved` 줄을 함께 밝힙니다.
