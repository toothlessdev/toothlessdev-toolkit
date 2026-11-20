# MC/DC (Modified Condition/Decision Coverage)

**분류** structure-based (코드의 decision), specification-based (명세의 논리식) · **Coverage Item** decision 안의 원자 조건 하나마다 independence pair 하나 · **쓰는 곳** whitebox-test-designer 기본, blackbox-test-designer 는 명세가 논리식을 줄 때

## 언제

원자 조건 두 개 이상이 `∧`, `∨`, `¬` 로 묶인 decision 이 있을 때 씁니다. condition coverage 는 각 조건을 참과 거짓으로 한 번씩 만들 뿐이라, 조건을 다 뒤집어도 결과에 영향을 준 조건이 하나도 없을 수 있습니다. MC/DC 는 **조건마다 그 조건 하나 때문에 decision 결과가 바뀌는 케이스 두 개**를 요구합니다. 조건 N 개에 케이스가 최소 N+1 개, 많아야 2N 개라서 2^N 개를 다 도는 multiple-condition coverage 보다 훨씬 쌉니다.

- **화이트박스**: 구현의 복합 조건 decision 에 씁니다. `branch-condition` 이 그 decision 에 만든 항목을 모두 덮습니다.
- **블랙박스**: 명세가 결과를 논리식(「C1 이고 C2 또는 C3 이면」)으로 정하고, 조건이 많아 decision table 의 rule 전부를 만들기 과할 때 씁니다. decision table 을 independence pair 가 필요한 rule 만 남기도록 줄이는 셈입니다.

## 두 가지 form

independence pair 는 major 조건(지금 독립성을 보이려는 조건)만 다르고 decision 결과가 반대인 truth vector 두 개입니다. 나머지 조건(minor 조건)을 어떻게 다루는지로 form 이 갈립니다.

| form | minor 조건 | 쓰는 때 |
|---|---|---|
| `unique-cause` | 두 vector 에서 값이 같아야 합니다. coupled 조건(같은 조건이 decision 에 두 번 나옴)일 때만 예외 | 명세나 호출자가 이 form 을 요구할 때 |
| `masking` | 달라도 됩니다. 단, 다른 minor 조건이 연산자에 가려져(`∧` 의 한쪽이 거짓, `∨` 의 한쪽이 참) 결과에 영향을 못 주는 경우만 | beaker 의 기본값 |

beaker 는 `masking` 을 기본으로 씁니다. 이유는 둘입니다.

1. 단축평가 언어에서는 평가되지 않은 조건의 값을 고정할 수 없어 `unique-cause` pair 가 자주 불가능합니다. `masking` 은 평가되지 않은 조건을 `-`(not-evaluated)로 두고 pair 를 인정합니다.
2. FAA 보고서 DOT/FAA/AR-01/18 은 `masking` 이 `unique-cause` 와 같은 최소 케이스 수로 더 많은 decision 에 적용된다고 결론냈습니다.

## 규칙

1. **decision 과 원자 조건을 뽑습니다.** 화이트박스는 구현의 decision 원문, 블랙박스는 명세 문장의 논리식입니다. 블랙박스는 명세에 논리 연산자 구조가 없으면 식을 만들지 않고 `ambiguities` 에 올립니다.
2. **Test Condition 은 원자 조건 하나마다 하나입니다.** 화이트박스에서는 `predicate` 가 그 원자 조건 원문이고 `predicateClass` 도 조건마다 따로 붙입니다.
3. **Coverage Item 은 원자 조건마다 independence pair 하나입니다.** pair 가 여러 개 가능해도 하나를 고릅니다. 고른 두 vector 를 `description` 에 실제 조건 값으로 적습니다.
4. **pair 끼리 vector 를 공유해 케이스 수를 줄입니다.** 한 케이스가 여러 Coverage Item 의 한쪽 vector 를 겸해도 됩니다. 공유한 사실을 `rationale` 에 적습니다.
5. **각 vector 의 결과는 근거에서만 가져옵니다.** 블랙박스는 명세의 논리식으로 계산한 결과와 명세가 그 결과에 지정한 출력이고, 화이트박스는 현재 구현이 내는 값(characterization)입니다. 명세가 어떤 vector 의 출력을 말하지 않으면 그 Coverage Item 을 `blockedCoverageItems` 에 올립니다.
6. **pair 의 두 케이스가 같은 `expected` 를 가지면 독립성이 관찰되지 않습니다.** decision 결과는 바뀌었지만 출력에 드러나지 않는 경우입니다. 화이트박스는 `Note`(`issue: unobservable-decision-outcome`)로, 블랙박스는 명세가 두 결과를 구별하지 않는다는 `Ambiguity` 로 올립니다.
7. **pair 를 만들 수 없는 조건을 지우지 않습니다.** 어떤 값으로도 결과를 혼자 바꾸지 못하는 조건은 쓸모없는 조건이거나 다른 조건과 묶여 있는 것입니다. 화이트박스는 `Note`(`issue: no-independence-pair`), 블랙박스는 「이 조건이 결과에 영향을 주는가」를 묻는 `Ambiguity` 로 올리고 Coverage Item 은 남깁니다.

