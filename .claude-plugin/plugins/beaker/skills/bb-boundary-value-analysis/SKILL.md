---
name: bb-boundary-value-analysis
description: 명세가 순서 있는 도메인(수, 날짜, 길이, 개수)을 임계값으로 나눌 때, 맞닿은 boundary value 와 이웃을 2-value 또는 3-value 규칙으로 골라 값 하나를 Coverage Item 하나로 만드는 기법입니다. 임계값은 명세에서만 가져옵니다. blackbox-test-designer 가 equivalence-partitioning 뒤에 부르며 technique 값은 boundary-value-analysis 입니다.
---

# Boundary Value Analysis

blackbox-test-designer 가 순서 있는 파티션의 경계에서 부르는 specification-based 기법입니다. `technique` 값은 `boundary-value-analysis` 입니다.

이 기법이 beaker 의 핵심입니다. implementation anchoring 이 가장 극적으로 드러나는 자리이기 때문입니다.

## 언제 쓰나

순서 있는 도메인(수, 날짜, 길이, 개수)을 명세가 파티션으로 나눌 때 씁니다. [beaker:bb-equivalence-partitioning](../bb-equivalence-partitioning/SKILL.md) 을 했으면 거의 항상 뒤따릅니다. 순서가 없는 열거형에는 쓰지 않습니다.

## 절차

### 용어

- **boundary value**: 순서 있는 파티션의 최솟값과 최댓값입니다. 두 파티션 사이의 틈이 아니라 파티션에 속한 원소입니다.
- **이웃**: boundary value 에서 `δ` 만큼 떨어진 값입니다. `δ` 는 명세가 정한 정밀도이고, 정수 도메인이면 1 입니다. 명세가 정밀도를 말하지 않으면 `<public-types>` 의 타입이 표현하는 최소 간격을 쓰고 `assumptions` 에 남깁니다.

### 경계 값 고르기

1. 명세에서 임계값 `T`, 비교 관계 `R`, `R` 이 참인 쪽 결과 X 를 읽습니다. 두 파티션이 맞닿은 자리마다 boundary value 가 둘(양쪽 파티션에 하나씩) 있습니다.
2. 아래 표에서 `R` 에 맞는 행을 찾아 Coverage Item 을 정합니다.

    | R | `T` 는 X 구간 | 맞닿은 boundary value | 2-value Coverage Item | 3-value Coverage Item |
    |---|---|---|---|---|
    | `>=` (이상) | 안 | `T-δ`, `T` | `T-δ`, `T` | `T-2δ`, `T-δ`, `T`, `T+δ` |
    | `>` (초과) | 밖 | `T`, `T+δ` | `T`, `T+δ` | `T-δ`, `T`, `T+δ`, `T+2δ` |
    | `<=` (이하) | 안 | `T`, `T+δ` | `T`, `T+δ` | `T-δ`, `T`, `T+δ`, `T+2δ` |
    | `<` (미만) | 밖 | `T-δ`, `T` | `T-δ`, `T` | `T-2δ`, `T-δ`, `T`, `T+δ` |
    | `==` (정확히) | 안 | `T` 하나 | `T-δ`, `T`, `T+δ` | `T-2δ`, `T-δ`, `T`, `T+δ`, `T+2δ` |

    - **2-value**: boundary value 마다 그 값과, 이웃한 파티션에 속한 가장 가까운 이웃이 Coverage Item 입니다. 맞닿은 자리 하나에서 두 값이 나오고, 두 값은 결과가 다른 두 구간에 하나씩 걸칩니다.
    - **3-value**: boundary value 마다 그 값과 양쪽 이웃 둘이 Coverage Item 입니다. 맞닿은 자리 하나의 합집합은 네 값이고, 2-value 의 Coverage Item 을 전부 포함합니다.
    - `>` 와 `<=` 에서 `T-δ` 를 2-value 짝으로 고르면 두 값이 같은 구간에 놓여 경계 반대편의 오류를 놓칩니다.

