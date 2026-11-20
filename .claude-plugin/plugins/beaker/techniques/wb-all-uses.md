# All-Uses Coverage

**분류** structure-based (data-flow) · **Coverage Item** 각 def-use 쌍. p-use 는 분기 결과마다 따로 · **쓰는 곳** whitebox-test-designer 전용

블랙박스 설계자는 이 기법을 쓰지 않습니다. 변수가 어디서 정의되고 어디서 쓰이는지는 구현에만 있습니다.

## 언제

branch-condition 은 분기 결과를 하나씩 셉니다. 그래서 「앞 분기에서 다시 정의된 값이 뒤 분기에 도착했을 때만 틀리는」 결함은 분기 결과를 전부 덮어도 놓칠 수 있습니다. all-uses 는 **어느 정의의 값이 어느 사용 지점에 도착했는가**를 셉니다.

아래 형태가 있으면 branch-condition 에 **더해서** 씁니다. 대체하지 않습니다.

- 같은 변수가 서로 다른 경로에서 다시 정의되고, 그 뒤에 같은 사용 지점이 있습니다
- 정의 지점과 사용 지점 사이에 분기나 루프가 있습니다
- 루프 안에서 정의된 값이 다음 반복이나 루프 밖에서 쓰입니다

직선 코드처럼 사용 지점마다 도달하는 정의가 하나뿐이면 node-coverage 와 차이가 없습니다. 그런 변수는 쌍을 만들지 않아도 됩니다.

## 용어

| 용어 | 뜻 |
|---|---|
| def | 변수에 값이 들어가는 지점. 대입, 복합 대입, 파라미터 진입, 구조 분해, 루프 변수 갱신 |
| c-use | 계산, 반환, 호출 인자, 출력에 값이 쓰이는 지점 |
| p-use | 분기 조건에 값이 쓰이는 지점. 분기의 나가는 간선(결과)마다 다른 사용으로 셉니다 |
| def-clear path | 시작 노드 이후로 그 변수를 다시 정의하는 노드가 없는 경로 |
| du-pair | def 에서 def-clear path 로 닿을 수 있는 use 하나와 그 def 의 묶음 |
| kill | 그 쌍의 def-clear path 를 끊는 재정의 지점 |

## 규칙

1. **변수마다 def 와 use 를 전부 열거합니다.** 범위는 대상 함수 안의 지역 변수와 파라미터입니다. 필드, 전역, alias 가 있는 참조는 쌍을 만들지 않고 `notes` 에 범위 밖으로 남깁니다.
2. **각 def 에서 def-clear path 로 닿는 use 마다 Coverage Item 하나를 만듭니다.** p-use 는 결과(참, 거짓, 다중 분기의 각 갈래)마다 따로 만듭니다. 이 분리가 있어야 all-uses 가 분기 결과까지 포함합니다.
3. **Coverage Item 에 kill 지점을 적습니다.** executor 가 그 케이스가 def-clear path 를 지났는지 판정하는 근거입니다.
4. **케이스의 `preconditions` 에 def 에서 use 까지 지나야 할 경로를 적고, `inputs` 는 그 경로를 강제하는 값으로 채웁니다.** use 지점까지 닿아도 중간에 kill 을 지나면 그 쌍은 덮인 것이 아닙니다.
5. **어떤 입력으로도 def-clear path 를 지날 수 없는 쌍은 케이스를 만들지 않습니다.** `notes` 에 `issue: infeasible-du-pair` 로 남기고, Coverage Item 은 지우지 않습니다. 구조상 경로는 있지만 조건이 서로 배타적인 경우가 대부분입니다.
6. **이상 패턴은 `notes` 로 보냅니다.** use 가 하나도 없는 def 는 `dead-definition`, def 없이 닿는 use 는 `use-before-def` 입니다. 커버리지 항목은 아니지만 사람이 볼 가치가 있습니다.
7. **predicate 분류는 branch-condition 과 같습니다.** p-use 쌍은 그 분기 predicate 의 class 를 따릅니다. c-use 쌍은 그 값이 무엇을 결정하는지로 분류합니다. 결과 값이나 도메인 판정을 만들면 `business-rule`, 입력 정리나 오류 처리면 `defensive` 입니다.
8. **기대값은 characterization 입니다.** `expectedDescription` 에 `(characterization)` 을 남깁니다.

<example>
변수 `V1` 이 `S1` 에서 정의되고, `P1` 이 참이면 `S2` 에서 다시 정의되고, 그 뒤 `P2` 의 조건과 `S3` 의 계산에서 쓰일 때.

```
du-pair (V1)                              kill
  CI-101  S1 -> P2 참                      S2
  CI-102  S1 -> P2 거짓                    S2
  CI-103  S1 -> S3                         S2
  CI-104  S2 -> P2 참                      -
  CI-105  S2 -> P2 거짓                    -
  CI-106  S2 -> S3                         -
```

케이스 두 개 `(P1 참, P2 참)`, `(P1 거짓, P2 거짓)` 으로 `P1`, `P2` 의 분기 결과는 전부 덮입니다. 그런데 이 둘은 CI-104, CI-106, CI-102, CI-103 만 덮습니다. CI-101 (`S1` 의 값이 `P2` 참 쪽으로 가는 경우)과 CI-105 는 남습니다. 「`P1` 을 건너뛴 값으로 `P2` 가 참이 될 때만 틀리는」 결함이 여기 숨습니다.
</example>

