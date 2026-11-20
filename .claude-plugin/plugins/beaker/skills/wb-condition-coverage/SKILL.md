---
name: wb-condition-coverage
description: 설계 기법이 아니라 기준 문서입니다. 결정 안 원자 조건마다 참과 거짓으로 실제 평가됐는지를 세는 Condition Coverage 를 정의합니다. branch-condition 의 조건 수준 Test Condition 이 이 기준을 그대로 만족하며, whitebox-test-designer 와 리포트가 조건 수준 항목을 확인하거나 따로 읽을 때 참조합니다. technique 값으로 쓰지 않습니다.
---

# Condition Coverage

whitebox-test-designer 와 리포트가 참조하는 기준 문서입니다. `technique` 값이 없습니다. 이 기준의 Coverage Item 은 `branch-condition` 의 조건 수준 Test Condition 이 만듭니다.

**분류** structure-based · **Coverage Item(기준의 정의)** 원자 조건마다 참 1개, 거짓 1개 · **쓰는 곳** 기준으로만 씀 (`branch-condition` 에 포함)

블랙박스 설계자는 이 기준을 쓰지 않습니다. 원자 조건은 구현의 식에서만 나옵니다. 명세의 논리식을 원자 조건으로 쪼개는 일은 [beaker:bb-decision-table](../bb-decision-table/SKILL.md) 과 [beaker:bb-cause-effect-graph](../bb-cause-effect-graph/SKILL.md) 가 맡습니다.

## 언제 쓰나

결정(decision) 하나가 원자 조건(condition) 여러 개를 `∧`, `∨`, `¬` 로 묶은 식일 때 이 기준이 의미가 있습니다. 결정은 분기문의 조건식만이 아니라 불리언 값을 만드는 모든 식입니다. 변수에 대입하는 식, 반환식, 다른 함수에 넘기는 인자식도 결정입니다.

- 원자 조건이 하나뿐인 결정에서는 이 기준이 Decision Coverage 와 같은 Coverage Item 을 정의합니다. 그래서 `branch-condition` 은 그런 결정에 결정 수준 Test Condition 하나만 둡니다.
- **단독 기준으로 읽지 않습니다.** 원자 조건을 전부 뒤집어도 결정 결과는 한쪽만 나올 수 있습니다. 그래서 beaker 는 이 기준을 Decision Coverage 와 함께, 둘을 합친 Condition/Decision Coverage 로 셉니다. 그 기준을 세는 기법이 `branch-condition` 입니다.
- 화이트박스 설계자가 `branch-condition` 의 조건 수준 항목을 만들 때, 그리고 리포트가 조건 수준 항목만의 비율을 따로 볼 때 이 문서의 정의를 씁니다.

## 이 기준을 쓰는 법

### 기준의 정의

`branch-condition` 의 조건 수준 Test Condition 은 아래 정의를 따릅니다.

1. **결정을 원자 조건까지 쪼갭니다.** 원자 조건은 불리언 연산자를 포함하지 않는 불리언 식입니다. 비교식, 불리언 변수, 불리언을 돌려주는 호출이 원자 조건입니다.
2. **원자 조건마다 Test Condition 하나를 만듭니다.** `predicate` 는 그 원자 조건의 원문이고, `predicateClass` 는 그 원자 조건이 무엇을 판단하는지로 정합니다. 같은 결정 안의 원자 조건끼리 class 가 달라도 됩니다.
3. **Test Condition 하나에 Coverage Item 둘입니다.** 「원자 조건이 참으로 평가됨」과 「원자 조건이 거짓으로 평가됨」입니다.
4. **평가되지 않은 값은 세지 않습니다.** 단축평가 연산자에서 앞 조건이 결과를 정하면 뒤 조건은 평가되지 않습니다. 그 케이스는 뒤 조건의 Coverage Item 을 덮지 않습니다.
5. **목표 원자 조건이 평가되게 앞 조건을 고정합니다.** `P1 ∧ P2` 에서 `P2` 의 Coverage Item 을 겨냥하는 케이스는 `P1` 을 참으로 둡니다. `P1 ∨ P2` 에서는 `P1` 을 거짓으로 둡니다. 이 고정은 `preconditions` 와 `inputs` 에 넣고, `rationale` 에 어떤 앞 조건을 왜 고정했는지 적습니다.
6. **같은 원자 조건이 결정 안에 두 번 나오면 나온 자리마다 따로 셉니다.** 자리마다 평가 시점과 단축평가 여부가 다릅니다.
7. **어떤 입력으로도 한쪽 값이 나오지 않는 원자 조건은 케이스를 만들지 않습니다.** 그 Coverage Item 은 파일에 남기고, `notes` 에 `issue: unreachable-branch` 와 그 값을 막는 선행 조건을 적습니다. 다른 원자 조건과 서로 묶여 한쪽 값이 불가능한 경우도 같습니다.

