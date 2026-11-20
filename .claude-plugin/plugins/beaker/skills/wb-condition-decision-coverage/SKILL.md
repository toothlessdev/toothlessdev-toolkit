---
name: wb-condition-decision-coverage
description: 설계 기법이 아니라 기준 문서입니다. 결정마다 참·거짓 결과와 그 결정 안 원자 조건의 참·거짓 값을 함께 세는 Condition/Decision Coverage(C/DC)를 이름과 한계까지 정의합니다. branch-condition 이 세는 단위의 정의라서 whitebox-test-designer 와 리포트가 참조하며, technique 값으로 쓰지 않습니다.
---

# Condition/Decision Coverage (C/DC)

whitebox-test-designer 와 리포트가 참조하는 기준 문서입니다. `technique` 값이 없습니다. 이 기준을 세는 기법은 `branch-condition` 입니다.

**분류** structure-based · **Coverage Item(기준의 정의)** 각 decision 의 참/거짓 결과와 그 decision 안 각 원자 조건의 참/거짓 값 · **쓰는 곳** 기준으로만 씀 (`branch-condition` 과 같은 기준)

ISO/IEC/IEEE 29119-4 의 Branch Condition Testing 이 세는 항목과 같습니다. 그 표준의 커버리지 식은 「decision 안 조건의 불리언 값 수 + decision 결과 수」를 분모로 둡니다. 그래서 [beaker:wb-branch-condition](../wb-branch-condition/SKILL.md) 이 하는 일과 같은 기준이고, 이 문서는 그 기준을 이름과 한계까지 드러내 다시 정의합니다.

## 언제 쓰나

- 화이트박스 설계의 기본 구조 기준입니다. Decision Coverage 와 Condition Coverage 를 따로 세지 않고 이 기준 하나로 둘을 함께 셉니다. beaker 에서 이 기준을 세는 기법은 `branch-condition` 입니다.
- 복합 조건 decision 이 있고, 각 조건이 결과를 혼자 바꾸는지까지 보여야 할 근거가 없을 때 이 기준으로 충분합니다. 그 근거가 있으면 `mcdc` 를 더해 기준을 올립니다.
- 블랙박스 설계자는 쓰지 않습니다. 명세의 논리식은 decision-table 이 rule 단위로 더 세밀하게 셉니다. C/DC 를 명세 논리식에 적용하면 케이스 두 개로 끝나 decision-table 보다 약합니다.

## 이 기준을 쓰는 법

### 기준의 정의

1. **decision 을 전부 열거합니다.** 조건 분기, 다중 분기, 삼항, 루프의 계속/종료 판정, early return 의 가드가 decision 입니다. 다중 분기는 각 case 와 default 가 결과 하나씩입니다.
2. **decision 마다 원자 조건까지 쪼갭니다.** `P1 ∧ (P2 ∨ P3)` 이면 원자 조건은 `P1`, `P2`, `P3` 입니다.
3. **Coverage Item 은 두 종류입니다.**
   - decision 결과: 참 1개, 거짓 1개 (다중 분기는 결과 수만큼)
   - 원자 조건 값: 조건마다 참 1개, 거짓 1개
4. **조건이 하나뿐인 decision 은 decision 결과 항목 두 개만 만듭니다.** 조건 값과 decision 결과가 같은 사건이라, 따로 세면 같은 실행이 분모에 두 번 들어갑니다.
5. **조건 값은 실제로 평가된 경우만 셉니다.** 단축평가(`∧` 의 앞 조건이 거짓, `∨` 의 앞 조건이 참) 때문에 평가되지 않은 조건은 그 케이스에서 값이 없습니다. 목표 조건 앞의 조건들을 평가가 이어지는 값으로 고정하고, 그 값을 `preconditions` 와 `rationale` 에 적습니다.
6. **케이스를 고를 때 decision 결과 항목과 조건 값 항목을 함께 채웁니다.** 케이스 하나가 여러 항목을 덮어도 됩니다. 덮은 항목을 `coverageItemRefs` 에 전부 겁니다.

