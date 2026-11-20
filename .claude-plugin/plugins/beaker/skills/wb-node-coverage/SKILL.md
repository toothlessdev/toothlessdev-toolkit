---
name: wb-node-coverage
description: 설계 기법이 아니라 구조 기준 계층의 바닥으로만 쓰는 기준입니다. technique 값으로 쓰지 않고 Coverage Item 을 만들지 않습니다. CFG 의 도달 가능한 node(문장)를 모두 지나기를 요구하며, 실행 단계가 줄 커버리지로 reach 를 판정하거나 리포트가 실행되지 않은 줄을 해석할 때 whitebox-test-designer, test-executor, test-reporter 가 참조합니다.
---

# Node (Statement) Coverage

구조 기준 계층의 바닥으로만 두는 기준입니다. `technique` 값이 없고, 생성기로 쓰지 않습니다. 기준 계층과 실행 단계의 줄 커버리지 해석에 참조합니다.

**분류** structure-based · **Coverage Item** 제어 흐름 그래프(CFG)에서 도달 가능한 각 node(beaker 에서는 만들지 않음)

## 언제 쓰나

Node Coverage 는 시험 집합이 CFG 의 도달 가능한 node 를 하나도 빠짐없이 한 번 이상 지나가기를 요구합니다. 코드에서 node 는 basic block, 곧 중간에 분기 없이 이어지는 문장 묶음입니다. 그래서 Statement Coverage 와 같은 기준으로 다룹니다.

이 기준이 잡는 결함은 두 가지입니다.

- 한 번도 실행되지 않은 문장 안의 결함. 실행되지 않은 줄의 크래시나 잘못된 대입은 어떤 시험도 드러내지 못합니다
- 어떤 입력으로도 닿지 않는 문장. 죽은 코드이거나 도달 조건을 아무도 모르는 코드입니다

beaker 에서 이 기준을 따로 고르는 경우는 없습니다. 화이트박스 설계자가 쓰는 `branch-condition` 이 분기 결과를 전부 세므로, 분기가 하나라도 있는 대상에서는 그 Coverage Item 을 다 덮으면 Node Coverage 가 함께 채워집니다.

## 이 기준을 쓰는 법

1. **node 는 도달 가능한 것만 셉니다.** Ammann & Offutt 의 정의는 「syntactically reachable」한 node 입니다. 그래프에 진입 node 에서 이어지는 경로가 있는 node 를 말합니다.
2. **경로가 있어도 그 경로를 타는 입력이 없을 수 있습니다.** 이걸 semantic reach 라고 부르고, 그 node 는 시험으로 덮을 수 없습니다. beaker 에서는 `beaker:wb-branch-condition` 의 「도달 불가 분기」 규칙대로 `Note` 의 `unreachable-branch` 로 남깁니다.
3. **100% 를 분기 방향의 보장으로 읽지 않습니다.** `else` 가 없는 `if` 는 조건이 참인 시험 하나로 모든 node 를 지납니다. 거짓 방향 간선은 지나지 않은 채로 Node Coverage 는 100% 가 됩니다.
4. **줄 커버리지는 Node Coverage 의 근사값으로 읽습니다.** 도구가 세는 단위는 node 가 아니라 줄이고, 둘은 아래처럼 어긋납니다.

| 경우 | 줄 커버리지 | node 기준 |
|---|---|---|
| 한 줄에 단축평가, 삼항, 여러 문장이 있음 | 그 줄의 명령어 하나만 돌아도 줄 전체를 덮은 것으로 셉니다 | 줄 안의 일부 node 는 실행되지 않았습니다 |
| `else` 없는 `if` 의 거짓 방향 | 그 방향에는 자기 줄이 없어서 셀 대상이 없습니다 | 간선만 있고 새 node 가 없어 역시 셀 대상이 없습니다 |
| 디버그 정보 없이 컴파일된 코드 | 줄 커버리지를 낼 수 없습니다 | 명령어 단위로는 셀 수 있습니다 |
| 예외 처리 경로 | 도구에 따라 분기로 세지 않습니다 | 예외 간선 뒤의 node 는 실행됐을 때만 덮입니다 |

