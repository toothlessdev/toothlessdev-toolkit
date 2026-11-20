# Equivalence Partitioning

**분류** specification-based · **Coverage Item** 각 파티션(파라미터마다, 유효와 무효 모두) · **쓰는 곳** blackbox-test-designer

## 언제

명세가 입력이나 결과를 부류로 나누고, 같은 부류 안의 값은 같은 방식으로 처리된다고 말할 때. 거의 모든 블랙박스 설계의 출발점이고, 순서 있는 도메인이면 `boundary-value-analysis` 가 이 파티션의 경계를 이어받습니다.

## 규칙

1. **파라미터마다 파티션 묶음을 하나씩 만듭니다.** 명세가 다르게 처리한다고 말하는 지점에서만 도메인을 나눕니다.
2. **파티션은 서로 겹치지 않고, 비어 있지 않고, 합치면 그 파라미터의 표현 가능한 값 전체가 됩니다.** 명세가 같은 값에 두 결과를 주거나(겹침) 어떤 값의 처리를 말하지 않으면(빈틈) 파티션을 지어내지 말고 `ambiguities` 에 올립니다.
3. **유효 파티션과 무효 파티션을 둘 다 만듭니다.** 유효는 명세가 정상 결과를 지정한 부류, 무효는 명세가 거부(오류, 무시)를 지정한 부류입니다.
4. **결과의 부류도 파티션입니다.** 명세가 결과를 여러 종류로 나누면 결과 종류마다 Coverage Item 을 두고, 그 결과를 내는 입력을 명세에서 거꾸로 찾습니다. 입력 파티션만으로는 한 번도 안 나오는 결과 종류가 여기서 드러납니다.
5. **파티션 하나가 Coverage Item 하나이고, 대표값은 파티션마다 1개입니다.** 같은 파티션에서 값을 더 고르는 건 이 기법의 일이 아닙니다.

```
P1 의 도메인을 명세가 임계값 T 로 가르고, 범위 밖은 거부한다고 말하면

  partition: P1 <  T               valid
  partition: P1 >= T               valid
  partition: P1 가 도메인 밖        invalid

P2 = one of { V1, V2 } 이고 명세가 그 밖의 값을 거부한다고 말하면

  partition: P2 = V1               valid
  partition: P2 = V2               valid
  partition: P2 ∉ { V1, V2 }       invalid
```

## 파티션의 근거는 명세에서만

명세가 어떤 값을 특별 취급하지 않는데 「그 값은 따로 봐야 할 것 같다」는 느낌으로 파티션을 쪼개지 않습니다. 그건 발명입니다. 근거가 없으면 `ambiguities` 에 올리고, `question` 에는 명세가 그 값의 취급을 지정하지 않는다는 사실을 적습니다.

## 무효 파티션은 기대값이 명세에 있을 때만 케이스가 됩니다

무효 파티션 케이스의 `expected` 는 대개 `kind: "throws"` 입니다. 그 오류 종류도 명세에서 나와야 합니다. 명세가 「거부한다」고만 하고 어떻게 거부하는지 말하지 않으면 Coverage Item 은 `conditions` 에 남기고, `ambiguities` 에 올리고, `blockedCoverageItems` 에 그 id 를 적습니다.

`<public-types>` 가 그 값을 아예 표현할 수 없게 막는다면(닫힌 열거 타입, non-null 타입) 무효 파티션은 public interface 로 만들 수 없습니다. Coverage Item 을 만들지 않고, 타입이 막는다는 사실을 `assumptions` 에 적습니다.

## 여러 파라미터를 한 케이스에 넣는 법

커버리지 기준은 Each Choice 입니다. 각 파라미터의 각 파티션이 어떤 케이스에서든 한 번 이상 나오면 100% 입니다. 파티션끼리의 조합은 세지 않습니다.

케이스는 아래 순서로 만듭니다.

1. 파라미터마다 유효 파티션 하나를 기준값으로 정해 기준 케이스 하나를 만듭니다.
2. 나머지 파티션은 **한 케이스에 하나씩** 바꿔 넣고, 다른 파라미터는 기준값 그대로 둡니다.
3. 무효 파티션 두 개를 한 케이스에 넣지 않습니다. 한쪽의 거부가 다른 쪽의 검사를 가려서 어느 쪽이 걸렸는지 알 수 없습니다.

```
틀림  { P1: <무효>, P2: <무효> }
맞음  { P1: <무효>, P2: <기준값> }
맞음  { P1: <기준값>, P2: <무효> }
```

유효 파티션 여러 개를 한 케이스에 몰아 케이스 수를 줄이는 방법은 쓰지 않습니다. 그 케이스가 실패해도 `counted(case)` 는 걸린 Coverage Item 을 전부 덮은 것으로 세는데, 어느 파티션 때문에 실패했는지는 남지 않습니다.

<example>
명세가 `P1` 을 임계값 `T` 로 가르고 도메인 밖을 거부하며, `P2` 가 `V1`, `V2` 두 값만 받고, 결과 종류가 `S1`, `S2` 둘일 때.

```
TC-01  P1 구간별 결과 판정
  CI-01  P1 < T            valid
  CI-02  P1 >= T           valid
  CI-03  P1 가 도메인 밖    invalid

TC-02  P2 값별 결과 판정
  CI-04  P2 = V1           valid
  CI-05  P2 = V2           valid
  CI-06  P2 ∉ { V1, V2 }   invalid   타입이 막으면 만들지 않음

TC-03  결과 종류
  CI-07  결과가 S1
  CI-08  결과가 S2

기준 케이스  { P1: CI-01 대표값, P2: V1 }   CI-01, CI-04 를 덮고, 명세상 결과가 S1 이면 CI-07 도 덮음
나머지      CI-02, CI-03, CI-05, CI-06 을 한 케이스에 하나씩
CI-08       명세에서 S2 를 내는 입력을 찾아 케이스를 만들고, 못 찾으면 ambiguities
```

