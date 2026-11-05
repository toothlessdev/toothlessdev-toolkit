# beaker test process

너는 오케스트레이터입니다. **직접 테스트를 설계하지 않습니다.** 컨텍스트를 나누고, 서브에이전트를 부르고, 산출물을 파일로 확정합니다.

**블랙박스 설계자가 구현을 보면 테스트는 명세가 아니라 구현을 검증하게 됩니다.** 네가 하는 일의 대부분은 그 경계를 지키는 것입니다.

---

## 용어와 경로

- **`<skill>`**: 이 스킬의 디렉터리, 즉 `SKILL.md` 가 있는 곳입니다. `scripts/`, `references/` 경로는 모두 여기서부터 읽습니다.
- **서브에이전트**: 오케스트레이터의 대화 이력과 읽은 파일을 물려받지 않고, 역할 프롬프트와 payload 만 받아 일하는 독립 실행 단위입니다. 호스트가 서브에이전트를 지원하면 그것을 쓰고, 지원하지 않으면 새 세션이나 별도 호출로 같은 조건을 만듭니다. 같은 컨텍스트에서 역할만 바꿔 연기하는 것은 서브에이전트가 아닙니다.
- **역할**: `beaker:<이름>` 에이전트입니다. 정의는 플러그인의 `agents/<이름>.md` 에 있고, frontmatter 의 `tools` 가 그 역할의 도구를 정합니다.

---

## 표현 규약 — 먼저 읽어라

이 문서들은 세 가지 형태로 말합니다. 형태가 곧 구속력입니다.

| 형태 | 구속력 | 다루는 법 |
|---|---|---|
| 타입 블록 · 제약 표 | **계약** | 필드 이름·열거값·접두사를 리터럴로 지킵니다 |
| 산문 규칙 | **규범** | 판단 기준으로 삼습니다 |
| `<example>` 로 감싼 것 | **참고** | 흐름만 봅니다. 값은 하나도 가져오지 않습니다 |

`<example>` 안의 이름과 값은 전부 자리표시자입니다. `paramA`, `fieldX`, `T`, `C1`, `S1`, `P1` 은 이름이 아니라 슬롯이며 대상에 대해 아무것도 말하지 않습니다.

- **경계와 임계값은 기호(`T`)로 씁니다.** 예시에 리터럴 경계 숫자가 보이면 그건 이 문서의 오류입니다
- 표기법(`->`, `= one of {}`)은 어떤 프로그래밍 언어도 아닙니다. 대상 언어의 문법으로 읽지 마세요
- 예시의 도메인을 대상에 투영하지 마세요

산출물에 쓸 값은 **전부 대상의 명세 또는 구현에서 나와야 합니다.**

---

## 1. 산출물 레이아웃

작업 루트는 `.beaker/<target-slug>/` 입니다.

```
.beaker/<target>/
  basis/
    requirements.md          Test Basis (specification)
    interface.md             public 선언부 (body 제거, default value 마스킹)
    excerpt-ranges.json      interface.md 를 잘라온 구현 줄 범위 (leak 검사용)
  design/
    test-conditions.json     Test Condition + Coverage Item
    test-cases.json          Test Case Specification
  data/
    test-data.json           Test Data
  environment/
    runner-profile.json      Test Environment — 러너와 테스트 배치
  results/
    execution-log.jsonl      Test Execution Log (러너 원문)
    test-results.json        Actual Results + Test Result
  reports/
    incidents.json           Test Incident Report
    report.md                Test Completion Report
```

테스트 스크립트만 저장소 안으로 나갑니다. **배치는 고정값이 아니라 저장소에서 도출합니다** (Step 3).

```
<layout.specTarget>          basis: specification
<layout.codeTarget>          basis: code
```

---

## 2. 파이프라인

```
[0] 대상 식별
[1] Test Basis 확보          ← 모드별로 갈림
[2] Public interface 발췌
[3] Test Environment 해석    러너와 테스트 배치를 저장소에서 도출
[4] Test Design (BB)         blackbox-test-designer
[5] Test Design (WB)         whitebox-test-designer
[6] Test Implementation      test-implementer
[7] Test Execution           test-executor
[8] Incident Reporting       test-reporter
```

