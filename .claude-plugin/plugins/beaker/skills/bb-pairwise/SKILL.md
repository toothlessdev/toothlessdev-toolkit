---
name: bb-pairwise
description: 설계 기법이 아니라 combinatorial-t-way 의 t = 2 를 도구 없이 손으로 짤 때의 지침입니다. technique 값으로 pairwise 를 쓰지 말고 combinatorial-t-way 를 씁니다. 파라미터 셋 이상의 값 쌍을 손으로 덮는 규모 상한(파라미터 4개, 값 3개), 행 만드는 순서, 덮은 쌍을 검사하는 방법을 blackbox-test-designer 가 참조합니다.
---

# All-Pairs (Pairwise) Testing

blackbox-test-designer 가 [beaker:bb-combinatorial-t-way](../bb-combinatorial-t-way/SKILL.md) 를 t = 2 로 손으로 짤 때 참조합니다. 이 스킬 이름은 `technique` 값이 아니고, 케이스와 Coverage Item 의 `technique` 은 `combinatorial-t-way` 입니다.

- **분류**: specification-based (combinatorial)
- **Coverage Item**: 서로 다른 두 파라미터의 P-V pair(파라미터와 그 값 하나의 짝) 두 개로 이루어진 쌍 하나

## 언제 쓰나

파라미터가 셋 이상이고 파라미터마다 값 부류가 나뉘는데, 모든 조합을 다 돌리기에는 조합 수가 너무 많을 때 씁니다. 이 기법이 노리는 결함은 **두 파라미터의 특정 값이 함께 올 때만** 드러나는 결함입니다.

- 값 부류는 equivalence-partitioning 과 boundary-value-analysis 가 이미 나눈 것을 씁니다. 이 기법은 값을 새로 나누지 않습니다.
- 명세가 조합마다 결과를 따로 정하고 조건 수가 적으면 decision-table 이 맞습니다. 이 기법은 명세가 결과를 파라미터별 규칙으로 정하고, 조합이 결과를 바꾸지 않아야 하는 경우에 맞습니다.
- 세 파라미터 이상이 함께 와야 드러나는 결함은 놓칠 수 있습니다. 그 위험이 크면 combinatorial-t-way 를 t = 3 이상으로 씁니다.

## 이 기준을 쓰는 법

combinatorial-t-way 의 t = 2 를 손으로 짤 때 아래 순서를 따릅니다.

1. **파라미터 모델을 명세에서 만듭니다.** 파라미터는 `<public-interface>` 의 입력이고, 값은 명세가 나눈 부류의 대표값입니다. 명세가 부류를 나누지 않은 파라미터에 값을 지어내지 말고 `ambiguities` 에 올립니다.
2. **유효한 값만 조합합니다.** 명세가 거절한다고 말한 값(무효 부류)은 pairwise 행에 넣지 않습니다. 무효 값이 섞인 행은 앞단에서 거절되어 같은 행의 다른 쌍이 실행되지 않고, 그 쌍들은 `reach: unreached` 로 끝납니다. 무효 값은 equivalence-partitioning 의 단일 무효 값 케이스가 맡습니다.
3. **명세가 금지한 조합은 Coverage Item 이 아닙니다.** 「`P1` 이 `V2` 이면 `P3` 은 `V1` 이어야 한다」 같은 명세 문장이 있으면 그 쌍을 빼고, 뺀 쌍과 근거 `REQ-` 를 그 Test Condition 의 `statement` 에 적습니다. 명세 근거 없이 「이 조합은 안 쓰일 것」이라고 빼지 않습니다.
4. **Coverage Item 은 남은 쌍마다 하나입니다.** `description` 은 `<파라미터>=<값> × <파라미터>=<값>` 형식으로 실제 이름과 값을 씁니다. 개수는 파라미터 쌍마다 두 값 개수를 곱해 더한 것에서 금지 쌍을 뺀 수입니다.
5. **행을 만듭니다.** 앞의 두 파라미터의 모든 값 조합으로 행을 시작하고, 다음 파라미터를 붙일 때마다 아직 덮이지 않은 쌍을 가장 많이 덮는 값을 고릅니다. 그래도 남은 쌍은 행을 추가해 덮습니다. 행 하나가 Test Case 하나입니다.
6. **케이스의 `coverageItemRefs` 에 그 행이 덮는 쌍을 전부 적습니다.** 적은 쌍은 두 값이 모두 그 케이스의 `inputs` 에 그대로 있어야 합니다. 오케스트레이터가 이것을 검사합니다.
7. **기대값은 그 행 전체에 대해 명세가 정한 결과입니다.** 행마다 명세 규칙을 적용해 `expected` 를 씁니다. 명세가 그 행의 결과를 정하지 않으면 추측하지 말고 `ambiguities` 에 올리고, 그 행만 덮던 쌍을 `blockedCoverageItems` 에 적습니다.
8. **손으로 만드는 규모는 파라미터 4개, 파라미터마다 값 3개까지입니다.** 이 크기면 쌍은 최대 54개이고 행은 10개 안팎입니다. 이보다 크면 Coverage Item 은 전부 만들되, 행은 만들 수 있는 만큼만 만들고 나머지 쌍은 덮지 않은 채 남깁니다. 지우지 않습니다. 더 큰 규모는 combinatorial-t-way 의 생성 도구 경로를 씁니다.