기대값은 [beaker:wb-branch-condition](../wb-branch-condition/SKILL.md) 과 같은 characterization 입니다. `expectedDescription` 에 `(characterization)` 을 남기고, `pins` 는 그 케이스가 겨냥한 원자 조건의 `predicateClass` 로 채웁니다.

### 리포트에서 읽을 때

- 조건 수준 항목(`predicateScope: condition`)만의 비율을 볼 때 이 정의를 씁니다.
- 줄 커버리지로는 원자 조건이 무슨 값으로 평가됐는지 알 수 없습니다. 조건 값 항목은 설계자가 입력에서 도출한 값이고, reporter 는 그 사실을 구조 커버리지 옆에 적습니다.

### 한계

- 단독으로 쓰면 결정 결과를 보장하지 않습니다. 아래 예시의 비단축 `∧` 가 그 경우입니다.
- 원자 조건이 결정 결과에 독립적으로 영향을 주는지도 보지 않습니다. 그건 [beaker:wb-mcdc](../wb-mcdc/SKILL.md) 가 맡습니다.

## 만들지 않는 이유

조사 단계에서는 별도 technique 로 넣는 안을 냈습니다. 통합할 때 `branch-condition` 이 결정 결과와 원자 조건 값을 함께 세도록 고쳤고, 이 기준의 Coverage Item 은 그 안의 조건 수준 항목과 같습니다. 따로 두면 같은 항목이 두 이름으로 두 번 세어집니다.

## 하지 않는 것

- `technique` 필드에 `condition-coverage` 를 쓰지 않습니다.
- 이 기준 100% 를 결정 결과까지 덮었다는 뜻으로 읽지 않습니다.
- 평가되지 않은 조건 값으로 Coverage Item 을 덮었다고 세지 않습니다.
- 한쪽 값이 불가능한 원자 조건의 Coverage Item 을 지우지 않습니다.

<example>
결정 `P1 ∧ P2` 가 단축평가 연산자이고, `P1` 은 `business-rule`, `P2` 는 `defensive` 일 때.

```
TC-101  predicate P1   predicateClass business-rule
  CI-101  P1 참으로 평가됨
  CI-102  P1 거짓으로 평가됨
TC-102  predicate P2   predicateClass defensive
  CI-103  P2 참으로 평가됨      앞 조건 고정: P1 참
  CI-104  P2 거짓으로 평가됨    앞 조건 고정: P1 참

WB-101  P1 거짓              → CI-102            (P2 평가 안 됨)
WB-102  P1 참, P2 참         → CI-101, CI-103
WB-103  P1 참, P2 거짓       → CI-101, CI-104
```

연산자가 모든 피연산자를 평가하는 비단축 `∧` 이면 `P1 참, P2 거짓` 과 `P1 거짓, P2 참` 두 케이스로 CI-101 부터 CI-104 까지 다 덮입니다. 이때 결정 결과는 두 케이스 모두 거짓입니다. 결정이 참인 경로는 한 번도 실행되지 않았는데 Condition Coverage 는 100% 로 나옵니다. 그래서 이 기준을 Decision Coverage 없이 쓰지 않습니다.
</example>

## 다른 기법과의 관계

