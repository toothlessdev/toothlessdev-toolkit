# Cause-Effect Graph

**분류** specification-based · **Coverage Item** 그래프를 변환한 decision table 의 rule 하나 (decision-table 과 같은 단위) · **쓰는 곳** blackbox-test-designer 가 decision-table 의 rule 을 도출하는 절차로 사용. 별도 `technique` 값은 없습니다

## 언제

명세의 조건 조합이 결과를 정하는데, 조건 사이에 **제약**이 있을 때 씁니다. 「둘 중 하나만 줄 수 있다」, 「C1 이면 반드시 C2 도」처럼 조건끼리 묶인 문장이 있으면 2^n 조합 중 일부는 만들 수 없는 입력입니다. 그 조합을 근거 없이 빼거나, 반대로 만들 수 없는 조합에 케이스를 쓰려다 막히는 것을 이 절차가 막습니다.

조건이 서로 독립이고 제약이 없으면 decision-table 만으로 충분합니다.

## 규칙

1. 명세에서 **원인(cause)** 과 **결과(effect)** 를 뽑습니다. 원인은 참/거짓으로 판정되는 입력 조건이고, 결과는 명세가 지정한 출력이나 상태 변화입니다. 값이 여러 부류로 나뉘는 입력은 equivalence-partitioning 으로 먼저 나누고 「입력이 파티션 P1 에 속함」을 원인 하나로 씁니다.
2. 결과마다 원인의 논리식을 적습니다. AND, OR, NOT 과 중간 노드를 써서 명세 문장의 구조를 그대로 옮깁니다. 그래프는 설계자의 작업 메모이고 산출물이 아닙니다.
3. 명세가 말한 **제약**을 아래 다섯 가지로 적습니다. 각 제약에는 그 문장을 말한 명세 항목 id 가 있어야 합니다.

    | 제약 | 대상 | 뜻 | 빠지는 조합 |
    |---|---|---|---|
    | `exclusive` | 원인 | 많아야 하나만 참 | 둘 이상 참인 조합 |
    | `inclusive` | 원인 | 적어도 하나는 참 | 모두 거짓인 조합 |
    | `one-and-only-one` | 원인 | 정확히 하나만 참 | 하나가 아닌 조합 |
    | `requires` | 원인 | C1 이 참이면 C2 도 참 | C1 참, C2 거짓 |
    | `mask` | 결과 | A1 이 참이면 A2 는 거짓 | 빠지는 조합 없음. 기대값 근거가 됨 |

4. 원인 조합을 펼쳐 decision table 을 만들고, 원인 제약에 걸리는 조합만 지웁니다. 남은 rule 하나가 Coverage Item 하나이고, `technique` 은 `decision-table` 로 씁니다. 압축과 「결과가 명세에 없는 조합」 처리는 bb-decision-table.md 를 그대로 따릅니다.
5. 지운 조합은 전부 `excludedCombinations` 에 남깁니다. 어떤 제약이, 어느 명세 항목 때문에, 어떤 조합을 지웠는지 적습니다.

## 제약은 명세에서만 나옵니다

조합을 지우는 것은 Coverage Item 을 지우는 것과 같습니다. 그래서 다른 기법에서 값을 발명하지 않는 것처럼, 여기서는 **제약을 발명하지 않습니다.**

- 「현실적으로 같이 올 일이 없다」는 근거가 아닙니다. 명세가 그 배타 관계를 말하지 않으면 조합을 지우지 말고 `ambiguities` 에 올리고, 그 rule 의 CI id 를 `blockedCoverageItems` 에 적습니다.
- 명세가 「그 조합은 거부한다」, 「오류를 낸다」라고 말하면 그건 제약이 아니라 **rule** 입니다. 조합을 지우지 않고 `kind: "throws"` 기대값을 가진 케이스로 씁니다. 허용되면 안 되는 조합을 허용하는 결함이 여기서 잡힙니다.
- 제약이 지우는 것은 public interface 로 **만들 수 없는** 조합뿐입니다. 타입이 두 원인을 동시에 표현하지 못하는 경우가 대표적입니다.
- 제약을 말한 명세 항목의 등급이 `authored` 면, 지운 조합이 구현을 보고 쓴 배타 관계일 수 있습니다. 리포트가 이 조합을 따로 보여 줘야 합니다.

