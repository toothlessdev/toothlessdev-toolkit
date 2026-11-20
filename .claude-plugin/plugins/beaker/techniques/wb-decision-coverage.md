# Decision Coverage

**분류** structure-based · **Coverage Item** 각 결정(decision)의 결과 하나 · **쓰는 곳** 생성기로 쓰지 않습니다. 기준 계층 문서이고, 결정 결과 Coverage Item 은 `branch-condition` 이 만듭니다

## 언제

결정은 조건(Boolean 연산자가 없는 Boolean 식) 0개 이상을 Boolean 연산자로 묶은 식 전체입니다. Decision Coverage 는 이 식 전체가 참과 거짓을 각각 한 번 이상 내는지만 봅니다. 식 안의 원자 조건은 보지 않습니다.

beaker 에서 이 문서를 읽는 때는 두 가지입니다.

- 화이트박스 설계자가 `branch-condition` 으로 Coverage Item 을 만들 때, 결정 결과 항목을 빠뜨리지 않았는지 확인할 때
- 리포트에서 「결정 단위로는 다 덮었는가」를 원자 조건 단위와 따로 말해야 할 때

이 기준 하나만으로 Coverage Item 을 만들지 않습니다. 이유는 「beaker 통합」 절에 있습니다.

## 규칙

1. **결정을 전부 열거합니다.** 조건 분기, 루프 진입과 탈출, 다중 분기(switch, case), 삼항 연산이 결정입니다. 분기 지점이 아닌 곳의 Boolean 식(Boolean 변수에 대입하는 식, Boolean 을 반환하는 식)도 결정입니다. DO-178B/C 의 정의가 이렇고, 이 점에서 결정은 분기 지점과 같은 말이 아닙니다.
2. **결정의 가능한 결과마다 Coverage Item 하나입니다.** 2방향 결정은 참과 거짓 두 개, N방향 다중 분기는 N개입니다.
3. **복합 결정도 결과는 둘입니다.** `P1 ∧ P2` 는 Coverage Item 이 「식 전체 참」, 「식 전체 거짓」 두 개뿐입니다. `P1`, `P2` 각각의 참·거짓은 이 기준의 항목이 아닙니다.
4. **결정이 없는 대상도 케이스 하나는 요구합니다.** ISO/IEC/IEEE 29119-4 가 결정이 없을 때 테스트 하나로 100% 라고 정합니다.
5. **세는 법은 결과 단위입니다.** 29119-4 의 decision testing coverage 는 「덮은 결정 결과 수 / 전체 결정 결과 수」입니다. 결정 하나의 결과를 다 덮어야 그 결정을 1로 세는 DO-178 도구식 계산과 다르고, beaker 는 29119-4 방식을 따릅니다.

## 한계

단축평가 때문에 평가되지 않는 원자 조건이 있어도 Decision Coverage 는 100% 가 됩니다. `P1 ∧ P2` 에서 (`P1` 참, `P2` 참) 과 (`P1` 거짓) 두 케이스면 결정 결과는 둘 다 나오지만 `P2` 가 거짓인 경우는 한 번도 실행되지 않습니다. 이 두 케이스로는 `P1 ∧ P2` 와 `P1` 을 구분하지 못합니다.

<example>
결정이 `P1 ∨ P2` 이고 그 결과로 경로가 갈릴 때.

```
Decision Coverage 항목
  CI   결정 참     (P1 참, P2 거짓) 으로 덮임
  CI   결정 거짓   (P1 거짓, P2 거짓) 으로 덮임
  → 100%

같은 두 케이스로 본 원자 조건
  P1 참, P1 거짓  덮임
  P2 참           덮이지 않음
```

Decision Coverage 는 100% 인데 `P2` 를 지워도 두 케이스 모두 결과가 같습니다. `branch-condition` 은 `P2 참` 을 별도 항목으로 세므로 이 빈칸이 리포트에 남습니다.
</example>

## 다른 기법과의 관계

