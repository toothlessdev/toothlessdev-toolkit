---
name: bb-syntax-based
description: 명세가 입력 형식을 형식 문법(BNF, ABNF, EBNF, 정규식, 스키마 pattern)으로 정할 때, production 마다 그것을 쓰는 유효 문자열과 production 과 mutation operator 쌍마다 문법 밖 문자열을 만들어 받을 것과 거절할 것을 시험하는 기법입니다. 파서, DSL, 프로토콜 메시지, 설정 파일, 식별자 표기에 씁니다. blackbox-test-designer 만 technique 값 syntax-based 로 씁니다.
---

# Syntax-based Testing (입력 문법 기반)

blackbox-test-designer 가 명세가 문법으로 정한 입력에 부르고, `technique` 값은 `syntax-based` 입니다.

- **분류**: specification-based
- **Coverage Item**: 문법의 production 하나마다 그 production 을 쓰는 유효 문자열 하나, production 과 mutation operator 쌍 하나마다 무효 문자열 하나

## 언제 쓰나

명세가 입력의 형식을 형식 문법(BNF, ABNF, EBNF, 정규식, 스키마의 pattern)으로 정할 때 씁니다. 파서, DSL, 프로토콜 메시지, 설정 파일, 식별자 표기처럼 입력이 구조를 가진 문자열이고, 그 구조에 맞는 입력은 받고 맞지 않는 입력은 거절해야 하는 대상입니다.

목표는 둘입니다.

- **문법을 덮습니다.** production 마다 그것을 실제로 쓰는 유효 문자열을 만들어, 유효한 입력을 거절하는 결함을 찾습니다.
- **문법을 어깁니다.** production 을 mutation operator 로 비틀어 문법 밖의 문자열을 만들어, 잘못된 입력을 받아들이는 결함을 찾습니다.

`${CLAUDE_PLUGIN_ROOT}/references/process.md` 의 「값을 비교하는 요구사항」 절이 찾아 오는 **수용 규칙**(어떤 형식과 표기를 같은 값으로 받는지)이 형식 문법으로 쓰여 있으면 이 기법의 입력이 됩니다.

## 절차

1. **문법은 `<requirements>` 의 명세 항목에서만 가져옵니다.** 코드의 정규식, 파서, 타입 이름, 주석에서 문법을 복원하지 않습니다. 명세가 형식을 산문으로만 설명하면 산문이 정한 부분만 production 으로 옮기고, 산문이 정하지 않은 부분(구분자, 반복 횟수, 허용 문자)을 채우지 않고 `ambiguities` 에 올립니다. 「수용 규칙 없음」 줄이 있는 값에는 이 기법을 쓰지 않습니다.
2. **유효 Coverage Item 을 production 하나에 하나씩 만듭니다.** 선택(`|`)으로 갈린 대안은 각각 따로 셉니다. 그 production 을 실제로 거치는 유도(derivation)로 문자열을 하나 만듭니다. production coverage 를 만족하면 terminal symbol coverage 도 만족합니다.
3. **재귀와 반복은 유도를 끝내는 쪽까지만 펼칩니다.** 재귀 production 은 재귀 대안을 한 번 거치고 base 대안으로 닫습니다. 모든 유도를 세는 derivation coverage 는 재귀가 있으면 무한이라 쓰지 않습니다. 반복 횟수 범위(`X{T1,T2}`, `X*`)는 boundary-value-analysis 의 경계 Coverage Item 으로 따로 만듭니다.
4. **무효 Coverage Item 을 production 과 mutation operator 쌍 하나에 하나씩 만듭니다.** operator 는 아래 넷입니다. 적용할 수 없는 쌍은 Coverage Item 을 만들지 않습니다.

    | operator | 하는 일 |
    |---|---|
    | `deletion` | production 에서 terminal 이나 nonterminal 하나를 뺍니다 |
    | `duplication` | production 의 terminal 이나 nonterminal 하나를 한 번 더 넣습니다 |
    | `terminal-replacement` | terminal 하나를 문법의 다른 terminal 로 바꿉니다 |
    | `nonterminal-replacement` | 기호 하나를 다른 nonterminal 이 유도한 문자열로 바꿉니다 |

