# Complete Path Coverage

**분류** structure-based · **Coverage Item** 대상 CFG 의 entry 에서 exit 까지 가는 경로 하나하나 · **쓰는 곳** 생성기로 쓰지 않습니다. 구조 기준 계층의 꼭대기(이론적 상한)로만 둡니다

## 언제

설계자가 이 기준을 골라 Coverage Item 을 만드는 경우는 없습니다. 이 문서는 두 경우에 읽습니다.

- 다른 구조 기준(`prime-path-coverage`, `edge-pair-coverage`, `all-du-paths` 등)이 기준 계층의 어디에 있는지 설명할 때. 모든 그래프 기준은 이 기준 아래에 있습니다.
- 리포트나 사람이 「모든 경로를 시험했다」, 「경로 커버리지 100%」라고 말하려 할 때. 그 말이 성립하는지 판단하는 기준이 이 문서입니다.

## 정의

- **Complete Path Coverage**: test requirement 가 그래프의 모든 경로입니다. 코드의 CFG 에서는 entry 에서 exit 까지 가는 완전한 test path 전부입니다.
- **loop 가 있으면 경로가 무한합니다.** 반복 횟수가 하나 다를 때마다 다른 경로입니다. Ammann & Offutt 는 그래서 이 기준을 「not feasible」이라고 적습니다.
- **loop 가 없으면 유한하지만 지수적으로 늘어납니다.** 서로 독립인 분기가 연달아 있으면 분기 하나가 늘 때마다 경로 수가 두 배가 됩니다.
- **Specified Path Coverage**: 이 기준의 타협안으로, 시험자가 덮을 경로 집합을 매개변수로 정합니다. 결과가 시험자마다 달라진다는 이유로 Ammann & Offutt 도 만족스럽지 않은 기준으로 봅니다.

## 규칙

1. **`technique` 필드에 `complete-path-coverage` 를 쓰지 않습니다.** Coverage Item 도 만들지 않습니다.
2. **loop 가 있는 대상에 「모든 경로」를 주장하지 않습니다.** Structural Coverage 는 실제로 쓴 기법이 만든 Coverage Item 을 분모로 합니다. 그 숫자가 100% 여도 「모든 경로를 덮었다」는 뜻이 아닙니다.
3. **loop 가 없는 대상에서 모든 경로를 요구하는 것은 prime path 를 요구하는 것과 같습니다.** entry 하나, exit 하나인 loop 없는 CFG 에서는 모든 경로가 simple path 이고, 더 늘릴 수 없는 simple path 가 곧 entry 에서 exit 까지의 경로입니다. 이 요구가 필요하면 새 기준을 만들지 않고 `wb-prime-path-coverage.md` 를 그 한도 규칙대로 씁니다.
4. **설계자가 경로 집합을 임의로 골라 「경로 커버리지」라고 부르지 않습니다.** 그건 Specified Path Coverage 이고, 분모를 설계자가 정하는 것입니다. 경로를 더 보고 싶으면 정의가 고정된 기준(`edge-pair-coverage`, `prime-path-coverage`)을 씁니다.

<example>
entry `S1`, 분기 `P1`, 이어서 분기 `P2`, exit `S4` 인 loop 없는 대상과, entry `S1`, loop head `S2`, body `S3`, exit `S4` 인 대상.

```
loop 없음
  경로   P1 참 -> P2 참      P1 참 -> P2 거짓
         P1 거짓 -> P2 참    P1 거짓 -> P2 거짓
  prime path 집합과 같습니다. 분기가 하나 늘면 두 배가 됩니다

loop 있음
  경로   [S1, S2, S4]
         [S1, S2, S3, S2, S4]
         [S1, S2, S3, S2, S3, S2, S4]
         ...                        반복 횟수마다 하나씩, 끝이 없습니다
  prime path 는 이 중 반복 0회와 2회 이상을 가르는 다섯 개로 끝납니다
```

두 번째 대상에서 Coverage Item 집합은 유한하게 적을 수 없습니다. beaker 의 커버리지 식은 분모가 유한한 집합이어야 계산됩니다.
</example>

## 다른 기법과의 관계