- **포함하는 것**: 없습니다. 원자 조건이 둘 이상인 결정에서는 [beaker:wb-decision-coverage](../wb-decision-coverage/SKILL.md) 도, 그와 거의 같은 [beaker:wb-edge-coverage](../wb-edge-coverage/SKILL.md) 도 포함하지 않습니다. 위 예의 비단축 `∧` 가 반례입니다.
- **포함되는 것**: [beaker:wb-condition-decision-coverage](../wb-condition-decision-coverage/SKILL.md), [beaker:wb-mcdc](../wb-mcdc/SKILL.md), [beaker:wb-multiple-condition-coverage](../wb-multiple-condition-coverage/SKILL.md). MC/DC 는 원자 조건마다 결과를 혼자 뒤집는 참·거짓 쌍을 요구하므로 이 기준의 Coverage Item 을 전부 덮습니다.
- **Decision Coverage 와는 서로 포함하지 않습니다.** 둘을 합친 것이 Condition/Decision Coverage 입니다.
- **[beaker:wb-branch-condition](../wb-branch-condition/SKILL.md) 과의 관계**: branch-condition 의 「원자 조건까지 쪼개 참·거짓을 각각 Coverage Item 으로」 단계가 이 기준과 같고, 「결정 결과의 참·거짓」 단계는 Decision Coverage 입니다. 조사 당시의 branch-condition 예시는 원자 조건의 Coverage Item 만 만들고 복합 조건 전체의 결과는 세지 않아서, 실제로는 Condition Coverage 만 요구했습니다. 지금은 branch-condition 이 결정 수준 Test Condition(`predicateScope: decision`)을 따로 두어 이 빈틈을 메웁니다.
- **[beaker:bb-decision-table](../bb-decision-table/SKILL.md), [beaker:bb-cause-effect-graph](../bb-cause-effect-graph/SKILL.md)**: 같은 논리식을 명세에서 다룹니다. 명세의 조건 조합은 블랙박스 몫이고, 이 기준은 구현의 식만 봅니다.

## beaker 통합

- **verdict**: criterion-only. `Technique` 값으로 넣지 않습니다. 이유는 「만들지 않는 이유」에 있습니다.
- **쓰는 곳**: `branch-condition` 의 조건 수준 Test Condition(`predicateScope: condition`)이 이 기준을 그대로 만족합니다. 리포트에서 조건 수준 항목만의 비율을 따로 볼 때 이 문서의 정의를 씁니다.
- **원자 조건 값의 관찰**: 줄 커버리지로는 원자 조건이 무슨 값으로 평가됐는지 알 수 없습니다. 조건 값 항목은 설계자가 입력에서 도출한 값이고, reporter 는 그 사실을 구조 커버리지 옆에 적습니다. 케이스별 조건 값을 기계가 읽을 수 있게 담는 필드(`conditionValues`)는 후속 과제입니다. 지금 스키마는 `${CLAUDE_PLUGIN_ROOT}/references/schemas.md` 에 있습니다.
- **한계**: 단독으로 쓰면 결정 결과를 보장하지 않습니다. 원자 조건이 결정 결과에 독립적으로 영향을 주는지도 보지 않습니다. 뒤의 것은 `mcdc` 가 맡습니다.
- 기법 목록과 분류는 `beaker:techniques` 에 있습니다.

## 출처

- Kelly J. Hayhurst 외, 「A Practical Tutorial on Modified Condition/Decision Coverage」, NASA/TM-2001-210876, 2.3.3 Condition Coverage, 2.3.4 Condition/Decision Coverage, 3.6 MC/DC with Short Circuit Logic. https://shemesh.larc.nasa.gov/fm/papers/Hayhurst-2001-tm210876-MCDC.pdf
- Arie Gurfinkel, 「Testing: (A Little) Logic Coverage」 강의 자료(Condition Coverage, Combinatorial Coverage 정의). https://ece.uwaterloo.ca/~agurfink/stqam.w20/assets/pdf/W03-LogicCoverage.pdf
- Paul Ammann, Jeff Offutt, 「Introduction to Software Testing」 2판, 8장 Logic Coverage(Clause Coverage, Predicate Coverage 와의 포함 관계). 원문 링크 미확인.
- ISO/IEC/IEEE 29119-4, Branch Condition Testing. 원문 링크 미확인.
