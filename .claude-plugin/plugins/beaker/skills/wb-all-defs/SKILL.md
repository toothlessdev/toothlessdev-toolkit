---
name: wb-all-defs
description: 설계 기법이 아니라 data-flow 기준 계층에서 가장 약한 기준입니다. 변수의 정의(def)마다 그 값이 def-clear path 로 use 하나에 닿았는지만 묻습니다. whitebox-test-designer 출력의 all-uses 열거 누락 검사와 test-reporter 의 「use 에 닿지 않은 정의」 목록에 쓰며, technique 값으로 쓰지 않습니다.
---

# All-Defs Coverage

whitebox-test-designer 의 all-uses 출력을 검사하거나 test-reporter 가 파생 목록을 만들 때 부르는 기준입니다. `technique` 값이 없습니다.

**분류**: structure-based (data-flow).

**Coverage Item**: 변수의 정의(def) 하나. 그 값이 def-clear path 로 use 하나에 닿으면 덮입니다.

## 언제 쓰나

data-flow 기준 세 개 중 가장 약한 기준입니다. 「모든 대입이 적어도 한 번은 어딘가에서 쓰이는 것을 시험이 보았는가」만 묻습니다.

- 대입식이 틀린 결함(잘못된 계산, 잘못된 변수에 대입)은 그 값이 쓰이는 지점까지 실행돼야 드러납니다. all-defs 는 def 마다 그 실행을 최소 한 번 요구합니다.
- 분기 방향이 틀린 결함은 겨냥하지 않습니다. Rapps 와 Weyuker 는 all-defs 가 계산 결함은 잡지만 분기 결함은 놓칠 수 있고, all-edges 를 포함하지 않아서 단독으로는 충분한 기준이 아니라고 결론 냈습니다.
- 「정의만 하고 안 쓰는 값」은 시험이 아니라 def-use 열거 단계에서 정적으로 나옵니다. use 가 없는 def 는 덮을 경로가 없으므로 Coverage Item 이 되지 못하고 이상 패턴으로 보고됩니다.

## 이 기준을 쓰는 법

### 용어

| 용어 | 뜻 |
|---|---|
| def | 변수에 값이 들어가는 지점. 대입, 복합 대입, 파라미터 진입, 루프 변수 갱신 |
| use | 값이 계산·반환·호출 인자에 쓰이는 c-use, 분기 조건에 쓰이는 p-use |
| def-clear path | 변수 `V1` 에 대해, 시작과 끝 사이 어느 노드와 간선에서도 `V1` 이 다시 정의되지 않는 경로 |
| def-path set `du(S1, V1)` | `S1` 에서 `V1` 을 정의해 시작하는 du-path 전부의 집합 |

all-defs 의 요구: **def-path set `du(S1, V1)` 마다 시험 경로가 그 원소를 하나 이상 지납니다.** def 하나에 use 가 여럿이어도 그중 하나만 닿으면 됩니다.

### def 를 세는 규칙

1. **def 열거 범위는 all-uses 와 같습니다.** 대상 함수 안의 지역 변수와 파라미터입니다. 필드, 전역, alias 가 있는 참조는 [beaker:wb-all-uses](../wb-all-uses/SKILL.md) 의 규칙대로 `notes` 에 범위 밖으로 남깁니다.
2. **같은 기본 블록 안에서만 쓰이는 def 는 세지 않습니다.** 분기 없이 바로 다음 문장에서만 쓰이는 임시 값은 그 블록이 실행되면 자동으로 덮입니다. Rapps 와 Weyuker 도 블록 밖으로 나가는 정의(global def)만 셉니다.
3. **def-clear path 로 닿는 use 가 하나도 없는 def 는 Coverage Item 이 아닙니다.** `notes` 에 `issue: dead-definition` 으로 남깁니다. 값이 버려지기 전에 같은 변수가 다시 정의되는 경우도 여기 들어갑니다. 원 논문도 이런 def 를 「오류 가능성이 있으니 검토할 것」으로 분류합니다.
4. **닿는 use 는 관찰되는 쪽을 고릅니다.** def-use 경로를 지나도 그 use 가 반환값, 던지는 오류, 단언하는 부수효과에 영향을 주지 않으면 틀린 대입이 시험 결과로 드러나지 않습니다. 고를 수 있으면 케이스의 `expected` 까지 값이 이어지는 use 를 고르고 `rationale` 에 어느 출력으로 이어지는지 적습니다.