5. **mutant 가 정말 문법 밖인지 확인합니다.** 비튼 문자열도 다른 production 으로 유도되면 유효 문자열입니다. 원래 문법으로 유도할 수 없음을 `rationale` 에 적고, 유도된다면 같은 쌍에서 다른 위치를 비틉니다. 어느 위치도 문법 밖으로 나가지 않으면 그 쌍은 적용할 수 없는 것으로 봅니다.
6. **무효 문자열 하나에는 위반 하나만 넣습니다.** equivalence-partitioning 의 무효 파티션 규칙과 같은 이유입니다. 위반 두 개가 있으면 어느 쪽이 거절됐는지 가를 수 없습니다. 다른 파라미터에는 유효 대표값을 넣습니다.
7. **기대값은 명세가 정한 만큼만 씁니다.** 문법은 받을지 말지만 말합니다.
    - 유효 문자열의 결과 값은 명세의 의미 규칙이 정할 때만 `kind: "value"` 로 씁니다. 명세가 받는다는 사실만 말하면 수용 여부만 단언합니다(`kind: "acceptance"`, `accepted: true`).
    - 무효 문자열은 명세가 오류 종류를 정하면 `kind: "throws"` 로, 거절한다는 사실만 말하면 수용 여부(`kind: "acceptance"`, `accepted: false`)만 단언합니다.
    - 명세가 문법 밖 입력을 거절하는지조차 말하지 않으면 무효 Coverage Item 을 `blockedCoverageItems` 에 올리고 `ambiguities` 로 보냅니다.
8. **같은 값의 다른 표기는 metamorphic-relation 과 묶습니다.** 수용 규칙 문법에서 대안 production 두 개가 명세상 같은 값을 뜻하면, 대안마다 만든 유효 문자열 케이스를 `equivalent-representation` relation 케이스의 `caseRefs` 로 겁니다. 이 기법은 어떤 표기가 있는지를 빠짐없이 뽑고, relation 은 그 표기들의 결과가 같다는 것을 단언합니다.

## 만드는 것

- **TestCondition**: 「입력 파라미터는 문법에 맞으면 받고 맞지 않으면 거절된다」 같은 성질 하나. `basisRefs` 는 문법을 정한 `REQ-` 입니다. `predicate`, `predicateClass` 는 `null` 입니다.
- **CoverageItem**: `technique` 은 `syntax-based`.
  - 유효: production 하나(선택 대안은 각각). `description` 에 파라미터와 production 원문을 씁니다.
  - 무효: production 과 operator 쌍 하나. `description` 에 production 원문, operator 이름, 비튼 위치를 씁니다.
- **TestCase**: `technique` 은 `syntax-based`. `inputs` 에 그 production 을 거치는 문자열(또는 위반 하나만 넣은 mutant)과 다른 파라미터의 유효 대표값을 넣습니다. 한 문자열이 production 여러 개를 덮으면 케이스 하나가 여러 Coverage Item 을 걸고, 공유한 사실을 `rationale` 에 적습니다. mutant 케이스의 `rationale` 에는 원래 문법으로 유도할 수 없는 이유를 적습니다.
- **Expected**: 절차 7(기대값) 그대로 `value`, `throws`, `acceptance` 중 하나입니다. `acceptance` 의 `over` 는 문법이 정한 파라미터입니다.
- **relation 케이스**: 같은 값의 다른 표기가 있으면 `technique` 이 `metamorphic-relation` 인 별도 Test Condition 과 케이스를 만들고, `caseRefs` 에 대안별 유효 케이스를 겁니다.
- **스키마에 아직 없는 것**: 어느 파라미터의 어느 production 을 어떤 operator 로 덮는지를 담는 `CoverageItem.syntax` 는 「beaker 통합」의 제안이고, 지금 `${CLAUDE_PLUGIN_ROOT}/references/schemas.md` 에는 없습니다. 그 정보는 `description` 에 씁니다.

## 하지 않는 것

- 코드의 정규식, 파서, 타입 이름, 주석에서 문법을 복원하지 않습니다.
- 산문 명세가 정하지 않은 구분자, 반복 횟수, 허용 문자를 채우지 않습니다.
- 「수용 규칙 없음」 줄이 있는 값에 이 기법을 쓰지 않습니다.
- derivation coverage 를 세지 않습니다.
- 다른 production 으로 유도되는 문자열을 무효 케이스로 쓰지 않습니다.
- 무효 문자열 하나에 위반 둘 이상을 넣지 않습니다.
- 명세가 정하지 않은 결과 값이나 오류 종류를 짓지 않습니다.

