# Edge (Branch) Coverage

**분류** structure-based, 기준 계층 문서 · **Coverage Item** control flow graph 의 도달 가능한 각 간선(edge) · **쓰는 곳** 생성기로 쓰지 않습니다. `branch-condition` 이 만든 구조 커버리지가 이 기준을 채우는지 판단하는 기준으로만 씁니다

`technique` 필드에 `edge-coverage` 를 쓰지 않습니다. 같은 간선을 `branch-condition` 이 이미 Coverage Item 으로 세고 있어서, 별도 enum 을 두면 같은 간선이 구조 커버리지 분모에 두 번 들어갑니다.

## 언제

화이트박스 설계 결과가 「모든 분기 방향을 한 번씩 지났는가」를 따질 때 이 문서를 기준으로 씁니다. 대상이 control flow graph 로 그려지고, 분기 한쪽(특히 `else` 가 없는 `if` 의 거짓 쪽, `switch` 의 빠진 case, 루프 미진입)을 처리하지 않은 결함이 의심될 때가 해당합니다.

## 규칙

1. **간선을 셉니다.** 대상의 control flow graph 에서 도달 가능한 간선 하나가 Coverage Item 하나입니다. Ammann & Offutt 의 정의는 「길이 1 이하의 도달 가능한 경로 전부」입니다.
2. **조건이 붙은 간선만 Coverage Item 으로 만듭니다.** 후속 노드가 하나뿐인 간선은 출발 노드가 실행되면 반드시 지나므로, 노드가 실행됐는지와 같은 질문입니다. 따로 세지 않습니다.
3. **조건이 붙은 간선의 종류**는 아래가 전부입니다.
   - 두 갈래 분기의 참 간선과 거짓 간선. `else` 가 없어도 거짓 간선은 있습니다
   - 다중 분기의 case 간선마다 하나, default 간선 하나. default 가 코드에 없어도 간선은 있습니다
   - 루프 조건의 진입 간선과 탈출 간선
   - early return, `throw`, `catch` 로 가는 간선
4. **암묵 예외 간선은 세지 않습니다.** 모든 호출이 예외를 던질 수 있다고 보면 간선 수가 호출 수만큼 늘어나고 대부분은 도달 조건을 만들 수 없습니다. 코드에 `throw`, `catch`, 실패 반환이 적힌 곳만 셉니다.
5. **분기가 하나도 없으면 Coverage Item 은 하나입니다.** 진입에서 종료까지 한 번 실행하는 항목입니다. 「길이 1 이하」의 「이하」가 이 경우를 위한 것이고, ISO/IEC/IEEE 29119-4 도 분기가 없는 test item 에 테스트 하나를 요구합니다.
6. **복합 조건이면 결정 전체의 간선을 원자 조건과 따로 셉니다.** 원자 조건의 참/거짓을 전부 덮어도 결정 결과가 한쪽으로만 나올 수 있습니다. 단축평가를 하지 않는 연산자를 쓰거나 결정 결과를 변수에 먼저 담은 코드에서 이런 일이 생깁니다.
7. **도달할 수 없는 간선**은 Coverage Item 으로 남기고 케이스를 만들지 않습니다. `notes` 에 `issue: unreachable-branch` 로 도달을 막는 선행 조건을 적습니다.

<example>
결정 `D` 가 원자 조건 `P1`, `P2` 를 단축평가 없이 묶은 `P1 ∧ P2` 일 때.

```
원자 조건 CI      P1 참 / P1 거짓 / P2 참 / P2 거짓
결정 간선 CI      D 참 간선 / D 거짓 간선

케이스 S1   P1 참,   P2 거짓   ->  D 거짓
케이스 S2   P1 거짓, P2 참     ->  D 거짓
```

`S1`, `S2` 로 원자 조건 CI 네 개는 전부 덮이지만 `D` 참 간선은 한 번도 지나지 않습니다. 원자 조건 CI 만 세면 이 상태가 구조 커버리지 100% 로 보입니다. 결정 간선 CI 를 따로 두면 `D` 참 간선이 덮이지 않은 항목으로 남습니다.
</example>

## 잡는 결함과 놓치는 결함

- **잡습니다**: 분기 한쪽을 처리하지 않은 결함. `else` 없는 `if` 의 거짓 쪽에서 값이 초기화되지 않는 경우, `switch` 의 default 누락, 루프에 한 번도 들어가지 않을 때의 처리 누락
- **놓칩니다**: 앞 분기 결과가 뒤 분기에 영향을 주는 결함. 간선마다 한 번씩만 지나면 되므로 간선 조합은 보지 않습니다. 이 결함은 `edge-pair-coverage` 와 `prime-path-coverage` 가 다룹니다
- **놓칩니다**: 루프를 여러 번 돌 때만 드러나는 결함. 진입 간선과 탈출 간선을 한 번씩 지나면 끝납니다
- **놓칩니다**: 원자 조건 하나가 결정 결과를 혼자 바꾸는지. 이건 `mcdc` 의 몫입니다

