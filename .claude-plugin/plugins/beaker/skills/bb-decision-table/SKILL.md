---
name: bb-decision-table
description: 명세가 조건 여러 개의 조합으로 결과를 정할 때 조건과 결과로 decision table 을 만들고, 실제로 쓴 표의 feasible rule 하나를 Coverage Item 하나로 만드는 기법입니다. 조합을 펼치며 rule count 로 명세의 누락과 충돌을 찾아 ambiguities 로 올립니다. blackbox-test-designer 가 부르며 technique 값은 decision-table 입니다.
---

# Decision Table

blackbox-test-designer 가 명세의 조건 조합이 결과를 정할 때 부르는 specification-based 기법입니다. `technique` 값은 `decision-table` 입니다.

## 언제 쓰나

명세가 조건 여러 개의 **조합**으로 결과를 정할 때 씁니다. 조건을 하나씩 따로 테스트하면 조합 효과를 놓칩니다.

이 기법은 케이스를 만들기 전에 명세 자체를 검사합니다. 조합을 빠짐없이 펼치면 명세가 결과를 말하지 않은 조합(누락)과, 명세 문장 둘이 같은 조합에 다른 결과를 주는 곳(충돌)이 드러납니다. 둘 다 케이스가 아니라 `ambiguities` 로 갑니다.

조건 사이에 배타, 필수, 포함 같은 제약이 많으면 표를 만들기 전에 [beaker:bb-cause-effect-graph](../bb-cause-effect-graph/SKILL.md) 로 제약을 정리합니다.

## 절차

### 표 만들기

1. 명세에서 **조건(condition)** 과 **결과(action)** 를 뽑습니다. 행이 됩니다.
2. 조건이 참/거짓뿐이면 limited-entry 표, 조건이 여러 값(파티션, 이산값)을 가지면 extended-entry 표로 만듭니다. extended-entry 의 값은 [beaker:bb-equivalence-partitioning](../bb-equivalence-partitioning/SKILL.md) 으로 나눈 파티션을 씁니다.
3. 조건 조합마다 rule(열)을 만듭니다. limited-entry 이고 조건이 n 개면 최대 2^n, extended-entry 면 조건별 값 개수의 곱입니다.
4. **불가능한 조합(infeasible)은 명세 근거가 있을 때만 뺍니다.** 명세가 배타 관계를 말하거나, 같은 파라미터의 서로 다른 파티션이라 동시에 성립할 수 없을 때입니다. 후자처럼 명세 문장이 아니라 구조에서 끌어낸 배제는 `assumptions` 에 적습니다. 근거가 없으면 feasible 로 둡니다.
5. 남은 rule 하나를 Coverage Item 하나로 둡니다.

조건 `C1`, `C2` 와 결과 `A` 에 대해:

| rule | C1 | C2 | → A |
|---|---|---|---|
| R1 | T | T | `a1` |
| R2 | T | F | `a2` |
| R3 | F | T | `a3` |
| R4 | F | F | `a4` |

`a1`~`a4` 는 **명세가 각 조합에 지정한 결과**입니다. 명세를 보기 전에 미리 채워두지 않습니다.

### 압축하고 기록 남기기

