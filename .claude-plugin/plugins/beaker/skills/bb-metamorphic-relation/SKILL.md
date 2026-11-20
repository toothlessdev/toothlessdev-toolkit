---
name: bb-metamorphic-relation
description: 명세 문장의 값 대신 「입력을 이렇게 바꾸면 결과가 이렇게 바뀌어야 한다」는 관계를 두 실행 이상의 결과끼리 비교해 단언하는 기법입니다. 입력이 항목 집합이거나, 같은 값의 다른 표기가 있거나, 명세 항목 등급이 authored 이거나, 결과값을 미리 알 수 없을 때 다른 기법에 더해 씁니다. blackbox-test-designer 만 technique 값 metamorphic-relation 으로 씁니다.
---

# Metamorphic Relation (결과 불변식)

blackbox-test-designer 가 다른 기법에 더해 부르고, `technique` 값은 `metamorphic-relation` 입니다. 특히 `authored` 등급 항목에서 나온 Test Condition 에는 결과 불변식을 최소 하나 붙입니다.

- **분류**: specification-based
- **Coverage Item**: 각 relation 과 그 relation 을 적용할 입력 묶음(metamorphic group)

## 언제 쓰나

다른 기법은 명세 문장이 지정한 값을 기대값으로 씁니다. 그래서 **명세 문장이 틀리면 기대값도 같이 틀립니다.** 같은 변경에서 저자가 쓴 명세(`authored`)가 대표적입니다. 명세가 결과값을 정해 주지 않는 대상(랭킹, 추정치, 수치 계산처럼 정답을 미리 알 수 없는 결과)도 같은 처지입니다.

결과 불변식은 기대값을 명세 문장에서 가져오지 않습니다. **입력을 이렇게 바꾸면 결과가 이렇게 바뀌어야 한다**는 관계만 단언하고, 두 실행의 결과끼리 비교합니다. 명세 문장의 값이 틀려도 관계는 살아남습니다.

용어는 원 논문을 따릅니다.

- **source input**: 먼저 정한 입력
- **follow-up input**: relation 으로 source input 에서 만든 입력
- **metamorphic group**: 둘을 묶은 것

아래 형태가 있으면 다른 기법과 **함께** 씁니다. 대체하지 않습니다.

| 입력이나 결과의 형태 | 쓸 수 있는 relation |
|---|---|
| 입력이 항목의 집합이고 결과가 항목별 기여를 모은 것 | `decomposition`, `removal`, `irrelevant-addition` |
| 입력 값에 같은 뜻의 다른 표기가 있음 | `equivalent-representation` |
| 같은 입력을 두 번 넣어도 결과가 같아야 함 | `idempotence` |
| 입력 순서가 결과에 영향을 주면 안 됨 | `permutation` |

### 어디서 신호가 나는가

- 항목 하나를 빼도 그 항목이 쓴 값이 남는 결함 → `removal`
- 같은 값의 다른 표기가 다른 결과를 내는 결함 → `equivalent-representation`
- 관계없는 항목이 끼면 다른 항목의 결과가 바뀌는 결함 → `irrelevant-addition`

이 셋은 명세 문장이 결함과 같은 방향으로 틀려 있어도 잡힙니다.

## 절차

