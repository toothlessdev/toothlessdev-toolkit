# Multiple Condition Coverage (MCC)

**분류** structure-based · **Coverage Item** 결정 하나 안에서 실행 가능한 원자 조건 값 조합 하나 (단축평가 언어에서는 평가 벡터 하나) · **쓰는 곳** whitebox-test-designer 전용

ISO/IEC/IEEE 29119-4 는 같은 기법을 branch condition combination testing 이라 부르고, Ammann & Offutt 는 Combinatorial Coverage(CoC) 라 부릅니다.

## 언제

구현의 결정(decision) 하나가 원자 조건 여러 개로 이뤄지고, 그 결정의 predicate 가 `business-rule` 일 때 씁니다. 조건 하나씩 참/거짓을 보는 `branch-condition` 으로는 조합에서만 드러나는 결함(`∧` 와 `∨` 를 바꿔 쓴 것, 괄호 위치가 틀린 것)을 놓칩니다.

`defensive` · `infrastructural` predicate 에는 기본값인 `branch-condition` 을 그대로 씁니다. 조합 수가 늘어나는 비용을 도메인 규칙이 아닌 곳에 쓰지 않습니다.

## 규칙

1. 결정을 원자 조건 `P1 … Pn` 으로 쪼갭니다. 같은 변수가 두 번 나오면 각각 별개 조건입니다.
2. **평가 벡터를 열거합니다.** 단축평가(`&&`, `||`, `and`, `or` 처럼 결과가 정해지면 나머지를 평가하지 않는 연산)가 있으면, 평가되지 않은 조건은 `-` 로 둡니다. `-` 자리를 T/F 로 늘리지 않습니다. 실행으로 구별할 수 없는 조합이라 Coverage Item 이 아닙니다.
3. 단축평가가 없는 연산(비트 연산자로 쓴 불리언 결합 등)이면 2^n 조합을 전부 열거합니다.
4. **실행 불가능한 조합을 걸러냅니다.** 두 조건이 같은 변수에 묶여 동시에 참이 될 수 없으면 그 벡터는 Coverage Item 이 아닙니다. 지우지 말고 `notes` 에 `Note` 로 남깁니다. `issue` 는 `infeasible-combination`, `detail` 에는 두 조건을 묶는 관계를 적습니다.
5. 남은 벡터 하나가 Coverage Item 하나입니다. `description` 에는 벡터를 조건 원문과 함께 적습니다.
6. 케이스의 `inputs` 는 결정 앞의 early return 과 입력 검증을 통과하면서 그 벡터를 만드는 값으로 채웁니다. 조건 값이 중간 계산을 거쳐 정해지면 그 계산까지 따라가서 고릅니다.
7. 기대값은 characterization 입니다. `expectedDescription` 에 `(characterization)` 을 남기고 `pins` 는 그 결정의 `predicateClass` 입니다.

## 비용

조건이 n 개면 상한은 2^n 입니다. 단축평가 언어에서는 평가 벡터 수가 이보다 훨씬 적습니다.

- `∧` 만, 또는 `∨` 만 이어진 결정은 평가 벡터가 n+1 개입니다. MC/DC 의 최소 케이스 수와 같습니다.
- `∧` 와 `∨` 가 섞여 괄호로 묶이면 n+1 보다 많아질 수 있고, 2^n 을 넘지는 않습니다.

평가 벡터 수가 n+1 을 넘고 결정이 많아 설계 비용이 커지면 그 결정은 `mcdc` 로 내립니다. 내린 사실은 `notes` 에 `issue: mcc-downgraded` 로 남깁니다. 조용히 기준을 낮추면 리포트를 읽는 사람이 MCC 결과로 읽습니다.

## 도출 흐름

<example>
결정이 `P1 ∧ (P2 ∨ P3)` 이고 단축평가 언어이며, predicate 가 `business-rule` 일 때.

```
Test Condition
  predicate       P1 ∧ (P2 ∨ P3) 의 원문
  predicateClass  business-rule

Coverage Item  평가 벡터 하나당 하나
  CI   P1=F, P2=-, P3=-     → 결정 거짓
  CI   P1=T, P2=T, P3=-     → 결정 참
  CI   P1=T, P2=F, P3=T     → 결정 참
  CI   P1=T, P2=F, P3=F     → 결정 거짓
```

단축평가가 없으면 2^3 조합이지만, 여기서는 `P1` 이 거짓인 네 조합이 실행상 하나로 합쳐지고 `P2` 가 참인 두 조합도 하나로 합쳐져 평가 벡터는 넷입니다.
</example>

## 다른 기법과의 관계

**포함하는 것**

- `condition-coverage`(wb-condition-coverage.md), `decision-coverage`(wb-decision-coverage.md), `condition-decision-coverage`(wb-condition-decision-coverage.md): 모든 조합을 돌면 각 조건과 결정 결과가 양쪽 값을 다 가집니다.
- `mcdc`(wb-mcdc.md): MC/DC 가 요구하는 조합 쌍은 전부 조합 집합 안에 있습니다. 단축평가 언어에서는 평가 벡터 집합이 short-circuit 형태 MC/DC 의 쌍을 포함합니다. 다른 조건을 고정한 unique-cause 쌍은 단축평가에서 만들 수 없는 경우가 있고, 그 경우 MCC 도 그 쌍을 만들지 않습니다.
- `branch-condition`(wb-branch-condition.md): 같은 결정에 대해 MCC 의 Coverage Item 집합이 원자 조건 참/거짓 항목을 모두 덮습니다.