<example>
decision 이 `C1 ∧ (C2 ∨ C3)` 이고 form 이 `unique-cause` 일 때. vector 는 (C1, C2, C3) 순서입니다.

```
V1  T T F  -> 참
V2  T F T  -> 참
V3  T F F  -> 거짓
V4  F T F  -> 거짓

CI  C1 의 pair   V1 / V4   C1 만 다르고 결과가 반대
CI  C2 의 pair   V1 / V3
CI  C3 의 pair   V2 / V3
```

케이스는 V1~V4 네 개(N+1)이고 V1, V3 는 두 pair 가 같이 씁니다. 단축평가 언어에서 V4 는 C1 이 거짓이라 C2, C3 가 평가되지 않으므로, `masking` 으로 적으면 `F - -` 입니다.
</example>

## 다른 기법과의 관계

- **포함하는 것**: decision-coverage(`wb-decision-coverage.md`), condition-coverage(`wb-condition-coverage.md`), condition-decision-coverage(`wb-condition-decision-coverage.md`). 같은 decision 에서 기존 `branch-condition`(`wb-branch-condition.md`)의 항목도 모두 덮습니다. pair 의 두 vector 가 각 조건의 참과 거짓, decision 의 참과 거짓을 함께 만들기 때문입니다.
- **포함되는 것**: multiple-condition-coverage(`wb-multiple-condition-coverage.md`). 2^N 조합 전부에는 모든 pair 가 들어 있습니다.
- **겹치는 것**: decision-table(`bb-decision-table.md`)은 rule 전부를 세고 MC/DC 는 그 부분집합을 셉니다. cause-effect-graph(`bb-cause-effect-graph.md`)도 조합을 줄이지만 기준이 조건 사이 제약입니다. edge-coverage(`wb-edge-coverage.md`)는 decision 결과 쪽만 겹치고 조건 단위는 보지 않습니다.
- **보완하는 것**: mutation-testing(`wb-mutation-testing.md`)은 pair 가 실제 단언으로 출력 차이를 잡는지(규칙 6)를 따로 확인합니다.

## beaker 통합

- **verdict**: technique. `Technique` 값은 `mcdc` 입니다.
- **쓰는 설계자**: whitebox-test-designer 는 원자 조건이 두 개 이상이고 그중 하나라도 `business-rule` 인 decision 에 `branch-condition` 대신 씁니다. `defensive`, `infrastructural` 조건만으로 된 decision 은 비용 대비 이득이 적어 `branch-condition` 으로 둡니다. blackbox-test-designer 는 명세가 논리식을 줄 때 `decision-table` 과 함께 또는 그 대신 씁니다.
- **Coverage Item 단위**: 원자 조건 하나의 independence pair 하나. 케이스 두 개가 있어야 덮입니다.
- **스키마**: `CoverageItem` 에 pair 를 기계가 읽을 수 있게 담는 선택 필드가 필요하고, 커버리지 식이 「케이스 하나라도」가 아니라 「pair 의 두 vector 를 맡은 케이스가 모두 counted」로 셉니다. 이 조건이 없으면 vector 한쪽만 돈 실행이 pair 를 덮은 것으로 세집니다.
- **불변식**: 블랙박스 기대값은 명세 논리식에서 계산하므로 발명이 아닙니다. 화이트박스 케이스는 다른 기법과 같이 `(characterization)` 표기와 `pins` 를 붙이고, 목표 줄은 decision 이 있는 줄이라 `reach` 판정이 그대로 적용됩니다.
- **비용**: decision 하나에 케이스 N+1~2N 개. N 이 큰 decision 은 vector 를 찾는 탐색이 설계자에게 무거우므로, 설계자는 찾은 pair 만 Coverage Item 으로 두고 못 찾은 조건은 규칙 7 로 남깁니다.
- **한계**: 조건이 decision 결과를 바꾸는지만 보고, 그 결과가 출력까지 전파되는지는 보장하지 않습니다(규칙 6). 비교 연산자 안의 경계(`<` 와 `<=`)는 조건 값만 보므로 놓칠 수 있어 boundary-value-analysis(`bb-boundary-value-analysis.md`)와 함께 써야 합니다.

## 출처

- Kelly J. Hayhurst 외, 「A Practical Tutorial on Modified Condition/Decision Coverage」, NASA/TM-2001-210876, 2001. https://ntrs.nasa.gov/citations/20010057789
- John J. Chilenski, 「An Investigation of Three Forms of the Modified Condition Decision Coverage (MCDC) Criterion」, DOT/FAA/AR-01/18, 2001. 용어집의 Masking, Unique Cause MCDC 정의와 9장 결론을 확인했습니다. https://rosap.ntl.bts.gov/view/dot/42764
- GCC 문서, Instrumentation Options 의 `-fcondition-coverage`(조건마다 결과에 독립적으로 영향을 주는지 기록). 어느 form 인지는 문서에 없습니다. https://gcc.gnu.org/onlinedocs/gcc/Instrumentation-Options.html
- Paul Ammann, Jeff Offutt, 「Introduction to Software Testing」 2판, Logic Coverage 장. Active Clause Coverage 의 CACC 가 masking, RACC 가 unique-cause 에 대응합니다(본문 원문은 확인하지 못했고 장 이름만 적습니다).
