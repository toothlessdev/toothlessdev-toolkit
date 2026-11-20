---
name: bb-classification-tree
description: 명세가 입력을 파라미터, 사전 상태, 환경 설정 같은 여러 측면으로 나누고 측면마다 부류가 갈릴 때, 측면을 classification 트리로 그려 빠진 측면과 불가능한 조합을 드러내는 기법입니다. 기본 조합 규칙 minimal 에서는 leaf class 하나가 Coverage Item 하나입니다. blackbox-test-designer 만 부르며 technique 값은 classification-tree 입니다.
---

# Classification Tree Method

blackbox-test-designer 가 입력의 측면이 많을 때 부르는 specification-based 기법입니다. `technique` 값은 `classification-tree` 이고, 조합 규칙이 `pairwise` 면 Coverage Item 의 `technique` 은 `combinatorial-t-way` 입니다.

## 언제 쓰나

명세가 입력을 여러 측면으로 나누고, 측면마다 부류가 갈릴 때 씁니다. 측면은 파라미터만이 아닙니다. 사전 상태, 환경 설정, 결과의 종류처럼 명세가 결과를 가르는 근거로 말한 것이면 전부 측면입니다.

[beaker:bb-equivalence-partitioning](../bb-equivalence-partitioning/SKILL.md) 은 파라미터 하나씩 파티션을 나눕니다. 측면이 셋 이상이거나, 어떤 측면이 다른 측면의 특정 값에서만 의미가 있으면(하위 측면) 파라미터별 목록으로는 빠진 측면과 불가능한 조합이 보이지 않습니다. 이 기법은 측면을 트리로 그려서 그 둘을 드러냅니다.

## 절차

### 용어

- **classification**: 명세가 결과를 가르는 근거로 쓴 측면 하나입니다.
- **class**: classification 의 값 부류입니다. 같은 classification 의 class 끼리는 겹치지 않고, 합치면 그 측면의 도메인 전체가 됩니다.
- **refinement**: class 하나 아래에 다시 classification 을 다는 것입니다. 하위 classification 은 부모 class 가 선택된 케이스에서만 값을 갖습니다.
- **leaf class**: 아래에 refinement 가 없는 class 입니다. 케이스가 실제로 고르는 단위입니다.

### 트리 만들고 조합하기

1. 명세에서 classification 을 뽑습니다. 명세가 결과를 가르는 근거로 말하지 않은 측면은 넣지 않습니다. classification 마다 근거 REQ 를 남깁니다.
2. 각 classification 의 class 는 equivalence-partitioning 규칙으로 나눕니다. 유효 class 와 무효 class 를 둘 다 둡니다.
3. 명세가 「X 일 때만」, 「X 인 경우에」라고 말한 측면은 그 class 아래 refinement 로 답니다. 최상위에 두지 않습니다.
4. 케이스 하나는 **최상위 classification 마다 leaf class 를 정확히 하나** 고릅니다. 고른 class 아래 refinement 가 있으면 그 하위 classification 에서도 하나 고릅니다.
5. 조합 규칙을 하나 고르고, 그 규칙이 정하는 단위를 Coverage Item 으로 씁니다. 고른 `combinationRule` 과 아래 `constraints` 는 스키마 필드가 아니라 Test Condition 의 `statement` 와 Coverage Item 의 `rationale` 에 문장으로 적습니다.

| combinationRule | Coverage Item | 케이스 수 하한 | 고르는 때 |
|---|---|---|---|
| `minimal` | 각 leaf class | 최상위 classification 중 leaf class 가 가장 많은 것의 leaf 수 | 기본값. 명세가 측면 간 상호작용을 말하지 않을 때 |
| `pairwise` | 서로 다른 최상위 classification 의 leaf class 쌍 | 가장 큰 두 classification 의 leaf 수의 곱 | 명세가 두 측면의 조합에 따라 결과가 바뀐다고 말할 때 |
| `full` | leaf class 의 모든 유효 조합 | 각 최상위 classification 의 leaf 수의 곱 | 측면이 적고 명세가 조합마다 결과를 지정할 때 |

