---
name: beaker
description: 요구사항(명세)만 보고 설계하는 블랙박스 테스트와 구현을 읽고 설계하는 화이트박스 테스트를 서로 다른 Test Basis 에서 독립 생성하고, 명세와 구현의 불일치를 자동 수정 대신 Test Incident 로 보고합니다. ISO/IEC/IEEE 29119 기반, 언어·러너 중립. 명세 기반 테스트 설계, 블랙박스·화이트박스 테스트 생성, 구현에 끌려가지 않는 테스트, PR 본문과 링크된 문서의 요구사항으로 PR 을 대조 검증하는 요청에 사용합니다. 모드는 test, blackbox, whitebox, run, pr-review.
---

# beaker

LLM 에게 구현을 보여 주고 테스트를 시키면 테스트가 명세를 검증하는 대신 현재 구현을 고정하는 장치가 됩니다. beaker 는 블랙박스 설계자에게 구현을 **전달하지 않는 방식**으로 이걸 막습니다. "구현을 보지 마라"고 말하는 게 아니라 볼 수 없게 만듭니다.

너는 오케스트레이터입니다. 직접 테스트를 설계하지 않습니다. 컨텍스트를 나누고, 서브에이전트를 부르고, 산출물을 파일로 확정합니다.

## 요청 해석

요청에서 모드, 대상, 명세 경로를 읽습니다.

| 모드 | 하는 일 | 명세 |
|---|---|---|
| `test` | 블랙박스 후 화이트박스를 순차 실행 | 한 번 질의, 없으면 블랙박스 생략 |
| `blackbox` | 명세만 Test Basis 로 설계·구현·실행 | 필수. 없으면 종료 |
| `whitebox` | 구현을 Test Basis 로 characterization 테스트 생성 | 선택 |
| `run` | 생성된 테스트를 재실행하고 리포트만 다시 만듦 | 필요 없음 |
| `pr-review` | PR 의 요구사항을 뽑아 격리 worktree 에서 대조 | PR 에서 추출해 등급을 매김 |

- 대상은 심볼 이름이나 파일 경로입니다. PR 번호나 URL 이 오면 `pr-review` 입니다.
- 명세 경로는 `--spec <경로>` 형태나 문장으로 받습니다.
- 모드가 드러나지 않으면 한 줄로 묻고 멈춥니다. 추측해서 고르지 않습니다.

## 절차

1. `references/modes.md` 에서 해당 모드의 절을 읽습니다.
2. `references/process.md` 의 파이프라인을 그 모드로 실행합니다. `pr-review` 는 `references/pr-review.md` 가 그 위에 얹힙니다.
3. 서브에이전트는 이 플러그인의 `beaker:<역할>` 에이전트로 부릅니다. 도구 제한은 에이전트 정의에 있으니 호출할 때 다른 도구를 더 주지 않습니다.
4. 스크립트는 이 스킬 디렉터리의 `scripts/` 에서 실행합니다.

## 어느 모드에서든 지킬 것

- **명세는 코드 밖에서만 찾습니다.** JSDoc, 주석, 타입 이름, 기존 테스트에서 요구사항을 복원하지 않습니다. 대화로 받은 구두 요구사항을 명세 파일로 승격하지 않습니다.
- **블랙박스 설계자에게는 payload 블록만 줍니다.** 네가 무엇을 읽었는지는 상관없고 payload 에 무엇이 들어가느냐가 전부입니다. payload 를 만든 직후 `scripts/check-leak.mjs` 로 검사합니다.
- **`basis: specification` 테스트가 실패하면 성공입니다.** 기대값을 고치거나 케이스를 지우거나 skip 하지 않습니다. incident 로 올리고 `classification` 은 `null` 로 둡니다. 사람만 채웁니다.
- **격리 강도를 숨기지 않습니다.** 서브에이전트의 도구 제한을 걸 수 없었다면 `payload-only` 라고 리포트에 적습니다.

## 파일

| 경로 | 내용 |
|---|---|
| `references/modes.md` | 모드별 설정과 규칙 |
| `references/process.md` | 파이프라인, 산출물 레이아웃, payload 규칙, invariant |
| `references/pr-review.md` | PR 리뷰 모드: 참조 해결, 출처 등급, 심볼 선별, worktree 격리 |
| `${CLAUDE_PLUGIN_ROOT}/agents/` | 서브에이전트 역할 6종 |
| `references/schemas.md` | 산출물 JSON 스키마 |
| `references/techniques.md`, `references/techniques/` | 설계 기법 5종 |
| `references/verification.md` | 설치 확인, 동작 확인, 검증되지 않은 것 |
| `scripts/check-leak.mjs` | 블랙박스 payload 의 구현 유출 검사 |
| `scripts/extract-symbols.mjs` | `git diff -U0` 에서 변경 심볼 추출 |
| `scripts/diff-attributes` | `git -c core.attributesFile=` 로 넘기는 언어별 diff 드라이버 설정 |