같은 결과를 내는 rule 을 `-`(don't care)로 합치면 케이스 수가 줍니다. 합쳤으면 `rationale` 에 어느 rule 들을 합쳤는지 적습니다.

```
a1 = a2 = a3 이면   →   C1 ∨ C2 → a1
```

1. **합치기 전에 명세를 다시 읽습니다.** 결과가 같아 보여도 명세가 서로 다른 근거로 같은 결과를 지정한 것이면 별개 rule 로 둡니다.
2. 합친 rule 의 케이스는 `-` 조건에 값 하나를 골라 `inputs` 에 넣고, 고른 값을 `rationale` 에 적습니다. 압축한 표는 `-` 조건의 나머지 값을 실행하지 않습니다.

### 완전성 검사: rule count

압축한 표에서 rule 하나가 덮는 조합 수는, 그 rule 의 `-` 개수가 k 일 때 2^k 입니다(extended-entry 면 `-` 조건들의 값 개수의 곱). 표를 확정하기 전에 셉니다.

```
Σ rule 이 덮는 조합 수  +  뺀 infeasible 조합 수   =   전체 조합 수
```

- **왼쪽이 작으면 누락입니다.** 어느 rule 에도 들어가지 않은 조합이 있습니다.
- **왼쪽이 크면 겹침입니다.** 한 조합이 rule 둘 이상에 들어갑니다. 겹친 rule 들의 결과가 같으면 중복이라 하나로 정리하고, 다르면 **충돌**입니다.

### 누락과 충돌을 ambiguities 로 올리기

| 발견 | 하는 일 | `Ambiguity` |
|---|---|---|
| 누락: feasible 조합인데 명세가 결과를 말하지 않음 | rule 은 표에 남기고 케이스는 만들지 않습니다 | `question` 을 「rule 누락:」으로 시작하고 조합을 적습니다. `basisRefs` 는 그 조건들을 정의한 REQ 전부 |
| 충돌: 명세 문장 둘 이상이 같은 조합에 다른 결과를 줌 | 한쪽을 골라 기대값을 만들지 않습니다 | `question` 을 「rule 충돌:」로 시작하고 조합과 각 결과를 적습니다. `basisRefs` 는 충돌한 REQ 전부 |
| 배제 근거 불명: 불가능해 보이지만 명세가 말하지 않음 | rule 을 feasible 로 남깁니다 | 결과도 명세에 없으면 누락으로 올립니다 |

막힌 rule 의 CI id 는 `blockedCoverageItems` 에 적고 `conditions` 에서 지우지 않습니다. 지우면 분모가 줄어 커버리지가 100% 로 보입니다. 리포트 단계는 이 `Ambiguity` 를 `ambiguous-requirement` incident 로 올립니다.

### 결과가 여럿인 rule

`Expected` 하나는 경로 하나만 단언합니다. rule 이 결과 행 여러 개를 정하면 결과마다 케이스를 하나씩 만들고, 모두 같은 rule 의 CI 를 겁니다. 명세가 「이 결과는 일어나지 않는다」고 정했는데 그것을 관찰할 방법을 명세가 말하지 않으면, 값을 발명하지 않고 `ambiguities` 에 올립니다.

## 만드는 것

- **TestCondition**: 조건 조합이 결과를 정하는 명세 단위 하나입니다. `basisRefs` 는 그 조건들을 정의한 명세 항목 전부입니다.
- **CoverageItem**: `technique` 은 `decision-table` 입니다. 단위는 실제로 쓴 표(전체 또는 압축)의 feasible rule 하나입니다. 누락과 충돌로 막힌 rule 도 분모에 남습니다. `description` 의 조건 자리에는 명세 문장에서 읽어낸 조건을 적습니다.
- **TestCase**: rule 마다 하나, 결과 행이 여럿이면 결과마다 하나입니다. `inputs` 는 그 rule 의 조건을 참/거짓으로 만드는 파라미터 값이고, `expected` 는 그 rule 에 명세가 지정한 결과입니다. `rationale` 에는 어느 rule 인지와 왜 그 결과인지, 압축했으면 합친 rule 과 `-` 조건에 고른 값을 적습니다.
- **ambiguities**: 누락은 「rule 누락:」, 충돌은 「rule 충돌:」로 `question` 을 시작합니다.

## 하지 않는 것

- **명세를 보기 전에 결과 칸을 채우지 않습니다.**
- **근거 없이 조합을 infeasible 로 빼지 않습니다.**
- **결과가 명세에 없는 조합을 이웃 rule 에 합치지 않습니다.** 합치면 누락이 결과를 가진 rule 로 바뀌어 사라집니다.
- **충돌한 rule 에서 한쪽 결과를 골라 기대값을 만들지 않습니다.**
- **막힌 rule 의 Coverage Item 을 지우지 않습니다.**
- **「당연히 이렇게 되겠지」를 근거로 쓰지 않습니다.** 실무 결함의 상당수가 그 「당연히」에서 나옵니다.

<example>
명세가 조건 `C1`, `C2` 로 결과를 정하고, `¬C1 ∧ ¬C2` 의 결과는 말하지 않을 때.

```
Test Condition
  statement    <C1 과 C2>의 조합에 따른 결과 결정
  basisRefs    두 조건을 정의한 명세 항목 전부

Coverage Item  rule 하나당 하나
  R1   C1 ∧ C2      → 명세가 지정한 결과
  R2   C1 ∧ ¬C2     → 명세가 지정한 결과
  R3   ¬C1 ∧ C2     → 명세가 지정한 결과
  R4   ¬C1 ∧ ¬C2    → 명세에 없음

rule count   덮은 조합 3 + 배제 0  <  전체 4   → 누락 1

Test Case    R1, R2, R3 마다 하나
  inputs     그 rule 의 조건을 참/거짓으로 만드는 파라미터 값
  expected   그 rule 에 명세가 지정한 결과
  rationale  어느 rule 인지 + 왜 그 결과인지

ambiguities
  question              rule 누락: ¬C1 ∧ ¬C2 의 결과를 명세가 정하지 않음
  blockedCoverageItems  R4 의 CI
```

`description` 의 `C1`, `C2` 자리에는 **명세 문장에서 읽어낸 조건**을 적습니다.
</example>

## 다른 기법과의 관계

- **multiple-condition-coverage** ([beaker:wb-multiple-condition-coverage](../wb-multiple-condition-coverage/SKILL.md)): 압축하지 않은 limited-entry 표의 rule 전부를 덮는 것은, 명세의 조건식에 multiple-condition-coverage 를 적용한 것과 같은 모양입니다. basis 가 다르므로 서로를 대신하지 않습니다.
- **mcdc** ([beaker:wb-mcdc](../wb-mcdc/SKILL.md)): 조건이 많아 전체 표가 너무 크면 명세 논리식에 MC/DC 를 적용해 rule 을 최소 n+1 개로 골라낼 수 있습니다. 이때 Coverage Item 은 고른 rule 이고, rule count 검사는 고르기 전 전체 표로 합니다.
- **cause-effect-graph** ([beaker:bb-cause-effect-graph](../bb-cause-effect-graph/SKILL.md)): 원인-결과 그래프는 이 표를 만들어내는 앞 단계입니다. 조건 사이 제약(배타, 필수, 포함)이 많을 때 infeasible rule 을 근거 있게 거르는 데 씁니다. 결과물의 Coverage Item 은 이 기법의 rule 과 같습니다.
- **equivalence-partitioning** ([beaker:bb-equivalence-partitioning](../bb-equivalence-partitioning/SKILL.md)): extended-entry 표의 조건 값은 파티션입니다. 조합 없이 파티션 하나씩만 덮는 EP 는 이 기법보다 약합니다.
- **boundary-value-analysis** ([beaker:bb-boundary-value-analysis](../bb-boundary-value-analysis/SKILL.md)): rule 은 「조건이 참」만 말하고 경계 근처 값을 고르지 않습니다. 순서 있는 조건이면 BVA 를 함께 씁니다.
- **pairwise** ([beaker:bb-pairwise](../bb-pairwise/SKILL.md)), **combinatorial-t-way** ([beaker:bb-combinatorial-t-way](../bb-combinatorial-t-way/SKILL.md)): rule 이 너무 많아 다 실행할 수 없을 때 실행할 조합을 줄이는 대안입니다. 줄이더라도 누락과 충돌 검사는 전체 조합에 대해 합니다.
- **classification-tree** ([beaker:bb-classification-tree](../bb-classification-tree/SKILL.md)): 파라미터가 많은 입력을 나누는 데 쓰는, 모양이 비슷한 기법입니다. 조건과 결과의 대응을 표로 고정하는 쪽이 이 기법입니다.
- **state-transition** ([beaker:bb-state-transition](../bb-state-transition/SKILL.md)): 결과가 이전 이력에 따라 달라지면 조건 조합만으로는 결과가 정해지지 않습니다. state-transition 을 씁니다.
- **metamorphic-relation** ([beaker:bb-metamorphic-relation](../bb-metamorphic-relation/SKILL.md)): 조건이 나온 명세 항목이 `authored` 면 rule 의 기대값이 구현과 같은 방향으로 틀릴 수 있어서, 결과 불변식을 함께 붙입니다.

## beaker 통합

- **verdict**: technique. `Technique` enum 에 이미 `decision-table` 이 있습니다.
- **쓰는 설계자**: blackbox-test-designer. 화이트박스 설계자는 이 기법을 쓰지 않습니다. 구현 조건식의 조합은 [beaker:wb-condition-coverage](../wb-condition-coverage/SKILL.md), [beaker:wb-mcdc](../wb-mcdc/SKILL.md), [beaker:wb-multiple-condition-coverage](../wb-multiple-condition-coverage/SKILL.md) 가 맡습니다.
- **스키마**: 바꿀 것이 없습니다. 누락과 충돌은 기존 `Ambiguity` 와 `ambiguous-requirement` 로 표현하고, 둘의 구분은 `question` 의 머리말(「rule 누락:」, 「rule 충돌:」)로 합니다.
- **비용**: 조건 수에 지수로 늘어납니다. 압축, MC/DC 로 고르기, pairwise 로 줄이기 중 하나를 쓰되, rule count 검사는 줄이기 전 전체 조합으로 합니다.
- **한계**: 경계 값을 고르지 않고, 이력 의존 동작을 표현하지 못하며, 압축한 rule 은 `-` 조건의 값 하나만 실행합니다.

## 출처

- ISTQB, [Certified Tester Foundation Level Syllabus v4.0.1](https://istqb.org/certifications/certified-tester-foundation-level-ctfl-v4-0/), 4.2.3 Decision Table Testing. limited-entry 와 extended-entry, `-` 와 N/A 표기, infeasible 열 삭제와 열 병합, feasible 조합을 담은 열이 Coverage Item 이고 커버리지는 실행한 열 / feasible 열 전체라는 정의, 요구사항의 누락(gap)과 모순(contradiction)을 찾는 데 쓰인다는 점, 조건 수에 지수로 늘어난다는 점을 확인했습니다.
- ISO/IEC/IEEE 29119-4, Test techniques. Decision table testing 기법과 그 커버리지 정의(절 번호와 링크 미확인).
- Paul C. Jorgensen, 「Software Testing: A Craftsman's Approach」, Decision Table-Based Testing 장. rule count 로 완전성을 검사하는 방법과 중복(redundant) 표, 모순(inconsistent) 표의 구분(링크 미확인).
