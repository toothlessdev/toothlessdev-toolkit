---
name: bb-scenario
description: 명세가 행위자와 대상의 상호작용을 주 흐름과 대안 흐름(예외, 오류 처리, 재시도)으로 서술하고 대상 심볼이 그 흐름의 진입점일 때, 흐름 하나마다 Coverage Item 과 케이스 하나를 만드는 기법입니다. use case, Given/When/Then 묶음, 절차 문장에 씁니다. 여러 진입점에 걸친 E2E 흐름은 범위 밖입니다. blackbox-test-designer 만 technique 값 scenario 로 씁니다.
---

# Scenario Testing (Use Case Testing)

blackbox-test-designer 가 흐름으로 쓰인 명세에서 대상이 진입점일 때 부르고, `technique` 값은 `scenario` 입니다.

- **분류**: specification-based
- **Coverage Item**: 명세가 정의한 주 흐름 하나, 또는 대안 흐름 하나

## 언제 쓰나

명세가 행위자와 대상 사이의 상호작용 순서를 **흐름**으로 서술할 때 씁니다. 주 흐름(성공 경로) 하나와, 특정 단계에서 갈라지는 대안 흐름과 예외 흐름이 있는 형태입니다. use case, 인수조건의 Given/When/Then 묶음, 「~하면 ~한다, 단 ~이면 ~한다」로 이어지는 절차 문장이 여기에 해당합니다.

ISO/IEC/IEEE 29119-4 는 use case testing 을 scenario testing 의 한 형태로 봅니다. 이 스킬도 둘을 같은 기법으로 다룹니다.

**대상이 그 흐름의 진입점일 때만 씁니다.** beaker 의 대상은 심볼 하나입니다. 행위자가 대상 심볼을 직접 호출해서 흐름이 시작되거나, 흐름의 한 단계가 대상 심볼 호출 하나와 대응될 때만 Coverage Item 을 만듭니다.

| 흐름과 대상의 관계 | 처리 |
|---|---|
| 흐름 전체가 대상 호출 한 번 안에서 끝납니다 | Coverage Item 을 만듭니다 |
| 흐름의 앞 단계는 다른 심볼이 하고, 대상은 뒤 단계 하나를 맡습니다 | 앞 단계는 `preconditions` 로 쓰고, 대상이 맡은 단계부터 Coverage Item 을 만듭니다 |
| 흐름이 대상을 거치지 않습니다 | 이 대상의 Coverage Item 이 아닙니다 |
| 흐름이 여러 진입점, 여러 프로세스에 걸쳐 끝까지 이어져야 판정됩니다 (E2E) | 범위 밖입니다. 단계마다 그 단계의 진입점 심볼을 대상으로 따로 실행합니다 |

E2E 를 범위에서 빼는 이유는 두 가지입니다.

- test-implementer 는 저장소의 러너 하나로 대상 하나를 호출하는 스크립트를 쓰고, E2E 에 필요한 배포 환경을 만들지 않습니다.
- 여러 심볼에 걸친 흐름의 기대값을 `Expected` 하나로 쓰면 어느 심볼의 결함인지 가를 수 없습니다.

## 절차

