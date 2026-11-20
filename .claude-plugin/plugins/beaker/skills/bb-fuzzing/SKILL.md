---
name: bb-fuzzing
description: 설계 기법이 아니라 실행 뒤 선택 단계 후보입니다. technique 값으로 쓰지 않고 Coverage Item 을 만들지 않습니다. 파서, 디코더, 신뢰할 수 없는 입력을 받는 대상에 예상 밖 입력을 대량으로 넣어 crash, 선언되지 않은 예외, relation 위반을 찾습니다. blackbox-test-designer 는 fuzz target 명세만 내고 campaign 은 test-executor 가 돌립니다.
---

# Fuzzing

설계 기법이 아니라 파이프라인 [7] Execution 뒤의 선택 단계 `[7f] Fuzz campaign` 후보입니다. `technique` 값이 없습니다. blackbox-test-designer 가 `fuzzTargets` 로 fuzz target 명세를 내고, test-executor 가 campaign 을 돌립니다.

**분류** specification-based 입력 모델 + 실행 도구(black-box 에서 coverage-guided grey-box 까지) · **Coverage Item** 만들지 않음. 실행 단위는 fuzz target 하나

## 언제 쓰나

fuzzing 은 대상이 예상하지 않은 입력(기대 입력 공간을 벗어난 입력)을 대량으로 만들어 실행하고, 실행 하나하나가 정책을 어겼는지 bug oracle 로 판정하는 기법입니다. 처음에는 무작위 문자열로 유틸리티가 죽는지만 봤고, 지금은 실행 중 code coverage 를 되먹여 새 경로에 닿은 입력을 seed 로 남기는 coverage-guided(grey-box) 방식이 주류입니다.

아래 형태가 있으면 씁니다. 다른 기법을 대체하지 않습니다.

| 대상의 형태 | 이유 |
|---|---|
| 바이트열, 문자열, 구조화된 문서를 받아 해석합니다(파서, 디코더, 역직렬화) | 입력 공간이 넓고 손으로 고른 값이 닿지 않는 경로가 많습니다 |
| 신뢰할 수 없는 쪽에서 온 입력을 처리합니다(보안 경계, 외부 요청) | 어떤 입력에도 죽지 않고 선언된 방식으로만 거절해야 합니다 |
| 메모리를 직접 다루는 언어이거나 그런 라이브러리를 부릅니다 | sanitizer 가 잡는 메모리 오류는 다른 기법의 단언으로 드러나지 않습니다 |

### oracle 은 세 층입니다

fuzzing 은 입력마다 기대값을 계산하지 않습니다. 그래서 무엇을 실패로 볼지가 기법의 전부이고, beaker 에서는 그 근거를 아래처럼 나눕니다.

| 층 | 실패로 보는 것 | 근거 |
|---|---|---|
| generic | crash, panic, hang(시간 초과), OOM, sanitizer 오류 | 명세가 필요 없습니다. 어떤 명세도 대상이 죽기를 요구하지 않습니다 |
| 선언된 거절 | 명세가 정한 거절 방식(`errorType`) 밖의 예외 | 명세의 거절 규칙. 그 규칙이 없으면 이 층은 비어 있습니다 |
| relation | 명세에서 뽑은 결과 불변식이 깨짐(예: 직렬화 왕복) | `metamorphic-relation` 이나 `property-based` 가 명세에서 고른 relation |

명세가 「잘못된 입력을 어떻게 거절하는가」를 말하지 않으면, 관리형 언어의 처리되지 않은 예외는 결함인지 판정할 수 없습니다. 이때 설계자는 거절 방식을 지어내지 않고 `ambiguities` 에 올리며, 그 target 은 generic 층만으로 돌립니다.

## 이 기준을 쓰는 법

단계가 켜졌을 때 역할마다 따를 순서입니다.

1. **설계자는 입력을 만들지 않고 fuzz target 을 명세합니다.** 대상 진입점, 흔들 파라미터, 고정할 파라미터와 그 값, 허용 결과(값 반환, 또는 명세가 정한 `errorType` 목록), 적용할 relation, seed 로 쓸 기존 케이스를 적습니다. 허용 결과마다 `basisRefs` 를 겁니다.
2. **흔들 파라미터는 명세가 외부 입력이라고 말한 것만 고릅니다.** 명세가 호출자 책임으로 둔 파라미터(`OBL-` 의 대상)를 흔들면 상대 컴포넌트가 막아 줄 입력으로 결함을 만들어 냅니다.
3. **seed 는 equivalence-partitioning 과 boundary-value-analysis 케이스의 `inputs` 에서 가져옵니다.** valid 파티션 대표값과 경계값이 coverage-guided 탐색의 출발점이 됩니다. 명세가 문법을 주면 syntax-based 가 seed 와 dictionary 를 줍니다.
4. **harness 는 저장소가 이미 쓰는 fuzz 프레임워크로 씁니다.** 언어의 기본 fuzz 지원이나 저장소에 설정된 fuzzer 를 찾고, 없으면 그 target 은 `unresolved` 입니다. 무작위 반복문을 손으로 짜서 대신하지 않습니다.
5. **대상이 프로세스 밖에 부수 효과를 내면 campaign 을 돌리지 않습니다.** 파일 쓰기, 네트워크, 외부 저장소 호출이 입력 수만큼 반복됩니다. 저장소의 기존 test double 로 끊을 수 없으면 `unresolved` 로 올립니다.
6. **찾은 입력은 최소화한 뒤 재생해서 다시 실패하는지 확인합니다.** 다시 실패하지 않는 입력은 incident 가 아니라 리포트의 메모로 남깁니다.

