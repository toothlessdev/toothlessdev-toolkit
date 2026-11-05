# beaker 산출물 스키마

이 문서는 **계약**입니다. 필드 이름, 열거값, ID 접두사는 리터럴로 지켜야 합니다. 에이전트들이 이 스키마로만 서로를 이해합니다.

## 표기법

```
TypeName {
  fieldName        type              제약
}
```

| 표기 | 뜻 |
|---|---|
| `T[]` | `T` 의 배열 |
| `enum(a, b)` | 두 값 중 하나 |
| `T?` | 생략 가능 |
| `T \| null` | 값 또는 `null` |
| `Ref<X>` | 다른 산출물의 `X.id` 를 가리키는 문자열 |
| `any` | 대상의 타입에 따라 결정. 스키마가 제한하지 않습니다 |

**이 문서에는 데이터 예시가 없습니다.** 구조는 타입 블록이 전부 말합니다. 값은 전부 대상의 명세·구현에서 도출하세요.

## ID 접두사

| 접두사 | 대상 | 비고 |
|---|---|---|
| `REQ-` | 명세 항목 | 원문의 번호 체계를 따릅니다 |
| `TC-` | Test Condition | code basis 는 100 번대부터 |
| `CI-` | Test Coverage Item | code basis 는 100 번대부터 |
| `BB-` | Test Case (basis: specification) | |
| `WB-` | Test Case (basis: code) | |
| `INC-` | Test Incident | |

---

## 공통 타입

```
Basis            = enum(specification, code)

Technique        = enum(equivalence-partitioning,
                        boundary-value-analysis,
                        decision-table,
                        state-transition,
                        branch-condition)

PredicateClass   = enum(business-rule, defensive, infrastructural)

BasisRef         = string            basis=specification → REQ- ID
                                     basis=code          → "파일경로:행번호"
```

`Technique` 은 위 5종뿐입니다. 목록에 없는 이름을 쓰면 리포트 단계에서 커버리지 집계가 깨집니다.

`PredicateClass` 는 셋 다 커버리지 항목이 되지만 **incident 후보는 `business-rule` 뿐입니다.**

---

## design/test-conditions.json

```
TestConditionsFile {
  target           string            대상 식별자
  conditions       TestCondition[]
}

TestCondition {
  id               string            TC- 접두사
  basis            Basis
  statement        string            검증 가능한 성질 한 문장
  basisRefs        BasisRef[]        1개 이상
  predicate        string | null     basis=code 에서만. 원자 조건 원문
  predicateClass   PredicateClass | null   basis=code 에서만
  coverageItems    CoverageItem[]    1개 이상
}

CoverageItem {
  id               string            CI- 접두사
  technique        Technique
  description      string            이 항목이 세는 단위. 기호가 아니라 실제 값으로
}
```

`predicate` 와 `predicateClass` 는 함께 채우거나 함께 `null` 입니다. 한쪽만 있으면 스키마 위반입니다.

---

## design/test-cases.json

```
TestCasesFile {
  target           string
  cases            TestCase[]
}

TestCase {
  id               string            BB- (specification) | WB- (code)
  basis            Basis
  coverageItemRefs Ref<CoverageItem>[]     1개 이상
  basisRefs        BasisRef[]
  technique        Technique
  rationale        string            필수. 이 케이스가 왜 존재하는가
  preconditions    string[]          도달 경로. 없으면 빈 배열
  inputs           object            파라미터 이름 → 값
  expected         Expected
  expectedDescription  string        사람이 읽을 한 문장
}
```

`rationale` 이 비면 그 케이스는 근거가 없습니다. "BVA 를 썼다"가 아니라 **명세의 어느 성질을 어떤 논리로 겨냥하는지**를 적습니다.

`inputs` 의 키는 대상의 파라미터 이름과 정확히 일치해야 합니다. 다음 단계가 이걸로 호출문을 만듭니다.

### Expected — `kind` 로 갈리는 union

```
Expected = ValueExpectation | ThrowsExpectation | RelationExpectation

ValueExpectation {
  kind             "value"
  path             string            반환값 내부 경로. 전체면 ""
  value            any               기대값
}

ThrowsExpectation {
  kind             "throws"
  errorType        string            명세가 지정한 오류 종류
  messageContains  string?           메시지 부분 문자열
}

RelationExpectation {
  kind             "relation"
  relation         string            관계 이름
  over             string            관계가 성립하는 파라미터
  caseRefs         Ref<TestCase>[]   비교 대상 케이스. 2개 이상
}
```

`path` 는 점 표기와 인덱스를 씁니다 — `a.b`, `a[0].b`.