`rationale` 에는 「pairwise 행 하나」가 아니라 이 행이 처음으로 덮은 쌍과, 그 쌍이 왜 함께 시험할 가치가 있는지(명세의 어느 두 규칙이 만나는지)를 적습니다.

리포트를 읽을 때는 다음을 봅니다.

- t = 2 로 짠 Coverage Item 도 집계에서는 `combinatorial-t-way` 로 셉니다. pairwise 커버리지를 따로 찾지 않습니다.
- 오케스트레이터 검사에서 `coverageItemRefs` 의 두 값이 `inputs` 에 없던 주장은 커버리지로 세지 않습니다. 덮였다고 적힌 쌍이 덮이지 않은 것으로 나오면 이 검사 결과입니다.

## 만들지 않는 이유

별도 `technique` 값을 두지 않습니다. pairwise 와 combinatorial-t-way 는 Coverage Item 단위가 같고 t 만 달라서, 값을 둘로 나누면 같은 쌍이 두 이름으로 집계됩니다. 그래서 이 스킬은 Coverage Item 을 자기 이름으로 만들지 않고, 위 순서로 만든 항목과 케이스의 `technique` 에 `combinatorial-t-way` 를 씁니다.

## 하지 않는 것

- `technique` 에 `pairwise` 를 쓰지 않습니다.
- 명세가 나누지 않은 값 부류를 지어내지 않습니다.
- 무효 값을 행에 넣지 않습니다.
- 명세 근거 없이 조합을 금지 쌍으로 빼지 않습니다.
- 손 구성 상한을 넘었다고 덮지 못한 쌍의 Coverage Item 을 지우지 않습니다.

<example>
명세가 파라미터 `P1`, `P2`, `P3` 에 각각 두 부류 `V1`, `V2` 를 정하고, 「`P1` 이 `V2` 이면 `P3` 은 `V1` 이어야 한다」(REQ-n) 고 말할 때.

```
Test Condition  P1, P2, P3 의 값 쌍마다 명세 결과가 성립한다
  statement 에 적는 금지 쌍   P1=V2 × P3=V2   (REQ-n)
  CI          파라미터 쌍 3개 × 값 쌍 4개 = 12, 금지 쌍 1개를 빼서 11

행    P1   P2   P3    새로 덮는 쌍
r1    V1   V1   V2    P1P2=V1V1  P1P3=V1V2  P2P3=V1V2
r2    V1   V2   V1    P1P2=V1V2  P1P3=V1V1  P2P3=V2V1
r3    V2   V1   V1    P1P2=V2V1  P1P3=V2V1  P2P3=V1V1
r4    V2   V2   V1    P1P2=V2V2
r5    V1   V2   V2    P2P3=V2V2
```

`P2P3=V2V2` 는 `P1=V2` 와 함께 둘 수 없어 행이 하나 늘었습니다. 금지 조합은 행 수를 줄이기도 하고 늘리기도 합니다.
</example>

## 다른 기법과의 관계