1. **relation 의 근거를 명세에서 찾습니다.** 「결과는 항목별 기여로 조립된다」, 「같은 값이면」, 「순서와 무관하게」 같은 명세의 성질에서 relation 을 고릅니다. 구현을 짐작해서 relation 을 만들지 않습니다.
2. **기대 절대값을 쓰지 않습니다.** 케이스의 `expected` 는 `kind: "relation"` 이고, `caseRefs` 에 비교할 실행들을 겁니다. 각 실행 케이스의 `expected` 도 같은 relation 을 가리킵니다.
3. **표기 목록은 명세에서 가져옵니다.** `equivalent-representation` 에 쓸 표기는 그 값의 수용 규칙을 정한 명세가 말한 것만 씁니다. 수용 규칙 명세가 없으면 표기를 발명하지 말고 `ambiguities` 에 올립니다.
4. **집합형 입력에는 `removal` 과 `irrelevant-addition` 을 최소 하나씩 둡니다.** 항목 하나가 다른 항목의 결과에 새는 결함은 단일 입력 케이스로는 드러나지 않습니다.
5. **`caseRefs` 의 첫 원소를 source input 으로 둡니다.** 나머지는 그 입력에서 relation 으로 만든 follow-up input 입니다. `removal` 과 `irrelevant-addition` 은 방향이 있어서 순서가 바뀌면 단언의 뜻이 뒤집힙니다.
6. **묶음의 모든 실행이 목표 동작에 닿게 합니다.** 두 실행이 같은 이유로 입력 거절을 당하면 「결과가 같다」는 relation 이 아무것도 실행하지 않고 성립합니다. source input 은 명세가 정상으로 받는 입력에서 고르고, 실행 하나라도 `reach: unreached` 면 그 Coverage Item 은 덮이지 않은 것으로 셉니다.
7. **입력 하나로 판정되는 성질은 relation 으로 쓰지 않습니다.** 실행 한 번의 결과만 보는 성질(「결과는 항상 정렬되어 있다」)은 relation 이 아닙니다. 실행이 둘 이상 필요한 성질만 이 기법의 Coverage Item 입니다.
8. **relation 은 필요조건으로만 읽습니다.** 통과해도 결과값이 맞다는 뜻이 아닙니다. relation 케이스만으로 덮인 Test Condition 은 `rationale` 에 「결과값 자체는 검증하지 않음」을 적습니다.
9. **같음이 아닌 relation 은 지금 쓰지 않습니다.** 명세가 「조건을 더하면 결과가 줄어든다」처럼 부분 집합이나 크기 비교를 말하면 아래 여섯 개에 억지로 맞추지 말고 `ambiguities` 에 올립니다.

## 만드는 것

- **TestCondition**: relation 을 뒷받침하는 명세 성질 하나(「결과는 항목별 기여의 합이다」). `basisRefs` 는 그 성질을 말한 `REQ-` 입니다. `predicate`, `predicateClass` 는 `null` 입니다.
- **CoverageItem**: `technique` 은 `metamorphic-relation`. relation 하나와 그것을 적용할 metamorphic group 하나마다 하나입니다. `description` 에 relation 이름과 묶음의 실제 항목을 명세의 값으로 씁니다.
- **TestCase**: group 안의 실행 하나마다 케이스 하나. `technique` 은 `metamorphic-relation` 이고, 같은 group 의 케이스는 모두 같은 Coverage Item 을 `coverageItemRefs` 에 겁니다.
- **Expected**: `kind: "relation"`.
  - `relation`: 아래 여섯 값 중 하나
  - `over`: 관계가 성립하는 파라미터
  - `caseRefs`: 비교할 케이스 2개 이상. 첫 원소가 source input

### relation 종류

`relation` 필드의 값은 아래 여섯 개 중 하나입니다.

| relation | 단언 | 실행 묶음 |
|---|---|---|
| `decomposition` | 전체 집합의 결과 = 항목마다 따로 실행한 결과를 명세의 합성 규칙으로 합친 것 | 전체 1회 + 항목별 n회 |
| `removal` | 항목 `P1` 을 뺀 집합의 결과에는 `P1` 이 기여한 부분이 남지 않음 | 전체 1회 + `P1` 제외 1회 |
| `irrelevant-addition` | `P1` 과 무관한 항목 `P2` 를 더해도 `P1` 에 대한 결과는 같음 | 기본 1회 + `P2` 추가 1회 |
| `equivalent-representation` | 같은 값의 다른 표기 `V1`, `V1'` 은 결과가 같음 | 표기마다 1회 |
| `idempotence` | 같은 입력을 두 번 적용한 결과 = 한 번 적용한 결과 | 1회 + 2회 |
| `permutation` | 입력 순서를 바꾼 결과 = 원래 결과 | 원래 순서 1회 + 바꾼 순서 1회 |