**포함하지 않는 것**

- MCC 는 결정 하나 안의 조합만 봅니다. 결정 여러 개를 잇는 흐름은 `edge-pair-coverage`(wb-edge-pair-coverage.md), `prime-path-coverage`(wb-prime-path-coverage.md) 의 몫입니다.
- 변수의 정의와 사용 관계는 `all-defs`(wb-all-defs.md), `all-uses`(wb-all-uses.md) 가 봅니다.
- `combinatorial-t-way`(bb-combinatorial-t-way.md) 를 한 결정의 조건에 t = n 으로 적용하면 MCC 와 같은 조합이 나옵니다. t < n 이면 MCC 의 부분집합입니다.

### decision-table 과의 관계

조합을 펼치는 골격은 `decision-table`(bb-decision-table.md) 과 같습니다. 조건 n 개, 최대 2^n, 불가능한 조합 제거, `-` 표기까지 겹칩니다. 다른 것은 근거와 `-` 의 뜻입니다.

| 기준 | decision-table | multiple-condition-coverage |
|---|---|---|
| Test Basis | 명세 | 구현 |
| 조건의 출처 | 명세 문장에서 읽은 조건 | 코드 결정의 원자 조건 |
| 결과의 출처 | 명세가 rule 마다 지정한 action | 현재 구현의 동작 (characterization) |
| 조합을 지우는 근거 | 명세가 말한 배타 관계 | 단축평가, 같은 변수에 묶인 조건 |
| `-` 의 뜻 | 명세상 결과가 같아 합친 rule | 실행 중 평가되지 않은 조건 |
| 범위 | rule 하나가 코드의 여러 결정에 걸칠 수 있음 | 결정 하나 |
| 결과가 비어 있을 때 | `ambiguities` | 해당 없음. 구현이 항상 무언가를 함 |

명세의 논리식에 MCC 를 적용한 것은 압축하지 않은 decision-table 과 같습니다. 그래서 블랙박스 쪽에는 MCC 를 따로 두지 않고 decision-table 로 씁니다.

두 기법이 같은 논리를 서로 다른 근거로 세면 신호가 납니다.

- decision-table rule 이 기대한 결과와 MCC 벡터의 현재 동작이 다르면, 그 BB 케이스가 `fail` 로 드러나 `requirement-implementation-discrepancy` 가 됩니다.
- 코드 결정에는 있는데 명세 조건 어디에도 대응하지 않는 원자 조건은 `unexplained-implementation-behavior` 후보입니다.

두 쪽의 Coverage Item 을 합치지 않습니다. Requirement Coverage 와 Structural Coverage 는 다른 질문에 답하는 숫자입니다.

## beaker 통합

- **verdict**: technique. `Technique` 값은 `multiple-condition-coverage` 입니다.
- **설계자**: whitebox-test-designer 만 씁니다. 블랙박스 설계자가 이 기법을 쓸 수 있다면 구현이 payload 에 샌 것입니다.
- **Coverage Item 단위**: 결정 하나의 실행 가능한 평가 벡터 하나. 실행 불가능한 벡터는 `notes` 로 갑니다.
- **predicate 분류**: 결정 전체가 Test Condition 하나이고, `predicate` 에는 결정 원문, `predicateClass` 에는 결정의 분류를 적습니다. 원자 조건마다 class 가 다르면 결정 안에서 가장 강한 class(`business-rule` 우선)를 씁니다.
- **reach**: 줄 커버리지는 결정 줄이 실행됐는지만 보여 주고 어느 벡터였는지는 보여 주지 않습니다. 러너가 조건 단위 커버리지를 주지 못하면 벡터 단위 도달은 `unknown` 입니다.
- **한계**: 결정 사이의 상호작용은 보지 않습니다. 조건 값이 중간 계산에 숨어 있으면 입력으로 벡터를 만들기 어렵고, 그 벡터는 `unreached` 로 남기 쉽습니다.

## 출처

- Hayhurst, Veerhusen, Chilenski, Rierson. A Practical Tutorial on Modified Condition/Decision Coverage. NASA/TM-2001-210876, 2.3.6 Multiple Condition Coverage, 3.6 MC/DC with Short Circuit Logic. https://shemesh.larc.nasa.gov/fm/papers/Hayhurst-2001-tm210876-MCDC.pdf
- ISO/IEC/IEEE 29119-4:2021, 용어 절의 branch condition combination testing 정의, 5.3.5 Branch condition combination testing, 6.3.5 coverage. 목차와 정의는 공개 미리보기에서 확인 https://cdn.standards.iteh.ai/samples/79430/6c93dfe4a05b46a8895e04dfd74ddd24/ISO-IEC-IEEE-29119-4-2021.pdf
- Ammann & Offutt, Introduction to Software Testing, Logic Coverage 장의 Combinatorial Coverage(CoC). 강의 자료로 정의 확인 https://www.cs.cornell.edu/courses/cs5154/2021fa/resources/LogicCoverage.pdf