다른 스킬이나 단계가 이 기준을 쓰는 자리는 「beaker 통합」의 쓰는 곳 1~4 입니다.

### beaker 의 `reach` 와 그래프의 「도달 가능」은 다른 말입니다

두 용어가 같은 낱말을 써서 섞이기 쉽습니다.

- 그래프의 도달 가능: node 에 이르는 경로나 입력이 **존재하는가**입니다. 설계 단계에서 Coverage Item 을 만들지 말지를 가릅니다
- beaker 의 `reach`: 케이스 하나가 실행에서 자기 목표 동작에 **실제로 닿았는가**입니다. 실행 단계에서 `reached` / `unreached` / `unknown` 으로 기록하고, `counted` 조건에서 `unreached` 를 빼는 데 씁니다

`reach` 판정은 줄 커버리지를 근거로 쓸 수 있습니다(`${CLAUDE_PLUGIN_ROOT}/references/schemas.md` 의 「reach: 목표 동작까지 갔는가」). 그 근거는 줄 단위라서 위 표의 어긋남을 그대로 물려받습니다.

## 만들지 않는 이유

생성기로 쓰면 node 마다 Coverage Item 이 생기는데, 같은 대상의 `branch-condition` 항목을 다 덮으면 그 항목들은 저절로 덮입니다. Structural Coverage 분모만 늘고 새 케이스는 거의 생기지 않습니다. 「else 없는 if 의 거짓 방향」처럼 이 기준이 놓치는 것을 이미 `branch-condition` 이 세고 있습니다.

## 하지 않는 것

- `technique` 필드에 `node-coverage` 를 쓰지 않습니다.
- Node Coverage 100% 나 줄 커버리지 100% 를 분기 방향을 다 지났다는 근거로 쓰지 않습니다.
- 어떤 케이스도 실행하지 않은 줄을 Structural Coverage 와 합산하거나 incident 로 올리지 않습니다.

<example>
대상이 `S1`, `if P1 then S2`, `S3` 순서이고 `else` 가 없을 때.

```
CFG node     N1 = { S1, P1 판정 }   N2 = { S2 }   N3 = { S3 }
간선         N1->N2 (P1 참)   N1->N3 (P1 거짓)   N2->N3

Node Coverage   TR = { N1, N2, N3 }
                P1 참인 시험 하나로 셋 다 지남. 100%

Edge Coverage   P1 거짓 간선 N1->N3 이 남음
```

`branch-condition` 이 만든 CI `P1 거짓` 의 케이스가 실수로 P1 참 경로를 탔다고 합시다. `basisRefs` 가 P1 판정 줄을 가리키면 그 줄은 두 방향 모두에서 실행되므로, 줄 커버리지만으로는 `reached` 로 잘못 판정됩니다. 거짓 방향에는 자기 줄이 없어서 줄 커버리지로는 그 방향을 탔는지 가를 수 없습니다.
</example>

## 다른 기법과의 관계

- **포함하는 것**: 없습니다. 구조 기준 계층의 가장 아래입니다
- **포함되는 것**: edge-coverage([`beaker:wb-edge-coverage`](../wb-edge-coverage/SKILL.md)), edge-pair-coverage([`beaker:wb-edge-pair-coverage`](../wb-edge-pair-coverage/SKILL.md)), prime-path-coverage([`beaker:wb-prime-path-coverage`](../wb-prime-path-coverage/SKILL.md)), complete-path-coverage([`beaker:wb-complete-path-coverage`](../wb-complete-path-coverage/SKILL.md)). 간선을 모두 지나면 그 끝의 node 도 모두 지나기 때문입니다
- **결정 기준 쪽에서 포함하는 것**: decision-coverage([`beaker:wb-decision-coverage`](../wb-decision-coverage/SKILL.md))와 그 위의 condition-decision-coverage, mcdc, multiple-condition-coverage. 결정마다 참과 거짓을 다 내면 모든 문장이 실행됩니다. condition-coverage([`beaker:wb-condition-coverage`](../wb-condition-coverage/SKILL.md))만으로는 결정 결과가 한쪽으로 몰릴 수 있어 포함하지 않습니다
- **현재 기법**: branch-condition([`beaker:wb-branch-condition`](../wb-branch-condition/SKILL.md))은 분기가 하나 이상인 대상에서 Node Coverage 를 포함합니다. 분기가 하나도 없는 대상에서는 Coverage Item 이 0개가 되어 포함하지 못합니다. Edge Coverage 가 「길이 0 또는 1 인 경로」로 정의된 이유가 이 경우입니다
- **데이터 흐름 기준**: all-defs, all-uses, all-du-paths 는 def 와 use 가 없는 node 를 요구하지 않으므로 일반적으로 Node Coverage 를 포함하지 않습니다

