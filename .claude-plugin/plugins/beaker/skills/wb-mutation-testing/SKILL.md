---
name: wb-mutation-testing
description: 설계 기법이 아니라 실행 뒤 선택 단계 후보입니다. technique 값으로 쓰지 않고 Coverage Item 을 만들지 않습니다. 대상 구현에 작은 문법 변경(mutant)을 넣어 이미 통과한 시험이 그것을 잡는지로 단언 강도를 잽니다. 구조 커버리지는 높은데 단언이 의심될 때 사용자가 요청하면 돌고, 설계자 둘 다 쓰지 않습니다.
---

# Mutation Testing

설계 기법이 아니라 실행 단계 [7] 과 도달 보강 반복이 끝난 뒤, 리포트 단계 [8] 전에 도는 선택 단계 `[7m] Mutation Analysis` 후보입니다. `technique` 값이 없습니다. 사용자가 요청할 때만 돌고, 설계자 둘 다 쓰지 않습니다.

**분류** 시험 묶음 평가 (설계 기법 아님) · **Coverage Item** 없음. 세는 단위는 대상 구현에 넣은 mutant 하나

## 언제 쓰나

다른 기법은 무엇을 시험할지 정합니다. mutation testing 은 **이미 만든 시험이 결함을 잡을 만큼 단언하는지**를 잽니다. 대상 구현에 작은 문법 변경(mutant) 하나를 넣고 시험을 돌려, 시험이 실패하면 mutant 가 죽은(killed) 것이고 전부 통과하면 살아남은(survived) 것입니다. 살아남은 mutant 는 그 줄을 실행하고도 결과를 확인하지 않는 시험, 단언이 빠졌거나 느슨한 시험을 가리킵니다.

- 구조 커버리지는 높은데 시험이 무엇을 단언하는지 의심될 때 씁니다. 커버리지는 「실행했다」만 말하고 「확인했다」는 말하지 않습니다.
- 근거 가정은 두 가지입니다. competent programmer hypothesis(실제 프로그램은 정답에서 작은 차이만 난다)와 coupling effect(단순 결함을 잡는 시험은 복잡한 결함도 대부분 잡는다)입니다. 실측 연구에서도 mutant 를 잡는 능력과 실제 결함을 잡는 능력이 코드 커버리지와 별개로 상관을 보였습니다. 다만 모든 실제 결함이 mutant 와 짝지어지지는 않습니다.

## 이 기준을 쓰는 법

단계가 켜졌을 때 따를 순서입니다.

1. **원래 구현에서 통과한 케이스만 참여시킵니다.** `status: pass` 이고 `reach: reached` 인 케이스만 mutant 에 돌립니다. 원래 구현에서 이미 실패하는 `basis: specification` 케이스는 incident 쪽 신호이고, mutant 를 죽였다고 셀 수 없습니다.
2. **mutant 는 대상 범위 안에만 넣습니다.** 대상 심볼의 본문 줄만 바꿉니다. 저장소 전체를 변이시키지 않습니다.
3. **mutant 하나에 변경 하나를 둡니다.** 저장소에 mutation 도구가 이미 설정돼 있으면 그 도구와 operator 설정을 씁니다. 없으면 관계 연산자 경계(`<` 와 `<=`), 조건 부정, 산술 연산자 교체, 호출 제거, 반환값 교체 같은 일반 operator 만 씁니다.
4. **변이는 detached worktree 안에서만 합니다.** 대상 저장소의 워킹 트리를 바꾸지 않습니다. 「beaker 통합」의 worktree 절차를 따릅니다.
5. **basis 별로 따로 셉니다.** 같은 mutant 를 `specification` 케이스 묶음과 `code` 케이스 묶음에 각각 돌리고 점수를 합산하지 않습니다. 커버리지 식을 합산하지 않는 것과 같은 이유입니다.

리포트를 읽을 때는 살아남은 mutant 를 basis 별 절에서 봅니다. specification 묶음에서 살아남은 mutant 는 명세 공백이거나 블랙박스 케이스의 입력, 단언이 약하다는 신호이고, code 묶음에서 죽은 mutant 는 characterization 케이스가 현재 동작을 고정했다는 뜻일 뿐 그 동작이 옳다는 뜻이 아닙니다.

## 만들지 않는 이유

- 설계자가 Coverage Item 을 만드는 기법이 아닙니다. 무엇을 시험할지 정하지 않고, 이미 확정된 케이스를 대상 구현의 변형에 돌려 단언 강도만 잽니다.
- 그래서 TestCondition, CoverageItem, TestCase 를 만들지 않고, 결과는 mutant 마다 상태(killed, survived, no-coverage, timeout, compile-error, runtime-error)로 리포트의 별도 절에 basis 별로 모읍니다.

