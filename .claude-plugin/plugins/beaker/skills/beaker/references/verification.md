# beaker 검증

`<skill>` 은 이 스킬의 디렉터리입니다.

## 설치 확인

설치한 호스트의 스킬 목록에 `beaker` 가 보여야 합니다. 스킬 디렉터리에 아래가 모두 있는지도 봅니다.

```bash
ls <skill>/SKILL.md <skill>/references/process.md <skill>/scripts <skill>/../../agents
```

`agents/` 에는 에이전트 정의 6개가 있어야 합니다. `blackbox-test-designer` 의 frontmatter 가 **파일·검색·셸 도구 없음** 인지 확인합니다. 서브에이전트를 이 조건으로 호출할 수 있는지가 격리 강도(`structural` / `payload-only`)를 정합니다.

## 동작 확인

### 1. leak 검사기 단독

스킬 설치와 무관하게 바로 돌릴 수 있습니다. 의존성이 없습니다.

구현에는 있고 명세에는 없는 상수가 payload 에 남아 있으면 잡아야 합니다.

아래 예시는 한 줄짜리 시그니처라 범위 없이도 통과합니다. 선언부와 공개 타입을 구현에서 그대로 잘라 만든 실제 payload 는 `--ranges` 로 잘라온 줄 범위를 넘겨야 합니다. 사용법은 `references/process.md` 의 「leak 검사」 절에 있습니다.

```bash
mkdir -p /tmp/beaker-check && cd /tmp/beaker-check
printf 'function f(x) {\n  if (x >= 60) return 1;\n  return 0;\n}\n' > impl.js
printf -- '- REQ-01: x 가 65 이상이면 1 을 반환한다\n' > spec.md
printf 'f(x: number, threshold = 60) -> number\n' > leaky.md
printf 'f(x: number, threshold = ?) -> number\n' > clean.md
```

```bash
node <skill>/scripts/check-leak.mjs --payload leaky.md --impl impl.js --spec spec.md
```

`[implementation-literal-in-payload] 60` 이 나오고 exit code 1 이면 정상입니다. 명세에 있는 `65` 는 잡히지 않아야 합니다.

```bash
node <skill>/scripts/check-leak.mjs --payload clean.md --impl impl.js --spec spec.md
```

`leak 없음` 과 exit code 0 이 나와야 합니다.

body 가 통째로 섞인 경우도 확인합니다.

```bash
cp impl.js bodyleak.md && node <skill>/scripts/check-leak.mjs --payload bodyleak.md --impl impl.js --spec spec.md
```

총 4건이 나오고 그중 `shared-token-window` 3건이 포함되어야 합니다. 두 규칙이 함께 잡는 것이 정상입니다. 상수 하나가 새는 것과 선언부 발췌가 body 를 잘라온 것은 다른 실패입니다.

```bash
node <skill>/scripts/check-leak.mjs --payload bodyleak.md --impl impl.js --spec spec.md --json
```

`--json` 으로 규칙별 집계를 확인할 수 있습니다.

### 2. 파이프라인 스모크

**명세와 구현의 경계가 어긋난 대상**을 만들어 놓고, 그 불일치를 실제로 잡아내는지 봅니다. 이게 이 스킬이 존재하는 이유이므로 다른 어떤 확인보다 이 하나가 중요합니다.

테스트 러너가 이미 설정된 저장소에서 시작합니다. 러너가 없으면 배치 해석 단계(`[3]`)가 근거를 찾지 못합니다.

대상 함수를 하나 만듭니다. 명세는 65 를 경계로 지정하고 구현은 60 을 씁니다.

```
명세 파일   x 가 65 이상이면 자격, 아니면 비자격
구현        x >= 60 이면 자격
```

호스트에 이렇게 요청합니다.

```
beaker blackbox <대상 심볼> --spec <명세 파일 경로>
```

기대 결과는 이렇습니다.

| 확인 지점 | 기대 |
|---|---|
| `design/test-cases.json` | 경계값이 **64, 65**. 59, 60 이 나오면 I1 이 깨진 것입니다 |
| 실행 결과 | `basis: specification` 테스트가 **실패**합니다 |
| `reports/incidents.json` | `requirement-implementation-discrepancy` 가 올라옵니다 |
| `classification` | `null` 입니다. 채워져 있으면 안 됩니다 |
| 테스트 파일 | 실패에 맞춰 기대값이 수정되어 있지 **않습니다** |
| `reports/report.md` 요약 | 「격리 강도」 줄이 있고 실제 호출 조건과 맞습니다 |

**테스트가 실패하는 것이 성공입니다.** 전부 통과했다면 설계자가 구현을 봤거나 명세를 코드에서 복원한 것이므로, `basis/interface.md` 와 `basis/requirements.md` 를 열어 무엇이 payload 로 들어갔는지 확인합니다.

명세를 주지 않고 돌려서 **종료하는지도** 확인합니다.

```
beaker blackbox <대상 심볼>
```

명세 경로를 요청하며 멈춰야 합니다. 코드나 주석에서 요구사항을 복원해 진행하면 안 됩니다.

### 3. 배치 해석

`environment/runner-profile.json` 을 열어 `layout` 이 저장소의 실제 관례를 따랐는지 봅니다.

- 저장소에 없던 최상위 디렉터리가 새로 생기지 않았습니까
- `discoveredFrom` 이 실제 근거 파일을 가리킵니까
- `separable` 이 `false` 면 그 사실이 리포트에 명시되었습니까

이 파일은 사용자가 읽고 교정하라고 남기는 것입니다. 배치가 틀렸으면 직접 고친 뒤 `run` 모드로 재실행합니다.

## 아직 검증되지 않은 것

**파이프라인은 end-to-end 로 실행된 적이 없습니다.** 스캐폴딩이 완료되었을 뿐이고, 아래는 확인된 것과 확인되지 않은 것의 구분입니다.

| | 상태 |
|---|---|
| 에이전트 정의 · 링크 무결성 | 확인됨 |
| `check-leak.mjs` 두 규칙 | 확인됨 |
| 서브에이전트 6개가 실제로 계약대로 JSON 을 반환합니까 | **미확인** |
| 플러그인으로 설치한 환경에서 모드 선택과 역할 호출이 동작합니까 | **미확인** |
| 도구 제한을 걸 수 없는 호스트에서 `payload-only` 가 anchoring 을 실제로 막습니까 | **미확인** |
| 배치 해석 3전략이 실제 저장소에서 갈립니까 | **미확인** |
| baseline 대비 결함 탐지율이 개선됩니까 | **미확인**. 벤치마크에서 측정 |