predicate 분류, characterization 기대값, 도달 불가 분기 처리는 [beaker:wb-branch-condition](../wb-branch-condition/SKILL.md) 의 규칙을 그대로 따릅니다.

### branch-condition 산출물과 맞춰 읽기

- decision 결과 항목은 `branch-condition` 의 결정 수준 Test Condition(`predicateScope: decision`)에, 원자 조건 값 항목은 조건 수준 Test Condition(`predicateScope: condition`)에 있습니다.
- 정의 1번은 29119-4 를 따라 분기점만 decision 으로 셉니다. `branch-condition` 의 절차는 분기점이 아닌 Boolean 식(대입, 반환)도 결정으로 열거하므로, beaker 산출물의 decision 집합이 이 정의보다 넓을 수 있습니다. 아래 한계의 세 번째 항목을 같이 봅니다.

### 한계

- **각 조건이 결과를 혼자 바꾼다는 것을 보이지 않습니다.** 아래 예시의 두 케이스처럼 모든 조건이 함께 뒤집히면, 어느 조건이 결과를 정했는지 가려집니다. 연산자를 잘못 쓴 결함(`∨` 자리에 `∧`)이나 조건 하나가 빠진 결함이 통과합니다.
- **단축평가 언어에서는 비용이 언어마다 다릅니다.** 비단축 연산자면 decision 마다 최소 2개로 충분합니다. 단축평가에서 평가된 값만 세면 순수 `∧` 사슬이나 순수 `∨` 사슬은 조건 수 + 1 개가 필요해 mcdc 와 개수가 같아집니다. 섞인 식에서는 그 사이입니다.
- **decision 의 범위를 분기점으로 한정합니다.** 29119-4 를 따라 결과가 둘 이상으로 갈리는 지점만 decision 으로 셉니다. 분기점이 아닌 대입, 반환, 인자의 불리언 식까지 decision 으로 보는 정의(DO-178 계열)보다 항목이 적습니다.
- **조건 값 항목은 줄 커버리지로 확인되지 않습니다.** decision 이 있는 줄이 실행된 것까지만 `reach` 로 확인되고, 목표 조건이 그 값으로 평가됐는지는 케이스 설계가 보장합니다.

## 만들지 않는 이유

조사 단계에서는 `condition-decision-coverage` 를 새 `technique` 값으로 넣고 `branch-condition` 을 대체하는 안을 냈습니다. 통합할 때 이름을 바꾸지 않고 `branch-condition` 의 내용을 이 기준에 맞췄습니다. 이름을 바꾸면 기존 산출물의 `technique` 값이 깨지고, 같은 항목이 두 이름으로 두 번 세어집니다.

## 하지 않는 것

- `technique` 필드에 `condition-decision-coverage` 를 쓰지 않습니다. `branch-condition` 을 씁니다.
- 조건이 하나뿐인 decision 에 조건 값 항목을 따로 만들지 않습니다.
- 이 기준 100% 를 각 조건의 독립 영향까지 보였다는 뜻으로 읽지 않습니다.
- 블랙박스 설계에 쓰지 않습니다.

<example>
decision `P1 ∨ P2` 이고 단축평가 언어일 때.

```
CI-101  decision 참          CI-102  decision 거짓
CI-103  P1 참                CI-104  P1 거짓
CI-105  P2 참                CI-106  P2 거짓

WB-01  P1 참                    -> CI-101, CI-103   P2 는 평가되지 않음
WB-02  P1 거짓, P2 참           -> CI-101, CI-104, CI-105
WB-03  P1 거짓, P2 거짓         -> CI-102, CI-104, CI-106
```

단축평가가 없다면 { P1 참, P2 참 } 과 { P1 거짓, P2 거짓 } 두 케이스로 여섯 항목이 모두 덮입니다. 이 두 케이스는 `P1 ∨ P2` 를 `P1`, `P2`, `P1 ∧ P2` 와 구별하지 못합니다. 이것이 이 기준의 masking 한계입니다.
</example>

## 다른 기법과의 관계

