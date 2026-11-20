---
name: wb-branch-condition
description: 구현의 결정마다 결정 결과와 결정 안 원자 조건의 참·거짓 값을 함께 세는 화이트박스 기본 설계 기법입니다(= Condition/Decision Coverage). 모든 대상에 기본으로 쓰고, predicate 를 business-rule, defensive, infrastructural 로 분류해 명세 근거 없는 business-rule 원자 조건만 incident 후보로 올립니다. whitebox-test-designer 가 부릅니다.
---

# Branch Condition Testing (= Condition/Decision Coverage)

whitebox-test-designer 가 모든 대상에 기본으로 부르는 기법입니다. `technique` 값은 `branch-condition` 입니다.

**분류** structure-based · **Coverage Item** 결정 결과 하나, 결정 안 원자 조건 값 하나 · **쓰는 곳** whitebox-test-designer 전용

ISO/IEC/IEEE 29119-4 의 Branch Condition Testing 은 결정 결과와 원자 조건 값을 함께 셉니다. 문헌의 Condition/Decision Coverage(C/DC)와 같은 항목입니다.

## 언제 쓰나

- 화이트박스 설계의 모든 대상에 기본으로 씁니다. 다른 화이트박스 기법은 이 기법을 대체하지 않고 더해집니다.
- 원자 조건이 둘 이상인 `business-rule` 결정이면 같은 결정에 `mcdc` 를 더합니다. 이유는 「다른 기법과의 관계」의 masking 한계입니다.
- 블랙박스 설계자는 이 기법을 쓰지 않습니다. 쓸 수 있다면 그건 구현이 payload 에 샜다는 뜻입니다.

## 절차

1. 대상의 결정을 전부 열거합니다. 조건 분기, 다중 분기, 삼항, 단축평가, early return, 예외 경로, 루프 진입/미진입, 그리고 **분기 지점이 아닌 Boolean 식**(Boolean 변수 대입, Boolean 반환)도 결정입니다.
2. Coverage Item 을 만들기 전에 predicate 를 분류합니다. 이 기법에서 가장 중요한 단계입니다. 기준은 아래 「predicate 분류」에 있습니다.
3. **결정마다 결정 수준 Test Condition 을 하나 둡니다.** `predicateScope: decision`, `predicate` 에 결정 전체 원문을 적고, 결과마다 Coverage Item 을 하나씩 둡니다. 두 갈래면 참·거짓 두 개, 다중 분기면 case 마다 하나입니다.
4. **원자 조건이 둘 이상인 결정은 원자 조건까지 쪼갭니다.** 원자 조건마다 조건 수준 Test Condition(`predicateScope: condition`, `decisionRef` 는 3번의 TC)을 두고, 참으로 평가됨·거짓으로 평가됨을 Coverage Item 으로 둡니다.

   ```
   결정이  P1 ∧ P2  이면

     TC  결정 P1 ∧ P2      CI: 결정 참       CI: 결정 거짓
     TC  조건 P1           CI: P1 참         CI: P1 거짓
     TC  조건 P2           CI: P2 참         CI: P2 거짓
   ```

5. 원자 조건이 하나뿐인 결정은 3번의 결정 수준 TC 하나로 끝냅니다.
6. 단축평가로 평가되지 않는 조건을 겨냥할 때는 앞 조건을 고정합니다. `P1 ∧ P2` 에서 `P1` 이 거짓이면 `P2` 가 평가되지 않습니다. `P2` 의 값을 세려면 `P1` 을 참으로 고정한 입력을 쓰고 `rationale` 에 적습니다.
7. 명세 근거가 없는 `business-rule` 원자 조건만 `incidentCandidates` 에 올립니다.
8. **결정이 하나도 없는 대상은 진입 실행 Test Condition 하나를 둡니다.** `statement` 에 「진입에서 종료까지 한 번 실행한다」를 적고 `predicate`, `predicateClass`, `predicateScope` 는 모두 `null` 로 둡니다. Coverage Item 은 그 실행 하나입니다. 이게 없으면 구조 커버리지 분모가 0 이 됩니다.
9. 어떤 입력으로도 도달할 수 없는 분기를 찾으면 케이스를 만들지 않고 `notes` 에 `Note` 로 기록합니다. `issue` 는 `unreachable-branch`, `detail` 에는 도달을 막는 선행 조건을 적습니다. 죽은 코드이거나, 도달 조건을 설계자가 못 찾은 것입니다. 둘 다 사람이 볼 가치가 있습니다.

### predicate 분류

| class | 판별 기준 |
|---|---|
| `business-rule` | 값이 바뀌면 제품 동작이 바뀝니다. 도메인 규칙을 표현합니다 |
| `defensive` | 잘못된 입력·상태로부터 스스로를 보호합니다 |
| `infrastructural` | 도메인과 무관한 실행 환경 관심사 |

- **셋 다 Coverage Item 이 됩니다.** 구조 커버리지는 전부 세야 합니다.
- **`business-rule` 만 incident 후보입니다.** incident 후보는 원자 조건 단위로 봅니다. 결정 수준 TC 자체는 후보로 올리지 않습니다.
- 애매하면 `defensive` 로 분류합니다. 실무 코드의 predicate 대다수가 `defensive` / `infrastructural` 이고, 그걸 전부 incident 로 올리면 리포트가 노이즈에 덮여 아무도 안 읽습니다.
- 분류 기준은 **predicate 가 무엇을 판단하는가**이지 predicate 가 어떻게 생겼는가가 아닙니다. 같은 비교 연산이라도 도메인 규칙일 수도 방어 코드일 수도 있습니다.

## 만드는 것