리포트를 읽을 때는 target 마다 예산, 실행 횟수, corpus 크기, 도구가 내는 coverage, 찾은 입력 수를 봅니다. 짧은 예산에서 아무것도 못 찾은 것은 「결함이 없다」가 아니라 「그 예산 안에서 못 찾았다」로 읽습니다.

## 만들지 않는 이유

- Coverage Item 을 만들지 않습니다. fuzzing 에는 정해진 coverage criterion 이 없고, 결과가 실행 시간과 도구에 따라 달라지며, 입력 생성은 설계자가 아니라 fuzzer 가 합니다.
- 그래서 TestCondition, CoverageItem, TestCase 대신 설계 산출물의 `fuzzTargets` 에 target 명세만 둡니다. 결과는 Requirement Coverage 와 Structural Coverage 의 분모와 분자에 넣지 않습니다.

## 하지 않는 것

- `technique` 필드에 `fuzzing` 을 쓰지 않습니다.
- 명세가 거절 방식을 말하지 않을 때 거절 방식을 지어내지 않습니다.
- 명세가 호출자 책임으로 둔 파라미터를 흔들지 않습니다.
- fuzz 프레임워크 없이 무작위 반복문을 손으로 짜서 대신하지 않습니다.
- campaign 결과(corpus, coverage, 찾은 입력)를 블랙박스 payload 에 넣지 않습니다.
- 재생해서 다시 실패하지 않는 입력을 incident 로 올리지 않습니다.

<example>
명세가 「P1 은 외부에서 받은 값이다. 형식이 맞지 않으면 E1 으로 거절한다」고 말하고, 「같은 값을 직렬화했다가 읽으면 원래 값과 같다」는 relation 이 있을 때.

```
FZ-01  대상 S1                                    REQ-01, REQ-02
  fuzzedParams     P1
  fixedInputs      { P2: V1 }
  allowedOutcomes  value | throws E1 (REQ-01)
  relations        CI-03 (equivalent-representation 왕복)
  seedCaseRefs     BB-01, BB-02, BB-05

campaign 결과
  FF-01  oracle: undeclared-exception E2   재생 확인됨
         -> E1 만 허용했으므로 requirement-implementation-discrepancy
  FF-02  oracle: hang                       재생 확인됨
         -> robustness-failure
```

명세가 거절 방식을 말하지 않았다면 FF-01 은 ambiguous-requirement 로 갑니다. FF-02 는 명세와 상관없이 robustness-failure 입니다.
</example>

## 다른 기법과의 관계

fuzzing 에는 정해진 coverage criterion 이 없어서 다른 기준을 포함하거나 다른 기준에 포함되는 관계가 성립하지 않습니다. grey-box 가 쓰는 edge coverage 는 입력을 고르는 신호이지 도달해야 할 목표가 아닙니다.

- **겹치는 것**: property-based([`beaker:bb-property-based`](../bb-property-based/SKILL.md)). 둘 다 입력을 대량 생성하고 불변식을 단언합니다. property-based 는 타입에서 생성기를 만들고 shrink 해서 일반 시험처럼 짧게 돌리고, fuzzing 은 coverage 를 되먹이며 오래 돌리고 generic oracle 을 기본으로 둡니다. 저장소의 fuzz 프레임워크가 property 형태의 harness 를 받으면 같은 harness 를 두 기법이 함께 씁니다.
- **입력을 받는 것**: equivalence-partitioning([`beaker:bb-equivalence-partitioning`](../bb-equivalence-partitioning/SKILL.md))과 boundary-value-analysis([`beaker:bb-boundary-value-analysis`](../bb-boundary-value-analysis/SKILL.md))가 seed 를, syntax-based([`beaker:bb-syntax-based`](../bb-syntax-based/SKILL.md))가 문법과 dictionary 를 줍니다.
- **oracle 을 받는 것**: metamorphic-relation([`beaker:bb-metamorphic-relation`](../bb-metamorphic-relation/SKILL.md))과 property-based 의 relation 을 harness 단언으로 씁니다.
- **보완하는 것**: error-guessing([`beaker:bb-error-guessing`](../bb-error-guessing/SKILL.md))은 사람이 아는 단골 결함 입력을 고르고 fuzzing 은 사람이 떠올리지 못한 입력을 찾습니다. error-guessing 이 고른 입력은 seed 로도 씁니다.
- **혼동하지 않는 것**: mutation-testing([`beaker:wb-mutation-testing`](../wb-mutation-testing/SKILL.md))은 프로그램을 변형해 시험의 약점을 찾고, fuzzing 은 입력을 변형해 프로그램의 약점을 찾습니다.