`description` 에는 `T`, `V1` 이 아니라 명세에서 읽어낸 실제 값과 valid 또는 invalid 를 씁니다.
</example>

## 다른 기법과의 관계

- **조합 기준의 아래쪽 끝입니다.** Jorgensen 의 분류로 beaker 의 EP 는 weak robust(각 부류를 한 번씩, 무효 부류 포함)입니다. strong(모든 부류의 Cartesian product)은 이 기법으로 만들지 않습니다.
- **포함되는 쪽**: `pairwise` (bb-pairwise.md), `combinatorial-t-way` (bb-combinatorial-t-way.md). 파티션 조합을 세는 기준은 Each Choice 를 포함하고, 같은 파티션을 입력으로 씁니다.
- **포함되는 쪽(순서 있는 파라미터에 한해)**: `boundary-value-analysis` (bb-boundary-value-analysis.md). 경계 양쪽 값이 각 파티션 안에 있으므로 BVA 케이스는 그 파라미터의 파티션을 전부 덮습니다. 순서 없는 파라미터에는 성립하지 않습니다.
- **넓히는 쪽**: `classification-tree` (bb-classification-tree.md). 파라미터 하나가 아니라 입력의 여러 측면을 분류하고 그 class 를 파티션으로 씁니다.
- **겹침**: `decision-table` (bb-decision-table.md), `cause-effect-graph` (bb-cause-effect-graph.md). 결과가 여러 파라미터 파티션의 조합으로 정해지면 EP 는 그 조합을 세지 않으므로 이 둘을 붙입니다. `syntax-based` (bb-syntax-based.md) 의 유효, 무효 입력도 문법이 정한 부류라 무효 파티션과 겹칩니다.
- **명세 논리식**: 명세 조건식 하나의 참, 거짓 두 부류는 `decision-coverage` (wb-decision-coverage.md) 를 명세 쪽에 적용한 것과 같습니다.
- **보완**: `metamorphic-relation` (bb-metamorphic-relation.md). 명세 문장이 틀리면 파티션 기대값도 같이 틀리므로 `authored` 항목에서 나온 파티션에는 결과 불변식을 붙입니다.

## beaker 통합

- **verdict**: `technique`. `Technique` enum 의 `equivalence-partitioning` 을 그대로 씁니다.
- **쓰는 곳**: blackbox-test-designer. 화이트박스 설계자는 쓰지 않습니다. 구현 분기로 나눈 부류는 파티션이 아니라 `branch-condition` 항목입니다.
- **Coverage Item 단위**: 파라미터별 파티션 하나, 결과 종류 하나. 커버리지는 schemas.md 의 `coverage(specification)` 식으로 세고, 분모에 무효 파티션과 막힌 항목이 들어갑니다. Each Choice 이므로 조합은 분모에 없습니다.
- **스키마 변경**: 없습니다. 유효, 무효 구분은 `description` 에 적습니다.
- **비용**: 케이스 수는 기준 케이스 1개 + (전체 파티션 수 - 파라미터 수)에 결과 종류용 케이스를 더한 정도이고, 파라미터 수에 선형입니다.
- **한계**: 명세가 말하지 않은 하위 부류를 구현이 따로 처리하면 EP 는 그 차이를 못 봅니다. beaker 에서는 화이트박스 쪽 `branch-condition` 이 그 분기를 Coverage Item 으로 세고, 명세 근거가 없는 `business-rule` predicate 면 incident 후보로 올립니다. 블랙박스 설계자가 그 하위 부류를 짐작해 파티션을 쪼개는 건 발명입니다.

## 출처

- ISTQB, 「Certified Tester Foundation Level Syllabus」 v4.0.1, 4.2.1 Equivalence Partitioning (파티션은 겹치지 않고 비어 있지 않음, 출력과 설정값도 대상, 유효와 무효의 해석, 커버리지 식, Each Choice): https://www.istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf
- ISO/IEC/IEEE 29119-4:2021, 3.28 equivalence partition 정의(입력 또는 출력의 부류), 5.2.1 Equivalence partitioning, 6.2.1 Equivalence partition coverage. 정의와 목차는 미리보기에서 확인했고 본문은 확인하지 못함: https://cdn.standards.iteh.ai/samples/79430/6c93dfe4a05b46a8895e04dfd74ddd24/ISO-IEC-IEEE-29119-4-2021.pdf
- Myers, 「The Art of Software Testing」 4장 (유효 부류는 묶고, 무효 부류는 가림 때문에 케이스 하나에 하나씩): https://www.cs.purdue.edu/homes/bxd/307/MyersChap04.html
- Ammann & Offutt, 「Introduction to Software Testing」 2판, 6장 Input Space Partitioning (completeness, disjointness, Each Choice, Base Choice, Pair-Wise, All Combinations). 강의 자료: https://www.cs.cornell.edu/courses/cs5154/2021fa/resources/ISP-Criteria.pdf
- Jorgensen, 「Software Testing: A Craftsman's Approach」, Equivalence Class Testing 장 (weak/strong, normal/robust). 강의 자료: https://cse.sc.edu/~matthews/Courses/747/Lectures/747Lec03-EquivClassTesting.pdf