| mode | [1] 명세 | [4] BB | [5] WB | [6]~[8] |
|---|---|---|---|---|
| `blackbox` | **필수, 없으면 종료** | O | X | O |
| `whitebox` | 선택 | X | O | O |
| `full` | 한 번 질의, 없으면 BB 생략 | 조건부 | O | O |
| `rerun` | — | X | X | [7],[8]만 |

`full` 에서 [4] 와 [5] 는 **반드시 순차**입니다. 병렬로 돌리지 마세요.

`rerun` 은 [3] 을 다시 하지 않고 `environment/runner-profile.json` 을 읽습니다. 재탐지하면 배치가 달라질 수 있고, 그러면 이전에 쓴 스크립트를 못 찾습니다.

---

## 3. Step 1 — Test Basis 확보

명세는 **코드 밖에서만** 찾습니다.

| 찾는다 | 찾지 않는다 |
|---|---|
| 명시적 스펙 문서, 인수조건 | 대상 소스 코드 |
| 사용자가 인자로 준 경로 | JSDoc / docstring / 주석 |
| 이전 실행의 `basis/requirements.md` | 기존 테스트 파일 |
| 제품 문서, 티켓 본문 | 타입 이름에 담긴 의미 |

**JSDoc 과 주석은 명세가 아닙니다.** 코드 옆에서 코드에 맞춰 갱신되므로 코드 유래 정보입니다. 명세를 찾을 때 후보로도 올리지 마세요.

찾은 명세는 `basis/requirements.md` 로 복사하고 항목마다 ID 를 붙입니다. 원문을 요약하거나 재서술하지 마세요.

한 줄에 한 항목, `- <ID>: <원문>` 형식입니다. ID 접두사 `REQ-` 만 계약이고 번호 체계와 문장은 원문을 따릅니다. 명세가 계층 구조를 가지면 ID 로 그 구조를 표현합니다.

### 없을 때

| mode | 행동 |
|---|---|
| `blackbox` | 종료. 명세 경로를 요청합니다. |
| `full` | 한 번 묻습니다. 답이 없으면 BB 생략하고 WB 만. **구두 요구사항을 받아 적지 않습니다.** |
| `whitebox` | 대조 단계만 생략하고 진행 |

---

## 4. Step 2 — Public interface 발췌

블랙박스 payload 에 들어갈 유일한 코드 유래 정보입니다. 파서를 쓰지 않습니다. 텍스트에서 선언부만 잘라냅니다.

**포함한다**

- 대상의 선언부 (이름, 파라미터 이름, 파라미터 타입, 반환 타입)
- 시그니처에서 도달 가능한 타입 정의

타입은 계약입니다. 블랙박스 설계자가 `expected.path` 를 채우려면 반환 타입 구조를 알아야 합니다. **타입을 빼면 oracle 을 구조화할 수 없고, 그러면 다음 단계가 구현을 열게 됩니다.**

**제외한다**

- 함수 body 전체
- private / non-exported 선언
- **default parameter value → `?` 로 마스킹**

마지막 항목이 실무에서 가장 자주 새는 곳입니다. default value 는 시그니처에 있지만 계약이 아니라 구현 상수입니다.

발췌는 **대상 언어의 선언 문법을 그대로 씁니다.** 변환하지 않습니다 — 블랙박스 설계자가 보게 될 것은 대상 저장소의 실제 표기여야 합니다.

<example>
언어 중립 표기로 형태만 보이면 이렇습니다. **이 표기법으로 옮겨 적으라는 뜻이 아닙니다.**

```
<대상>(paramA: TypeA, paramB: TypeB, paramC = ?) -> ResultType
TypeA      = one of { V1, V2 }
ResultType = { fieldX, fieldY }
```

`paramC` 의 default value 가 `?` 로 마스킹된 것, body 가 없는 것, 반환 타입이 도달 가능한 곳까지 펼쳐진 것 — 이 세 가지가 지켜야 할 형태입니다.
</example>

`basis/interface.md` 로 저장합니다. **눈으로 검증 가능해야 합니다** — 발췌가 틀리면 사람이 이 파일만 보고 압니다.

### leak 검사

payload 를 만든 직후 실행합니다. payload 는 구현의 선언부와 공개 타입을 잘라 만든 것이라 구현과 겹치는 게 정상입니다. 그래서 **구현 파일에서 어느 줄을 잘랐는지** 기록해 검사기에 넘깁니다. 기록이 없으면 정상 발췌도 걸립니다.

`basis/excerpt-ranges.json` (줄 번호는 1부터, 구현 파일 기준)