- **포함하는 것**: 유효한 값만 쓸 때 pairwise 행은 모든 유효 부류를 한 번 이상 지나므로, [beaker:bb-equivalence-partitioning](../bb-equivalence-partitioning/SKILL.md) 의 유효 부류 커버리지를 포함합니다. 같은 구조로 Each Choice(부류마다 한 번)를 포함합니다. 무효 부류 커버리지는 포함하지 않습니다.
- **포함되는 것**: [beaker:bb-combinatorial-t-way](../bb-combinatorial-t-way/SKILL.md) 는 t 가 2 이상이면 이 기법을 포함합니다. pairwise 는 t-way 의 t = 2 인 경우입니다. 모든 조합을 다 도는 시험도 이 기법을 포함하고, 조건이 셋 이상인 [beaker:bb-decision-table](../bb-decision-table/SKILL.md) 의 전체 rule 표와 [beaker:bb-cause-effect-graph](../bb-cause-effect-graph/SKILL.md) 에서 나온 결정 테이블이 여기 해당합니다.
- **입력을 받는 것**: [beaker:bb-classification-tree](../bb-classification-tree/SKILL.md) 가 만든 분류와 부류가 파라미터 모델이 됩니다. [beaker:bb-boundary-value-analysis](../bb-boundary-value-analysis/SKILL.md) 의 경계값을 값으로 넣으면 값 개수가 늘어 쌍 수가 커집니다.
- **비슷하지만 다른 축**: [beaker:wb-multiple-condition-coverage](../wb-multiple-condition-coverage/SKILL.md) 도 조합을 세지만 구현의 원자 조건을 세고, 이 기법은 명세의 입력 파라미터를 셉니다.

## beaker 통합

- **verdict**: criterion-only. 별도 `Technique` 값을 두지 않고 [beaker:bb-combinatorial-t-way](../bb-combinatorial-t-way/SKILL.md) 의 t = 2 로 씁니다. 두 기법은 Coverage Item 단위가 같고 t 만 달라서, 값을 둘로 나누면 같은 쌍이 두 이름으로 집계됩니다. 이 스킬은 t = 2 를 도구 없이 손으로 짤 때의 규모와 검사 방법을 담습니다.
- **설계자**: blackbox-test-designer. 파라미터 모델, 금지 조합, 기대값이 모두 명세에서 나오므로 도구 없이 설계할 수 있습니다.
- **손 구성의 상한**: 파라미터 4개 x 값 3개(쌍 54개, 행 10개 안팎) 정도까지입니다. 넘으면 [beaker:bb-combinatorial-t-way](../bb-combinatorial-t-way/SKILL.md) 의 생성 도구 경로를 씁니다.
- **검사**: 손으로 만든 행은 쌍을 덮었다고 잘못 적기 쉽습니다. 오케스트레이터가 반환값을 저장한 뒤 결정적 검사로 `coverageItemRefs` 의 두 값이 `inputs` 에 실제로 있는지 대조하고, 맞지 않는 주장은 커버리지로 세지 않습니다. 설계자의 반환값은 고치지 않습니다. 이 검사 스크립트는 후속 과제입니다.
- **비용과 한계**: 행 수는 가장 큰 두 파라미터의 값 개수 곱 이상이고, 파라미터 수에 대해서는 로그 수준으로만 늘어납니다. 세 요인 이상의 상호작용 결함은 보장하지 못합니다. 행마다 기대값이 필요해서 oracle 비용은 줄지 않습니다. 명세가 행 전체의 결과를 정하지 못하면 많은 쌍이 `blockedCoverageItems` 로 남습니다.

## 출처

- ISO/IEC/IEEE 29119-4:2021, 3.12 combinatorial test design techniques(예시에 pair-wise testing), 3.38 P-V pair, 5.2.5 Combinatorial test design techniques, 6.2.5 coverage. 정의와 목차는 공개 미리보기에서 확인 https://cdn.standards.iteh.ai/samples/79430/6c93dfe4a05b46a8895e04dfd74ddd24/ISO-IEC-IEEE-29119-4-2021.pdf
- Kuhn, Kacker, Lei. Practical Combinatorial Testing. NIST SP 800-142, 2010. 2장 interaction rule 과 covering array, 테스트 수가 v^t log n 에 비례한다는 서술, 2.2 The Test Oracle Problem, 3.3.1 Invalid Combinations and Constraints. https://csrc.nist.gov/pubs/sp/800/142/final
- Kuhn, Wallace, Gallo. Software Fault Interactions and Implications for Software Testing. IEEE TSE 30(6), 2004. https://csrc.nist.gov/pubs/journal/2004/06/software-fault-interactions-and-implications-for-s/final
- NIST Automated Combinatorial Testing for Software(ACTS 생성기). https://csrc.nist.gov/projects/automated-combinatorial-testing-for-software
- Microsoft PICT 문서. 제약(IF/THEN), 무효 값을 행마다 하나로 제한하는 이유(input masking), 결과가 최소 크기를 보장하지 않는다는 점. https://github.com/microsoft/pict/blob/main/doc/pict.md
- Ammann & Offutt, Introduction to Software Testing, Input Space Partitioning 장의 PWC, TWC, ECC, BCC 와 포함 관계. 강의 자료로 정의 확인 https://www.cs.cornell.edu/courses/cs5154/2021fa/resources/ISP-Criteria.pdf