- **`technique`**: `branch-condition`.
- **결정 수준 Test Condition**: `predicateScope: decision`, `predicate` 는 결정 전체 원문, `decisionRef` 는 `null`. `predicateClass` 는 결정 안에 `business-rule` 조건이 있으면 `business-rule` 입니다. Coverage Item 은 결정 결과마다 하나입니다.
- **조건 수준 Test Condition**: 원자 조건이 둘 이상인 결정에만 둡니다. `predicateScope: condition`, `decisionRef` 는 결정 수준 TC, `predicate` 는 원자 조건 원문, `predicateClass` 는 그 원자 조건이 무엇을 판단하는지로 정합니다. Coverage Item 은 「참으로 평가됨」, 「거짓으로 평가됨」 두 개입니다.
- **Test Case 의 기대값은 characterization 입니다.** 현재 구현이 실제로 하는 일이고, 옳음을 주장하는 게 아닙니다. `expectedDescription` 에 `(characterization)` 표기를 반드시 남깁니다. 이 테스트가 나중에 깨졌을 때 "버그"가 아니라 "의도된 변경일 수 있음"으로 읽혀야 합니다.
- **`pins`**: 그 케이스가 고정하는 predicate 의 `predicateClass` 입니다.
- **`notes`**: 도달 불가 분기는 `issue: unreachable-branch` 인 `Note` 입니다.

## 하지 않는 것

- 평가되지 않은 조건 값으로 그 Coverage Item 을 덮었다고 세지 않습니다.
- 결정 수준 TC 를 incident 후보로 올리지 않습니다. `defensive`, `infrastructural` predicate 도 올리지 않습니다. 커버리지 항목으로만 셉니다.
- 도달 불가 분기에 케이스를 만들지 않습니다.
- `technique` 값을 `condition-decision-coverage` 로 바꾸지 않습니다. 이유는 「beaker 통합」에 있습니다.
- 블랙박스 설계에 쓰지 않습니다.

<example>
결정이 복합 조건 `P1 ∧ P2` 이고, `P1` 이 도메인 규칙, `P2` 가 방어 코드일 때.

```
Test Condition 1  결정
  predicateScope  decision
  predicate       P1 ∧ P2 의 원문
  predicateClass  business-rule      결정 안에 business-rule 조건이 있으면 business-rule
  CI   결정 참 / 결정 거짓

Test Condition 2  조건
  predicateScope  condition
  decisionRef     Test Condition 1
  predicate       P1 의 원문
  predicateClass  business-rule
  CI   P1 참 / P1 거짓

Test Condition 3  조건
  predicateScope  condition
  decisionRef     Test Condition 1
  predicate       P2 의 원문
  predicateClass  defensive
  CI   P2 참 / P2 거짓

incidentCandidates
  P1 에 대응하는 명세 항목을 못 찾았다면 여기 올린다.
  P2 는 defensive 이므로 올리지 않는다. 커버리지 항목으로만 센다.
```

여섯 개 커버리지 항목 전부가 구조 커버리지 분모에 들어갑니다. incident 후보만 걸러지는 것이지 커버리지가 걸러지는 게 아닙니다.
</example>

## 다른 기법과의 관계

- **포함합니다**: [beaker:wb-decision-coverage](../wb-decision-coverage/SKILL.md), [beaker:wb-condition-coverage](../wb-condition-coverage/SKILL.md), [beaker:wb-edge-coverage](../wb-edge-coverage/SKILL.md)(조건이 붙은 간선), [beaker:wb-node-coverage](../wb-node-coverage/SKILL.md)(분기가 하나라도 있을 때). 네 문서는 이 기법이 세는 단위의 정의와 한계를 담습니다. [beaker:wb-condition-decision-coverage](../wb-condition-decision-coverage/SKILL.md) 는 이 기법과 같은 기준입니다.
- **포함됩니다**: [beaker:wb-mcdc](../wb-mcdc/SKILL.md), [beaker:wb-multiple-condition-coverage](../wb-multiple-condition-coverage/SKILL.md). 같은 결정에 그 기법을 더 붙이면 조건이 결과에 독립적으로 영향을 주는지까지 봅니다.
- **masking 한계**: 조건 값을 전부 뒤집었는데 결정 결과는 다른 조건이 정한 경우가 있습니다. 이 기법은 그 경우를 막지 못합니다. `business-rule` 결정이면 [beaker:wb-mcdc](../wb-mcdc/SKILL.md) 를 더합니다.

## beaker 통합

- **verdict**: technique. `Technique` 값은 `branch-condition` 그대로입니다. `condition-decision-coverage` 로 이름을 바꾸지 않습니다. 기존 산출물의 `technique` 값이 깨지고, 같은 항목이 두 이름으로 두 번 세어지기 때문입니다.
- **스키마**: `TestCondition` 의 `predicateScope`(decision, condition)와 `decisionRef` 로 결정 수준과 조건 수준을 가릅니다. `mcdc`, `multiple-condition-coverage` 도 같은 필드를 씁니다. 필드 정의는 `${CLAUDE_PLUGIN_ROOT}/references/schemas.md` 에 있습니다.
- **reach**: 결정 결과 항목은 결정 줄이 아니라 그 방향의 첫 줄이 실행됐는지로 봐야 정확합니다. 줄 커버리지가 없으면 결과 종류로 판정하고, 판정이 서지 않으면 `unknown` 입니다.
- **비용**: 결정마다 2개에서 원자 조건 수 + 1 개 사이의 케이스입니다.

## 출처

- ISO/IEC/IEEE 29119-4:2015, 5.3.4 Branch Condition Testing, 6.3.4
- [Hayhurst 외, A Practical Tutorial on Modified Condition/Decision Coverage, NASA/TM-2001-210876](https://shemesh.larc.nasa.gov/fm/papers/Hayhurst-2001-tm210876-MCDC.pdf), 2.3절