`pairwise` 를 고르면 Coverage Item 의 `technique` 은 `combinatorial-t-way` 로 쓰고 t = 2 로 적으며, [beaker:bb-pairwise](../bb-pairwise/SKILL.md) 의 손 구성 규칙을 따릅니다. 이 기법은 그 앞의 측면 분류까지 맡습니다. `full` 이 필요하고 classification 이 전부 불리언이면 decision-table 이 더 맞습니다.

### 무효 class 넣기

equivalence-partitioning 과 같은 규칙입니다. 무효 class 는 한 케이스에 하나씩 넣고, 무효 class 를 고른 케이스에서 나머지 classification 은 유효 leaf class 를 고릅니다. 무효 class 둘을 한 케이스에 넣으면 어느 쪽이 거절됐는지 가를 수 없습니다.

### 불가능한 조합 다루기

hierarchy 로 표현되지 않는 제약(서로 다른 가지의 class 가 같이 나올 수 없음)은 명세가 말한 것만 `constraints` 에 적고, 그 조합을 고르지 않습니다. 판단이 서지 않으면 `ambiguities` 에 올립니다. 측면 간 제약이 복잡하면 [beaker:bb-cause-effect-graph](../bb-cause-effect-graph/SKILL.md) 로 제약을 정리한 뒤 `constraints` 로 옮깁니다.

### 분할 누락은 ambiguity 로 올리기

명세가 어떤 측면을 결과의 근거로 말하는데 그 측면의 부류를 정하지 않았으면, `ambiguities` 에 올립니다. 그 classification 의 Coverage Item 은 지우지 않고 `blockedCoverageItems` 에 적습니다.

## 만드는 것

- **CoverageItem**: `minimal` 은 leaf class 하나, `pairwise` 는 class 쌍 하나(`technique: combinatorial-t-way`, t = 2), `full` 은 유효 조합 하나입니다. `minimal` 과 `full` 의 `technique` 은 `classification-tree` 입니다. `description` 에는 루트부터 leaf 까지의 classification 과 class 경로를 명세의 실제 이름으로 씁니다.
- **TestCase**: 케이스 하나가 여러 CI 를 덮습니다. `coverageItemRefs` 에 고른 leaf class 의 CI 를 전부 겁니다. 커버리지 식은 바꾸지 않아도 됩니다.
- **무효 class 케이스**: 나머지 classification 은 유효 대표값으로만 채우고, 그 대표값의 CI 는 `coverageItemRefs` 에 걸지 않습니다.
- **같은 조건의 EP 항목**: 이 기법을 쓴 Test Condition 에는 equivalence-partitioning Coverage Item 을 따로 만들지 않습니다. 같은 부류를 두 번 세게 됩니다.

## 하지 않는 것

- **명세에 없는 측면을 넣거나, 명세가 말한 측면을 빼지 않습니다.** 측면을 고르는 알고리즘이 없어서, 설계자가 이렇게 하면 트리 전체가 흔들립니다.
- **명세가 말하지 않은 제약을 「현실적으로 안 나올 것」이라는 이유로 만들지 않습니다.**
- **명세가 부류를 정하지 않은 측면의 class 를 발명하지 않습니다.**
- **하위 측면을 최상위에 두지 않습니다.** 불가능한 조합이 생깁니다.
- **무효 class 둘을 한 케이스에 넣지 않습니다.**

<example>
명세가 측면 `P1`(파라미터)과 `S1`(사전 상태)로 결과를 가르고, `P1 = V2` 일 때만 측면 `P2` 가 의미가 있다고 말할 때.

```
classification P1
  class V1
  class V2
    classification P2
      class V3
      class V4
  class V5            무효
classification S1
  class C1
  class C2

combinationRule  minimal
leaf class       V1, V2/V3, V2/V4, V5, C1, C2

Test Condition  <P1 과 S1 에 따른 결과 판정>
  CI  P1 = V1          CI  P1 = V2, P2 = V3     CI  P1 = V2, P2 = V4
  CI  P1 = V5 (무효)   CI  S1 = C1              CI  S1 = C2

Test Case
  { P1: V1,          S1: C1 }      CI: V1, C1
  { P1: V2, P2: V3,  S1: C2 }      CI: V2/V3, C2
  { P1: V2, P2: V4,  S1: C1 }      CI: V2/V4, C1
  { P1: V5,          S1: C1 }      CI: V5      S1 은 유효 대표값으로만 채우고 C1 의 CI 로 세지 않음
```