- **포함하는 것**: 그래프 기준 전부입니다. `prime-path-coverage`(wb-prime-path-coverage.md), `edge-pair-coverage`(wb-edge-pair-coverage.md), `edge-coverage`(wb-edge-coverage.md), `node-coverage`(wb-node-coverage.md)와 data flow 기준 `all-du-paths`(wb-all-du-paths.md), `all-uses`(wb-all-uses.md), `all-defs`(wb-all-defs.md)를 포함합니다. 모든 경로를 지나면 그 부분 경로도 다 지납니다. `decision-coverage`(wb-decision-coverage.md)도 간선을 거쳐 포함합니다.
- **조건 기준은 CFG 를 어떻게 세우느냐에 달립니다**: 복합 조건을 `wb-branch-condition.md` 처럼 원자 조건 노드로 펼친 CFG 라면, 한 결정 안의 경로 하나가 단축평가로 실제 일어나는 원자 조건 값의 순서 하나입니다. 그래서 `condition-coverage`(wb-condition-coverage.md), `condition-decision-coverage`(wb-condition-decision-coverage.md), 단축평가 기준의 `multiple-condition-coverage`(wb-multiple-condition-coverage.md)와 `mcdc`(wb-mcdc.md)까지 따라옵니다. 결정을 노드 하나로 둔 CFG 에서는 조건 기준을 포함하지 않습니다. 이 단락은 정의에서 끌어낸 추론이고 출처의 문장이 아닙니다.
- **포함되는 것**: 없습니다. 구조 기준 계층의 꼭대기입니다.
- **경로를 다 지나도 입력 값은 다 보지 않습니다**: 같은 경로를 지나는 입력 중 일부만 결함을 드러내는 경우(경계 근처 값, 잘못된 계산이 우연히 맞는 값)는 이 기준으로 잡히지 않습니다. 값의 부류와 경계는 `equivalence-partitioning`(bb-equivalence-partitioning.md), `boundary-value-analysis`(bb-boundary-value-analysis.md) 몫입니다. 단언이 약한 시험은 `mutation-testing`(wb-mutation-testing.md)이 드러냅니다.
- **상태 그래프에도 같은 한계가 있습니다**: `state-transition`(bb-state-transition.md)의 상태 그래프에 cycle 이 있으면 모든 전이 순서도 무한합니다. switch 수준을 정해 끊는 것이 그 기법의 방식입니다.

## beaker 통합

- **verdict**: criterion-only. `Technique` enum 에 `complete-path-coverage` 를 넣지 않습니다.
- **넣지 않는 이유 1, 분모**: `schemas.md` 의 `coverage(basis)` 는 Coverage Item 집합의 크기로 나눕니다. loop 가 있으면 그 집합이 무한해서 식이 정의되지 않습니다. 반복 횟수에 상한을 두어 끊으면 그 상한을 설계자가 정하게 되고, 그건 Specified Path Coverage 입니다.
- **넣지 않는 이유 2, 중복**: loop 가 없으면 Coverage Item 집합이 `prime-path-coverage` 의 것과 같습니다. 같은 집합에 enum 값 두 개를 두면 같은 항목이 두 이름으로 세어집니다.
- **넣지 않는 이유 3, 도달 판정**: `reach` 는 줄 커버리지나 결과 종류로 판정합니다. 경로는 줄 집합만으로 확인되지 않습니다. `wb-prime-path-coverage.md` 의 도달 판정 제약이 여기에 그대로, 더 크게 걸립니다.
- **넣지 않는 이유 4, oracle 과 열거 비용**: 화이트박스 케이스의 기대값은 characterization 이라 경로 수만큼 결함 탐지가 늘지 않습니다. 설계자의 도구는 Read, Grep, Glob 뿐이라 지수적으로 늘어나는 경로를 손으로 열거하면 누락이 분모에서 조용히 사라집니다.
- **쓰는 곳**: `techniques/index.md` 에 구조 기준의 포함 관계를 적을 때 꼭대기에 둡니다. 리포트가 Structural Coverage 를 쓸 때 「모든 경로」 표현을 막는 근거로 씁니다.
- **다시 볼 조건**: 없습니다. loop 가 없는 대상의 전체 경로는 `prime-path-coverage` 의 적용 조건을 넓히는 쪽에서 다룹니다.
- **한계**: 이론적 상한일 뿐 실무 목표가 아닙니다. 실무에서 loop 를 다루는 상한은 `prime-path-coverage` 입니다.

## 출처

- Paul Ammann, Jeff Offutt, 「Introduction to Software Testing」 2판, 7장 Graph Coverage. 강의 슬라이드로 확인: [Ch2-1-2 Overview Graph Coverage Criteria](https://www.cs.montana.edu/courses/se422/currentLectures/Ch2-1-2.pdf). Complete Path Coverage 와 Specified Path Coverage 의 정의, loop 가 있으면 경로가 무한해 CPC 가 불가능하다는 서술, SPC 의 결과가 시험자마다 달라진다는 서술, CPC 를 꼭대기에 둔 포함 관계 그림
- [CS 5154 Dealing with Loops in Graph Coverage, Cornell](https://www.cs.cornell.edu/courses/cs5154/2022fa/resources/LoopsInGraphBasedTesting.pdf). loop 때문에 Complete Path Coverage 가 불가능하다는 서술과 loop 를 다루는 방식의 변천(1회 실행, 0회·1회·여러 회, prime path), 포함 관계 그림
- Arthur Watson, Thomas McCabe, [Structured Testing: A Testing Methodology Using the Cyclomatic Complexity Metric, NIST SP 500-235](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication500-235.pdf). loop 가 있는 프로그램은 경로가 잠재적으로 무한해 이론상으로도 전수 시험이 안 된다는 서술, loop 없는 단순 모듈에는 전체 경로 시험이 맞을 수 있다는 서술
- Jørgen Kvalsvik, [Prime path coverage in the GNU Compiler Collection](https://arxiv.org/html/2505.14694v1), 2025. 연속된 if-then-else 마다 prime path 수가 두 배가 된다는 서술
