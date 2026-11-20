---
name: wb-all-du-paths
description: 설계 기법이 아니라 data-flow 기준 계층에서 all-uses 와 prime-path 사이 자리를 설명하는 기준입니다. def 와 use 쌍마다 그 사이의 def-clear simple path 전부를 요구합니다. 경로 수가 지수적이고 줄 커버리지로 def-clear 여부를 가를 수 없어 technique 값으로 쓰지 않으며, 설계자가 Coverage Item 을 만드는 데 부르지 않습니다.
---

# All-DU-Paths Coverage

data-flow 기준 계층에서 이 기준이 무엇을 요구하는지 판단할 때 읽는 기준입니다. 설계자가 Coverage Item 을 만드는 데 부르지 않고, `technique` 값이 없습니다.

**분류**: structure-based (data-flow).

**Coverage Item**: 각 def-pair set 의 du-path 하나하나.

## 언제 쓰나

변수 하나의 정의(def)에서 그 값을 쓰는 지점(use)까지 가는 경로가 여럿이고, 경로마다 값이 덮어써지는지가 결과를 가를 때 이 기준이 무엇을 요구하는지 판단하는 데 씁니다. beaker 의 설계자가 Coverage Item 을 만드는 데는 쓰지 않습니다. 이유는 아래 「만들지 않는 이유」에 있습니다.

## 이 기준을 쓰는 법

### 용어

- **def-clear 경로**: 변수 `V1` 에 대해, 경로의 시작과 끝 사이 어느 노드와 간선에서도 `V1` 이 다시 정의되지 않는 경로입니다.
- **du-path**: `V1` 을 정의하는 노드 `S1` 에서 시작해 `V1` 을 쓰는 노드 `S3` 에서 끝나는, def-clear 이면서 simple 한 경로입니다. simple 은 경로 안에서 같은 노드가 두 번 나오지 않는다는 뜻입니다(시작과 끝이 같은 경우만 예외).
- **def-pair set** `du(S1, S3, V1)`: `S1` 에서 `S3` 까지 `V1` 에 대한 du-path 전부의 집합입니다.

| 기준 | def-pair set 마다 요구하는 것 |
|---|---|
| all-defs ([beaker:wb-all-defs](../wb-all-defs/SKILL.md)) | def-path set `du(S1, V1)` 에서 하나 |
| all-uses ([beaker:wb-all-uses](../wb-all-uses/SKILL.md)) | def-pair set 에서 하나 |
| all-du-paths | def-pair set 의 **원소 전부** |

시험 경로는 du-path 를 그대로 지나가거나, du-path 의 노드를 순서대로 지나되 중간에 다른 노드로 갔다가 같은 노드로 돌아오는 sidetrip 을 끼고 지나가면(touring) 그 du-path 를 덮은 것으로 봅니다. Rapps 와 Weyuker 의 원래 정의는 루프를 한 번까지 허용하고, Ammann 과 Offutt 의 정의는 simple path 로 제한합니다. 어느 쪽이든 루프를 여러 번 도는 경로는 요구하지 않습니다.

### 이 기준이 세는 방식

이 기준이 요구하는 것을 따질 때 아래 순서로 셉니다.

1. 변수마다 def 노드와 use 노드(c-use: 계산에 쓰임, p-use: 분기 조건에 쓰임)를 전부 찾습니다.
2. def 와 use 의 쌍마다 그 사이의 def-clear simple path 를 전부 열거합니다. 각 경로가 Coverage Item 입니다.
3. 어떤 입력으로도 지나갈 수 없는 du-path(infeasible path)는 분모에서 빼지 않고 도달 불가로 기록합니다.

### 다른 스킬에서 참조할 때

- [beaker:techniques](../techniques/SKILL.md) 의 구조 기준 포함 관계에서 all-uses 와 prime-path 사이 자리를 설명하는 데 씁니다.
- all-uses 를 쓰는 설계자가 중간 덮어쓰기가 의심스러운 쌍을 만나면, 그 쌍에 한해 du-path 를 열거해 `notes` 에 남깁니다. Coverage Item 으로 만들지 않습니다.

## 만들지 않는 이유

`Technique` enum 에 넣지 않고, 화이트박스 설계자가 이 기준으로 Coverage Item 을 만들지 않습니다(verdict: criterion-only). 이유는 네 가지입니다.

- **경로 수**: 최악의 경우 필요한 시험 수가 지수적으로 늘어납니다(Bieman 과 Schultz). 같은 연구에서 서브루틴 대부분은 완전 경로 몇 개로 충족됐지만, 그 판정은 경로를 세는 도구로 한 것입니다.
- **손으로 하는 열거**: whitebox-test-designer 의 도구는 Read, Grep, Glob 뿐입니다. CFG 와 def/use 를 도구 없이 머릿속에서 세워야 합니다. def 와 use 사이에 분기가 서너 개만 있어도 열거가 빠지기 쉽고, 빠진 du-path 는 분모에서 조용히 사라집니다. `${CLAUDE_PLUGIN_ROOT}/references/schemas.md` 의 「케이스를 못 만든 커버리지 항목은 파일에 그대로 남기세요」는 만든 항목에만 적용되므로, 열거 누락은 아무 검사에도 걸리지 않고 커버리지를 부풀립니다.
- **도달 판정**: `counted(case)` 는 `reach ≠ unreached` 를 요구하고, `reach` 는 줄 커버리지나 결과 종류로 판정합니다. du-path 를 덮었는지는 노드를 **어떤 순서로** 지났고 그 사이에 재정의 노드를 지나지 않았는지로 정해집니다. 줄 커버리지는 실행된 줄의 집합만 보여 주므로, 루프가 있으면 재정의 노드가 다른 반복에서 실행됐는지 이번 경로 위에서 실행됐는지 가르지 못합니다. 경로 추적 계측이 없는 지금의 executor 로는 이 기준의 `reach: reached` 를 정직하게 판정할 수 없습니다.
- **oracle**: 화이트박스 케이스의 기대값은 characterization 입니다. 경로를 더 덮어도 각 케이스는 현재 동작을 고정할 뿐이라, 늘어난 케이스 수만큼 결함 탐지가 늘지 않습니다.