3. 2-value 를 기본으로 합니다. 아래 중 하나면 3-value 로 늘립니다.
    - 명세가 그 경계를 특별히 위험하다고 지정합니다.
    - 호출자가 `<technique-hint>` 로 3-value 를 지정합니다.

    2-value 가 놓치는 결함은 정해져 있습니다. 명세가 `x <= T` 인데 구현이 `x == T` 이거나 `x != T+δ` 이면, 2-value 의 두 값(`T`, `T+δ`)에서 기대 결과와 같은 결과가 나와 통과합니다. 3-value 의 `T-δ` 가 앞의 것을, `T+2δ` 가 뒤의 것을 드러냅니다.

4. 도메인 양끝을 더합니다.

    ```
    CI: min(domain(P1))
    CI: max(domain(P1))     타입이 상한을 주는 경우
    ```

    - 도메인 바깥 이웃이 입력으로 표현될 수 없으면(음수 길이, 타입 최댓값 너머) Coverage Item 이 아닙니다. 그 자리는 2-value 에서 한 값, 3-value 에서 두 값입니다.
    - 명세의 유효 범위 밖이지만 타입이 표현할 수 있는 값(빈 값, 최대 길이보다 `δ` 큰 길이)은 무효 파티션의 boundary value 이므로 Coverage Item 입니다. 그 값에서의 결과를 명세가 말하지 않으면 `Ambiguity` 입니다.

5. 한 파라미터의 경계는 Test Condition 하나에 모읍니다. 원소가 적은 파티션에서 두 경계의 값이 겹치면 Coverage Item 은 한 번만 만듭니다. 겹친 값을 둘로 세면 분모가 부풀어 커버리지가 틀립니다.

### 포함과 배타를 정확히 읽기

관계 `R` 이 `>=` 인지 `>` 인지가 `T` 와 짝을 이룰 반대편 값이 `T-δ` 인지 `T+δ` 인지를 바꿉니다. 「이상」, 「초과」, 「미만」, 「이하」, 「~부터 ~까지」, 「~사이」가 실무에서 가장 자주 틀리는 지점이고, 그래서 테스트할 가치가 가장 높은 지점입니다.

명세가 포함 여부를 분명히 하지 않으면 추정하지 말고 `Ambiguity` 로 올립니다.

### 경계 양쪽의 결과가 같을 때

두 파티션의 결과 규칙이 달라도, 맞닿은 boundary value 에서는 두 규칙이 같은 결과 값을 낼 수 있습니다. 그러면 2-value 와 3-value 모두 경계가 어긋난 구현을 통과시킵니다.

1. 명세의 두 규칙으로 결과가 처음 갈리는 값을 계산할 수 있으면, 그 값을 boundary value 로 하는 파티션을 하나 더 두고 그 경계에 이 절차를 적용합니다.
2. 계산할 근거(정밀도, 반올림 규칙)가 명세에 없으면 `Ambiguity` 에 올립니다.

## 만드는 것

- **TestCondition**: 한 파라미터의 경계를 조건 하나에 모읍니다. `basisRefs` 는 임계값을 정한 명세 항목입니다.
- **CoverageItem**: `technique` 은 `boundary-value-analysis` 입니다. 단위는 값 하나이고, 같은 파라미터에서 겹친 값은 하나로 셉니다. `description` 에는 명세에서 읽어낸 실제 값과, 그 값이 어느 파티션의 boundary value 인지를 적습니다.
- **TestCase**: Coverage Item 마다 1개입니다. `inputs` 에 그 값을 넣고 나머지 파라미터는 유효 대표값으로 채웁니다. `expected` 는 명세가 그 구간에 지정한 결과이고, 명세가 거절을 지정한 무효 파티션이면 그 `errorType` 의 `throws` 입니다. `rationale` 에는 명세가 지정한 경계이고 반대편의 가장 가까운 값이라는 사실을 적습니다.
- **assumptions**: `δ` 를 명세 대신 타입의 최소 간격에서 가져왔으면 그 사실을 적습니다.

