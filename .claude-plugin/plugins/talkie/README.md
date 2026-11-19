# talkie

장표 HTML 이나 Claude 아티팩트에 대본, 음성, 자막, 유튜브식 재생 컨트롤을 입혀 새 HTML 로 만듭니다. PPTX 는 받지 않습니다.

## 준비

- [uv](https://docs.astral.sh/uv/): Python 의존성을 설치하고 스크립트를 실행합니다.
- [ffmpeg](https://ffmpeg.org/): 합친 음성을 mp3 로, 영상을 mp4 로 인코딩합니다.
- Chrome 또는 Playwright Chromium: 재생과 탐색 결과를 비교합니다.

Python 의존성은 첫 실행 때 `~/.cache/talkie/venv` 에 설치됩니다. 위치를 바꾸려면 `TALKIE_ENV_DIR` 을 지정합니다. Apple Silicon 이 아니면 Whisper 받아쓰기 검사는 건너뛰고 파형 검사만 합니다.

## 실행

```bash
claude plugin install talkie@toothlessdev-toolkit
```

Claude Code 에서 덱 경로나 아티팩트 URL 을 넘깁니다.

```text
/talkie:talkie ./발표자료.html
```

청중, 톤, 길이를 답하고 대본을 승인하면 `.talkie/<덱 이름>/out/` 에 결과가 생깁니다.

`--skip-verify` 를 붙이면 음성 검증과 슬라이더 검사를 건너뜁니다. 시간과 토큰이 줄지만, 잘못 읽은 줄이나 점프했을 때 깨지는 화면을 잡지 못합니다.

| 결과 | 용도 |
| --- | --- |
| `out/talkie.html` | 파일 하나로 재생됩니다 |
| `out/hosted/` | 페이지와 mp3 를 나눕니다. 페이지 크기 제한이 있는 곳에 올릴 때 씁니다 |
| `out/talkie-compact.html` | `build_deck.py --mode compact` 로 만듭니다. 음성을 모노 48kbps 로 줄인 파일 하나입니다 |
| `out/talkie.mp4` | `/talkie:export` 로 만듭니다. 음성과 자막이 들어간 영상입니다 |

## 파이프라인

| 순서 | 스킬 | 입력 | 출력 | 실행 |
| --- | --- | --- | --- | --- |
| 1 | `/talkie:brief` | 덱 | `brief.json` | 메인 세션 |
| 2 | `/talkie:script` | 덱, 브리프 | `script.json` | `write-script` |
| 3 | `/talkie:enhance` | 덱, 대본 | 고친 `deck.html` | `write-adapter`, 선택 |
| 4 | `/talkie:pronounce` | 대본 | `narration.json` | `pronounce-script`, Haiku |
| 5 | `/talkie:choreograph` | 덱, 대본 | `adapter.js`, `motions.json` | `write-adapter` |
| 6 | `/talkie:voice` | 발음 | `voice/` | `render-audio` |
| 7 | `/talkie:assemble` | 음성, 순서, 어댑터 | `timeline.json`, `out/` | `assemble-deck` |
| 8 | `/talkie:inspect` | 결과 HTML | `inspect-report.json` | `assemble-deck` |
| 9 | `/talkie:export` | 결과 HTML, 음성 | `out/talkie.mp4` | 메인 세션, 선택 |

- `/talkie:talkie` 는 질문과 대본 승인을 맡고, 나머지는 메인 워크플로 `talkie:produce` 를 부릅니다.
- 발음 변환과 합성, 어댑터 작성은 서로의 결과가 필요 없어서 동시에 돌고, 조립에서 합칩니다.
- 워크플로는 실행 중에 사용자에게 물을 수 없어서 `produce` 를 `stage: "draft"` 와 `stage: "build"` 로 나눠 부릅니다.

## 구조

- **스킬 하나에 산출물 하나**: 대본을 고쳐도 어댑터 스킬은 바뀌지 않습니다.
- **단계는 파일로만 연결**: 스킬은 앞 단계 구현이 아니라 `schemas/` 의 형식에 의존합니다.
- **플레이어는 고정**: 재생바, 자막, 상태 머신은 [template/player.html](template/player.html) 하나입니다. `build_deck.py` 가 그대로 넣습니다.
- **덱 차이는 어댑터로**: 덱마다 `slideCount`, `showSlide`, `seekMotion` 을 구현합니다. 예시는 [snippets](snippets) 에 있습니다.
- **시간은 시계 하나로**: 슬라이드, 자막, 애니메이션 위치를 `audio.currentTime` 에서 계산합니다. 상태 머신은 재생, 일시정지, 탐색, 버퍼링 같은 재생 상태만 담습니다.

## 키보드

| 키 | 동작 |
| --- | --- |
| Space, K | 재생, 일시정지 |
| ← → | 이전, 다음 슬라이드 |
| J L | 10초 뒤로, 앞으로 |
| Home End | 처음, 끝 |
| C | 자막 |
| F | 전체화면 |

## 플레이어 수정

`template/player.html` 의 `xstate` 스크립트는 아래 내용을 묶은 결과입니다.

```bash
npx esbuild entry.js --bundle --minify --format=iife --global-name=XState --legal-comments=none
```

`entry.js` 내용은 `export { setup, assign, createActor } from "xstate";` 입니다.

## 개발

저장소 복제본을 설치 없이 시험합니다.

```bash
claude --plugin-dir .claude-plugin/plugins/talkie
```

```bash
claude plugin validate .claude-plugin/plugins/talkie
```
