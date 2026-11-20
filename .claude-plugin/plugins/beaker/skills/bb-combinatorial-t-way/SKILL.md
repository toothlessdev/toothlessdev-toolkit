---
name: bb-combinatorial-t-way
description: 서로 독립인 입력 파라미터 셋 이상의 값 조합이 너무 많을 때, 제약을 만족하는 모든 t-tuple 이 어느 케이스 행에든 한 번은 나오도록 covering array 를 짜는 기법입니다. 기본은 t = 2(pairwise)이고, 명세가 파라미터 셋 이상이 함께 결과를 정한다고 말하거나 호출자가 실패 비용이 큰 영역이라고 표시할 때만 t 를 올립니다. blackbox-test-designer 가 technique 값 combinatorial-t-way 로 씁니다.
---

# Combinatorial t-way Testing

blackbox-test-designer 가 파라미터 값 조합이 폭발하는 Test Condition 에 부르고, `technique` 값은 `combinatorial-t-way` 입니다. pairwise 는 별도 값이 아니라 이 기법의 t = 2 입니다.

- **분류**: specification-based
- **Coverage Item**: 제약을 만족하는 t-tuple 하나(서로 다른 파라미터 t 개에 값을 하나씩 정한 조합)

## 언제 쓰나

입력 파라미터가 셋 이상이고, 파라미터마다 값이 몇 개로 나뉘며, 전수 조합은 너무 많을 때 씁니다.

결함 대부분은 파라미터 한두 개의 상호작용에서 나오고, 셋 이상이 얽힌 결함은 점점 줄어든다는 관찰(NIST 의 실패 사례 연구)이 근거입니다. 모든 t-tuple 이 어느 케이스에든 한 번은 나오게 하면, 파라미터 t 개 이하가 얽힌 결함은 놓치지 않습니다.

pairwise 는 t = 2 인 경우입니다. t 를 3 이상으로 올리는 때는 둘 중 하나입니다.

- 명세가 파라미터 셋 이상이 **함께** 결과를 정한다고 말합니다.
- 호출자가 `<technique-hint>` 로 그 요구사항이 안전성이나 금액처럼 실패 비용이 큰 영역이라고 표시했습니다.

근거가 없으면 t = 2 입니다. t 를 올리면 행 수가 값 개수의 t 제곱에 비례해 늘어납니다.

## 절차

1. **모델을 명세에서만 만듭니다.** 파라미터는 `<public-interface>` 의 입력이고, 값은 equivalence-partitioning 이 명세에서 나눈 파티션의 대표값이나 boundary-value-analysis 의 경계값입니다. 명세에 없는 값을 모델에 넣지 않습니다.
2. **invalid 값은 t-tuple 에 넣지 않습니다.** 거절되는 값이 한 행에 둘 있으면 앞의 거절이 뒤를 가립니다(input masking). invalid 파티션은 equivalence-partitioning 의 케이스로 하나씩 따로 시험하고, t-way 모델은 valid 값만 씁니다.
3. **제약도 명세에서만 가져옵니다.** 명세가 「P1 이 V2 이면 P2 는 V2 일 수 없다」처럼 불가능한 조합을 말하면, 그 조합을 담은 t-tuple 은 Coverage Item 이 아닙니다. 명세가 가능한지 말하지 않는 조합은 지우지 않고 남깁니다. 지울지 판단이 서지 않으면 `ambiguities` 에 올립니다.
4. **t 를 정합니다.** 근거가 없으면 t = 2 입니다. 명세가 상호작용을 말한 파라미터 묶음만 t = 3 이상으로 두고 나머지는 t = 2 로 둘 수 있습니다(variable strength). 묶음과 그 t 를 `rationale` 에 적습니다.
5. **Coverage Item 을 빠짐없이 적습니다.** 파라미터 t 개를 고르는 모든 경우마다, 그 값들의 모든 조합 가운데 제약을 만족하는 것이 Coverage Item 입니다. 제약 때문에 어떤 valid 행에도 들어갈 수 없는 tuple 도 빼고, 뺀 이유를 `rationale` 에 적습니다.
6. **행을 만듭니다.** 케이스 하나는 covering array 의 한 행입니다. t = 3 이상이거나 tuple 이 많으면 손으로 짜지 않고 아래 「beaker 통합」의 생성 도구 경로를 씁니다. t = 2 를 손으로 짤 때의 규모와 순서는 [beaker:bb-pairwise](../bb-pairwise/SKILL.md) 를 따릅니다.
7. **한 케이스가 여러 Coverage Item 을 덮습니다.** 그 행에 들어 있는 tuple 전부를 `coverageItemRefs` 에 겁니다.
8. **각 행의 기대값은 명세에서 계산합니다.** 명세가 그 행의 조합에 결과를 정하지 않으면 기대값을 추측하지 않습니다. 결과가 정해지는 다른 행으로 바꿔 같은 tuple 을 덮거나, 바꿀 수 없으면 그 행에만 있는 tuple 을 `blockedCoverageItems` 에 올립니다.

## 만드는 것