## 하지 않는 것

### `T` 를 명세 밖에서 가져오지 않습니다

**이 기법에서 가장 중요한 규칙입니다.**

`T` 는 명세가 말한 값입니다. payload 어딘가에 다른 값이 보여도 그건 `T` 가 아닙니다. 구현의 임계값이 `T` 와 다를 수 있고, **그 불일치를 드러내는 게 이 테스트의 존재 이유입니다.**

```
명세의 임계값   T
구현의 임계값   T'        너는 이걸 모른다. 알아도 쓰지 않는다.

경계를 T' 로 잡으면  →  T'-δ, T' 를 테스트한다. 전부 통과한다. 아무것도 못 찾는다.
경계를 T  로 잡으면  →  T-δ, T 를 테스트한다. 불일치 구간에서 실패한다.
```

`P3 = ?` 처럼 마스킹된 default value 를 보면 그건 leak 흔적입니다. 값을 추측하지 말고 `leakSuspects` 에 적습니다.

### 명세가 임계값을 안 줄 때 경계를 발명하지 않습니다

명세가 부류만 서술하고 `T` 를 주지 않으면 도메인 상식으로 그럴듯한 값을 채우지 않습니다. 그렇게 만든 케이스는 아무것도 검증하지 않습니다.

`ambiguities` 에 `Ambiguity` 항목을 올립니다. `question` 에는 임계값이 명세에 없다는 사실을, `blockedCoverageItems` 에는 그것 때문에 케이스를 만들지 못한 커버리지 항목 id 를 적습니다. 커버리지 항목 자체는 `conditions` 에 남겨둡니다.

### 그 밖에

- 순서가 없는 열거형에는 쓰지 않습니다.
- 포함 여부가 분명하지 않은 관계를 추정하지 않습니다.

<example>
명세 문장이 "P1 이 `T` 이상이면 결과 X" 형태이고 2-value 일 때.

```
Test Condition TC-01
  statement    P1 의 임계값 경계에서의 결과 판정
  basisRefs    해당 명세 항목 id

Coverage Item CI-01
  technique    boundary-value-analysis
  description  P1 = <T 바로 아래 값>, X 가 아닌 파티션의 boundary value

Coverage Item CI-02
  technique    boundary-value-analysis
  description  P1 = <T>, X 파티션의 boundary value

Test Case (Coverage Item 마다 1개)
  inputs       P1 에 위 값, 나머지 파라미터는 유효 대표값
  expected     명세가 각 구간에 지정한 결과
  rationale    명세가 지정한 경계이고 반대편의 가장 가까운 값이라는 사실
```

`<T>` 자리에는 **명세에서 읽어낸 실제 값**이 들어갑니다. `T` 는 이 문서의 기호일 뿐 산출물에 쓰는 표기가 아닙니다. 3-value 면 `<T 아래로 두 칸>` 과 `<T 위로 한 칸>` 이 Coverage Item 으로 더해집니다.
</example>

## 다른 기법과의 관계