## mask 제약과 기대값

`mask` 는 조합을 지우지 않습니다. A1 이 참인 rule 에서 「A2 가 일어나지 않는다」를 단언할 명세 근거가 됩니다. `Expected` 는 케이스 하나에 하나뿐이라, A2 의 부재는 같은 입력으로 만든 두 번째 케이스의 `kind: "value"` 기대값으로 씁니다. 그 경로가 반환 타입에 없으면 `ambiguities` 에 올립니다.

## 조합 수를 줄이는 휴리스틱은 쓰지 않습니다

원 저자는 결과에서 원인 쪽으로 거슬러 올라가며 조합을 고르는 휴리스틱을 함께 제시했습니다. 예를 들어 출력이 참인 OR 노드에서는 입력 하나만 참인 조합만 고릅니다. 이 휴리스틱으로 고른 열은 실행 가능한 rule 전체의 일부이고, 선택 규칙이 일관되지 않다는 비판이 있습니다.

beaker 는 이 휴리스틱으로 분모를 줄이지 않습니다. Coverage Item 은 제약을 통과한 rule 전체입니다. 원인이 많아 rule 수가 감당되지 않으면 결과마다의 논리식에 mcdc 를 적용합니다. mcdc 는 조건마다 independence pair 라는 정의된 단위로 케이스를 줄이고, 줄인 근거가 Coverage Item 에 남습니다.

<example>
명세가 원인 `C1`, `C2`, `C3` 과 결과 `A1`, `A2` 를 말하고, 「`C1` 과 `C2` 는 함께 주어질 수 없다」(REQ 항목 하나), 「`A1` 이면 `A2` 는 일어나지 않는다」(다른 REQ 항목)를 말할 때.

```
결과의 논리식
  A1 = (C1 ∨ C2) ∧ C3
  A2 = ¬A1

제약
  exclusive(C1, C2)      → C1 ∧ C2 인 두 조합을 지움
  mask(A1, A2)           → 지우는 조합 없음. A1 rule 에서 A2 부재를 단언할 근거

Coverage Item  남은 rule 여섯 개
  R1   C1 ∧ ¬C2 ∧ C3      → 명세가 지정한 A1
  R2   C1 ∧ ¬C2 ∧ ¬C3     → 명세가 지정한 A2
  R3   ¬C1 ∧ C2 ∧ C3      → 명세가 지정한 A1
  R4   ¬C1 ∧ C2 ∧ ¬C3     → 명세가 지정한 A2
  R5   ¬C1 ∧ ¬C2 ∧ C3     → 명세가 지정한 A2
  R6   ¬C1 ∧ ¬C2 ∧ ¬C3    → 명세가 지정한 A2

excludedCombinations
  exclusive(C1, C2)  C1 ∧ C2 ∧ C3   basisRefs = 배타를 말한 REQ 항목
  exclusive(C1, C2)  C1 ∧ C2 ∧ ¬C3  basisRefs = 같은 항목
```

명세가 「`C1` 과 `C2` 를 함께 주면 거부한다」라고 말했다면 두 조합은 지우지 않고 `throws` rule 이 되어 Coverage Item 이 여덟 개입니다.
</example>

## 다른 기법과의 관계