**자연어 기대값은 스키마 위반입니다.** `expected` 는 기계가 단언으로 번역할 재료이고, 사람이 읽을 문장은 `expectedDescription` 이 맡습니다. 이 분리가 없으면 번역 단계가 의미를 해석해야 하고, 해석하려면 구현을 봐야 합니다.

---

## 설계 에이전트 반환값

파일이 아니라 에이전트가 반환하는 JSON 입니다. 오케스트레이터가 위 두 파일로 분해해 저장합니다.

```
BlackboxDesignerOutput {
  target           string
  basis            "specification"
  conditions       TestCondition[]
  cases            TestCase[]
  assumptions      Assumption[]
  ambiguities      Ambiguity[]
  leakSuspects     LeakSuspect[]
}

Assumption {
  basisRefs        BasisRef[]
  statement        string            명세에서 유도되지만 명시되지 않은 것
}

Ambiguity {
  basisRefs        BasisRef[]
  question         string            명세가 판정하기에 무엇이 부족한가
  blockedCoverageItems  Ref<CoverageItem>[]
}

LeakSuspect {
  observed         string            payload 에서 본 구현 흔적
  why              string            왜 명세가 아니라 구현 유래로 판단했는가
}
```

`Assumption` 과 `Ambiguity` 의 경계: 명세로부터 합리적으로 유도되면 `Assumption`, 판단이 서지 않으면 `Ambiguity`. **애매하면 `Ambiguity` 입니다.** assumption 으로 덮는 것이 근거 없는 기대값을 만드는 가장 흔한 경로입니다.

```
WhiteboxDesignerOutput {
  target           string
  basis            "code"
  conditions       TestCondition[]
  cases            TestCase[]
  incidentCandidates  IncidentCandidate[]
  notes            Note[]
}

IncidentCandidate {
  kind             IncidentKind
  predicate        string
  predicateClass   "business-rule"   business-rule 만 후보가 된다
  locations        BasisRef[]
  summary          string
}

Note {
  location         BasisRef
  issue            string            unreachable-branch 등
  detail           string
}
```

---

## environment/runner-profile.json

**테스트 스크립트의 배치는 고정값이 아니라 저장소에서 도출한 값입니다.** 저장소마다 관례가 다르고(co-located, 중앙 테스트 디렉터리, 소스 트리 미러링), 언어에 따라서는 같은 패키지 디렉터리가 강제됩니다. 고정 경로에 쓰면 러너의 파일 탐색 규약에 걸리지 않아 실행이 0건으로 끝납니다.

```
RunnerProfile {
  runner           string            러너 이름
  testCommand      string            전체 실행 명령
  selectByPath     boolean           경로로 실행 대상을 좁힐 수 있는가
  selectByName     string | null     이름으로 좁히는 플래그. 없으면 null
  layout           TestLayout
  discoveredFrom   string[]          이 값을 도출한 근거 파일
  unresolved       string[]          찾지 못해 비워둔 항목
}

TestLayout {
  strategy         enum(directory, suffix, single)
  specTarget       string            basis=specification 스크립트의 배치 규칙
  codeTarget       string            basis=code 스크립트의 배치 규칙
  separable        boolean           두 basis 를 각각 따로 실행할 수 있는가
  denyPattern      string | null     basis=specification 산출물의 쓰기 금지 패턴
}
```

### strategy

| strategy | 쓰는 때 | `specTarget` 의 형태 |
|---|---|---|
| `directory` | 저장소에 중앙 테스트 디렉터리가 있고 러너 탐색 규약이 그 하위를 포함할 때 | 디렉터리 경로 |
| `suffix` | 저장소가 테스트를 소스 옆에 두거나, 언어가 같은 패키지 배치를 요구할 때 | 파일명 규칙 |
| `single` | 위 둘 다 불가능할 때 | 디렉터리 경로 (양쪽 동일) |

`directory` → `suffix` → `single` 순으로 시도합니다.

### separable 이 계약의 핵심이다

두 디렉터리로 나누는 것 자체가 목적이 아닙니다. 진짜 요구는 하나입니다.

> **executor 가 각 basis 를 한 번의 러너 호출로 선택 실행할 수 있어야 합니다.**

`directory` 는 `selectByPath`, `suffix` 는 `selectByName` 으로 이를 만족시킵니다. 둘 다 불가능하면 `strategy: "single"`, `separable: false` 이고, 이때 **두 신호의 구별이 무너집니다** — 리포트에 명시해야 하며 조용히 합치면 안 됩니다.

### denyPattern

`basis: specification` 산출물의 쓰기를 막는 패턴입니다. 호스트의 경로 단위 쓰기 거부 규칙(예: Claude Code 의 `.claude/settings.json` `permissions.deny`)에 넣을 값으로, layout 에서 생성됩니다.

