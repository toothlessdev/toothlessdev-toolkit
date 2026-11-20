---
name: bb-state-transition
description: 같은 입력이라도 이전 이력에 따라 결과가 다를 때 상태와 이벤트로 state table 을 만들고, valid 와 invalid transition 칸 하나를 Coverage Item 하나로 만드는 기법입니다. 명세가 순서를 말한 쌍에만 1-switch 를 더합니다. blackbox-test-designer 가 기본으로 부르고, 상태 필드가 있는 구현에는 whitebox-test-designer 도 부르며 technique 값은 state-transition 입니다.
---

# State Transition Testing

blackbox-test-designer 가 이력에 따라 결과가 달라질 때 부르고, whitebox-test-designer 도 상태 머신 구현에 부르는 기법입니다. `technique` 값은 `state-transition` 입니다.

## 언제 쓰나

같은 입력이라도 이전 이력에 따라 결과가 다를 때 씁니다. 명세가 상태 이름, 상태별로 허용되는 이벤트, 상태 변화 규칙 중 하나라도 말하면 씁니다. 화이트박스에서는 상태를 나타내는 필드와 그 값을 바꾸는 분기가 있으면 씁니다.

## 절차

### state table 만들기

1. 명세에서 **상태**와 **이벤트**를 뽑습니다. 이벤트에 guard 조건이 붙으면 `이벤트 [guard]` 를 하나의 열로 봅니다.
2. `(현재 상태, 이벤트) → (다음 상태, 출력)` 표(state table)를 만듭니다. 행은 상태, 열은 이벤트, 칸은 transition 입니다.
3. 칸 하나를 Coverage Item 하나로 둡니다. 기준은 **all transitions coverage** 입니다. 명세가 정의한 칸(valid transition)과 명세가 금지하거나 비워 둔 칸(invalid transition)을 모두 셉니다.
4. 상태 자체는 따로 Coverage Item 으로 만들지 않습니다. valid transition 을 전부 덮으면 모든 상태를 지나기 때문입니다. 어떤 valid transition 의 출발점도 도착점도 아닌 상태가 있을 때만 그 상태를 Coverage Item 으로 둡니다.

| # | 현재 | 이벤트 | 다음 | 근거 |
|---|---|---|---|---|
| T1 | S1 | E1 | S2 | REQ-nn |
| T2 | S2 | E1 | S3 | REQ-nn |
| T3 | S1 | E2 | S4 | REQ-mm |
| T4 | S3 | E2 | (거부) | REQ-kk |

**T4 처럼 거부되어야 하는 transition 도 Coverage Item 입니다.** 오히려 이쪽에서 결함이 잘 나옵니다. 허용되면 안 되는 전이가 허용되는 결함, 특정 상태에서 이벤트가 조용히 무시되는 결함은 invalid transition 칸에서만 드러납니다.

### invalid transition 의 기대값 정하기

invalid transition 의 기대값은 명세의 닫는 문장에서만 나옵니다. 빈 칸은 두 가지로 갈립니다.

1. 명세가 「그 밖의 이벤트는 거부한다」, 「S3 에서는 E2 를 받지 않는다」처럼 **빈 칸을 닫는 문장**을 갖고 있으면 invalid transition 케이스를 만듭니다. 거부 방식이 오류면 `expected.kind` 는 `throws`, 상태 불변이면 `value` 입니다. **명세가 지정한 쪽을 씁니다.**
2. 닫는 문장이 없으면 칸은 Coverage Item 으로 남기고 `ambiguities` 에 `Ambiguity` 를 올려 `blockedCoverageItems` 로 겁니다.
3. invalid transition 은 **케이스 하나에 하나만** 시도합니다. 한 케이스에서 둘을 시도하면 첫 번째 거부가 두 번째를 가립니다(defect masking).

### 경로로 케이스 만들기

transition 하나를 테스트하려면 그 출발 상태까지 가는 경로가 필요합니다.