## 하지 않는 것

- `technique` 필드에 `mutation-testing` 을 쓰지 않습니다.
- 살아남은 mutant 를 equivalent 로 단정하지 않습니다. 원래 구현과 같은 동작을 하는 mutant(equivalent mutant)인지는 일반적으로 판정할 수 없습니다. 살아남은 것은 그대로 남기고 사람이 가립니다.
- 살아남은 mutant 를 블랙박스 설계자에게 주지 않습니다. mutant 는 구현 줄과 그 줄의 변경이라, payload 에 들어가면 I1, I2 가 깨집니다.
- 블랙박스 케이스가 부족해 보여도 블랙박스 설계를 다시 돌리지 않습니다.
- 살아남은 mutant 를 자동으로 incident 로 올리지 않습니다.

<example>
대상 구현의 한 decision 이 `P1 < T` 이고, 이 decision 을 실행하는 통과 케이스가 basis 마다 있을 때.

```
MUT-01  P1 < T   ->  P1 <= T      relational-boundary
MUT-02  P1 < T   ->  !(P1 < T)    negate-condition

                 specification 묶음   code 묶음
MUT-01           survived             killed
MUT-02           killed               killed
```

MUT-01 이 specification 묶음에서 살아남았다면 두 가지 중 하나입니다. 명세가 `T` 에서의 결과를 정하지 않았거나(명세 공백), 블랙박스 케이스가 `T` 에 걸리는 입력을 두지 않았거나 단언이 느슨한 것입니다. 어느 쪽인지는 사람이 봅니다. code 묶음에서 죽었다는 것은 characterization 케이스가 현재 동작을 고정했다는 뜻일 뿐 그 동작이 옳다는 뜻이 아닙니다.
</example>

## 다른 기법과의 관계

- **다른 축입니다.** 그래프 기준(node-coverage [`beaker:wb-node-coverage`](../wb-node-coverage/SKILL.md), edge-coverage [`beaker:wb-edge-coverage`](../wb-edge-coverage/SKILL.md), prime-path-coverage [`beaker:wb-prime-path-coverage`](../wb-prime-path-coverage/SKILL.md)), 논리 기준(mcdc [`beaker:wb-mcdc`](../wb-mcdc/SKILL.md) 등), 데이터 흐름 기준(all-defs [`beaker:wb-all-defs`](../wb-all-defs/SKILL.md), all-uses [`beaker:wb-all-uses`](../wb-all-uses/SKILL.md), all-du-paths [`beaker:wb-all-du-paths`](../wb-all-du-paths/SKILL.md))은 시험이 무엇을 실행하는지를 세고, mutation 은 실행한 결과를 단언이 확인하는지를 셉니다. 포함 관계 계층에 넣지 않습니다.
- **보완하는 것**: mcdc 의 independence pair 가 출력 차이로 드러나는지(`beaker:wb-mcdc` 의 「pair 의 두 케이스가 같은 `expected` 를 가지면 독립성이 관찰되지 않는다」 규칙), all-defs 의 관찰 가능성 문제(`beaker:wb-all-defs` 의 「닿는 use 는 관찰되는 쪽을 고른다」 규칙)를 실측합니다. `negate-condition` mutant 가 살아남으면 그 decision 의 pair 나 def-use 경로가 단언까지 전파되지 않은 것입니다.
- **겹치는 것**: boundary-value-analysis([`beaker:bb-boundary-value-analysis`](../bb-boundary-value-analysis/SKILL.md))는 `relational-boundary` mutant 가 잡는 off-by-one 을 설계 단계에서 겨냥합니다. 경계에서 살아남은 mutant 는 BVA 케이스가 빠졌거나 그 경계를 명세가 정하지 않았다는 신호입니다.
- **혼동 주의**: syntax-based([`beaker:bb-syntax-based`](../bb-syntax-based/SKILL.md))도 문법 규칙으로 입력을 변형하지만 변형 대상이 입력이고, mutation testing 은 구현입니다. fuzzing([`beaker:bb-fuzzing`](../bb-fuzzing/SKILL.md))도 입력을 바꿉니다.

## beaker 통합