- **decision-table (bb-decision-table.md)**: Coverage Item 단위가 같습니다. cause-effect graph 는 decision table 의 rule 을 도출하는 앞단 절차이고, 결과물은 decision table 입니다. 별도 enum 으로 두면 같은 rule 이 두 기법 이름으로 집계됩니다.
- **multiple-condition-coverage (wb-multiple-condition-coverage.md)**: 제약이 없을 때 rule 전체는 명세 논리식에 대한 multiple condition coverage 와 같습니다. 제약이 있으면 그중 만들 수 있는 조합만 남습니다.
- **decision-coverage (wb-decision-coverage.md), condition-coverage (wb-condition-coverage.md), condition-decision-coverage (wb-condition-decision-coverage.md)**: 명세 논리식에 적용했을 때, 제약을 통과한 rule 전체는 이 셋의 만들 수 있는 항목을 모두 포함합니다.
- **mcdc (wb-mcdc.md)**: rule 수가 폭발할 때의 대안입니다. Myers 휴리스틱 대신 씁니다.
- **equivalence-partitioning (bb-equivalence-partitioning.md)**: 값 입력을 원인으로 바꾸는 앞단입니다.
- **classification-tree (bb-classification-tree.md)**: 입력을 측면별로 나누는 목적이 겹치지만, classification tree 는 값이 여럿인 측면을 다루고 cause-effect graph 는 참/거짓 원인과 그 사이 제약을 다룹니다.
- **pairwise (bb-pairwise.md)**: 원인이 많고 서로 독립이면 pairwise 가 맞습니다. 제약이 결과를 정하는 구조면 cause-effect graph 쪽입니다.
- **state-transition (bb-state-transition.md)**: 이전 이력에 따라 결과가 바뀌는 조건은 표현하지 못합니다. 그건 state-transition 몫입니다.

## beaker 통합

- **verdict**: `criterion-only`. `Technique` enum 에 값을 더하지 않습니다. 절차는 decision-table 의 rule 도출 단계로 흡수하고, 이 문서는 제약 표기와 조합 제거 규칙의 참고 문서로 둡니다.
- **쓰는 설계자**: blackbox-test-designer. whitebox-test-designer 는 쓰지 않습니다. 구현에는 실제 predicate 가 있으므로 branch-condition 이나 mcdc 가 맞습니다.
- **Coverage Item 단위**: 제약을 통과한 decision table rule 하나. `technique: decision-table`.
- **스키마 변경**: `BlackboxDesignerOutput` 에 `excludedCombinations` 배열을 더합니다. 원소는 `basisRefs`(1개 이상), `constraint`(위 다섯 값 중 원인 제약 넷), `operands`(제약이 걸린 원인 문장), `combination`(지운 조합) 입니다. `basisRefs` 가 빈 원소는 스키마 위반입니다.
- **역할 파일 변경**: blackbox-test-designer 의 기법 선택 표에 「조건 사이 제약이 있는 조합」을 decision-table 행에 더하고, 조합을 지울 때 `excludedCombinations` 를 쓰라는 규칙을 넣습니다. test-reporter 는 지운 조합을 리포트에 따로 보여 주고, `authored` 항목이 근거인 조합에 표시를 붙입니다.
- **비용**: 원인 n 개면 제약 전 2^n 조합입니다. 제약이 조합을 줄이지만, 제약이 적으면 decision-table 과 비용이 같습니다.
- **한계**: 원인과 결과를 자연어 명세에서 뽑는 단계가 사람이나 LLM 의 판단입니다. 원인을 빠뜨리면 그 원인이 걸린 조합 전체가 Coverage Item 에서 사라지고, 그 누락은 커버리지 수치에 드러나지 않습니다. 시간 순서나 이력은 표현하지 못합니다.

## 출처

- Glenford J. Myers, *The Art of Software Testing* (1979), cause-effect graphing 장. 원인, 결과, 제약 E/I/O/R/M, decision table 변환의 원전입니다.
- ISO/IEC/IEEE 29119-4:2021, 5.2.7 Cause-effect graphing 과 6.2.7 Cause-effect graphing coverage. 목차에서 절 위치만 확인했고 본문은 확인하지 못했습니다. [표준 미리보기](https://cdn.standards.iteh.ai/samples/79430/6c93dfe4a05b46a8895e04dfd74ddd24/ISO-IEC-IEEE-29119-4-2021.pdf)
- Usha Badhera, Purohit G.N, S. Taruna, 「Fault Based Techniques for Testing Boolean Expressions: A Survey」. Myers 의 그래프-테이블 변환 휴리스틱(OR/AND 노드별 조합 선택)과 그 절차가 일관되지 않다는 지적을 확인했습니다. [arXiv:1202.4836](https://arxiv.org/pdf/1202.4836)