1. `preconditions` 에 시작 상태에서 어떤 이벤트를 어떤 순서로 적용해 출발 상태에 이르는지를 한 줄에 한 단계씩 씁니다. 경로는 valid transition 만으로 만들고, public interface 로 할 수 있는 호출만 씁니다.
2. 한 케이스가 경로 위의 valid transition 여러 개를 함께 덮어도 됩니다. 그때 `coverageItemRefs` 에 덮은 항목을 모두 겁니다.
3. 대상 상태가 반환값으로 보이지 않으면, 명세가 상태마다 다른 결과를 정한 이벤트를 하나 더 적용해 상태를 확인합니다. 그런 이벤트가 명세에 없으면 `Ambiguity` 입니다.
4. 시작 상태에서 어떤 경로로도 닿을 수 없는 상태가 명세에 있으면, 그 상태에서 출발하는 칸은 `Ambiguity` 로 올립니다. 명세 결함일 가능성이 큽니다.

### 1-switch 를 더하기(선택)

N-switch coverage 는 연속된 N+1 개 transition 의 열을 Coverage Item 으로 셉니다. valid transitions coverage 가 0-switch 이고, 1-switch 는 연속된 transition 쌍입니다.

1-switch 는 명세가 이벤트의 순서나 연속을 직접 말할 때(「E1 직후의 E2」, 「연속으로 두 번」) 그 쌍에만 추가합니다. 쌍의 수는 상태마다 (들어오는 transition 수 × 나가는 transition 수)를 더한 값이라 전부 만들면 금방 커집니다.

### 화이트박스에서 쓸 때

1. 상태와 transition 은 구현에서 읽습니다. 그 transition 을 고르는 조건이 `predicate` 이고, 대개 `business-rule` 입니다.
2. 구현이 처리하지 않는 `(상태, 이벤트)` 칸도 Coverage Item 입니다. 기대값은 현재 구현이 실제로 하는 일이고 `(characterization)` 을 붙입니다.
3. `<requirements>` 를 받았을 때, 명세가 정의하지 않은 transition 을 구현이 허용하면 `unexplained-implementation-behavior`, 명세가 정의한 transition 을 구현이 처리하지 않으면 `possible-missing-implementation` 으로 올립니다.
4. 어떤 경로로도 갈 수 없는 상태 값은 `notes` 에 `unreachable-branch` 로 적습니다.

## 만드는 것

- **TestCondition**: 상태 하나에서 받는 이벤트 묶음 단위로 둡니다. 블랙박스는 `basisRefs` 에 REQ 항목을, 화이트박스는 `"파일경로:행번호"` 와 `predicate`, `predicateClass` 를 채웁니다.
- **CoverageItem**: `technique` 은 `state-transition` 입니다. 단위는 state table 의 칸 하나입니다. valid 와 invalid 를 모두 세고, 명세가 순서를 말한 쌍에만 1-switch 를 더합니다. `description` 에는 상태와 이벤트 이름을 명세(화이트박스는 구현)의 어휘 그대로 쓰고 valid, invalid 를 적습니다.
- **TestCase**: `preconditions` 에 출발 상태까지의 경로를, `inputs` 에 시험할 이벤트를 넣습니다. invalid transition 의 `expected` 는 명세가 지정한 대로 `throws` 또는 `value`(상태 불변)입니다. 화이트박스 케이스의 `expectedDescription` 에는 `(characterization)` 을 붙이고 `pins` 를 채웁니다.

## 하지 않는 것

- **명세에 없는 transition 을 발명하지 않습니다.**
- **빈 칸을 지우지 않습니다.** 지우면 분모가 줄어 커버리지가 거짓으로 오릅니다.
- **「당연히 거부되겠지」를 근거로 invalid transition 의 기대값을 만들지 않습니다.** 실제로 많은 결함이 그 「당연히」에서 나옵니다.
- **invalid transition 둘을 한 케이스에서 시도하지 않습니다.**
- **N 이 2 이상인 switch 열은 만들지 않습니다.**

<example>
명세가 상태 `S1..Sn` 과 이벤트 `E1..Em` 을 정의하고, 「그 밖의 이벤트는 오류로 거부한다」는 닫는 문장을 가질 때.