## beaker 통합

- **verdict**: stage. Coverage Item 을 만들지 않고, 결과가 실행 시간과 도구에 따라 달라지며, 입력 생성은 설계자가 아니라 fuzzer 가 합니다. `Technique` enum 에 넣지 않고 파이프라인 [7] Execution 뒤의 선택 단계 `[7f] Fuzz campaign` 으로 둡니다.
- **블랙박스 격리와의 관계**: 설계자는 fuzz target 명세만 반환하므로 도구가 필요 없습니다. coverage 되먹임은 fuzzer 안에서만 입력 선택에 쓰이고 허용 결과에는 들어가지 않으므로 I1, I2 를 깨지 않습니다. 대신 campaign 결과(corpus, coverage, 찾은 입력)는 블랙박스 payload 에 넣지 않습니다. `${CLAUDE_PLUGIN_ROOT}/references/process.md` 가 payload 에서 금지한 「커버리지 결과」와 같은 정보입니다.
- **쓰는 역할**: blackbox-test-designer 가 `fuzzTargets` 를 반환합니다. test-implementer 가 harness 를 쓰고, test-executor 가 시간 예산 안에서 campaign 을 돌린 뒤 찾은 입력을 재생합니다. test-reporter 가 incident 로 올립니다. whitebox-test-designer 는 쓰지 않습니다.
- **Coverage Item 단위**: 없음. Requirement Coverage 와 Structural Coverage 의 분모와 분자에 넣지 않습니다. 리포트에는 target 마다 예산, 실행 횟수, corpus 크기, 도구가 내는 coverage, 찾은 입력 수를 따로 적습니다.
- **재실행**: `run` 모드는 campaign 을 다시 돌리지 않고 저장된 재생 입력만 일반 시험처럼 돌립니다(Go 의 `testdata/fuzz`, Jazzer 의 regression mode). campaign 결과는 매번 달라서 I7 을 지키려면 재생 입력만 고정해야 합니다.
- **PR 코드 실행 제한**: campaign 은 PR 코드를 입력 수만큼 반복 실행하므로 `${CLAUDE_PLUGIN_ROOT}/references/pr-review.md` 의 실행 판정을 그대로 따릅니다. 포크이거나 확인할 수 없으면 harness 작성까지만 하고 campaign 을 건너뛰며 「검증하지 못한 것」에 이유를 남깁니다. 같은 저장소 브랜치여도 사용자가 `--fuzz` 와 예산을 명시해야 돌립니다. 프레임워크가 재생 입력을 저장소 안(`testdata/fuzz`, `src/test/resources`)에 쓰므로 worktree 정리 전에 작업 루트로 복사합니다.
- **비용**: 예산이 곧 비용이고 결과의 질도 예산에 비례합니다. 짧은 예산에서 아무것도 못 찾은 것은 「결함이 없다」가 아니라 「그 예산 안에서 못 찾았다」로 적습니다.
- **한계**: generic oracle 은 틀린 값을 조용히 돌려주는 결함을 잡지 못합니다. 그런 결함은 relation 층이 있을 때만 잡힙니다. 명세가 거절 방식을 정하지 않으면 관리형 언어에서 찾은 예외 대부분이 ambiguous-requirement 가 됩니다. 저장소에 fuzz 프레임워크가 없으면 이 단계는 통째로 `unresolved` 입니다.

## 출처

- B. P. Miller, L. Fredriksen, B. So, 「An Empirical Study of the Reliability of UNIX Utilities」, Communications of the ACM 33(12), 1990. 목록: https://pages.cs.wisc.edu/~bart/fuzz/
- V. J. M. Manès 외, 「The Art, Science, and Engineering of Fuzzing: A Survey」, arXiv:1812.00140. 2절 정의(fuzzing, bug oracle)와 black-, grey-, white-box fuzzer 분류. https://arxiv.org/abs/1812.00140
- A. Zeller 외, 「The Fuzzing Book」, Fuzzing 장(oracle: crash, sanitizer, assertion)과 Greybox Fuzzing 장. https://www.fuzzingbook.org/html/Fuzzer.html , https://www.fuzzingbook.org/html/GreyboxFuzzer.html
- LLVM libFuzzer 문서(fuzz target, crash/timeout/OOM/leak 보고, `-max_total_time`, `-merge`). https://llvm.org/docs/LibFuzzer.html
- Go Fuzzing 문서(`testing.F`, 실패 판정, 최소화한 입력을 `testdata/fuzz` 에 저장해 일반 시험으로 재생). https://go.dev/doc/security/fuzz/
- Jazzer README(JUnit `@FuzzTest`, regression mode 와 fuzzing mode, 처리되지 않은 예외와 sanitizer 를 실패로 봄). https://github.com/CodeIntelligenceTesting/jazzer
- ISO/IEC/IEEE 29119-4, random testing 절(무작위 입력 생성 기법. fuzzing 이라는 이름으로는 다루지 않음).
