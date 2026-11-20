# Edge-Pair Coverage

**분류** structure-based · **Coverage Item** 이어지는 간선 두 개로 된 경로 하나(edge pair) · **쓰는 곳** whitebox-test-designer

## 언제

`branch-condition` 은 분기 결과를 하나씩 셉니다. 그래서 「앞 분기에서 어느 쪽으로 왔는가」에 따라 다음 분기가 다르게 동작하는 결함은 덮지 못합니다. 분기 결과를 각각 한 번씩만 지나도 분기 커버리지는 100% 가 되기 때문입니다.

아래 형태가 대상에 있으면 `branch-condition` 에 **더해서** 씁니다. 대체하지 않습니다.

| 구현의 형태 | edge pair 가 세는 것 |
|---|---|
| 앞 분기가 값을 바꾸고, 바로 다음 분기가 그 값을 읽습니다 (플래그, 누적 변수, 상태 필드) | 앞 분기 결과마다 다음 분기의 각 결과 |
| 루프가 있습니다 | 루프 머리에서 0회 진입, 1회 뒤 탈출, 2회 이상 반복 |
| 자기 자신으로 돌아가는 간선(self-loop)이 있습니다 | 그 간선을 두 번 연달아 지나는 경로 |

## 규칙

1. 대상의 CFG 를 **basic block 단위**로 세웁니다. 이어진 문장은 한 노드로 합칩니다. 문장 단위로 세우면 두 분기 사이에 노드가 끼어 edge pair 가 두 분기를 잇지 못합니다.
2. Ammann & Offutt 의 정의는 「도달 가능한 길이 2 이하의 경로 전부」입니다. 길이 0, 1 경로는 `branch-condition` 이 이미 셉니다. 여기서는 길이 2 경로만 Coverage Item 으로 만듭니다.
3. **들어오는 간선이 2개 이상이고 나가는 간선도 2개 이상인 노드만 셉니다.** 들어오는 간선이 1개인 노드는 나가는 간선을 지나면 그 앞 간선도 반드시 지난 것이고, 나가는 간선이 1개인 노드도 같은 이유로 edge pair 가 간선 커버리지에서 따라 나옵니다. 그런 쌍은 새로 세는 것이 없습니다.
4. 남은 노드마다 `(들어오는 간선, 나가는 간선)` 조합 하나가 Coverage Item 하나입니다. 노드 하나에서 「들어오는 간선 수 x 나가는 간선 수」만큼 나옵니다.
5. Coverage Item 의 `description` 은 노드 번호가 아니라 **분기 결과의 순서**로 씁니다. 「`P1` 거짓으로 합류한 뒤 `P2` 참」처럼 씁니다.
6. 케이스의 `basisRefs` 에는 세 노드의 줄을 순서대로 모두 넣습니다. 첫 간선을 만든 분기 줄, 가운데 노드의 분기 줄, 두 번째 간선이 닿는 줄입니다.

### Test Condition 과 pins

edge pair 하나는 predicate 두 개에 걸칩니다. Test Condition 은 **가운데 노드의 predicate** 를 기준으로 하나 만들고, 그 Condition 아래에 들어오는 쪽 분기 결과별로 Coverage Item 을 둡니다.

케이스의 `pins` 는 두 predicate 의 class 중 더 강한 쪽입니다. 순서는 `business-rule` > `defensive` > `infrastructural` 입니다. 둘 중 하나라도 `business-rule` 이면 그 케이스는 사람이 확인하기 전까지 회귀 시험으로 들어가지 않습니다.

### 도달할 수 없는 쌍

두 분기가 같은 값을 다시 판정하면 일부 쌍은 어떤 입력으로도 지날 수 없습니다. 케이스를 만들지 않고 Coverage Item 은 남깁니다. `notes` 에 `issue: infeasible-edge-pair` 로 기록하고, `detail` 에 두 predicate 가 왜 같이 성립할 수 없는지 적습니다.

이 Note 가 이 기법의 부산물 중 가장 쓸모 있습니다. 같은 조건을 두 번 판정하는 코드이거나, 두 번째 판정이 첫 번째 분기가 바꾼 값을 놓친 코드입니다.

### 도달 판정

케이스가 값을 돌려받았다고 해서 그 edge pair 를 지났다는 뜻은 아닙니다. 다른 경로로도 같은 종류의 값이 나옵니다. 그래서 이 기법의 케이스는 결과 종류로 `reached` 를 판정하지 않습니다.

- `basisRefs` 의 세 줄이 줄 커버리지에서 모두 실행됐으면 `reached` 입니다.
- 쌍이 루프 머리를 지나면 줄 실행 횟수로 판정합니다. 2회 이상 반복하는 쌍은 루프 몸통 줄이 2번 이상 실행돼야 합니다.
- 줄 커버리지를 켤 수 없으면 `unknown` 입니다.

<example>
basic block CFG 에서 `P1` 분기의 두 결과가 한 노드로 합류하고, 그 노드가 곧바로 `P2` 를 판정할 때.

```
Test Condition  TC-1xx
  predicate       P2 의 원문
  predicateClass  P2 의 class
  CI   P1 참으로 합류 -> P2 참
  CI   P1 참으로 합류 -> P2 거짓
  CI   P1 거짓으로 합류 -> P2 참
  CI   P1 거짓으로 합류 -> P2 거짓
```