1. 명세에서 **주 흐름**과 **대안 흐름**을 뽑습니다. 대안 흐름에는 예외 흐름, 오류 처리 흐름, 반복(재시도) 흐름이 들어갑니다. 흐름 이름과 단계 이름은 명세의 어휘를 그대로 씁니다.
2. 흐름 하나를 Coverage Item 하나로 둡니다. 29119-4 는 Coverage Item 을 Test Condition 과 같은 단위로 둡니다. beaker 에서는 Test Condition 을 use case(또는 명세가 묶은 흐름 집합) 하나로 두고, 그 아래에 흐름마다 Coverage Item 을 둡니다.
3. **Coverage Item 하나에 케이스 하나를 만듭니다.** ISTQB 는 서로 양립하는 대안 흐름을 케이스 하나에 합쳐도 된다고 하지만, beaker 는 합치지 않습니다. 합치면 실패했을 때 어느 흐름의 결함인지 가를 수 없고, `reach` 판정도 흐름 단위로 할 수 없습니다.
4. 대안 흐름 안에 또 대안이 있으면(재시도 흐름 안의 「다시 성공」과 「끝내 포기」) 끝나는 결과마다 Coverage Item 을 하나씩 둡니다. 바깥 대안으로 들어가는 단계는 `preconditions` 에 씁니다.
5. 흐름이 갈라지는 단계까지의 도달 경로를 `preconditions` 에 문장으로 씁니다. 대상을 여러 번 호출해야 그 단계에 이르면 앞선 호출도 `preconditions` 에 순서대로 씁니다. `inputs` 는 검증할 호출 한 번의 인자입니다.
6. 대안 흐름이 행위자나 상대 컴포넌트의 응답으로 갈라지면(「C1 이 거절하면」) 그 응답을 `preconditions` 에 씁니다. 상대 컴포넌트를 대신할 픽스처를 만들 수 없으면 implementer 가 `unresolved` 로 올립니다.
7. 기대값을 흐름의 **사후 조건**에서 가져옵니다. 성공으로 끝나는 흐름은 `value`, 명세가 오류로 끝난다고 쓴 흐름은 `throws` 입니다. 명세가 오류 종류를 지정하지 않았으면 `errorType` 을 짓지 않고 `ambiguities` 에 올립니다.
8. 흐름의 결과가 대상의 반환값이나 오류가 아니라 다른 컴포넌트에 남는 효과로만 서술되면, 그 Coverage Item 은 남기고 케이스를 만들지 않습니다. 「이 흐름의 결과를 대상의 반환값이나 오류로 판정할 명세 문장이 없다」를 `ambiguities` 에 올리고 `blockedCoverageItems` 에 그 항목을 겁니다.
9. **명세에 없는 대안 흐름을 만들지 않습니다.** 단계는 있는데 그 단계가 실패했을 때의 흐름이 없으면 `ambiguities` 에 올립니다. 이 기법에서 결함이 가장 많이 나오는 곳이 「대안 흐름 누락」이지만, 누락을 채우는 것은 설계자가 아니라 명세 작성자입니다.
10. 흐름 안의 입력 값은 흐름을 구분하는 데만 씁니다. 같은 흐름 안의 값 부류와 경계는 `equivalence-partitioning`, `boundary-value-analysis` 로 따로 Coverage Item 을 만듭니다. 재시도 횟수처럼 흐름이 반복 횟수로 갈리면 그 횟수의 경계(`T - 1`, `T`)는 `boundary-value-analysis` 몫입니다.

## 만드는 것

- **TestCondition**: use case 하나, 또는 명세가 묶은 흐름 집합 하나. `basisRefs` 는 흐름을 서술한 `REQ-` 입니다. `predicate`, `predicateClass` 는 `null` 입니다.
- **CoverageItem**: `technique` 은 `scenario`. 주 흐름 하나 또는 대안 흐름 하나마다 하나이고, 중첩된 대안은 끝나는 결과마다 하나입니다. `description` 에 명세의 흐름 이름과 단계 이름을 그대로 씁니다.
- **TestCase**: Coverage Item 하나에 케이스 하나. `technique` 은 `scenario` 입니다.
  - `preconditions`: 갈라지는 단계까지의 도달 경로, 앞선 대상 호출, 상대 컴포넌트의 응답을 순서대로 씁니다.
  - `inputs`: 검증할 호출 한 번의 인자입니다.
- **Expected**: 흐름의 사후 조건에서 가져옵니다. 성공으로 끝나면 `value`, 명세가 오류로 끝난다고 쓰고 오류 종류를 정했으면 `throws` 입니다.
- **케이스를 만들지 않는 항목**: 결과가 다른 컴포넌트의 효과로만 서술된 흐름과, 오류 종류가 정해지지 않은 흐름은 Coverage Item 을 남기고 `ambiguities` 와 `blockedCoverageItems` 로 보냅니다.

## 하지 않는 것