- **포함합니다**
  - [beaker:wb-decision-coverage](../wb-decision-coverage/SKILL.md): decision 결과 항목을 그대로 갖고 있습니다.
  - [beaker:wb-condition-coverage](../wb-condition-coverage/SKILL.md): 원자 조건 값 항목을 그대로 갖고 있습니다.
  - [beaker:wb-edge-coverage](../wb-edge-coverage/SKILL.md): 대상의 분기점이 전부 decision 으로 열거되면 decision 결과 집합이 CFG 의 분기 간선 집합과 같습니다. 열거가 빠지면 포함 관계도 깨집니다.
  - [beaker:wb-node-coverage](../wb-node-coverage/SKILL.md): edge-coverage 를 거쳐, 도달 가능한 노드에 한해 포함합니다.
- **포함됩니다**
  - [beaker:wb-mcdc](../wb-mcdc/SKILL.md): C/DC 에 각 조건의 독립 영향 증명을 더한 기준입니다.
  - [beaker:wb-multiple-condition-coverage](../wb-multiple-condition-coverage/SKILL.md): 조건 값의 모든 조합을 요구하므로 C/DC 항목이 전부 들어갑니다.
- **겹칩니다**
  - [beaker:bb-decision-table](../bb-decision-table/SKILL.md): 같은 논리식을 명세 쪽에서 rule 단위로 셉니다. 근거(Test Basis)가 달라 대체 관계가 아닙니다.
  - [beaker:wb-edge-pair-coverage](../wb-edge-pair-coverage/SKILL.md), [beaker:wb-prime-path-coverage](../wb-prime-path-coverage/SKILL.md): 경로 축 기준이라 조건 축인 C/DC 와 서로 포함하지 않습니다.

## beaker 통합

- **verdict**: criterion-only. 이 기준은 `branch-condition` 이 세는 단위의 정의입니다. 경위는 「만들지 않는 이유」에 있습니다.
- **반영한 것**: [beaker:wb-branch-condition](../wb-branch-condition/SKILL.md) 이 결정마다 결정 결과 항목을 두고, 원자 조건 값 항목과 구별하도록 `TestCondition` 에 `predicateScope`(decision, condition)와 `decisionRef` 를 더했습니다. 이 두 필드는 `mcdc`, `multiple-condition-coverage` 도 씁니다. 필드 정의는 `${CLAUDE_PLUGIN_ROOT}/references/schemas.md` 에 있습니다.
- **incident**: 원자 조건 단위의 `business-rule` predicate 만 후보입니다. 결정 수준 Test Condition 자체는 후보가 아닙니다.
- **비용**: 결정마다 2개에서 조건 수 + 1 개 사이. mcdc 보다 적거나 같고 multiple-condition-coverage(2의 조건 수 제곱)보다 훨씬 적습니다.
- 기법 목록과 분류는 `beaker:techniques` 에 있습니다.

## 출처

- Hayhurst, Veerhusen, Chilenski, Rierson. [A Practical Tutorial on Modified Condition/Decision Coverage, NASA/TM-2001-210876](https://shemesh.larc.nasa.gov/fm/papers/Hayhurst-2001-tm210876-MCDC.pdf). 2.3 절 Table 1(기준별 요구사항), 2.3.4 절(C/DC 정의와 `A or B` 를 TT, FF 로 덮었을 때 구별 못 하는 식), 3.6 절(단축평가).
- ISO/IEC/IEEE 29119-4:2015. 5.3.4 Branch Condition Testing(Coverage Item 정의), 6.3.4 Branch Condition Testing Coverage(조건 값 + decision 결과를 분모로 두는 식), Annex F(구조 커버리지 기준의 부분 순서와 subsumption 의 한계).
- Ammann, Offutt. Introduction to Software Testing, Logic Coverage 장(Predicate Coverage, Clause Coverage, Combinatorial Coverage, Active Clause Coverage).
- [Modified condition/decision coverage, Wikipedia](https://en.wikipedia.org/wiki/Modified_condition/decision_coverage). C/DC 와 MC/DC 정의 비교, masking 언급.