<example>
명세 REQ-01 이 입력 `P1` 의 형식을 아래 문법으로 정하고, 「`S1` 의 두 대안은 같은 값이다」라고 말할 때.

```
P1  ::= S1 C1 S2
S1  ::= V1 | V2
S2  ::= S2 V3 | V3

TC-01  P1 은 문법에 맞으면 받고 맞지 않으면 거절된다     REQ-01
  CI-01  valid   P1 ::= S1 C1 S2
  CI-02  valid   S1 ::= V1
  CI-03  valid   S1 ::= V2
  CI-04  valid   S2 ::= S2 V3      재귀 한 번 후 base 로 닫음
  CI-05  valid   S2 ::= V3
  CI-06  invalid P1 ::= S1 C1 S2 의 deletion      C1 을 뺌
  CI-07  invalid P1 ::= S1 C1 S2 의 duplication   C1 을 두 번 넣음
  CI-08  invalid S1 ::= V1 의 terminal-replacement  V1 을 V3 으로

TC-02  S1 의 두 대안은 같은 결과를 낸다                  REQ-01
  CI-09  equivalent-representation over P1, CI-02 와 CI-03 의 케이스
```

CI-02 와 CI-04 는 문자열 하나가 같이 덮을 수 있고, 공유한 사실을 `rationale` 에 적습니다. CI-07 은 `C1` 이 두 번 나와도 다른 production 으로 유도되지 않는지 확인한 뒤에만 무효 Coverage Item 입니다.
</example>

## 다른 기법과의 관계

- **안에서의 포함 관계**: production coverage 는 terminal symbol coverage 를 포함하고, derivation coverage 에 포함됩니다. 문법을 그래프로 보면 terminal symbol coverage 는 [beaker:wb-node-coverage](../wb-node-coverage/SKILL.md), production coverage 는 [beaker:wb-edge-coverage](../wb-edge-coverage/SKILL.md), derivation coverage 는 [beaker:wb-complete-path-coverage](../wb-complete-path-coverage/SKILL.md) 에 대응합니다. 대상이 코드가 아니라 명세의 문법이라 이 셋과 포함 관계는 아닙니다.
- **겹치는 것**: [beaker:bb-equivalence-partitioning](../bb-equivalence-partitioning/SKILL.md) 에서 production 의 대안은 유효 파티션이고 mutant 는 무효 파티션입니다. 이 기법은 구조가 있는 문자열 입력에서 파티션을 문법으로 체계적으로 나누는 쪽입니다. [beaker:bb-classification-tree](../bb-classification-tree/SKILL.md) 도 입력의 측면을 나누지만 문법 구조가 아니라 측면 목록을 씁니다.
- **함께 쓰는 것**: [beaker:bb-boundary-value-analysis](../bb-boundary-value-analysis/SKILL.md) 는 반복 횟수와 길이 범위의 경계를 맡습니다. [beaker:bb-metamorphic-relation](../bb-metamorphic-relation/SKILL.md) 의 `equivalent-representation` 은 절차 8(다른 표기 묶기)로 이어집니다. 유효 문자열의 직렬화 왕복이 명세에 있으면 [beaker:bb-property-based](../bb-property-based/SKILL.md) 가 같은 문법을 생성기로 씁니다.
- **같은 문법을 다르게 쓰는 것**: [beaker:bb-fuzzing](../bb-fuzzing/SKILL.md) 의 grammar-based fuzzing 은 문법에서 문자열을 대량으로 무작위 생성하고 oracle 은 크래시입니다. 이 기법은 Coverage Item 단위로 문자열을 정하고 기대값을 명세에서 가져옵니다. [beaker:wb-mutation-testing](../wb-mutation-testing/SKILL.md) 은 같은 operator 개념을 입력이 아니라 프로그램에 적용합니다.

## beaker 통합