- **포함합니다**: `node-coverage` (wb-node-coverage.md). 모든 결정 결과를 실행하면 결정 뒤의 문장도 실행됩니다. 결정이 없는 코드는 규칙 4의 케이스 하나가 문장을 덮습니다.
- **거의 같습니다**: `edge-coverage` (wb-edge-coverage.md). 논리 커버리지 강의 자료가 Decision Coverage 를 CFG 의 edge coverage 에 대응시킵니다. 차이는 두 가지입니다. edge 는 무조건 간선도 세고, 결정은 분기 지점이 아닌 Boolean 식도 셉니다.
- **포함되는 쪽**: `condition-decision-coverage` (wb-condition-decision-coverage.md), `mcdc` (wb-mcdc.md), `multiple-condition-coverage` (wb-multiple-condition-coverage.md). 세 기준 모두 결정 결과 참·거짓을 요구 사항에 포함하거나 함축합니다. 그래프 쪽에서는 `edge-pair-coverage` (wb-edge-pair-coverage.md), `prime-path-coverage` (wb-prime-path-coverage.md), `complete-path-coverage` (wb-complete-path-coverage.md) 가 edge 를 거쳐 이 기준을 포함합니다.
- **서로 포함하지 않습니다**: `condition-coverage` (wb-condition-coverage.md). (`P1` 참, `P2` 거짓) 과 (`P1` 거짓, `P2` 참) 은 `P1 ∨ P2` 의 조건 커버리지를 채우지만 결정은 계속 참입니다.
- **기존 `branch-condition` (wb-branch-condition.md)**: 이름의 출처인 29119-4 의 branch condition testing 은 「조건의 Boolean 값 + 결정 결과」를 함께 셉니다. 즉 condition/decision coverage 이고 Decision Coverage 를 포함합니다. 그런데 현재 wb-branch-condition.md 의 예시는 원자 조건마다 Test Condition 을 나누고 결정 전체의 참·거짓 항목을 따로 두지 않습니다. 규칙 2(분기 결과)와 규칙 3(원자 조건)이 함께 적용된다는 점을 문서에 명시해야 포함 관계가 실제로 성립합니다.
- **명세 쪽**: 명세의 논리식에 이 기준을 적용하면 「식이 참인 입력 하나, 거짓인 입력 하나」입니다. `equivalence-partitioning` (bb-equivalence-partitioning.md) 의 두 파티션과 같고, 완전한 `decision-table` (bb-decision-table.md) 과 `cause-effect-graph` (bb-cause-effect-graph.md) 가 이를 포함합니다.

## beaker 통합

- **verdict**: `criterion-only`. `Technique` enum 에 `decision-coverage` 를 넣지 않습니다.
- **이유 1, 분모 중복**: Coverage Item 은 기법별로 만들어지고 `coverage(code)` 는 그 수를 그대로 분모로 씁니다. 같은 결정의 참·거짓을 `decision-coverage` 와 `branch-condition` 이 각각 만들면 같은 결과가 분모에 두 번 들어가고, 한 케이스가 두 항목을 덮어 수치만 커집니다.
- **이유 2, 더 약한 기준을 생성기로 둘 이유가 없음**: 화이트박스 설계자의 기본 기법인 `branch-condition` 이 이미 결정 결과를 포함하는 기준입니다. Decision Coverage 를 따로 고를 상황은 비용을 줄이려 원자 조건을 포기할 때인데, LLM 설계자에게 항목 몇 개를 줄이는 이득은 작고 단축평가 빈칸이라는 손실은 큽니다.
- **이유 3, 블랙박스에서 새 항목이 없음**: 명세 논리식의 참·거짓은 EP 와 decision-table 이 이미 만듭니다.
- **쓰는 곳**: 생성기가 아니라 `branch-condition` 이 만든 항목 중 결정 결과 항목만 골라 보는 기준입니다. 리포트가 결정 단위 커버리지를 원자 조건 단위와 나눠 보여 줄 수 있게 하려면 CoverageItem 에 결정 결과 항목인지 원자 조건 항목인지 표시가 필요합니다(반환값의 schemaChanges).
- **reach 와의 관계**: 결정 결과 항목도 `counted(case)` 규칙을 그대로 따릅니다. 목표 결정 앞의 early return 에서 끝난 케이스는 그 결정의 결과를 덮지 않습니다.
- **비용**: 2방향 결정마다 최소 2개, N방향 다중 분기는 N개입니다. 조건 수와 무관합니다.
- **한계**: 단축평가로 가려진 조건, 같은 결과를 내는 다른 식과의 구분(`P1 ∨ P2` 와 `P1`)을 보장하지 않습니다. 이 기준이 100% 라는 사실만으로 결정 로직을 검증했다고 리포트에 쓰지 않습니다.

## 출처

- ISO/IEC/IEEE 29119-4:2015, 5.3.3 Decision Testing, 5.3.4 Branch Condition Testing, 6.3.3 Decision Testing Coverage, 6.3.4 Branch Condition Testing Coverage, 부록 C.2.2 Branch / Decision Testing
- Hayhurst, Veerhusen, Chilenski, Rierson, 「A Practical Tutorial on Modified Condition/Decision Coverage」, NASA/TM-2001-210876, 2.3절과 2.5절: https://shemesh.larc.nasa.gov/fm/papers/Hayhurst-2001-tm210876-MCDC.pdf
- Ammann & Offutt, 「Introduction to Software Testing」 2판, 8장 Logic Coverage 의 Predicate Coverage
- 논리 커버리지 강의 자료(Decision Coverage 와 edge coverage 의 대응): https://ece.uwaterloo.ca/~agurfink/stqam.w20/assets/pdf/W03-LogicCoverage.pdf
- Bullseye, 「Code Coverage Analysis」, Decision Coverage 절: https://bullseye.com/coverage.html
- Rapita Systems, decision coverage 와 branch coverage 의 차이 글: https://www.rapitasystems.com/difference-between-decision-coverage-and-branch-coverage