- **TestCondition**: 조합으로 결과가 정해지는 성질 하나. `basisRefs` 에 모델의 근거가 된 `REQ-` 와 제약의 근거 `REQ-` 를 겁니다. `predicate`, `predicateClass` 는 `null` 입니다.
- **CoverageItem**: `technique` 은 `combinatorial-t-way`. 제약을 만족하는 t-tuple 하나마다 하나이고, `description` 에 그 tuple 의 실제 파라미터 이름과 값을 씁니다. 개수는 파라미터 t 개를 고르는 경우마다 값 개수를 곱해 더한 뒤 제약으로 빠지는 것을 뺀 값입니다.
- **TestCase**: covering array 의 행 하나. `technique` 은 `combinatorial-t-way`, `inputs` 는 그 행의 모든 파라미터 값, `coverageItemRefs` 는 그 행에 들어 있는 tuple 전부입니다. `rationale` 에 t 와 variable strength 묶음, 제약으로 뺀 tuple 의 이유를 적습니다.
- **Expected**: 명세가 그 행의 조합에 정한 결과로 `value` 나 `throws` 를 씁니다. 명세가 결과를 정하지 않으면 케이스를 만들지 않고 `blockedCoverageItems` 로 보냅니다.
- **스키마에 아직 없는 것**: t 와 tuple 을 기계가 읽을 필드(`strength`, `tuple`)와 모델 필드는 「beaker 통합」의 제안이고, 지금 `${CLAUDE_PLUGIN_ROOT}/references/schemas.md` 에는 없습니다. 그 정보는 `description` 과 `rationale` 에 씁니다.

## 하지 않는 것

- 명세에 없는 값이나 제약을 모델에 넣지 않습니다.
- invalid 값을 t-tuple 에 넣지 않습니다.
- 명세가 금지한다고 말하지 않은 조합을 「안 쓰일 것」이라는 이유로 지우지 않습니다.
- 근거 없이 t 를 올리지 않습니다.
- 명세가 결과를 정하지 않은 행의 기대값을 추측하지 않습니다.
- 덮지 못한 tuple 의 Coverage Item 을 지우지 않습니다.

<example>
명세가 입력 P1~P4 를 정하고, 각각 valid 값이 두 개(`P1 ∈ { V1, V2 }` 처럼)이며, 「P1 이 V2 이면 P2 는 V2 일 수 없다」는 제약을 둘 때.

```
TC-01  P1~P4 의 조합에 따른 결과                    REQ-01, REQ-02
  t = 2   파라미터 쌍 6개 x 값 조합 4개 = 24, 제약으로 빠지는 tuple 1개  -> CI 23개
  t = 3   파라미터 셋 4개 x 값 조합 8개 = 32, 제약으로 빠지는 tuple 4개  -> CI 28개

  CI-01  (P1=V1, P2=V1, P3=V1)
  CI-02  (P1=V1, P2=V1, P3=V2)
  ...

BB-01  inputs { P1: V1, P2: V1, P3: V1, P4: V2 }
       coverageItemRefs  이 행에 들어 있는 t-tuple 전부
       expected          명세가 이 조합에 정한 결과
```

t = 3 은 명세가 「P1, P2, P3 가 함께 결과를 정한다」고 말할 때만 고릅니다. 행 수는 생성 결과로 정해지고 전수 조합 수보다 적습니다.
</example>

## 다른 기법과의 관계

- **포함하는 것**: [beaker:bb-pairwise](../bb-pairwise/SKILL.md). t-way 를 만족하면 t 보다 작은 모든 차수의 tuple 도 덮습니다. t-tuple 마다 그 일부 파라미터만 본 조합이 들어 있기 때문입니다.
- **포함되는 것**: 형식상 상위 기준은 모든 파라미터의 모든 조합(t = 파라미터 수)이고, beaker 기법 목록에는 그 이름이 따로 없습니다.
- **겹치는 것**: [beaker:bb-decision-table](../bb-decision-table/SKILL.md) 을 압축하지 않으면 불리언 조건 전부의 조합이라 t = 조건 수인 경우와 같은 행을 만듭니다. 다만 decision-table 은 명세의 조건과 결과를 세고, t-way 는 파라미터 값 조합을 셉니다. [beaker:wb-multiple-condition-coverage](../wb-multiple-condition-coverage/SKILL.md) 는 코드의 decision 하나 안에서 같은 일을 합니다.
- **모델을 받는 것**: [beaker:bb-equivalence-partitioning](../bb-equivalence-partitioning/SKILL.md) 과 [beaker:bb-boundary-value-analysis](../bb-boundary-value-analysis/SKILL.md) 가 값을, [beaker:bb-classification-tree](../bb-classification-tree/SKILL.md) 가 파라미터와 분류를, [beaker:bb-cause-effect-graph](../bb-cause-effect-graph/SKILL.md) 가 제약을 줍니다.
- **보완하는 것**: [beaker:bb-state-transition](../bb-state-transition/SKILL.md). t-way 는 호출 한 번의 입력 조합만 보고, 이벤트 순서에 따라 갈리는 결함은 보지 않습니다.

## beaker 통합