- **verdict**: stage. `Technique` enum 에 넣지 않습니다. 설계자가 Coverage Item 을 만드는 기법이 아니라, 실행 단계 [7] 과 도달 보강 반복이 끝난 뒤 리포트 단계 [8] 전에 도는 선택 단계 `[7m] Mutation Analysis` 입니다. 사용자가 요청할 때만 돕니다.
- **I1 은 깨지지 않습니다.** 블랙박스 케이스를 mutant 에 돌리는 것은 설계가 디스크에 확정된 뒤의 실행이라 설계자는 구현을 보지 않습니다. 깨지는 경로는 하나, 살아남은 mutant 를 근거로 블랙박스 케이스를 더 만들게 하는 피드백입니다. 그래서 mutation 결과는 리포트와 화이트박스 쪽으로만 흐릅니다. 블랙박스 케이스가 부족해 보여도 블랙박스 설계를 다시 돌리지 않습니다(`${CLAUDE_PLUGIN_ROOT}/references/process.md` 「하지 말아야 할 것」의 커버리지 규칙과 같음).
- **worktree 절차**: 생성한 시험 스크립트와 대상의 미커밋 변경은 `HEAD` 에 없으므로 worktree 를 만든 뒤 옮겨야 합니다.
  1. `git status --porcelain --ignored` 를 저장합니다.
  2. `git worktree add --detach <WORK>/mut HEAD` 로 만듭니다. pr-review 는 이미 있는 PR worktree 를 그대로 씁니다.
  3. 대상 파일의 미커밋 변경(`git diff` 와 추적되지 않은 대상 파일)과 `layout.specTarget`, `layout.codeTarget` 의 생성 스크립트를 worktree 로 복사합니다.
  4. 의존성 부트스트랩, 원래 구현으로 기준 실행(「이 기준을 쓰는 법」 1번 확인), mutant 마다 적용, 실행, 되돌리기를 worktree 안에서 합니다. 도구가 자체 임시 디렉터리나 리포트 디렉터리를 만들어도 worktree 안에 남습니다.
  5. 끝나면 성공이든 실패든 `git worktree remove --force` 와 `git worktree prune` 을 하고, status 를 다시 떠서 1 과 비교합니다. 다르면 리포트 최상단에 경고합니다.
  6. 포크 PR 처럼 호스트에서 실행하면 안 되는 코드면 이 단계를 건너뛰고 「검증하지 못한 것」에 남깁니다.
- **세는 단위**: mutant 하나. 상태는 killed, survived, no-coverage(참여 케이스 중 그 줄을 실행한 것이 없음), timeout, compile-error, runtime-error 입니다. 점수는 `(killed + timeout) / (killed + timeout + survived + no-coverage)` 이고, compile-error 와 runtime-error 는 분모에서 뺍니다.
- **incident 와의 관계**: 살아남은 mutant 는 자동으로 incident 가 되지 않습니다. 리포트의 별도 절에 basis 별로 모읍니다. 화이트박스 condition 의 `predicateClass` 가 `business-rule` 인 줄에서 specification 묶음이 놓친 mutant 는 명세 공백 후보로 표시만 합니다.
- **비용**: mutant 수 곱하기 참여 케이스 실행 시간. 대상 심볼 범위로 제한하고, 줄 커버리지를 쓸 수 있으면 그 mutant 의 줄을 실행하는 케이스만 돌립니다. 부트스트랩이 worktree 마다 한 번 더 듭니다.
- **한계**: equivalent mutant 를 걸러낼 수 없어 점수가 실제보다 낮게 나올 수 있습니다. operator 집합 밖의 결함은 재지 못합니다. characterization 케이스가 mutant 를 죽인 것은 단언이 강하다는 뜻이지 동작이 옳다는 뜻이 아닙니다.

## 출처

- Richard A. DeMillo, Richard J. Lipton, Frederick G. Sayward, 「Hints on Test Data Selection: Help for the Practicing Programmer」, IEEE Computer 11(4), 1978. competent programmer hypothesis 와 coupling effect 의 출처입니다(서지 정보만 확인했습니다).
- Yue Jia, Mark Harman, 「An Analysis and Survey of the Development of Mutation Testing」, IEEE TSE 37(5), 2011(서지 정보만 확인했습니다).
- René Just 외, 「Are Mutants a Valid Substitute for Real Faults in Software Testing?」, FSE 2014. 실제 결함 357건, 커버리지와 별개인 상관. https://homes.cs.washington.edu/~mernst/pubs/mutation-effectiveness-fse2014-abstract.html
- Stryker, Mutant states and metrics(상태 정의와 점수 식). https://stryker-mutator.io/docs/mutation-testing-elements/mutant-states-and-metrics/
- StrykerJS Configuration 의 `inPlace`, `tempDirName`, `coverageAnalysis`. https://stryker-mutator.io/docs/stryker-js/configuration/
- PIT, Basic concepts(bytecode 변이, 줄 커버리지 기반 시험 선택, equivalent mutation). https://pitest.org/quickstart/basic_concepts/
- git-worktree 문서(`add --detach`, `remove`, `prune`). https://git-scm.com/docs/git-worktree
- Paul Ammann, Jeff Offutt, 「Introduction to Software Testing」 2판, Syntax-based Testing 장의 mutation 절(장 이름만 적습니다).