### all-uses 열거의 누락 검사

whitebox-test-designer 출력을 저장하기 전에 오케스트레이터가 이 검사를 돌립니다.

1. all-uses 를 적용한 변수를 고릅니다.
2. 범위 안의 def 마다 du-pair Coverage Item 이 하나 이상 있거나 `dead-definition` note 가 있는지 봅니다.
3. 둘 다 없는 def 는 설계자가 열거를 빠뜨린 것입니다. 설계자에게 되돌려 보냅니다.

빠진 항목은 분모에서 조용히 사라져 커버리지를 부풀립니다. 그래서 저장 전에 막습니다.

### 리포트의 파생 목록

1. all-uses 결과에서 counted 쌍이 하나도 없는 def 를 모읍니다.
2. 「값이 한 번도 use 에 닿지 않은 정의」 목록으로 냅니다. 별도 커버리지 비율로 내지 않고 목록만 냅니다.

이 목록의 def 는 대입식이 틀려도 어떤 시험도 실패하지 않습니다.

## 만들지 않는 이유

`Technique` enum 에 `all-defs` 를 넣지 않습니다(verdict: criterion-only).

- **all-uses 가 같은 준비물로 더 많이 셉니다.** def/use 열거, kill 지점, reach 판정이 all-uses 와 똑같이 필요합니다. 그런데 all-uses 가 엄격하게 포함하므로 둘 다 생성기로 두면 같은 def 가 분모에 두 번 들어가거나, 설계자가 변수마다 수준을 골라야 합니다. 고르는 규칙이 하나 늘 뿐 잡는 결함은 늘지 않습니다.
- **all-uses 를 쓰지 않는 곳에서는 거의 이득이 없습니다.** [beaker:wb-all-uses](../wb-all-uses/SKILL.md) 의 적용 조건(다른 경로에서의 재정의, def 와 use 사이의 분기나 루프, 루프를 넘는 값)이 없으면 use 마다 닿는 def 가 하나뿐이고, all-defs 는 branch-condition 이 이미 실행하는 노드를 다시 요구하는 정도입니다.
- **잡는 결함의 다른 절반은 시험이 아닙니다.** 「정의만 하고 안 쓰는 값」은 「def 를 세는 규칙」 3번의 정적 판정이고, 시험 케이스나 커버리지 분모와 무관합니다.

## 하지 않는 것

- Coverage Item 이나 Test Case 를 만들지 않습니다. 위 두 용도는 all-uses 산출물을 다시 읽는 것이라 새 케이스나 실행이 없습니다.
- 파생 목록을 커버리지 비율로 내지 않습니다.
- alias 가 의심되는 def 는 `dead-definition` 으로 판정하지 않고 범위 밖 note 로 둡니다.

<example>
변수 `V1` 이 세 곳에서 정의됩니다. 함수 진입 시 파라미터(`S1`), `P1` 이 참일 때(`S2`), 루프 본문 끝(`S3`). use 는 루프 조건 `C1` 의 p-use 와 반환문의 c-use 입니다. `S2` 바로 뒤에는 `S3` 로 가는 경로만 있고 그 사이 use 가 없습니다.

```
def        닿는 use                         all-defs 가 요구하는 것
S1         C1, 반환                           둘 중 하나
S2         없음 (S3 이 다시 정의)               Coverage Item 아님. dead-definition
S3         C1 (다음 반복), 반환                 둘 중 하나
```

all-defs 는 Coverage Item 2개입니다. 루프를 한 번 이상 도는 실행 하나로 `S1 -> C1` 과 `S3 -> 반환` 을 모두 덮을 수 있습니다. 같은 변수에 all-uses 를 쓰면 `S1 -> C1 참`, `S1 -> C1 거짓`, `S1 -> 반환`, `S3 -> C1 참`, `S3 -> C1 거짓`, `S3 -> 반환` 이 각각 항목이 됩니다.
</example>

## 다른 기법과의 관계

