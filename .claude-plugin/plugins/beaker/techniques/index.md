# test techniques

ISO/IEC/IEEE 29119-4 의 분류를 따릅니다. 기법은 **Test Condition 을 Coverage Item 으로 바꾸는 규칙**입니다.

```
Test Condition  --[technique]-->  Coverage Item  -->  Test Case
```

기법을 고른다는 건 "이 조건에서 무엇을 세어야 충분한가"를 정하는 것입니다.

---

## 표현 규약: 먼저 읽어라

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

## 파일 이름

접두사는 주로 쓰는 설계자입니다. `bb-` 는 블랙박스(명세 기반), `wb-` 는 화이트박스(구조 기반)입니다. 둘 다 쓰는 기법은 표의 「쓰는 설계자」 칸을 따릅니다.

모든 기법 문서는 끝에 「beaker 통합」 절이 있습니다. 그 기법을 beaker 에 어떻게 넣었는지, 넣지 않았다면 왜인지가 거기 있습니다.

---

## 설계 기법: `technique` 필드에 쓰는 값

**아래 16개가 전부입니다.** 목록에 없는 이름을 `technique` 필드에 쓰지 마세요. 리포트 단계의 커버리지 집계가 깨집니다.

| `technique` 값 | 문서 | 쓰는 설계자 | Coverage Item |
|---|---|---|---|
| `equivalence-partitioning` | [bb-equivalence-partitioning](bb-equivalence-partitioning.md) | BB | 파라미터별 파티션 하나(유효, 무효), 결과 종류 하나 |
| `boundary-value-analysis` | [bb-boundary-value-analysis](bb-boundary-value-analysis.md) | BB | 경계값 하나(3-value 면 이웃 포함) |
| `decision-table` | [bb-decision-table](bb-decision-table.md) | BB | 실제로 쓴 표의 feasible rule 하나 |
| `state-transition` | [bb-state-transition](bb-state-transition.md) | BB, WB | state table 의 칸 하나(valid, invalid transition) |
| `metamorphic-relation` | [bb-metamorphic-relation](bb-metamorphic-relation.md) | BB | relation 과 metamorphic group 하나 |
| `classification-tree` | [bb-classification-tree](bb-classification-tree.md) | BB | 조합 규칙이 정한 단위(기본은 leaf class 하나) |
| `combinatorial-t-way` | [bb-combinatorial-t-way](bb-combinatorial-t-way.md) | BB | 제약을 만족하는 t-tuple 하나. pairwise 는 t = 2 |
| `scenario` | [bb-scenario](bb-scenario.md) | BB | 명세가 정의한 주 흐름 또는 대안 흐름 하나 |
| `syntax-based` | [bb-syntax-based](bb-syntax-based.md) | BB | production 하나(유효), production 과 mutation operator 쌍 하나(무효) |
| `error-guessing` | [bb-error-guessing](bb-error-guessing.md) | BB | 닫힌 결함 목록의 범주와 파라미터 쌍 하나 |
| `mcdc` | [wb-mcdc](wb-mcdc.md) | WB, BB | 원자 조건마다 independence pair 하나 |
| `branch-condition` | [wb-branch-condition](wb-branch-condition.md) | WB | 결정 결과 하나, 원자 조건 값 하나 (= C/DC) |
| `multiple-condition-coverage` | [wb-multiple-condition-coverage](wb-multiple-condition-coverage.md) | WB | 결정 안에서 실행 가능한 평가 벡터 하나 |
| `all-uses` | [wb-all-uses](wb-all-uses.md) | WB | def-use 쌍 하나(p-use 는 분기 결과마다) |
| `edge-pair-coverage` | [wb-edge-pair-coverage](wb-edge-pair-coverage.md) | WB | 합류 노드를 지나는 (들어오는 간선, 나가는 간선) 쌍 하나 |
| `prime-path-coverage` | [wb-prime-path-coverage](wb-prime-path-coverage.md) | WB | prime path 하나. loop 가 있고 한도 이하일 때만 |

---

## 기준으로만 쓰는 문서

생성기로 쓰지 않고, 포함 관계와 커버리지 수치를 읽는 기준으로만 둡니다. `technique` 값이 아닙니다.

| 문서 | 왜 생성기가 아닌가 |
|---|---|
| [wb-node-coverage](wb-node-coverage.md) | 분기가 있으면 `branch-condition` 에 포함됩니다. 줄 커버리지와 `reach` 를 해석하는 바닥 기준입니다 |
| [wb-edge-coverage](wb-edge-coverage.md) | 조건이 붙은 간선은 `branch-condition` 의 결정 결과 항목과 같은 단위입니다 |
| [wb-decision-coverage](wb-decision-coverage.md) | `branch-condition` 에 포함됩니다 |
| [wb-condition-coverage](wb-condition-coverage.md) | `branch-condition` 에 포함됩니다. 단독으로 쓰면 결정 결과를 보장하지 않습니다 |
| [wb-condition-decision-coverage](wb-condition-decision-coverage.md) | `branch-condition` 이 세는 단위의 정의입니다 |
| [wb-all-defs](wb-all-defs.md) | `all-uses` 에 포함됩니다. `all-uses` 열거에서 빠진 def 를 찾는 검사로 씁니다 |
| [wb-all-du-paths](wb-all-du-paths.md) | 경로 수가 지수적이고 `reach` 로 def-clear 여부를 가를 수 없습니다 |
| [wb-complete-path-coverage](wb-complete-path-coverage.md) | loop 가 있으면 분모가 무한입니다. 이론적 상한입니다 |
| [bb-cause-effect-graph](bb-cause-effect-graph.md) | Coverage Item 이 `decision-table` 의 rule 과 같습니다. `decision-table` 앞단의 원인 제약 정리 절차로 씁니다 |
| [bb-pairwise](bb-pairwise.md) | `combinatorial-t-way` 의 t = 2 입니다. 손으로 covering array 를 짜는 규모와 검사 방법을 담습니다 |