## 하지 않는 것

- Coverage Item 이나 Test Case 를 만들지 않습니다.
- 이 기준이 겨냥하는 결함은 다른 곳에서 다룹니다.
  - **중간 덮어쓰기**: [beaker:wb-all-uses](../wb-all-uses/SKILL.md) 가 쌍마다 하나를 덮고, 설계자는 의심스러운 쌍에 한해 du-path 를 열거해 `notes` 에 남깁니다.
  - **초기화 누락**: def 없이 use 에 닿는 경로입니다. du-path 가 아니므로 이 기준의 Coverage Item 이 되지 않습니다. 시험보다 정적 분석의 def-use anomaly 검사가 맞는 도구입니다.

<example>
`S1` 에서 `V1` 을 정의하고, `S3` 에서 `V1` 을 씁니다. 그 사이에 `V1` 을 다시 정의하는 `S2` 가 조건 `P1` 아래 있고, `V1` 과 무관한 조건 `P2` 와 `C1` 이 차례로 있습니다.

```
S1 (def V1)
  -> P1 ? S2 (def V1) : (건너뜀)
  -> P2 ? (가지 A) : (가지 B)
  -> C1 ? (가지 A) : (가지 B)
  -> S3 (use V1)

du(S1, S3, V1)
  P1 거짓 경로만 def-clear 입니다. P1 참 경로는 S2 에서 V1 이 덮어써지므로 du-path 가 아닙니다
  P2 의 두 가지 x C1 의 두 가지 = 원소 4개

all-uses:     이 쌍에서 1개
all-du-paths: 이 쌍에서 4개
```

`V1` 과 무관한 조건이 def 와 use 사이에 하나 늘 때마다 원소 수가 곱해집니다. all-uses 의 요구량은 그대로입니다.
</example>

## 다른 기법과의 관계

- **포함하는 것**: [beaker:wb-all-uses](../wb-all-uses/SKILL.md) 를 포함합니다(def-pair set 의 원소 전부를 덮으면 하나는 덮습니다). all-uses 를 거쳐 [beaker:wb-all-defs](../wb-all-defs/SKILL.md) 도 포함합니다.
- **포함되는 것**: [beaker:wb-prime-path-coverage](../wb-prime-path-coverage/SKILL.md) 에 포함됩니다. du-path 는 simple path 이고 모든 simple path 는 어느 prime path 의 부분 경로이기 때문입니다. sidetrip 을 허용한 touring 기준에서 성립합니다. [beaker:wb-complete-path-coverage](../wb-complete-path-coverage/SKILL.md) 에도 포함됩니다.
- **비교되지 않는 것**: [beaker:wb-edge-coverage](../wb-edge-coverage/SKILL.md), [beaker:wb-edge-pair-coverage](../wb-edge-pair-coverage/SKILL.md) 와는 일반적으로 포함 관계가 없습니다. 변수를 쓰지 않는 간선은 data-flow 기준이 요구하지 않습니다.
- [beaker:wb-mutation-testing](../wb-mutation-testing/SKILL.md) 은 Coverage Item 체계가 다르므로 비교하지 않습니다.

## beaker 통합

- **verdict**: criterion-only. `Technique` enum 에 넣지 않고, 화이트박스 설계자가 이 기준으로 Coverage Item 을 만들지 않습니다. 이유는 「만들지 않는 이유」에 있습니다.
- **쓰는 설계자나 단계**: 없습니다. 기준 계층([beaker:techniques](../techniques/SKILL.md))에서 all-uses 와 prime-path 사이 자리를 설명하는 데만 씁니다.
- **다시 볼 조건**: executor 가 케이스마다 실행 경로(노드 순서)를 `reachEvidence` 로 낼 수 있게 되고, def/use 열거를 도구로 할 수 있게 되면 technique 로 다시 판단합니다.

## 출처

- Ammann, P. and Offutt, J. 「Introduction to Software Testing」 2nd ed., 7.2.3 data flow coverage, Criterion 7.17 All-du-Paths Coverage, 7.4.2. 강의 슬라이드로 정의와 포함 관계(PPC 가 ADUPC 를 포함)를 확인: [Data-flow Based Testing, Utrecht University](https://ics-websites.science.uu.nl/docs/vakken/b3stv/pc/2425/slides/dfbt.pdf)
- Rapps, S. and Weyuker, E. J. 「Selecting Software Test Data Using Data Flow Information」, IEEE Transactions on Software Engineering, 1985. 원문은 열어 보지 못했습니다
- Frankl, P. G. and Weyuker, E. J. 「An Applicable Family of Data Flow Testing Criteria」, IEEE Transactions on Software Engineering, 1988. 원문은 열어 보지 못했습니다
- Bieman, J. M. and Schultz, J. L. 「Estimating the Number of Test Cases Required to Satisfy the All-du-paths Testing Criterion」, TAV3, 1989: [서지 정보](https://bibtex.github.io/TAV-1989-BiemanS.html), [초록](https://sciweavers.org/node/179645)
- ISO/IEC/IEEE 29119-4, data flow testing 절(all-definitions, all-uses, all-DU-paths). 원문은 열어 보지 못했습니다