- **포함되는 것**: [beaker:wb-all-uses](../wb-all-uses/SKILL.md) 에 포함됩니다(def 의 use 전부를 덮으면 하나는 덮습니다). all-uses 를 거쳐 [beaker:wb-all-du-paths](../wb-all-du-paths/SKILL.md), [beaker:wb-prime-path-coverage](../wb-prime-path-coverage/SKILL.md), [beaker:wb-complete-path-coverage](../wb-complete-path-coverage/SKILL.md) 에도 포함됩니다.
- **포함하는 것**: 다른 기법 스킬 중 all-defs 가 포함하는 것은 없습니다.
- **비교되지 않는 것**: [beaker:wb-node-coverage](../wb-node-coverage/SKILL.md), [beaker:wb-edge-coverage](../wb-edge-coverage/SKILL.md), [beaker:wb-edge-pair-coverage](../wb-edge-pair-coverage/SKILL.md), [beaker:wb-branch-condition](../wb-branch-condition/SKILL.md) 과는 포함 관계가 없습니다. 변수를 정의하지 않는 노드와 간선은 all-defs 가 요구하지 않고, 반대로 분기를 전부 덮어도 def 가 use 에 닿기 전에 다시 정의되는 경로만 지났을 수 있습니다.
- **겹치는 것**: [beaker:wb-mutation-testing](../wb-mutation-testing/SKILL.md) 도 「잘못된 대입」을 겨냥하지만 경로가 아니라 단언의 강도를 봅니다. 「def 를 세는 규칙」 4번의 관찰 가능성 문제는 mutation 이 직접 측정합니다.

## beaker 통합

- **verdict**: criterion-only. `Technique` enum 에 `all-defs` 를 넣지 않습니다. 이유는 「만들지 않는 이유」에 있습니다.
- **쓰는 설계자나 단계**: 생성은 없습니다. whitebox-test-designer 의 출력 검사와 test-reporter 의 파생 목록에서만 씁니다.
- **비용**: def 수에 비례합니다. 두 용도는 all-uses 산출물을 다시 읽는 것이라 새 케이스나 실행이 없습니다.

**한계**:

- infeasible path 때문에 def 하나의 use 가 전부 도달 불가일 수 있습니다. 이 경우 dead-definition 과 구별되지 않으므로 note 의 `detail` 에 「구조상 use 는 있으나 경로 조건이 배타적」을 따로 적게 합니다.
- 필드와 alias 를 범위 밖으로 두므로 객체 상태에 대입하고 다른 메서드에서 쓰는 값은 이 검사에 들어가지 않습니다. 지역 변수라도 alias 가 있는 참조를 거쳐 쓰이면 use 를 놓쳐 dead-definition 으로 잘못 보일 수 있어서, alias 가 의심되면 판정하지 않고 범위 밖 note 로 둡니다.

**다시 볼 조건**: all-uses 의 쌍 수가 감당되지 않는 긴 함수가 자주 나와서 「변수마다 all-defs 로 낮춰 세는」 모드가 필요해지면 technique 로 다시 판단합니다. 그때는 같은 변수에 두 수준을 동시에 쓰지 않는 규칙이 함께 필요합니다.

## 출처

- S. Rapps, E. J. Weyuker, 「Data Flow Analysis Techniques for Test Data Selection」, ICSE 1982. all-defs 정의, global def 와 local def 구분, use 없는 def 를 검토 대상으로 분류, 포함 관계 그림(all-uses 가 all-defs 를 포함, all-defs 와 all-edges 는 포함 관계 없음), 「all-defs 는 계산 결함을 잡고 분기 결함은 놓칠 수 있다」는 분석: [원문 PDF](https://userweb.cs.txstate.edu/~rp31/papers/RappsWeyuker.pdf)
- S. Rapps, E. J. Weyuker, 「Selecting Software Test Data Using Data Flow Information」, IEEE Transactions on Software Engineering, SE-11(4), 1985. 위 논문의 저널판입니다. 서지 정보만 확인했습니다.
- P. Ammann, J. Offutt, 「Introduction to Software Testing」, 1판 2.2.2 Criterion 2.9, 2판 7.2.3 Criterion 7.15 All-Defs Coverage. def-path set 정의와 ADUPC, AUC, ADC 의 포함 관계를 강의 슬라이드로 확인: [Data-flow Based Testing, Utrecht University](https://ics-websites.science.uu.nl/docs/vakken/b3stv/pc/2425/slides/dfbt.pdf)