## 다른 기법과의 관계

| 관계 | 기법 | 근거 |
|---|---|---|
| 포함합니다 | `node-coverage` (wb-node-coverage.md) | 길이 0 경로(노드)를 Coverage Item 에 포함하므로 간선을 다 덮으면 노드도 다 덮입니다. 반대는 성립하지 않습니다 |
| 같습니다 | `decision-coverage` (wb-decision-coverage.md) | 결정의 각 결과가 곧 조건이 붙은 간선입니다. 모든 노드가 도달 가능하고, 결정이 없는 대상에도 테스트 하나를 요구하면 두 기준이 요구하는 테스트 집합이 같습니다 |
| 포함되지 않고 포함하지도 않습니다 | `condition-coverage` (wb-condition-coverage.md) | 위 예시처럼 원자 조건을 다 덮어도 간선이 남고, 간선을 다 덮어도 원자 조건 값이 남습니다 |
| 포함됩니다 | `condition-decision-coverage` (wb-condition-decision-coverage.md), `mcdc` (wb-mcdc.md), `multiple-condition-coverage` (wb-multiple-condition-coverage.md) | 셋 다 결정의 모든 결과를 요구에 포함합니다 |
| 포함됩니다 | `edge-pair-coverage` (wb-edge-pair-coverage.md), `prime-path-coverage` (wb-prime-path-coverage.md), `complete-path-coverage` (wb-complete-path-coverage.md) | 길이 2 경로, prime path, 모든 경로는 각각 길이 1 이하 경로를 전부 지나야 채워집니다 |
| 겹칩니다 | `branch-condition` (wb-branch-condition.md) | 그 문서의 규칙 2(결정 수준 Test Condition 의 결과 항목)가 이 기준의 조건이 붙은 간선과 같은 단위입니다. 규칙 3(원자 조건 값)은 `condition-coverage` 정의를 따릅니다 |

## beaker 통합

- **verdict**: criterion-only. `Technique` enum 에 넣지 않습니다.
- **쓰는 설계자**: `whitebox-test-designer` 가 `branch-condition` 으로 만든 Coverage Item 이 이 기준을 채우게 합니다. 블랙박스 설계자는 쓰지 않습니다
- **Coverage Item 단위**: 조건이 붙은 간선 하나. 분기가 없는 대상은 진입 실행 하나
- **커버리지 계산**: `schemas.md` 의 `coverage(code)` 식을 그대로 씁니다. 간선 CI 가 `counted` 가 되려면 그 케이스가 결정 노드까지 도달하고 그 간선을 실제로 지나야 합니다

**`branch-condition` 이 지금 놓치는 것** 세 가지를 그 문서와 스키마에서 고쳐야 이 기준을 채웁니다.

- 복합 조건의 결정 간선이 Coverage Item 으로 나오지 않습니다. 지금 예시는 원자 조건 CI 만 만듭니다(규칙 6)
- 분기가 없는 대상의 Coverage Item 이 0개라 분모가 비어 있습니다(규칙 5)
- 간선의 `reach` 판정 근거가 없습니다. 결정 줄은 참 간선이든 거짓 간선이든 실행되므로, 결정 줄의 줄 커버리지로는 어느 간선을 지났는지 가를 수 없습니다. `else` 없는 `if` 의 거짓 간선은 도착 줄도 참 간선과 같습니다

**비용**: Coverage Item 수는 결정 결과 수와 같고, 케이스 하나가 여러 결정의 간선을 함께 덮을 수 있어 화이트박스 기준 가운데 싼 편입니다. 간선을 덮는 입력을 찾는 비용은 앞에 있는 입력 검증과 early return 을 통과시키는 데서 대부분 나옵니다.

**한계**: 위 「놓칩니다」 세 줄이 그대로 한계입니다. 이 기준을 100% 채운 결과를 「분기 간 상호작용과 루프 횟수까지 검증했다」로 읽지 않습니다.

## 출처

- Paul Ammann, Jeff Offutt, 「Introduction to Software Testing」 2판, 7장 Graph Coverage. Edge Coverage 정의(길이 1 이하의 도달 가능한 경로), 「이하」를 둔 이유(노드 하나에 간선이 없는 그래프), Node Coverage 포함 관계
- [University of Virginia CS 3250 강의 슬라이드, Graph Coverage](http://www.cs.virginia.edu/~up3f/cs3250/slides/3250meet16-17-graph-coverage.pdf): 위 책 7장을 따른 슬라이드. EC 정의, 「up to 1」 이유, EC 와 branch coverage 대응, 그래프 기준 포함 관계 그림
- ISO/IEC/IEEE 29119-4:2015, 5.3.2 Branch Testing, 5.3.3 Decision Testing, 6.3.2, 6.3.3. branch 가 control flow 의 모든 간선(arc)을 가리킨다는 점, 분기나 결정이 없을 때 테스트 하나를 요구하는 NOTE, branch coverage 와 decision coverage 의 분모가 각각 branch 수와 decision outcome 수라는 점