---

## 보류하거나 넣지 않은 것

| 문서 | 상태 | 남은 일 |
|---|---|---|
| [bb-property-based](bb-property-based.md) | 보류 | `inputs` 의 생성기 마커와 property 기대값 종류, 결과의 seed · 반례 자리가 스키마에 생겨야 씁니다 |
| [wb-mutation-testing](wb-mutation-testing.md) | 단계 후보 | 실행 뒤 시험 묶음의 단언 강도를 재는 선택 단계입니다. Coverage Item 을 만들지 않습니다 |
| [bb-fuzzing](bb-fuzzing.md) | 단계 후보 | 실행 뒤 fuzz campaign 을 도는 선택 단계입니다. 결과를 커버리지에 합산하지 않습니다 |
| [bb-exploratory](bb-exploratory.md) | 넣지 않음 | 실행 결과를 보고 다음 시험을 고르면 구현이 블랙박스 판단에 섞입니다. 사람 몫입니다 |

---

## 구조 기준의 포함 관계

화이트박스 기준끼리 무엇이 무엇을 포함하는지입니다. 위에 있는 것이 아래를 포함합니다. 수치를 읽을 때 「아래 기준 100%」를 「위 기준 충족」으로 읽지 않습니다.

```
complete-path
  prime-path               (self-loop 가 없으면 edge-pair 를 포함)
    edge-pair
      edge  ≈  decision
        node

multiple-condition
  mcdc
    branch-condition (= C/DC)
      decision, condition

all-du-paths
  all-uses
    all-defs
```

---

## 선택 규칙

Test Condition 의 **형태**를 보고 고릅니다. 도메인이 아니라 형태입니다. 조건 하나에 기법이 둘 이상 붙어도 됩니다.

### 블랙박스

| 조건의 형태 | 기법 |
|---|---|
| 값의 부류가 나뉘고 부류마다 결과가 다릅니다 | equivalence-partitioning |
| 순서 있는 도메인에 임계값이 있습니다 | + boundary-value-analysis |
| 불리언 조건 여러 개의 조합으로 결과가 결정됩니다 | decision-table. 조합이 너무 많으면 mcdc |
| 같은 입력이라도 이전 이력에 따라 결과가 다릅니다 | state-transition |
| 입력의 측면(aspect)이 많아 분할 누락이 걱정됩니다 | classification-tree |
| 파라미터마다 값이 여럿이고 서로 독립이라 조합이 폭발합니다 | combinatorial-t-way (기본 t = 2) |
| 명세가 주 흐름과 대안 흐름을 정의하고 대상이 그 진입점입니다 | scenario |
| 명세가 입력 형식을 문법으로 정합니다 | syntax-based |
| 입력이 항목 집합이거나, 같은 값의 다른 표기가 있거나, 명세 항목 등급이 `authored` 입니다 | + metamorphic-relation |
| 타입이 허용하는 단골 결함 입력(빈 값, 최대 길이 등)이 있고 명세가 그 결과를 정합니다 | + error-guessing |

EP 와 BVA 는 거의 항상 같이 갑니다. metamorphic-relation 과 error-guessing 은 다른 기법을 대체하지 않고 더해집니다.

### 화이트박스

| 대상의 형태 | 기법 |
|---|---|
| 모든 대상 | branch-condition (기본) |
| 원자 조건이 둘 이상인 `business-rule` 결정 | + mcdc. 조건이 적고 조합 전체가 필요하면 multiple-condition-coverage |
| 앞에서 대입한 값을 뒤 분기나 계산이 읽습니다 | + all-uses |
| 앞 분기가 바꾼 값을 바로 다음 분기가 읽습니다 | + edge-pair-coverage |
| loop 안에 분기가 있고 prime path 수가 한도 이하입니다 | + prime-path-coverage |
| 상태 머신입니다 | + state-transition |

경로를 세는 기법(all-uses, edge-pair-coverage, prime-path-coverage)은 결과 종류만으로는 그 경로를 지났는지 알 수 없습니다. 러너가 케이스별 줄 커버리지를 낼 수 있을 때만 씁니다. 커버리지 집계 규칙은 `references/schemas.md` 의 「커버리지 계산」 절에 있습니다.

---

## 공통 규칙

**1. Coverage Item 마다 테스트 케이스가 최소 1개.**

커버리지 지표가 이 관계로 계산됩니다. 케이스를 못 만든 커버리지 항목은 그대로 남기세요. 지우면 커버리지가 100% 로 보이는 거짓말이 됩니다.

**2. `rationale` 에 기법의 논리를 적습니다.**

"BVA 를 썼다"가 아니라 "명세가 지정한 경계이고 반대편의 가장 가까운 값"처럼 적습니다. 몇 주 뒤 이 케이스를 지워도 되는지 판단하려면 그 문장이 필요합니다.

**3. 명세에 없는 값을 만들어내지 않습니다.**

파티션·경계·조합·전이를 나눌 근거가 명세에 없으면 발명하지 말고 `ambiguities` 에 올리세요. 발명한 값은 검증하는 게 아무것도 없으면서 통과하거나 실패합니다.