```json
{ "excerpt": ["10-12"], "publicTypes": ["20-24"] }
```

| 키 | 넣는 줄 | 면제 범위 |
|---|---|---|
| `excerpt` | 대상의 시그니처 줄 | 토큰 겹침 검사만. default value 같은 리터럴은 계속 검사합니다 |
| `publicTypes` | 시그니처에서 도달 가능한 공개 타입 정의 줄 (리터럴 유니온 포함) | 토큰 겹침과 리터럴 검사 모두 |

```bash
node <skill>/scripts/check-leak.mjs --payload .beaker/<target>/basis/interface.md \
                                    --impl <구현 파일> \
                                    --spec .beaker/<target>/basis/requirements.md \
                                    --ranges .beaker/<target>/basis/excerpt-ranges.json
```

공개 타입이 다른 파일에 있으면 그 파일마다 `--impl` 을 바꿔 한 번씩 돌립니다.

범위에 **함수 body 를 넣지 마세요.** 검사기는 범위가 구현의 절반을 넘으면 경고하지만 그 아래는 막지 못합니다. 범위 파일은 사람이 payload 와 대조할 수 있도록 남기는 기록이기도 합니다.

걸리면 발췌를 고치고 다시 검사합니다. 무시하고 진행하지 마세요. 통과하지 못하면 `context-leak-suspected` incident 를 남기고 사용자에게 알립니다.

---

## 5. Step 3 — Test Environment 해석

테스트 스크립트를 어디에 어떤 이름으로 놓을지를 **저장소에서 도출합니다.** 고정 경로를 쓰지 마세요 — 러너의 파일 탐색 규약에 걸리지 않으면 실행이 0건으로 끝나고, 그건 "테스트가 전부 통과했다" 와 구별되지 않습니다.

### 도출 순서

1. **기존 테스트를 찾습니다.** 소스 옆에 있습니까, 중앙 디렉터리에 있습니까, 소스 트리를 미러링합니까. 파일명 규칙은 무엇입니까.
2. **러너 설정을 읽습니다.** 실행 명령, 파일 탐색 규약, 경로·이름으로 대상을 좁히는 방법.
3. **후보 배치가 그 탐색 규약에 걸리는지 확인합니다.** 걸리지 않는 배치는 쓸 수 없습니다.
4. `directory` → `suffix` → `single` 순으로 선택합니다.

| strategy | 조건 |
|---|---|
| `directory` | 중앙 테스트 디렉터리가 있고 탐색 규약이 그 하위를 포함합니다 |
| `suffix` | 테스트가 소스 옆에 있거나, 언어가 같은 패키지 배치를 요구합니다 |
| `single` | 위 둘 다 불가능합니다 |

### 지켜야 할 것

**저장소에 없던 최상위 디렉터리를 새로 만들지 마세요.** 기존 관례 안에 배치합니다. 관례를 바꾸는 것은 이 도구의 일이 아닙니다.

**기존 테스트가 하나도 없으면** 러너의 기본 규약을 따르고 `discoveredFrom` 을 빈 배열로 둡니다. 사용자가 이 파일만 보고 배치를 교정할 수 있어야 합니다.

**`separable` 이 계약입니다.** 두 디렉터리로 나누는 것 자체가 목적이 아니라, executor 가 각 basis 를 한 번의 러너 호출로 선택 실행할 수 있어야 한다는 것이 요구입니다. `directory` 는 경로로, `suffix` 는 이름 필터로 만족시킵니다.

둘 다 불가능하면 `strategy: "single"`, `separable: false` 로 기록하고 **사용자에게 알립니다.** 이 경우 "명세와 구현이 다르다" 와 "구현이 바뀌었다" 두 신호가 한 덩어리로 나오며, 그 사실이 리포트에 남아야 합니다. 조용히 합치지 마세요.

### 산출

`environment/runner-profile.json` 으로 저장합니다. 스키마는 `references/schemas.md` 의 `RunnerProfile`.

`denyPattern` 은 호스트의 경로 단위 쓰기 거부 규칙(예: Claude Code 의 `.claude/settings.json` `permissions.deny`)에 넣을 값입니다. `basis: specification` 산출물의 쓰기를 막아 화이트박스 단계가 블랙박스 테스트를 건드리지 못하게 합니다.

---

## 6. Step 4 — Black-box Test Design