- **verdict**: technique. `Technique` 값은 `combinatorial-t-way` 하나이고 pairwise 는 별도 값으로 두지 않습니다. 두 기법은 Coverage Item 단위가 같고 t 만 다르므로, enum 을 둘로 나누면 같은 tuple 이 두 이름으로 집계됩니다. pairwise 는 이 기법의 `strength: 2` 로 적습니다.
- **쓰는 설계자**: blackbox-test-designer. whitebox-test-designer 는 쓰지 않습니다. 코드 안의 조건 조합은 [beaker:wb-mcdc](../wb-mcdc/SKILL.md) 와 [beaker:wb-multiple-condition-coverage](../wb-multiple-condition-coverage/SKILL.md) 가 decision 단위로 이미 셉니다.
- **Coverage Item 단위**: 제약을 만족하는 t-tuple 하나. 개수는 파라미터 t 개를 고르는 경우마다 값 개수를 곱해 더한 뒤 제약으로 빠지는 것을 뺀 값입니다.
- **스키마**: `CoverageItem` 에 선택 필드 `strength`(number)와 `tuple`(파라미터 이름에서 값으로 가는 object)이 필요합니다. `TestCondition` 에는 모델(파라미터와 값, 제약 원문과 그 `basisRefs`, 묶음별 t)을 담는 선택 필드가 필요합니다. 커버리지 식은 그대로 쓸 수 있습니다. tuple 하나는 그 tuple 을 담은 행 하나가 counted 이면 덮입니다.
- **결정적 검사**: 블랙박스 설계자는 도구가 없어 tuple 을 빠뜨리거나 행에 없는 tuple 을 걸 수 있습니다. 오케스트레이터가 반환값을 받은 뒤 스크립트로 두 가지를 확인합니다.
  - 모델에서 다시 계산한 tuple 집합과 Coverage Item 집합이 같은지
  - 각 케이스의 `inputs` 에 그 케이스가 건 tuple 이 실제로 있는지

  틀리면 고쳐 쓰지 않고 재요청합니다.
- **생성 도구**: t = 3 이상이거나 tuple 이 많으면 손으로 covering array 를 짜는 것이 부정확합니다. 이때는 설계를 두 번 부릅니다.
  1. 첫 호출은 모델만 반환합니다.
  2. 오케스트레이터가 생성기(PICT 의 `/o` 옵션, NIST ACTS, 또는 플러그인 스크립트)로 행을 만듭니다.
  3. 두 번째 호출이 행마다 기대값을 채웁니다.

  생성기 입력은 설계자가 명세에서 만든 모델뿐이라 구현 정보가 들어가지 않습니다. 쓴 도구와 버전은 리포트에 적습니다.
- **reach 와 상호작용**: 행이 앞단에서 거절되면 `reach: unreached` 가 되고 그 행의 tuple 은 하나도 덮이지 않습니다. 절차 2(invalid 값 제외)가 invalid 값을 모델에서 빼는 이유가 이것입니다.
- **비용**: 행 수는 값 개수의 t 제곱에 비례해 늘고, 파라미터 수에는 로그로 늘어납니다. t 를 하나 올릴 때마다 Coverage Item 과 행이 크게 늘어나므로 절차 4(variable strength)로 필요한 묶음만 올립니다.
- **한계**: 행마다 명세가 결과를 정해야 기대값이 생깁니다. 조합이 많을수록 명세가 결과를 말하지 않는 행이 늘어 `ambiguities` 가 많아집니다. 값 선택이 틀리면(파티션을 잘못 나누면) t 를 올려도 결함을 못 잡으므로 모델의 질이 상한입니다. t 개보다 많은 파라미터가 얽힌 결함과 순서에 따른 결함은 보장하지 않습니다.

## 출처

- D. Richard Kuhn, Dolores R. Wallace, Albert M. Gallo Jr., 「Software Fault Interactions and Implications for Software Testing」, IEEE Transactions on Software Engineering 30(6), 2004. https://csrc.nist.gov/pubs/journal/2004/06/software-fault-interactions-and-implications-for-s/final
- D. Richard Kuhn, Raghu N. Kacker, Yu Lei, 「Practical Combinatorial Testing」, NIST SP 800-142, 2010. https://csrc.nist.gov/pubs/sp/800/142/final
- NIST, Automated Combinatorial Testing for Software(ACTS 소개, 1~6 개 변수 상호작용 관찰). https://csrc.nist.gov/projects/automated-combinatorial-testing-for-software
- NIST combinatorial-testing-tools 저장소(ACTS 의 제약과 variable-strength 지원). https://github.com/usnistgov/combinatorial-testing-tools
- Microsoft PICT 문서(`/o` order 옵션, sub-model 별 order, 제약 문법, `~` 접두 invalid 값을 한 행에 하나만 넣는 규칙). https://github.com/microsoft/pict/blob/main/doc/pict.md
- Paul Ammann, Jeff Offutt, 「Introduction to Software Testing」 2판, Input Space Partition Testing 장의 combination strategy 기준(t-wise 가 pair-wise 를 포함하고 all-combinations 에 포함됨).
- ISO/IEC/IEEE 29119-4, combinatorial test design techniques 절(pair-wise, all combinations).