- **verdict**: technique. `Technique` 값은 `syntax-based` 입니다.
- **쓰는 설계자**: blackbox-test-designer 만 씁니다. 화이트박스 설계자는 쓰지 않습니다. 구현의 정규식이나 파서에서 문법을 뽑으면 그건 명세가 아니라 현재 구현의 characterization 이고, 그 구조의 분기는 이미 [beaker:wb-branch-condition](../wb-branch-condition/SKILL.md) 과 [beaker:wb-mutation-testing](../wb-mutation-testing/SKILL.md) 이 맡습니다.
- **Coverage Item 단위**: production 하나(유효), production 과 mutation operator 쌍 하나(무효).
- **스키마**:
  - `CoverageItem` 에 선택 필드 `syntax` 가 필요합니다. 어느 파라미터의 어느 production 을 어떤 operator 로 덮는지를 기계가 읽을 수 있어야 executor 가 도달을 판정합니다. 아직 스키마에 없습니다.
  - 수용 여부만 단언하는 `Expected` 의 `kind: "acceptance"` 는 스키마에 들어갔습니다. 이 종류가 없으면 「받는다」만 정한 명세를 표현할 수 없어, 결과 값을 발명하거나 모든 유효 케이스를 `ambiguities` 로 보내야 했습니다.
- **도달 판정**: 값을 기대한 케이스가 입력 거절로 끝나면 `unreached` 입니다. 이 기법에서는 수용 판정 자체가 목표 동작이라, `acceptance` 케이스는 거절 이유가 `over` 파라미터를 가리키면 `reached` 이고 단언 결과대로 `fail` 입니다. 다른 파라미터 때문에 거절됐으면 `unreached` 입니다. 이 구분이 없으면 「유효 입력을 거절하는 결함」이 전부 「도달하지 못한 케이스」로 빠집니다.
- **불변식**: 문법과 기대값이 명세에서만 오므로 I1, I2(`${CLAUDE_PLUGIN_ROOT}/references/process.md` 의 「Invariant 와 강제 수단」 표)를 그대로 지킵니다. 명세의 문법이 구현의 정규식과 글자 그대로 같을 수 있지만 `--spec` 로 넘긴 명세 토큰이라 leak 이 아닙니다. `authored` 등급 문법은 구현을 보고 쓴 것일 수 있어 절차 8 의 relation 을 우선 붙입니다.
- **비용**: 유효 케이스는 production 수, 무효 케이스는 production 수에 적용 가능한 operator 수를 곱한 만큼입니다. 한 문자열이 production 여러 개를 덮으면 케이스는 줄어듭니다. terminal 대안이 많은 문자 집합 production 은 production coverage 를 그대로 지키면 케이스가 대안 수만큼 늘어나므로, 명세가 대안마다 다른 의미를 주지 않을 때만 한 Coverage Item 으로 묶고 묶은 사실을 `assumptions` 에 남깁니다.
- **한계**: 문법이 정하지 않는 의미 제약(값 범위, 필드 사이 관계, 문맥 의존 규칙)은 잡지 못해 다른 기법이 맡습니다. 명세 문법 자체가 틀리면 기대값도 같이 틀립니다. 모호한 문법(같은 문자열이 두 유도를 가짐)은 절차 5(mutant 확인)를 어렵게 하므로 발견하면 `ambiguities` 에 올립니다.

## 출처

- Paul Ammann, Jeff Offutt, 「Introduction to Software Testing」 2판, 9장 Syntax-based Testing. Terminal Symbol Coverage, Production Coverage, Derivation Coverage 의 정의와 포함 관계, grammar mutation operator 넷, ground string, Mutation Operator Coverage 와 Mutation Production Coverage 는 이 장을 따르는 강의 자료로 확인했습니다. https://www.cs.virginia.edu/~up3f/cs3250/slides/3250meet29-syntax-grammar.pdf
- ISO/IEC/IEEE 29119-4:2021, 3.1 Backus-Naur Form 과 syntax testing 용어 정의(「formal definition of the test item inputs」의 요소를 실행하는 specification-based 기법), 5.2.4 Syntax testing, 6.2.4 Syntax testing coverage. 공개 샘플에서 용어 정의와 목차만 확인했고 5.2.4, 6.2.4 본문은 확인하지 못했습니다. https://cdn.standards.iteh.ai/samples/79430/6c93dfe4a05b46a8895e04dfd74ddd24/ISO-IEC-IEEE-29119-4-2021.pdf
- Boris Beizer, 「Software Testing Techniques」 2판, Syntax Testing 장. 장 이름만 적습니다.