## 하지 않는 것

- 구현을 짐작해서 relation 을 만들지 않습니다.
- 기대 절대값을 단언하지 않습니다.
- 수용 규칙 명세가 말하지 않은 표기를 발명하지 않습니다.
- 입력 하나로 판정되는 성질을 relation 으로 쓰지 않습니다.
- 부분 집합이나 크기 비교 relation 을 여섯 값에 억지로 맞추지 않습니다.
- relation 통과를 결과값이 맞다는 근거로 쓰지 않습니다.

<example>
명세가 「결과는 입력 항목 각각이 기여한 필드를 합친 것이다」라고 말할 때:

```
TC-01  결과는 항목별 기여의 합이다                  REQ-01
  CI-01  decomposition over items = { P1, P2 }
  CI-02  removal of P1 from { P1, P2 }
  CI-03  irrelevant-addition of P3 to { P1 }
```

CI-02 의 케이스 두 개는 `{ P1, P2 }` 실행(source)과 `{ P2 }` 실행(follow-up)이고, 단언은 「두 번째 결과에 `P1` 이 기여한 필드가 없다」입니다. 필드의 값 자체는 단언하지 않습니다.
</example>

## 다른 기법과의 관계

포함 관계는 없습니다. relation 커버리지는 입력 공간이나 코드 구조를 세는 기준이 아니라서, 다른 기준을 포함하지도 않고 다른 기준에 포함되지도 않습니다. 대신 source input 을 다른 기법이 공급합니다.

- **[beaker:bb-equivalence-partitioning](../bb-equivalence-partitioning/SKILL.md), [beaker:bb-boundary-value-analysis](../bb-boundary-value-analysis/SKILL.md)**: source input 을 고르는 기법입니다. `equivalent-representation` 은 「같은 파티션의 두 표기는 결과가 같다」는 equivalence-partitioning 의 전제를 직접 단언합니다.
- **[beaker:bb-classification-tree](../bb-classification-tree/SKILL.md)**: 명세를 category 와 choice 로 나눈 test frame 에서 relation 을 찾는 방법(METRIC)이 있습니다. 측면이 많은 입력에서는 classification 을 먼저 만들고 relation 을 고릅니다.
- **[beaker:bb-property-based](../bb-property-based/SKILL.md)**: 실행 한 번으로 판정되는 성질은 property-based 몫이고(절차 7), 실행 둘 이상을 비교하는 성질은 이 기법 몫입니다. 생성기가 만든 입력을 source input 으로 쓰면 relation 하나를 여러 group 에 적용할 수 있습니다.
- **[beaker:bb-fuzzing](../bb-fuzzing/SKILL.md)**: fuzzing 의 기본 판정은 크래시이고, relation 을 판정으로 붙이면 크래시 없는 오답도 잡습니다.
- **[beaker:wb-mutation-testing](../wb-mutation-testing/SKILL.md)**: relation 묶음의 결함 검출력을 재는 기준입니다. relation 이 느슨해서 우연히 성립하는지를 mutant 로 확인합니다.
- **구조 기준([beaker:wb-node-coverage](../wb-node-coverage/SKILL.md), [beaker:wb-edge-coverage](../wb-edge-coverage/SKILL.md) 등)**: 원 논문은 구조 커버리지를 채운 케이스를 source input 으로 쓰라고 제안합니다. beaker 에서는 basis 가 달라 두 설계자가 케이스를 공유하지 않으므로 이 조합은 쓰지 않습니다.

## beaker 통합