```
Test Condition  상태 하나에서 받는 이벤트 묶음 단위

Coverage Item
  CI-01  valid    (S1, E1) -> S2       명세가 정의한 전이
  CI-02  valid    (S2, E1) -> S3       명세가 정의한 전이
  CI-03  invalid  (S3, E2) -> 거부      닫는 문장이 금지한 전이
  CI-04  invalid  (S2, E2) -> ?        닫는 문장이 없으면 Ambiguity 로 막힘

Test Case
  BB-01  preconditions  없음 (시작 상태 S1)
         inputs         E1 을 두 번 적용
         covers         CI-01, CI-02
  BB-02  preconditions  S1 에서 E1, E1 을 적용해 S3 에 도달
         inputs         E2
         expected       throws, 명세가 정한 오류 종류
         covers         CI-03 하나만
```

상태와 이벤트 이름은 **명세의 어휘를 그대로** 씁니다. `S1`, `E1` 은 이 문서의 기호입니다.
</example>

## 다른 기법과의 관계

- state table 위에서 all states coverage 는 [beaker:wb-node-coverage](../wb-node-coverage/SKILL.md), valid transitions coverage(0-switch)는 [beaker:wb-edge-coverage](../wb-edge-coverage/SKILL.md), 1-switch 는 [beaker:wb-edge-pair-coverage](../wb-edge-pair-coverage/SKILL.md) 와 같은 요구입니다. 그래프가 코드의 CFG 가 아니라 상태 모델이라는 점만 다릅니다.
- 포함 관계: all transitions coverage 는 valid transitions coverage 를, valid transitions coverage 는 all states coverage 를 포함합니다. N-switch 는 N 이 클수록 강하고, N 을 끝까지 키운 것이 [beaker:wb-complete-path-coverage](../wb-complete-path-coverage/SKILL.md) 의 상한입니다.
- guard 조건이 여러 불리언의 조합이면 그 칸 안을 [beaker:bb-decision-table](../bb-decision-table/SKILL.md) 로 나눕니다. guard 가 순서 있는 값의 임계값이면 [beaker:bb-equivalence-partitioning](../bb-equivalence-partitioning/SKILL.md) 과 [beaker:bb-boundary-value-analysis](../bb-boundary-value-analysis/SKILL.md) 를 함께 씁니다.
- [beaker:bb-scenario](../bb-scenario/SKILL.md) 의 주 흐름과 대안 흐름은 상태 모델 위의 긴 경로입니다. 시나리오는 흐름 단위 결함을, 이 기법은 칸 단위 결함을 잡습니다.

## beaker 통합

- **verdict**: technique. `Technique` enum 의 `state-transition` 을 그대로 씁니다.
- **쓰는 설계자**: blackbox-test-designer 가 기본이고, 대상에 상태 필드가 있으면 whitebox-test-designer 도 씁니다.
- **스키마**: `CoverageItem` 에 선택 필드 `criterion` 을 두어 `valid-transition`, `invalid-transition`, `1-switch`, `state` 를 구분하면 리포트가 기준별 커버리지를 따로 보일 수 있습니다. 경로를 기계가 읽게 하려면 `TestCase` 에 이벤트 호출 순서를 담는 선택 필드가 필요합니다.
- **비용**: invalid transition 은 최대 (상태 수 × 이벤트 수 - valid transition 수)개입니다. 1-switch 쌍은 상태마다 들어오는 수와 나가는 수의 곱을 더한 수입니다.
- **한계**: 명세가 상태 모델을 말하지 않으면 쓸 수 없고, 명세가 정하지 않은 숨은 상태(구현만 아는 상태)는 1-switch 이상에서만 드러날 수 있습니다. 상태가 반환값에 보이지 않으면 상태 확인 이벤트가 명세에 있어야 합니다.

## 출처

- [ISTQB Certified Tester Foundation Level Syllabus v4.0.1](https://www.istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf), 4.2.4 State Transition Testing: all states, valid transitions(0-switch), all transitions coverage 의 정의와 포함 관계, invalid transition 은 케이스 하나에 하나(defect masking)
- T. S. Chow, "Testing Software Design Modeled by Finite-State Machines", IEEE Transactions on Software Engineering, 1978: n-switch 의 정의
- P. Ammann, J. Offutt, 「Introduction to Software Testing」 2판, 7장 Graph Coverage 의 명세(FSM) 대상 절: 상태 모델에 node, edge, edge-pair coverage 를 적용
- ISO/IEC/IEEE 29119-4, State Transition Testing 절(원문 미열람)
