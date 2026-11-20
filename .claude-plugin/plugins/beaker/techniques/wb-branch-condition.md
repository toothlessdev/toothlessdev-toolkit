# Branch Condition Testing (= Condition/Decision Coverage)

**분류** structure-based · **Coverage Item** 결정 결과 하나, 결정 안 원자 조건 값 하나 · **쓰는 곳** whitebox-test-designer 전용

블랙박스 설계자는 이 기법을 쓰지 않습니다. 쓸 수 있다면 그건 구현이 payload 에 샜다는 뜻입니다.

ISO/IEC/IEEE 29119-4 의 Branch Condition Testing 은 결정 결과와 원자 조건 값을 함께 셉니다. 문헌의 Condition/Decision Coverage(C/DC)와 같은 항목입니다. 화이트박스 설계자의 기본 기법입니다.

## 규칙

1. 대상의 결정을 전부 열거합니다. 조건 분기, 다중 분기, 삼항, 단축평가, early return, 예외 경로, 루프 진입/미진입, 그리고 **분기 지점이 아닌 Boolean 식**(Boolean 변수 대입, Boolean 반환)도 결정입니다.
2. **결정마다 결정 수준 Test Condition 을 하나 둡니다.** `predicateScope: decision`, `predicate` 에 결정 전체 원문을 적고, 결과마다 Coverage Item 을 하나씩 둡니다. 두 갈래면 참·거짓 두 개, 다중 분기면 case 마다 하나입니다.
3. **원자 조건이 둘 이상인 결정은 원자 조건까지 쪼갭니다.** 원자 조건마다 조건 수준 Test Condition(`predicateScope: condition`, `decisionRef` 는 2번의 TC)을 두고, 참으로 평가됨·거짓으로 평가됨을 Coverage Item 으로 둡니다.

```
결정이  P1 ∧ P2  이면

  TC  결정 P1 ∧ P2      CI: 결정 참       CI: 결정 거짓
  TC  조건 P1           CI: P1 참         CI: P1 거짓
  TC  조건 P2           CI: P2 참         CI: P2 거짓
```

단축평가 때문에 `P1` 이 거짓이면 `P2` 가 평가되지 않습니다. 평가되지 않은 조건 값은 그 Coverage Item 을 덮지 않습니다. `P2` 의 값을 세려면 `P1` 을 참으로 고정한 입력을 쓰고 `rationale` 에 적습니다.

원자 조건이 하나뿐인 결정은 2번의 결정 수준 TC 하나로 끝납니다.

## predicate 분류가 먼저다

Coverage Item 을 만들기 전에 분류하세요. 이 기법에서 가장 중요한 단계입니다.

| class | 판별 기준 |
|---|---|
| `business-rule` | 값이 바뀌면 제품 동작이 바뀝니다. 도메인 규칙을 표현합니다 |
| `defensive` | 잘못된 입력·상태로부터 스스로를 보호합니다 |
| `infrastructural` | 도메인과 무관한 실행 환경 관심사 |

**셋 다 Coverage Item 이 됩니다.** 구조 커버리지는 전부 세야 합니다.

**`business-rule` 만 incident 후보입니다.** 명세 근거가 없는 `business-rule` predicate 만 `incidentCandidates` 에 올립니다. incident 후보는 원자 조건 단위로 봅니다. 결정 수준 TC 자체는 후보로 올리지 않습니다.

애매하면 `defensive` 로 분류하세요. 실무 코드의 predicate 대다수가 `defensive` / `infrastructural` 이고, 그걸 전부 incident 로 올리면 리포트가 노이즈에 덮여 아무도 안 읽습니다.

분류 기준은 **predicate 가 무엇을 판단하는가**이지 predicate 가 어떻게 생겼는가가 아닙니다. 같은 비교 연산이라도 도메인 규칙일 수도 방어 코드일 수도 있습니다.

## 기대값은 characterization 이다

여기서 만드는 케이스의 기대값은 **현재 구현이 실제로 하는 일**입니다. 옳음을 주장하는 게 아닙니다.

`expectedDescription` 에 `(characterization)` 표기를 반드시 남깁니다. 이 테스트가 나중에 깨졌을 때 "버그"가 아니라 "의도된 변경일 수 있음"으로 읽혀야 합니다.

## 도달 불가 분기

어떤 입력으로도 도달할 수 없는 분기를 찾으면 케이스를 만들지 말고 `notes` 에 `Note` 항목으로 기록합니다. `issue` 는 `unreachable-branch`, `detail` 에는 도달을 막는 선행 조건을 적습니다.

죽은 코드이거나, 도달 조건을 네가 못 찾은 것입니다. 둘 다 사람이 볼 가치가 있습니다.

## 도출 흐름

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

- 포함합니다: `wb-decision-coverage.md`, `wb-condition-coverage.md`, `wb-edge-coverage.md`(조건이 붙은 간선), `wb-node-coverage.md`(분기가 하나라도 있을 때). 네 문서는 이 기법이 세는 단위의 정의와 한계를 담습니다. `wb-condition-decision-coverage.md` 는 이 기법과 같은 기준입니다.
- 포함됩니다: `wb-mcdc.md`, `wb-multiple-condition-coverage.md`. 같은 결정에 그 기법을 더 붙이면 조건이 결과에 독립적으로 영향을 주는지까지 봅니다.
- masking 한계: 조건 값을 전부 뒤집었는데 결정 결과는 다른 조건이 정한 경우가 있습니다. 이 기법은 그 경우를 막지 못합니다. `business-rule` 결정이면 mcdc 를 더합니다.

## beaker 통합

- **verdict**: technique. `Technique` 값은 `branch-condition` 그대로입니다. `condition-decision-coverage` 로 이름을 바꾸지 않습니다. 기존 산출물의 `technique` 값이 깨지고, 같은 항목이 두 이름으로 두 번 세어지기 때문입니다.
- **스키마**: `TestCondition` 의 `predicateScope`(decision, condition)와 `decisionRef` 로 결정 수준과 조건 수준을 가릅니다. mcdc, multiple-condition-coverage 도 같은 필드를 씁니다.
- **reach**: 결정 결과 항목은 결정 줄이 아니라 그 방향의 첫 줄이 실행됐는지로 봐야 정확합니다. 줄 커버리지가 없으면 결과 종류로 판정하고, 판정이 서지 않으면 `unknown` 입니다.
- **비용**: 결정마다 2개에서 원자 조건 수 + 1 개 사이의 케이스입니다.

## 출처

- ISO/IEC/IEEE 29119-4:2015, 5.3.4 Branch Condition Testing, 6.3.4
- [Hayhurst 외, A Practical Tutorial on Modified Condition/Decision Coverage, NASA/TM-2001-210876](https://shemesh.larc.nasa.gov/fm/papers/Hayhurst-2001-tm210876-MCDC.pdf), 2.3절