| strategy | `denyPattern` |
|---|---|
| `directory` | `<specTarget>/**` |
| `suffix` | 파일명 규칙을 glob 으로 |
| `single` | `null` — 경로로 막을 수 없습니다 |

---

## data/test-data.json

```
TestDataFile {
  fixtures         object            fixture 이름 → 값
}
```

케이스에서는 `{ "$fixture": "<이름>" }` 로 참조합니다.

외부 fixture 가 필요할 때만 채웁니다. 입력이 케이스에 인라인으로 들어가면 이 파일은 비어 있어도 됩니다.

---

## test-implementer 반환값

```
ImplementerOutput {
  scripts          Script[]
  dataFile         string | null
  unresolved       Unresolved[]
}

Script {
  path             string            layout 이 정한 배치를 따른 실제 경로
  caseIds          Ref<TestCase>[]
  basis            Basis
}

Unresolved {
  caseId           Ref<TestCase>
  reason           string            이 러너에서 표현할 수 없었던 것
}
```

`basis` 가 `layout.specTarget` / `layout.codeTarget` 중 어느 쪽을 쓸지 정합니다. 경로를 스스로 고르지 마세요.

---

## results/test-results.json

```
ResultsFile {
  runId            string            ISO 8601 타임스탬프
  suites           Suite[]           basis 별로 하나씩
  results          Result[]
  unmapped         object[]          케이스에 되짚지 못한 러너 출력
  runError         string | null     실행 자체가 불가능했을 때 원문
  summary          Summary
}

Suite {
  basis            Basis
  selector         string            이 스위트를 고른 경로 또는 이름 필터
  command          string            이 스위트를 돌린 실행 명령
}

Result {
  caseId           Ref<TestCase>
  basis            Basis
  status           enum(pass, fail, error, skipped)
  scriptRef        string            "파일경로:행번호"
  expected         Expected          케이스에서 그대로 복사
  actual           object | null     관찰된 값. status=pass 면 생략 가능
  message          string | null     러너가 낸 실패 메시지
  durationMs       number
}

Summary {
  total, pass, fail, error, skipped   number
}
```

`fail` 과 `error` 를 섞지 마세요.

| status | 뜻 | 다음 단계의 해석 |
|---|---|---|
| `fail` | 실행됐고 단언이 틀렸습니다 | 명세/구현 불일치 후보 |
| `error` | 실행 자체가 안 됐습니다 | 대부분 도구 문제 |

---

## reports/incidents.json

```
IncidentsFile {
  incidents        Incident[]
}

Incident {
  id               string            INC- 접두사
  kind             IncidentKind
  classification   null              항상 null. 채우면 다음 단계가 수정해도 된다고 읽는다
  proposedClassification  Classification
  reasoning        string            이 분류를 제안하는 근거 한 문장
  evidence         Evidence
  action           "human-review-required"
}

Evidence {
  caseIds          Ref<TestCase>[]
  basisRefs        BasisRef[]
  locations        BasisRef[]
  specBoundary     string?           경계 불일치일 때만
  observedBoundary string?           경계 불일치일 때만
}

IncidentKind = enum(requirement-implementation-discrepancy,
                    unexplained-implementation-behavior,
                    possible-missing-implementation,
                    ambiguous-requirement,
                    test-defect-suspected,
                    context-leak-suspected)

Classification = enum(spec-defect, test-defect,
                      implementation-defect, ambiguous-requirement)
```

### kind 판정 조건

| kind | 조건 |
|---|---|
| `requirement-implementation-discrepancy` | `basis: specification` 케이스가 `fail` |
| `unexplained-implementation-behavior` | 명세 근거 없는 `business-rule` predicate |
| `possible-missing-implementation` | 명세 항목에 대응하는 predicate 없음 |
| `ambiguous-requirement` | 설계 단계가 올린 `Ambiguity` |
| `test-defect-suspected` | `error` 이거나 기대값이 명세와 어긋나 보임 |
| `context-leak-suspected` | leak 검사 실패 또는 `LeakSuspect` |

### classification

에이전트의 판단은 `proposedClassification` 까지입니다. 근거가 약하면 `ambiguous-requirement` 를 제안합니다.

---

## 커버리지 계산

두 지표를 **같은 식**으로 계산합니다.

```
coverage(basis) = |{ CI : basis(CI) = basis ∧ ∃ case → CI }|
                  ─────────────────────────────────────────
                  |{ CI : basis(CI) = basis }|
```

| 지표 | basis |
|---|---|
| Requirement Coverage | `specification` |
| Structural Coverage | `code` |

케이스를 못 만든 커버리지 항목은 파일에 그대로 남기세요. 지우면 분모가 줄어 100% 로 보이는 거짓말이 됩니다.

합산하지 마세요. 다른 질문에 답하는 숫자입니다.