`branch-condition` 은 케이스 두 개(`P1 참 ∧ P2 참`, `P1 거짓 ∧ P2 거짓`)로 네 분기 결과를 다 덮습니다. edge pair 는 나머지 두 조합도 요구합니다. `P1` 참 쪽이 `P2` 가 읽는 값을 바꿔서 `P1 참 ∧ P2 거짓` 이 불가능하면 그 Coverage Item 은 `infeasible-edge-pair` Note 로 남습니다.
</example>

## 다른 기법과의 관계

- **포함하는 것**: `wb-edge-coverage.md` (edge-coverage)와 `wb-node-coverage.md` (node-coverage)를 포함합니다. edge pair 를 다 지나면 그 안의 간선과 노드도 다 지납니다. beaker 의 `wb-branch-condition.md` 중 분기 결과 부분도 포함합니다. 원자 조건 단위의 결과는 포함하지 않습니다.
- **포함되는 것**: `wb-complete-path-coverage.md` (complete-path-coverage)에 포함됩니다.
- **prime path 와는 비교할 수 없습니다**: `wb-prime-path-coverage.md` (prime-path-coverage)는 self-loop 가 없는 그래프에서만 edge-pair 를 포함합니다. self-loop 가 있으면 edge-pair 가 요구하는 `[n, n, n]` 같은 경로는 simple path 가 아니라서 prime path 에 들어가지 않습니다. 반대로 edge-pair 는 길이 3 이상의 prime path 를 요구하지 않습니다.
- **state-transition 과 같은 기준입니다**: 상태 그래프에 적용한 edge-pair 는 1-switch coverage(all transition pairs)와 같습니다. 명세의 상태 머신에 이 기준을 쓰려면 `bb-state-transition.md` 의 switch 수준을 올리는 쪽으로 쓰고, 블랙박스 설계자가 이 Technique 값을 쓰지 않습니다.
- **조건 쪽 기준과는 다른 축입니다**: `wb-mcdc.md`, `wb-multiple-condition-coverage.md` 는 한 결정 안의 원자 조건 조합을 봅니다. edge-pair 는 서로 다른 결정 사이의 순서를 봅니다. 서로를 포함하지 않습니다.
- **data flow 와 겹칩니다**: 앞 분기가 쓴 값을 다음 분기가 읽는 경우는 `wb-all-uses.md` (all-uses)의 def-use 쌍과 같은 결함을 겨냥합니다. all-uses 는 사이에 노드가 몇 개 끼어도 쌍을 잇고, edge-pair 는 바로 이웃한 분기만 잇습니다.

## beaker 통합

- **verdict**: technique. 화이트박스 설계자만 씁니다. `Technique` 값은 `edge-pair-coverage` 입니다.
- **쓰는 때**: 기본 기법이 아닙니다. 위 「언제」 표의 형태가 대상에 있을 때 `branch-condition` 에 더합니다.
- **Coverage Item 단위**: 들어오는 간선과 나가는 간선이 각각 2개 이상인 노드에서의 `(들어오는 간선, 나가는 간선)` 조합 하나.
- **비용**: 해당 노드마다 「들어오는 간선 수 x 나가는 간선 수」 만큼 늘어납니다. 분기가 길게 이어진 함수에서는 `branch-condition` 보다 Coverage Item 이 몇 배가 됩니다.
- **한계**: 바로 이웃한 두 간선만 봅니다. 두 분기 사이에 분기가 하나 더 끼면 앞 분기와 뒤 분기의 상호작용은 잡지 못합니다. CFG 를 머릿속으로 세우므로 basic block 경계를 잘못 잡으면 Coverage Item 이 빠지거나 늘어납니다. 줄 커버리지 없이는 도달을 확인할 수 없습니다.

## 출처

- Paul Ammann, Jeff Offutt, 「Introduction to Software Testing」 2판, 7장 Graph Coverage. Edge-Pair Coverage 의 정의와 PPC 가 EPC 를 거의 포함하지만 self-loop 에서 예외가 생긴다는 서술.
- [CS 5154 Dealing with Loops in Graph Coverage, Cornell](https://www.cs.cornell.edu/courses/cs5154/2022fa/resources/LoopsInGraphBasedTesting.pdf): Ammann & Offutt 교재 기반 강의 자료. self-loop 노드에서 EPC 가 요구하는 경로가 prime path 가 아니라는 설명과 포함 관계 그림.
- [Rechtberger, Bures, Ahmed, Overview of Test Coverage Criteria for Test Case Generation from Finite State Machines Modelled as Directed Graphs (ICST 2022 workshop)](https://arxiv.org/pdf/2203.09604): EPC 와 1-switch coverage 가 같다는 점, EPC 가 Edge Coverage 를 포함한다는 점, PPC 와 EPC 를 비교할 수 없다는 반례.
- [Prime path coverage in GCC (arXiv 2505.14694)](https://arxiv.org/html/2505.14694v1): prime path 가 edge-pair 를 거의 포함하고 self-edge 가 예외라는 서술.