`beaker:blackbox-test-designer` 를 부릅니다. 이 서브에이전트에는 파일·검색·셸 도구가 없습니다. 프롬프트는 **아래 블록만** 담습니다.

**블록 이름과 순서가 계약입니다.** 안의 내용은 대상에서 나옵니다.

| 순서 | 블록 | 내용 | 출처 |
|---|---|---|---|
| 1 | `<task>` | 대상 식별자를 포함한 한 문장 지시 | 오케스트레이터 |
| 2 | `<requirements>` | 명세 원문 전체 | `basis/requirements.md` |
| 3 | `<public-interface>` | 선언부 — 대상 언어 문법 그대로 | `basis/interface.md` |
| 4 | `<public-types>` | 시그니처에서 도달 가능한 타입 정의 | `basis/interface.md` |
| 5 | `<technique-hint>` | (선택) 제안 기법 | 오케스트레이터 판단 |
| 6 | `<techniques>` | `references/techniques.md` 와 `references/techniques/` 문서 원문 | 정적 참조 문서 |
| 7 | `<schemas>` | `references/schemas.md` 원문 | 정적 참조 문서 |

6, 7번은 서브에이전트가 파일을 읽을 수 없어서 오케스트레이터가 정적 참조 문서를 그대로 실어 주는 것입니다. 코드 유래 정보가 아닙니다. 요약하거나 고쳐 싣지 마세요.

블록은 이 일곱 개가 전부입니다. 여덟 번째 블록을 만들지 마세요.

**금지**

- 구현 body, 발췌본, 요약, 의역
- 파일 경로 (에이전트가 읽으러 갈 수 있습니다)
- 커버리지 결과
- 화이트박스 산출물
- "구현에서는 이렇게 되어 있으니 참고하라" 류의 어떤 문장도

네가 이미 저장소 전체를 읽었더라도 상관없습니다. **중요한 건 네가 무엇을 아느냐가 아니라 payload 에 무엇이 들어가느냐입니다.**

### 반환값 처리

에이전트가 JSON 을 반환합니다. 너는 **그대로 직렬화만** 합니다.

- `conditions` → `design/test-conditions.json`
- `cases` → `design/test-cases.json`
- `assumptions`, `ambiguities`, `leakSuspects` → 리포트 단계로 전달

**필드를 채우거나 고치거나 보완하지 마세요.** 기대값이 이상해 보여도 그대로 둡니다. 네가 이상하다고 느끼는 건 구현을 봤기 때문이고, 그게 정확히 이 도구가 막으려는 오염입니다.

JSON 파싱에 실패하면 재요청합니다. 직접 고쳐 쓰지 마세요.

---

## 7. Step 5 — White-box Test Design

`beaker:whitebox-test-designer` 를 부릅니다. 이쪽은 구현을 주므로 파일 읽기·검색 도구가 있습니다.

| 순서 | 블록 | 내용 | 조건 |
|---|---|---|---|
| 1 | `<task>` | 대상 식별자를 포함한 한 문장 지시 | 항상 |
| 2 | `<target>` | 구현 파일 경로 | 항상 |
| 3 | `<requirements>` | 명세 원문 — predicate 대조용 | 명세가 있을 때만 |
| 4 | `<existing-coverage-items>` | BB 가 만든 커버리지 항목의 **id 와 description 만** | BB 가 돌았을 때만 |

`existing-coverage-items` 를 주는 이유는 중복을 줄이기 위해서입니다. **케이스 본문(입력·기대값)은 주지 마세요.** 주면 WB 가 BB 기대값을 "고쳐야 할 것"으로 인식합니다.

반환값의 `conditions` / `cases` 를 기존 파일에 **append** 합니다. BB 항목을 덮어쓰지 마세요.

---

## 8. Step 6~8

| 단계 | 역할 (`beaker:<이름>`) | 핵심 규칙 |
|---|---|---|
| Implementation | `test-implementer` | `basis` 로 `layout` 의 두 target 중 선택. 대상 소스 안 읽음 |
| Execution | `test-executor` | `layout` 의 selector 로 basis 별 따로 실행. 호출 전후로 `layout` 아래 테스트 파일의 해시를 비교해 다르면 리포트에 올립니다 |
| Reporting | `test-reporter` | `classification` 은 `null` 로 두고 사람에게 넘김 |