`P2` 는 `P1 = V2` 가 아닌 케이스에서 값을 갖지 않습니다. 최상위에 뒀다면 `{ P1: V1, P2: V3 }` 같은 불가능한 조합이 생깁니다.
</example>

## 다른 기법과의 관계

- **equivalence-partitioning** ([beaker:bb-equivalence-partitioning](../bb-equivalence-partitioning/SKILL.md)): class 를 나누는 규칙이 equivalence-partitioning 그대로입니다. 같은 class 집합 위에서 `minimal` 은 모든 파티션을 한 번씩 덮으므로 equivalence-partitioning 커버리지를 포함합니다. 같은 Test Condition 에 둘을 같이 붙이면 같은 부류를 두 번 세므로, 이 기법을 쓴 조건에는 equivalence-partitioning Coverage Item 을 따로 만들지 않습니다.
- **boundary-value-analysis** ([beaker:bb-boundary-value-analysis](../bb-boundary-value-analysis/SKILL.md)): 순서 있는 classification 의 class 경계는 boundary-value-analysis 로 더합니다. 이 기법은 경계값을 고르지 않습니다.
- **pairwise** ([beaker:bb-pairwise](../bb-pairwise/SKILL.md)), **combinatorial-t-way** ([beaker:bb-combinatorial-t-way](../bb-combinatorial-t-way/SKILL.md)): 조합 규칙 자리에 들어가는 기법입니다. 같은 class 집합 위에서 `pairwise` 는 `minimal` 을 포함하고, `full` 은 모든 t-way 를 포함합니다.
- **decision-table** ([beaker:bb-decision-table](../bb-decision-table/SKILL.md)), **cause-effect-graph** ([beaker:bb-cause-effect-graph](../bb-cause-effect-graph/SKILL.md)): classification 이 전부 불리언이고 `full` 이면 rule 과 조합이 같아집니다. 측면 간 제약이 복잡하면 cause-effect-graph 로 제약을 정리한 뒤 이 기법의 `constraints` 로 옮깁니다.

## beaker 통합

- **verdict**: technique. `Technique` 값은 `classification-tree` 입니다.
- **쓰는 설계자**: blackbox-test-designer 만 씁니다. classification 의 근거가 명세여야 하므로 whitebox-test-designer 는 쓰지 않습니다. 구현의 분기에서 측면을 뽑으면 branch-condition 과 같은 것을 다른 이름으로 세게 됩니다.
- **비용**: `minimal` 은 가장 큰 classification 의 leaf 수만큼이라 싸고, `full` 은 곱으로 커집니다. 도구 없는 설계자가 `pairwise` 배열을 손으로 짜면 쌍이 빠지기 쉬워, `pairwise` 는 리포트가 쌍 커버리지를 다시 세야 합니다.
- **한계**: 측면을 고르는 알고리즘이 없습니다. 설계자가 명세에 없는 측면을 넣거나 빼면 트리 전체가 흔들리므로, 측면은 명세 문장에서만 뽑고 근거 REQ 를 classification 마다 남깁니다. `minimal` 은 측면 간 상호작용 결함을 잡지 못합니다.

## 출처

- [ISO/IEC/IEEE 29119-4:2021 sample](https://cdn.standards.iteh.ai/samples/79430/6c93dfe4a05b46a8895e04dfd74ddd24/ISO-IEC-IEEE-29119-4-2021.pdf): 용어 3.10 classification tree, 3.11 classification tree method 정의. 기법 본문 5.2.2 와 커버리지 6.2.2 는 목차만 확인했습니다.
- [Classification Tree Method, Wikipedia](https://en.wikipedia.org/wiki/Classification_Tree_Method): classification 과 class, 케이스당 classification 마다 class 하나, minimal(가장 큰 classification 의 class 수)과 maximal(곱) 조합, CTE XL 의 dependency rule.
- Grochtmann, M. and Grimm, K., "Classification Trees for Partition Testing", Software Testing, Verification and Reliability, 3(2), 1993.
- Ostrand, T. J. and Balcer, M. J., "The Category-Partition Method for Specifying and Generating Functional Tests", Communications of the ACM, 1988.
- Ammann, P. and Offutt, J., Introduction to Software Testing, 2nd ed., Chapter 6 Input Space Partitioning (Each Choice, Pair-Wise, All Combinations, Base Choice 기준).