## beaker 통합

- **verdict**: criterion-only. `Technique` enum 에 `node-coverage` 를 넣지 않습니다
- **넣지 않는 이유**: 생성기로 쓰면 node 마다 Coverage Item 이 생기는데, 같은 대상의 `branch-condition` 항목을 다 덮으면 그 항목들은 저절로 덮입니다. Structural Coverage 분모만 늘고 새 케이스는 거의 생기지 않습니다. 「else 없는 if 의 거짓 방향」처럼 이 기준이 놓치는 것을 이미 `branch-condition` 이 세고 있습니다
- **쓰는 곳 1, 기준 계층**: `beaker:techniques` 에 구조 기준의 포함 관계를 적을 때 바닥으로 둡니다
- **쓰는 곳 2, 분기 없는 대상**: 분기가 없는 대상도 진입 node 하나는 Coverage Item 으로 남아야 합니다. 이 규칙은 [beaker:wb-branch-condition](../wb-branch-condition/SKILL.md) 의 절차 8번(결정이 없는 대상의 진입 실행 Test Condition)으로 들어가 있습니다
- **쓰는 곳 3, `reach` 근거**: 실행 단계가 줄 커버리지로 `reached` 를 판정할 때, 목표가 분기 방향인 케이스는 판정 줄이 아니라 그 방향의 첫 node 줄을 확인해야 합니다. 그 방향에 자기 줄이 없으면 도구의 분기 카운터나 결과 종류로 판정하고, 둘 다 없으면 `unknown` 입니다
- **쓰는 곳 4, 열거 누락 점검**: code basis 스위트를 돌린 뒤 어떤 케이스도 실행하지 않은 줄은, 설계자가 분기를 빠뜨렸거나 죽은 코드라는 신호입니다. 리포트에 따로 보이되 Structural Coverage 와 합산하지 않고 incident 로도 올리지 않습니다
- **비용**: 설계 비용은 없습니다. 실행 단계에서 러너의 커버리지 옵션을 켜는 비용만 듭니다
- **한계**: 줄 커버리지 수치는 줄 단위 근사값이고, 디버그 정보나 러너 지원이 없으면 아예 얻을 수 없습니다. 이때 쓰는 곳 3과 4는 결과 종류 근거로 물러나고 리포트에 그 사실을 남깁니다

## 출처

- Paul Ammann, Jeff Offutt, 「Introduction to Software Testing」 2장 2.1~2.2절 강의 슬라이드: [Ch2-1-2 Overview Graph Coverage Criteria](https://www.cs.montana.edu/courses/se422/currentLectures/Ch2-1-2.pdf). Node Coverage 정의(syntactically reachable node), syntactic reach 와 semantic reach 구분, 「length up to 1」 정의 이유, Prime Path Coverage 가 node · edge · edge-pair 를 포함한다는 서술
- JaCoCo, [Coverage Counters](https://www.jacoco.org/jacoco/trunk/doc/counters.html). 명령어 하나만 실행돼도 줄을 덮은 것으로 세는 규칙, 줄 커버리지의 디버그 정보 의존, 예외 처리를 분기로 세지 않는 점
- coverage.py, [Branch coverage measurement](https://coverage.readthedocs.io/en/latest/branch.html). `else` 없는 `if` 에서 문장 커버리지는 100% 인데 거짓 방향 점프가 실행되지 않은 예
- ISTQB Certified Tester Foundation Level syllabus, 4.3절 White-Box Test Techniques. 결정 커버리지 100% 가 문장 커버리지 100% 를 포함한다는 관계. 원문 PDF 는 직접 열어 확인하지 못했습니다