- **verdict**: technique. `Technique` 에 `metamorphic-relation` 이 이미 있고 그대로 둡니다.
- **쓰는 설계자**: blackbox-test-designer 만 씁니다. relation 근거가 명세여야 `basis: specification` 실패가 incident 가 됩니다. 구현에서 뽑은 relation 은 구현이 가진 성질을 다시 확인할 뿐이라 whitebox-test-designer 는 쓰지 않습니다.
- **Coverage Item 단위**: relation 하나와 그것을 적용할 metamorphic group 하나입니다. 문헌의 relation 커버리지(relation 마다 group 최소 하나)보다 촘촘하게 group 마다 CI 를 둡니다. `description` 에는 relation 이름과 묶음의 실제 항목을 명세의 값으로 씁니다.
- **커버리지 집계**: relation CI 는 `caseRefs` 의 케이스가 전부 `counted` 일 때만 덮인 것으로 셉니다(절차 6). `metamorphic-relation` 은 `${CLAUDE_PLUGIN_ROOT}/references/schemas.md` 의 `GroupTechnique` 에 들어 있어, 「커버리지 계산」 식이 그 CI 에 걸린 케이스가 2개 이상이고 전부 `counted` 일 때만 덮인 것으로 셉니다.
- **스키마**:
  - source input 순서(절차 5)는 `RelationExpectation` 의 계약으로 스키마에 적혀 있습니다.
  - 결과 일부만 비교하는 relation 을 위한 `RelationExpectation` 의 선택 필드 `path` 는 제안이고, 아직 스키마에 없습니다.
  - 같음이 아닌 relation(문헌의 inclusive, exclusive 유형)은 enum 추가를 제안만 하고, 그 전까지는 절차 9 를 따릅니다.
- **비용**: CI 하나에 실행이 둘 이상입니다. `decomposition` 은 항목 수만큼 실행이 늘어납니다. 서로 다른 relation 몇 개로 오라클에 가까운 검출력이 나왔다는 실험 결과가 있어, 같은 relation 의 group 을 늘리기보다 relation 종류를 다양하게 고릅니다.
- **한계**: 통과가 정답을 보장하지 않습니다(절차 8). relation 을 찾는 일은 사람의 판단이고 자동 도출 방법은 확립되지 않았습니다. 명세가 relation 을 뒷받침하지 않으면 케이스를 만들지 못합니다. 러너가 relation 단언으로 번역하는지는 `${CLAUDE_PLUGIN_ROOT}/references/verification.md` 에 미확인으로 남아 있습니다.

## 출처

- [Segura, Fraser, Sanchez, Ruiz-Cortes, "A Survey on Metamorphic Testing", IEEE TSE 42(9), 2016, 저자 원고](https://eprints.whiterose.ac.uk/110335/1/segura16-tse.pdf): 2절 정의(relation 은 실행 사이의 관계, source/follow-up test case, 적용 절차와 precondition), 4.1절 좋은 relation 의 성질(다양성, 실행 차이), 4.2절 relation 조합과 METRIC, Murphy 등의 여섯 유형(additive, multiplicative, permutative, invertive, inclusive, exclusive), 6.5.1절 mutation score 로 평가, 7절 도전 과제.
- [Chen, Kuo, Liu, Poon, Towey, Tse, Zhou, "Metamorphic Testing: A Review of Challenges and Opportunities", ACM Computing Surveys 51(1), 2018](https://homes.cs.washington.edu/~rjust/courses/CSE503/2021_02_12-reading2.pdf): Definition 1~3(relation 은 필요조건, source input, follow-up input, metamorphic group), Concept 1(입력 하나로 판정되는 성질은 relation 이 아님), 4.1절(오라클 문제를 완전히 풀지 못함, 다양한 relation 3~6개로 높은 검출률), 5.2절(검증용 relation 은 명세에서 나옴), Opportunity 3(relation 커버리지와 구조 커버리지의 보완).
- [ISO/IEC/IEEE 29119-4:2021 sample](https://cdn.standards.iteh.ai/samples/79430/6c93dfe4a05b46a8895e04dfd74ddd24/ISO-IEC-IEEE-29119-4-2021.pdf): 용어 3.34 metamorphic relation, 3.35 metamorphic testing(specification-based 기법) 정의. 기법 본문 5.2.11 과 커버리지 6.2.11 은 목차만 확인했습니다.
- Chen, T. Y., Cheung, S. C., and Yiu, S. M., "Metamorphic Testing: A New Approach for Generating Next Test Cases", Technical Report HKUST-CS98-01, 1998.