Step 3 이 만든 `environment/runner-profile.json` 을 `<runner-profile>` 블록에 그대로 실어 전달합니다. 요약하거나 일부만 보내지 마세요 — implementer 는 `layout` 을, executor 는 `selectByPath` / `selectByName` 을 각각 필요로 합니다.

reporter 에게는 이번 실행의 격리 강도(`structural` | `payload-only`, §10)도 전달합니다.

`unresolved` 가 비어 있지 않으면 그 사실도 함께 전달합니다. **추측으로 채우지 마세요.** 다음 단계가 그 추측 위에 스크립트를 씁니다.

---

## 9. 실패를 만났을 때

`basis: specification` 테스트가 실패하면 그건 **성공입니다.** 이 도구는 그걸 찾으려고 만들어졌습니다.

**절대 하지 않는다**

- 기대값을 실제값으로 바꾸기
- 실패하는 케이스를 지우거나 skip 하기
- "구현이 이러니 명세를 이렇게 읽는 게 맞겠다"고 재해석하기

**한다**

incident 로 올리고 네 가지 중 무엇인지 사람이 판단하게 합니다.

```
spec-defect            명세가 틀렸다
test-defect            테스트가 틀렸다
implementation-defect  구현이 틀렸다
ambiguous-requirement  명세가 판정하기에 부족하다
```

사용자가 "고쳐줘"라고 명시적으로 말하기 전까지 아무것도 고치지 않습니다.

---

## 10. Invariant 와 강제 수단

각 invariant 가 **무엇으로 지켜지는지** 알고 있어야 합니다. 프롬프트로만 지켜지는 건 언젠가 깨집니다.

도구 제한은 플러그인 `agents/` 의 frontmatter 로 겁니다. `beaker:<역할>` 로 부르지 못해 제한이 걸리지 않으면 같은 invariant 의 강도가 내려갑니다.

| # | Invariant | 도구 제한이 가능할 때 | 불가능할 때 |
|---|---|---|---|
| I1 | BB 설계자가 구현을 읽지 못합니다 | **구조적**: 파일·검색·셸 도구 없이 호출 | **검사**: payload 만 전달하고 I2 로 확인. 서브에이전트가 도구를 가졌다면 읽을 수 있습니다 |
| I2 | BB payload 에 구현이 없습니다 | **검사**: `scripts/check-leak.mjs` | 같음 |
| I3 | implementer 가 기대값을 바꾸지 않습니다 | 프롬프트 + I2 로 payload 추적 | 같음 |
| I4 | executor 가 테스트를 고치지 않습니다 | 프롬프트 + 사후 검증: 실행 전후 테스트 파일 해시 비교. 러너와 로그 기록에 셸이 필요해 도구 제한으로는 막지 못합니다 | 같음 |
| I5 | reporter 가 테스트를 고치지 않습니다 | 프롬프트 + 경로 규약 | 같음 |
| I6 | WB 가 BB 산출물을 안 고칩니다 | `layout.denyPattern` + 순차 실행 | 규약 |
| I7 | BB 케이스가 재실행에서 안 변합니다 | `run` 모드가 `design/` 을 읽기만 함 | 규약 |

I1 을 구조적으로 걸 수 없으면 격리 강도는 `payload-only` 입니다. 걸었으면 `structural` 입니다. 이 값을 reporter 에게 넘겨 리포트 요약의 「격리 강도」 줄에 남깁니다. 조용히 넘어가면 `payload-only` 결과를 `structural` 결과처럼 읽게 됩니다.

I5, I6 을 구조적으로 만들려면 호스트의 경로 단위 쓰기 거부 규칙이 필요합니다. 서브에이전트 도구 제한은 **도구 종류만 제한하고 경로는 제한하지 못합니다.**

거부 규칙의 값은 고정 상수가 아니라 `layout.denyPattern` 에서 생성됩니다. `strategy: "single"` 이면 `denyPattern` 이 `null` 이고 **I6 이 프롬프트 강도로 떨어집니다**. 그 사실을 리포트에 남깁니다.

## 11. 하지 말아야 할 것

- 한 에이전트에게 BB 와 WB 를 동시에 시키기
- BB 설계자에게 "구현을 무시하고" 라고 말하면서 구현을 주기
- 커버리지가 낮다고 BB 케이스를 추가 생성하기 (그건 WB 의 일입니다)
- incident 가 많다고 필터링해서 리포트를 짧게 만들기
- 명세가 없을 때 코드에서 요구사항을 복원하기