- 명세에 없는 대안 흐름을 지어내지 않습니다.
- 양립하는 대안 흐름을 케이스 하나에 합치지 않습니다.
- 여러 진입점에 걸친 E2E 흐름을 한 케이스로 판정하지 않습니다.
- 명세가 오류 종류를 정하지 않은 흐름에 `errorType` 을 짓지 않습니다.
- 흐름 안의 값 부류와 경계를 scenario 항목으로 세지 않습니다.
- Kaner 식으로 그럴듯한 사용 이야기를 지어내지 않습니다.

<example>
명세가 진입점 대상에 대해 주 흐름 하나와 대안 흐름 셋을 정의하고, 대안 하나가 재시도 흐름일 때.

```
Test Condition  TC-01  대상의 흐름 묶음                       REQ-nn
  CI-01  주 흐름: S1 → S2 → S3 성공                            scenario
  CI-02  대안 흐름: S1 에서 입력 V1 이 거부됨                   scenario
  CI-03  대안 흐름: S2 에서 C1 이 거절, 재시도 끝에 성공         scenario
  CI-04  대안 흐름: S2 에서 C1 이 거절, 재시도 T 회 뒤 포기      scenario

Test Case
  BB-01  CI-01  preconditions []                    expected value  (사후 조건)
  BB-02  CI-02  inputs 에 V1                        expected throws (명세의 오류 종류)
  BB-03  CI-03  preconditions [C1 이 거절 후 수락]   expected value
  BB-04  CI-04  preconditions [C1 이 계속 거절]      expected throws
```

CI-03 과 CI-04 는 같은 재시도 흐름 안의 두 결과라 따로 셉니다. 재시도 횟수 `T` 의 경계는 같은 조건 아래 `boundary-value-analysis` 항목으로 더합니다.
</example>

## 다른 기법과의 관계

- **포함 관계로 줄 세울 수 없습니다**: scenario coverage 는 명세의 흐름 모델 위에서 정의되고, [beaker:wb-edge-coverage](../wb-edge-coverage/SKILL.md), [beaker:wb-prime-path-coverage](../wb-prime-path-coverage/SKILL.md) 같은 구조 기준은 구현의 CFG 위에서 정의됩니다. 그래프가 달라 서로 포함하지 않습니다. 흐름 모델을 그래프로 보면 「모든 흐름」은 갈라지는 간선마다 한 번 지나는 것에 가깝고, 대안 흐름 둘의 조합은 요구하지 않습니다(inference).
- **[beaker:bb-state-transition](../bb-state-transition/SKILL.md) 과 겹칩니다**: 흐름이 대상의 상태를 바꾸면 흐름 하나는 transition 의 연속입니다. state-transition 은 transition 하나를 세고, scenario 는 명세가 이름 붙인 흐름 하나를 셉니다. 명세가 상태 표를 주면 state-transition 을, 흐름 서술을 주면 scenario 를 기본으로 씁니다.
- **[beaker:bb-decision-table](../bb-decision-table/SKILL.md) 과 겹칩니다**: 대안 흐름이 조건 여러 개의 조합으로 갈라지면 그 단계의 조합은 decision-table 로 세는 쪽이 빠짐이 적습니다. ISTQB 도 use case 서술에서 결정 테이블을 따로 만들라고 권합니다.
- **[beaker:bb-equivalence-partitioning](../bb-equivalence-partitioning/SKILL.md), [beaker:bb-boundary-value-analysis](../bb-boundary-value-analysis/SKILL.md) 와 함께 갑니다**: 흐름 안의 입력 값을 고르는 데 씁니다(절차 10).
- **[beaker:bb-metamorphic-relation](../bb-metamorphic-relation/SKILL.md) 을 더합니다**: 흐름 서술이 `authored` 등급이면 흐름의 사후 조건도 같이 틀릴 수 있습니다. 결과 불변식을 최소 하나 붙입니다.
- **[beaker:bb-exploratory](../bb-exploratory/SKILL.md), [beaker:bb-error-guessing](../bb-error-guessing/SKILL.md) 와 구분합니다**: Kaner 의 scenario testing 은 그럴듯하고 복잡한 사용 이야기를 사람이 지어내는 경험 기반 기법이고, 스스로 커버리지용이 아니라고 말합니다. beaker 의 `scenario` 는 명세가 정의한 흐름만 세는 29119-4 의 뜻만 씁니다. 이야기를 지어내는 쪽은 블랙박스 설계자의 「명세에 없는 값을 만들지 않는다」 규칙과 맞지 않습니다.