- **equivalence-partitioning** ([beaker:bb-equivalence-partitioning](../bb-equivalence-partitioning/SKILL.md)): BVA 는 EP 가 만든 파티션 위에서 돕니다. 순서 있는 파티션은 boundary value 를 하나 이상 가지므로, 2-value 100% 는 그 파티션들의 EP 100% 를 포함합니다. 순서 없는 파티션은 포함하지 않습니다.
- **2-value 와 3-value**: 3-value 의 Coverage Item 집합이 2-value 를 포함합니다.
- **mutation-testing** ([beaker:wb-mutation-testing](../wb-mutation-testing/SKILL.md)): 관계 연산자를 서로 바꾸는 변이(`<`, `<=`, `==`, `!=`, `>=`, `>`)가 BVA 가 겨냥하는 결함과 같습니다. 관계식 하나에서 2-value 는 등호 변이 두 개를 놓치고 3-value 는 잡습니다.
- **decision-coverage, condition-coverage** ([beaker:wb-decision-coverage](../wb-decision-coverage/SKILL.md), [beaker:wb-condition-coverage](../wb-condition-coverage/SKILL.md)): 구조 기준은 분기가 참과 거짓을 한 번씩 내기만 하면 되므로 경계에서 먼 값으로도 충족됩니다. 서로 포함하지 않습니다.
- **classification-tree** ([beaker:bb-classification-tree](../bb-classification-tree/SKILL.md)): 트리의 순서 있는 class 에 이 절차를 그대로 적용합니다.
- **decision-table, cause-effect-graph** ([beaker:bb-decision-table](../bb-decision-table/SKILL.md), [beaker:bb-cause-effect-graph](../bb-cause-effect-graph/SKILL.md)): 조건 하나가 임계값 비교이면 rule 의 참 값과 거짓 값을 이 기법의 Coverage Item 에서 고르면 두 기법이 함께 덮입니다.

## beaker 통합

- **verdict**: technique. 이미 `Technique` enum 에 `boundary-value-analysis` 로 있습니다.
- **쓰는 곳**: blackbox-test-designer. 화이트박스 설계자는 이 기법 이름을 쓰지 않습니다. 구현의 임계값 `T'` 로 경계를 잡으면 「`T` 를 명세 밖에서 가져오지 않습니다」 규칙이 무너지기 때문입니다.
- **커버리지**: `${CLAUDE_PLUGIN_ROOT}/references/schemas.md` 의 coverage 식을 그대로 씁니다. 입력 거절로 `reach: unreached` 가 된 경계 케이스는 덮인 것으로 세지 않습니다. 명세가 거절을 지정한 무효 파티션의 boundary value 는 기대한 `errorType` 이 나오면 `reached` 입니다.
- **비용**: 맞닿은 자리 하나에 2-value 는 케이스 2개, 3-value 는 4개입니다. 도메인 양끝은 각각 1개, 2개입니다.
- **한계**
  - 여러 파라미터가 함께 정하는 경계(`P1 + P2 <= T`)는 다루지 않습니다. domain analysis 의 ON, OFF, IN, OUT point 영역이고 beaker 에 없습니다. 그런 조건은 EP 나 decision-table 로 두고, 경계 값을 고를 근거가 명세에 없으면 `Ambiguity` 입니다.
  - 명세에 없는 구현의 추가 경계(파티션 한가운데의 `T''`)는 찾지 못합니다. 화이트박스의 `unexplained-implementation-behavior` 몫입니다.
  - 명세의 `T` 가 틀렸으면 기대값도 같이 틀립니다. `authored` 항목에는 metamorphic-relation 을 함께 붙입니다.

## 출처

- ISO/IEC/IEEE 29119-4:2021, 3.3 boundary value analysis 정의, 5.2.3 Boundary value analysis, 6.2.3 Boundary value analysis coverage. 목차와 정의는 [VDE 미리보기](https://assets.vde-verlag.de/iec-normen/preview-pdf/info_isoiecieee29119-4%7Bed2.0%7Den.pdf)에서 확인했고, 5.2.3 과 6.2.3 본문은 확인하지 못했습니다.
- Hamburg, Roman, [Boundary Value Analysis According to the ISTQB Foundation Level Syllabus](https://istqb.org/wp-content/uploads/2025/10/Boundary-Value-Analysis-white-paper.pdf), ISTQB 백서. CTFL v4.0 의 2-value, 3-value 정의 원문 인용, 맞닿은 자리당 Coverage Item 수, 관계 연산자 결함 표, 경계 양쪽 결과가 같은 경우, ON/OFF point 와의 관계.
- ISTQB Certified Tester Foundation Level Syllabus v4.0, Boundary Value Analysis 절(위 백서가 원문을 인용).
