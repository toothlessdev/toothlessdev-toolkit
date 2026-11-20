# Prime Path Coverage

**분류** structure-based · **Coverage Item** 대상 CFG 의 각 prime path · **쓰는 곳** whitebox-test-designer 전용, 대상에 loop 가 있을 때

블랙박스 설계자는 이 기법을 쓰지 않습니다. CFG 는 구현에서만 나옵니다.

## 언제

`branch-condition` 은 분기 결과를 하나씩 셉니다. 그래서 loop 를 「진입/미진입」 두 결과로만 보고, 반복이 두 번 이상 이어질 때 앞 반복의 결과가 다음 반복에 영향을 주는 결함은 세지 않습니다.

prime path 는 이 빈틈을 그래프 정의로 메웁니다. 대상에 loop 가 있고, 반복 사이에 값이 이어지거나 loop body 안에 분기가 있을 때 `branch-condition` 에 **더해서** 씁니다.

loop 가 없는 대상에는 쓰지 않습니다. loop 가 없으면 prime path 는 entry 에서 exit 까지의 모든 경로와 같아지고, 연속된 분기 수에 지수적으로 늘어납니다.

## 정의

- **simple path**: 첫 노드와 마지막 노드를 빼고 같은 노드가 두 번 나오지 않는 경로입니다. 첫 노드와 마지막 노드가 같으면 cycle 입니다.
- **prime path**: 다른 simple path 의 진부분 경로가 아닌 simple path 입니다. 더 늘리면 simple 이 깨지는 최대 길이 경로입니다.
- **tour**: test path 가 prime path 를 연속된 부분 경로로 그대로 포함하면 tour 합니다.
- **sidetrip**: prime path 의 edge 가 test path 에 같은 순서로 모두 있고, 중간에 빠져나갔다가 **같은 노드로** 돌아옵니다.
- **detour**: prime path 의 node 가 test path 에 같은 순서로 모두 있고, 빠져나갔다가 **다음 노드로** 돌아옵니다. edge 하나를 건너뛸 수 있습니다.

## 규칙

1. **CFG 노드는 `"파일경로:행번호"` 로 씁니다.** 노드는 basic block 이고 그 첫 줄을 이름으로 씁니다. 복합 조건은 `branch-condition` 과 같이 원자 조건 노드로 펼칩니다.
2. **prime path 를 전부 열거합니다.** 길이 0 경로에서 시작해 한 노드씩 늘리고, 더 늘릴 수 없는 경로와 cycle 을 남긴 뒤, 다른 경로의 진부분 경로인 것을 지웁니다.
3. **한도를 넘으면 열거하지 않습니다.** prime path 수가 `primePathLimit` 를 넘으면 일부만 골라 쓰지 않습니다. `notes` 에 `prime-path-limit-exceeded` 를 남기고 그 대상은 `branch-condition` 만 씁니다. 일부만 쓰면 분모가 임의로 정해집니다.
4. **각 prime path 가 Coverage Item 하나입니다.** `description` 에 노드 순서를 그대로 적습니다.
5. **touring 은 best effort 로 합니다.** 먼저 sidetrip 없이 tour 하는 입력을 찾습니다. 그런 입력이 없을 때만 sidetrip 을 허용하고, 케이스에 sidetrip 을 썼다고 표시합니다. detour 는 edge 를 건너뛰므로 tour 로 세지 않습니다.
6. **sidetrip 으로도 실행할 수 없는 prime path 는 지우지 않습니다.** 케이스를 만들지 말고 `notes` 에 `infeasible-prime-path` 와 실행을 막는 조건을 적습니다. Coverage Item 은 분모에 남습니다.
7. **케이스 하나가 여러 prime path 를 tour 해도 됩니다.** `coverageItemRefs` 에 그 케이스가 tour 하는 Coverage Item 을 모두 겁니다.

predicate 분류, `pins`, `(characterization)` 표기는 `wb-branch-condition.md` 와 같습니다. prime path 가 지나는 predicate 중 가장 앞에 있는 `business-rule` 을 `pins` 에 적고, 없으면 `defensive` 또는 `infrastructural` 을 적습니다.

## loop 0회·1회·n회와의 관계

whitebox-test-designer 가 지금 열거하는 「loop 의 0회·1회·n회 경계」는 prime path 가 loop 하나에 대해 만드는 요구와 거의 겹칩니다. 다른 점은 두 가지입니다.

- prime path 는 「정확히 1회」를 요구하지 않습니다. 0회 케이스와 2회 이상 케이스로 loop 하나의 prime path 를 모두 tour 할 수 있습니다. 「정확히 1회」는 반복 횟수의 경계값이라는 다른 근거에서 나옵니다.
- prime path 는 body 안 분기와 반복의 조합을 셉니다. body 에 분기 `P1` 이 있으면 「이번 반복은 `P1` 참, 다음 반복은 `P1` 거짓」 같은 연속 반복 경로가 각각 Coverage Item 이 됩니다. 0회·1회·n회 열거는 이것을 세지 않습니다.

<example>
loop head `S2`, body `S3`, exit `S4`, entry `S1` 인 대상. 노드는 실제로는 `"파일경로:행번호"` 입니다.

```
CI   [S1, S2, S4]        loop 를 건너뜀 (0회)
CI   [S1, S2, S3]        loop 에 들어감
CI   [S2, S3, S2]        body 한 번 뒤 head 로 돌아옴
CI   [S3, S2, S4]        마지막 반복 뒤 빠져나감
CI   [S3, S2, S3]        반복이 두 번 이상 이어짐

case A  0회 반복 입력     tour  [S1, S2, S4]
case B  2회 이상 반복 입력  tour  나머지 넷
```