## beaker 통합

- **verdict**: technique. 블랙박스 설계자만 씁니다. `Technique` 값은 `scenario` 입니다. 화이트박스 설계자는 쓰지 않습니다. 구현에는 흐름의 이름이 없고, 구현 분기로 흐름을 복원하면 그건 [beaker:wb-branch-condition](../wb-branch-condition/SKILL.md) 입니다.
- **쓰는 때**: 명세가 흐름으로 쓰였고 대상이 그 흐름의 진입점일 때. 오케스트레이터는 `<technique-hint>` 에 `scenario` 를 넣을 때 그 두 조건을 확인합니다.
- **Coverage Item 단위**: 명세가 정의한 주 흐름 하나 또는 대안 흐름 하나. 중첩된 대안은 끝나는 결과마다 하나.
- **커버리지**: `${CLAUDE_PLUGIN_ROOT}/references/schemas.md` 의 「커버리지 계산」 식을 그대로 씁니다. 29119-4 의 scenario coverage(실행한 흐름 수 / 전체 흐름 수)와 같은 값입니다. 결과를 반환값으로 판정할 수 없어 케이스가 없는 흐름도 분모에 남습니다.
- **스키마**: `Technique` enum 에 `scenario` 가 들어 있습니다. `Expected` 는 바꾸지 않았습니다. 다른 컴포넌트에 남는 효과로만 판정되는 흐름은 절차 8(blocked 처리)로 드러냅니다.
- **비용**: 흐름 수만큼만 늘어나 다른 기법보다 적습니다. 대신 흐름마다 도달 경로가 길어 `preconditions` 와 픽스처가 무겁고, 상대 컴포넌트 응답으로 갈라지는 흐름은 `unresolved` 가 되기 쉽습니다.
- **한계**: 흐름 서술의 질을 넘지 못합니다. ISTQB 가 말하듯 대안 흐름과 예외 흐름이 정확히 정의돼야 커버리지가 의미 있고, 명세가 빠뜨린 대안 흐름은 이 기법으로 생기지 않고 `ambiguities` 로만 드러납니다. 여러 심볼에 걸친 흐름의 통합 결함은 이 기법으로 잡지 못합니다.

## 출처

- ISO/IEC/IEEE 29119-4:2015, 5.2.9 Scenario Testing, 6.2.9 Scenario Testing Coverage, 부록 B.2.9. 흐름을 main / alternative scenario 로 나누고 둘 다 Coverage Item 으로 두는 것, Coverage Item 이 Test Condition 과 같다는 것, use case testing 이 scenario testing 의 한 형태라는 것, 대안 흐름에 비정상 사용과 예외가 들어간다는 것.
- [ISTQB Certified Tester Advanced Level Test Analyst Syllabus v3.1.2](https://www.istqb.org/wp-content/uploads/2024/11/ISTQB_CTAL-TA_Syllabus_v3.1.2.pdf), 3.2.7 Use Case Testing. 최소 커버리지(기본 동작 케이스 하나와 대안, 오류 처리 동작마다 케이스), 양립하는 대안을 합치는 것과 진단을 위해 나누는 것의 차이, 중첩 대안, 잡는 결함(정의된 동작의 잘못된 처리, 대안 동작 누락, 잘못된 오류 메시지).
- [Cem Kaner, An Introduction to Scenario Testing (2003)](https://kaner.com/pdfs/ScenarioIntroVer4.pdf). 이야기 기반 scenario test 의 정의와, 커버리지용이 아니고 회귀 시험은 단위 시험으로 하라는 한계.