## 다른 기법과의 관계

- **포함합니다**: all-defs (`wb-all-defs.md`). def 마다 use 하나가 아니라 닿는 use 전부를 요구하기 때문입니다.
- **포함됩니다**: all-du-paths (`wb-all-du-paths.md`). all-uses 는 쌍마다 def-clear path 하나를, all-du-paths 는 쌍마다 cycle-free 이거나 simple cycle 인 def-clear path 전부를 요구합니다. prime-path-coverage (`wb-prime-path-coverage.md`) 와 complete-path-coverage (`wb-complete-path-coverage.md`) 는 du-path 가 simple path 라서 구조상 all-du-paths 를 거쳐 all-uses 를 포함합니다. 단, infeasible 경로를 빼면 이 관계가 깨질 수 있습니다.
- **edge-coverage (`wb-edge-coverage.md`) 와**: p-use 를 분기 결과마다 세고(규칙 2), 모든 분기 조건이 어떤 변수를 쓴다면 all-uses 가 edge-coverage 를 포함합니다. p-use 를 노드 단위로만 세면 포함하지 않습니다. 그래서 규칙 2 를 지킵니다.
- **branch-condition (`wb-branch-condition.md`), decision-coverage (`wb-decision-coverage.md`) 와 겹칩니다**: p-use 쌍의 Coverage Item 은 분기 결과 항목과 같은 실행으로 덮이는 경우가 많습니다. 다른 점은 「어느 def 의 값으로」 그 결과에 닿았는가입니다.
- **mutation-testing (`wb-mutation-testing.md`) 과 다른 축입니다**: all-uses 는 경로를 세고 단언의 강도는 보지 않습니다.

## beaker 통합

- **verdict**: technique. `Technique` 값은 `all-uses` 입니다.
- **쓰는 설계자**: whitebox-test-designer. 위 「언제」의 형태가 있을 때 branch-condition 에 더합니다.
- **Coverage Item 단위**: `(변수, def 위치, use 위치, use 종류, p-use 면 분기 결과)` 하나. `description` 에 실제 변수 이름과 `파일경로:행번호` 를 씁니다.
- **TestCondition 단위**: 변수 하나 또는 def 하나. `basisRefs` 에 def 위치를 넣습니다.
- **필요한 스키마 변경**: `CoverageItem` 에 data-flow 항목용 선택 필드(변수, def, use, use 종류, 분기 결과, kill 목록)를 둡니다. 데이터 흐름 항목은 `counted` 를 `reach = reached` 로 좁힙니다. 지금 식은 `unknown` 도 세는데, def-clear 여부는 결과 종류만 보고 판정할 수 없기 때문입니다.
- **reach 판정**: def 줄과 use 줄이 실행됐고 kill 줄이 실행되지 않았으면 `reached` 입니다. kill 줄이 실행됐는데 실행 순서를 알 수 없으면 `unknown` 입니다. use 줄이 실행되지 않았으면 `unreached` 입니다. 줄 커버리지를 켤 수 없는 러너에서는 대부분 `unknown` 이 되고 커버리지에 들어가지 않습니다.
- **incident**: 새 incident 종류를 만들지 않습니다. 명세 근거 없는 `business-rule` p-use 는 branch-condition 쪽에서 이미 후보가 됩니다.
- **비용**: 쌍의 수는 변수마다 대략 def 수 곱하기 use 수이고, p-use 는 분기 결과 수만큼 곱해집니다. 함수 하나에서는 감당할 만하지만 긴 함수에서는 빠르게 늘어납니다. 규칙 1 의 범위 제한과 「언제」의 적용 조건으로 줄입니다.
- **한계**: infeasible 쌍 판정은 일반적으로 결정 불가능합니다. 설계자가 못 찾은 경로와 실제로 없는 경로를 구분하지 못합니다. 그래서 지우지 않고 `notes` 로 남깁니다. 필드와 alias 를 빼므로 객체 상태를 거치는 데이터 흐름 결함은 이 기법으로 잡히지 않습니다.

## 출처

- S. Rapps, E. J. Weyuker, 「Selecting Software Test Data Using Data Flow Information」, IEEE Transactions on Software Engineering, SE-11(4), 1985. 원 정의(c-use, p-use, all-uses). 본문은 열어 보지 못했고 서지 정보만 확인했습니다.
- P. Ammann, J. Offutt, 「Introduction to Software Testing」, data flow 기반 graph coverage 장. All-Defs, All-Uses, All-du-Paths 의 du-path 집합 정의.
- [University of Waterloo ECE 653, Dataflow Coverage 강의 자료](https://ece.uwaterloo.ca/~agurfink/ece653/assets/pdf/W04-DataflowCoverage.pdf): AUC 를 「각 def 에서 닿는 각 use 와 그 use 의 각 후속 노드까지」로 정의, AUC 가 edge coverage 를 포함하는 조건, infeasible path 때문에 100% 가 잘 나오지 않는다는 한계.
- [York University EECS 4313, Dataflow Testing 강의 자료](https://www.eecs.yorku.ca/course_archive/2009-10/W/4313/slides/09-DataFlowTesting.pdf): def, c-use, p-use, dc-path 정의와 All-Defs, All-Uses, All-P-uses/Some-C-uses 기준.