1회 반복 케이스는 이 다섯을 덮는 데 필요하지 않습니다. 1회를 따로 두려면 그 근거를 `rationale` 에 적습니다.
</example>

## 다른 기법과의 관계

- **포함하는 것**: `node-coverage`(wb-node-coverage.md), `edge-coverage`(wb-edge-coverage.md). prime path 를 모두 tour 하면 길이 0, 1 인 경로도 모두 tour 합니다.
- **거의 포함하는 것**: `edge-pair-coverage`(wb-edge-pair-coverage.md). 자기 자신으로 가는 edge(self-loop)가 있는 노드에서는 포함하지 않습니다. edge-pair 가 요구하는 `[S1, S1, S1]` 같은 경로는 simple path 가 아니라서 prime path 에 들어가지 않습니다.
- **구조상 포함하는 것**: `all-du-paths`(wb-all-du-paths.md). du-path 는 simple path 이므로 어떤 prime path 의 부분 경로입니다. 다만 실행 가능한 du-path 가 실행 불가능한 prime path 안에만 있으면 따로 덮어야 합니다. `all-uses`(wb-all-uses.md), `all-defs`(wb-all-defs.md) 도 같은 조건에서 따라옵니다.
- **포함되는 것**: `complete-path-coverage`(wb-complete-path-coverage.md). loop 가 있으면 경로가 무한하므로 complete path 는 이론적 상한일 뿐이고, prime path 가 loop 를 다루는 실무 상한입니다.
- **조건 계열**: 원자 조건 노드로 펼친 CFG 에서는 edge 를 포함하므로 `decision-coverage`(wb-decision-coverage.md) 와 단축평가 기준의 `condition-decision-coverage`(wb-condition-decision-coverage.md) 를 포함합니다. `mcdc`(wb-mcdc.md) 와 `multiple-condition-coverage`(wb-multiple-condition-coverage.md) 는 경로가 아니라 조건 값 조합을 요구하므로 이 기법의 포함 관계로 대신하지 않습니다.
- **블랙박스 쪽 대응**: 명세가 반복 횟수의 경계를 말하면 그건 `boundary-value-analysis`(bb-boundary-value-analysis.md) 의 경계입니다. prime path 는 그 경계를 대신하지 않습니다.

## beaker 통합

- **verdict**: technique. `Technique` 값은 `prime-path-coverage` 입니다. 단, 대상에 loop 가 있고 prime path 수가 한도 이하이며 러너가 케이스별 줄 실행 횟수를 낼 수 있을 때만 씁니다.
- **쓰는 설계자**: whitebox-test-designer. 블랙박스 설계자의 기법 문서 묶음에는 넣지 않습니다.
- **Coverage Item 단위**: prime path 하나. Structural Coverage 분모에 `branch-condition` 항목과 함께 들어갑니다.
- **도달 판정이 가장 큰 제약입니다.** 지금 `reach` 는 목표 줄이 실행됐는지나 기대한 종류의 결과가 나왔는지로 정합니다. 경로는 줄 집합만으로 확인되지 않습니다. 케이스를 하나씩 따로 실행해 줄별 실행 횟수를 얻으면, loop 가 없는 구간은 실행된 노드 집합이 경로를 하나로 정하고, loop 의 0회·1회·2회 이상도 head 와 body 의 실행 횟수로 가립니다. 그러나 body 안 분기의 반복 간 순서(이번 반복 `P1` 참, 다음 반복 `P1` 거짓)는 실행 횟수로 가리지 못합니다. 그런 Coverage Item 은 경로 추적 도구가 없으면 `reach: unknown` 이고, 이 기법에서는 덮인 것으로 세지 않습니다.
- **비용**: prime path 수는 연속된 분기 수에 지수적으로 늘어납니다. 설계자는 셸 없이 손으로 열거하므로 한도가 필요하고, 열거 실수가 분모를 바꿉니다. 노드 목록과 prime path 목록을 그대로 남겨 사람이 다시 셀 수 있게 합니다.
- **한계**: 실행 불가능한 prime path 가 흔하고, sidetrip 을 허용하면 기준이 약해집니다. loop 의 반복 횟수 값 자체(경계값)는 다루지 않습니다.

## 출처

- Paul Ammann, Jeff Offutt, 「Introduction to Software Testing」 2판, Cambridge University Press, 2016. Graph Coverage 장(simple path, prime path, tour, sidetrip, detour, best effort touring, 포함 관계).
- Owolabi Legunsen, 「Dealing with Loops in Graph Coverage」, Cornell CS 5154 강의 자료. https://www.cs.cornell.edu/courses/cs5154/2022fa/resources/LoopsInGraphBasedTesting.pdf (prime path 가 edge-pair 를 self-loop 에서 포함하지 않는 반례, best effort touring)
- Jørgen Kvalsvik, 「Prime path coverage in the GNU Compiler Collection」, 2025. https://arxiv.org/html/2505.14694v1 (prime path 수의 지수적 증가, 연속 if-then-else n 개에서 2^n, 경험적 결과 인용)
- GCC Instrumentation Options, `-fpath-coverage`, `-fpath-coverage-limit`. https://gcc.gnu.org/onlinedocs/gcc/Instrumentation-Options.html
- gcov `--prime-paths`, `--prime-paths-lines`, `--prime-paths-source`. https://gcc.gnu.org/onlinedocs/gcc/Invoking-Gcov.html
