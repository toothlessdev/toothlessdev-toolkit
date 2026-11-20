---
name: bb-property-based
description: 설계 기법이 아니라 보류한 기법입니다. technique 값으로 쓰지 않습니다. 명세가 정한 입력 도메인 전체에 성립하는 성질을 라이브러리 생성기가 만든 입력 여러 개로 확인하는 property-based testing 의 규칙과, 스키마에 생성기 마커와 property 기대값이 들어간 뒤 blackbox-test-designer 가 따를 절차를 담습니다.
---

# Property-based Testing

보류한 기법입니다. `technique` 값이 없고, 스키마 변경이 계약에 들어가기 전까지 blackbox-test-designer 도 이 기법으로 Coverage Item 을 만들지 않습니다. 그 사이 실행 둘 이상을 비교하는 성질은 `beaker:bb-metamorphic-relation` 으로 씁니다.

**분류** specification-based (ISO/IEC/IEEE 29119-4 의 Random testing 에 property oracle 을 붙인 것) · **Coverage Item** 명세가 말한 property 하나와 그 property 를 확인할 생성 도메인 하나의 쌍 · **쓰는 곳** blackbox-test-designer (보류 해제 뒤)

## 언제 쓰나

다른 블랙박스 기법은 설계자가 고른 concrete 입력 몇 개로 확인합니다. property-based 는 **명세가 입력 도메인 전체에 대해 성립한다고 말한 성질**을 라이브러리 생성기가 만든 입력 여러 개로 확인합니다. 반례가 나오면 라이브러리가 그 입력을 더 작은 반례로 줄여(shrinking) 보고합니다.

아래 둘이 모두 있을 때만 씁니다.

- 명세가 입력의 도메인을 정합니다. 타입, 범위, 길이, 허용 값 목록처럼 생성기가 값을 뽑을 범위가 명세 문장에 있습니다.
- 명세가 그 도메인 전체에 대해 기계로 단언할 수 있는 성질을 말합니다. 형태는 아래 「property 종류」 표 중 하나입니다.

둘 중 하나라도 명세에 없으면 이 기법을 쓰지 않고, 도메인이 빠졌으면 `ambiguities` 에 올립니다.

### property 종류

`PropertyExpectation.property` 의 값입니다. 자연어 술어는 받지 않습니다. 기계가 단언으로 옮길 수 있는 형태만 둡니다.

| property | 단언 | 명세의 근거 문장 형태 |
|---|---|---|
| `round-trip` | 생성 입력 `V1` 에 대상을 적용하고 `inverse` 를 적용한 결과 = `V1` | 「A 한 값을 B 하면 원래 값이 된다」 |
| `constant-outcome` | 도메인의 모든 입력에 대해 결과가 `outcome` (value 또는 throws) | 「P1 에 속하는 입력은 모두 같은 오류로 거절한다」 |
| `Relation` 값 6개 | `beaker:bb-metamorphic-relation` 의 relation 을 생성 입력마다 적용 | metamorphic-relation 과 같음 |

`constant-outcome` 의 `outcome` 은 명세가 그 도메인 전체에 지정한 값이나 오류 종류뿐입니다. 생성된 입력값으로 기대값을 계산하는 property(출력이 입력에 따라 달라지는 함수식)는 설계자가 구현 없이 기계 단언으로 쓸 수 없으므로 이 목록에 없습니다.

## 이 기준을 쓰는 법

지금은 설계 산출물에 이 기법을 쓰지 않습니다. 이 스킬을 읽는 경우는 둘입니다.

- 다른 기법 스킬이 property-based 와의 관계를 말할 때, 또는 블랙박스 설계자가 명세의 성질을 어느 기법으로 옮길지 정할 때. 보류 중에는 실행 둘 이상을 비교하는 성질만 `metamorphic-relation` 으로 옮깁니다.
- 보류가 풀린 뒤 설계자가 따를 순서를 확인할 때. 아래 순서가 그 절차입니다.

1. **생성 도메인은 명세가 정한 범위로 정합니다.** `$generate` 의 `domain` 은 equivalence-partitioning 이 명세에서 나눈 파티션 CI 를 가리키고, `constraints` 의 값(범위, 길이, 허용 값)은 명세 문장에서만 가져옵니다. 이 규칙이 「명세에 없는 값을 만들어내지 않는다」를 지키는 방식입니다. 파티션과 경계는 명세에서 오고, 생성기는 그 파티션 안의 대표값을 하나가 아니라 여러 개 뽑을 뿐입니다. 기대값은 생성된 값에서 나오지 않습니다.
2. **명세가 도메인을 정하지 않은 파라미터는 생성하지 않습니다.** concrete 값을 명세에서 가져올 수 있으면 그 값을 쓰고, 없으면 `ambiguities` 에 올리고 CI 를 `blockedCoverageItems` 로 남깁니다. 타입이 허용하는 전 범위를 도메인으로 쓰지 않습니다. 타입은 계약이지만 명세가 그 범위 전부를 유효 입력으로 정한 것은 아닙니다.
3. **도메인은 생성기 구성으로만 만듭니다.** filter 와 assume 으로 도메인을 좁히지 않습니다. 생성 뒤 버리는 방식은 조건부 건너뛰기와 같아서, 버린 비율이 높아도 시험은 녹색으로 남습니다.
4. **concrete 케이스를 대체하지 않습니다.** 명세가 지정한 경계 `T` 와 특정 입력의 기대값은 boundary-value-analysis, equivalence-partitioning 의 concrete 케이스로 확인합니다. 라이브러리의 edge case 생성은 타입 수준의 값이고 명세의 경계 `T` 를 알지 못합니다.
5. **seed 를 고정합니다.** 같은 케이스는 재실행마다 같은 입력열을 써야 합니다. seed 와 시행 횟수, shrinking 된 반례는 결과에 남습니다.
6. **pass 는 「시행 횟수 안에서 반례를 못 찾았다」로 읽습니다.** 리포트에서 「성질이 성립한다」로 쓰지 않습니다.

## 만들지 않는 이유

- 보류 중에는 `Technique` 값이 아니므로 TestCondition, CoverageItem, TestCase 를 만들지 않습니다. 「beaker 통합」의 스키마 변경(생성기 마커, `PropertyExpectation`, 결과의 seed 와 반례 자리)이 계약에 들어가야 씁니다.
- 보류가 풀리면 만들 것은 이렇습니다. Coverage Item 단위는 (property, 생성 도메인) 쌍 하나이고 케이스 하나가 덮습니다. 케이스의 `inputs` 에서 생성할 파라미터 자리는 `{ "$generate": { type, domain, constraints, tries } }` 이고, `expected` 는 `kind: "property"` 입니다. 시행 횟수는 커버리지 분모와 분자에 들어가지 않습니다.

## 하지 않는 것

- 보류 중에 `technique` 필드에 `property-based` 를 쓰지 않습니다.
- 타입이 허용하는 전 범위를 생성 도메인으로 쓰지 않습니다.
- filter 와 assume 으로 도메인을 좁히지 않습니다.
- 생성된 값으로 기대값을 계산하지 않습니다.
- property-based CI 로 EP 파티션 CI 나 BVA 경계 케이스를 대체하지 않습니다.
- 리포트에서 pass 를 「성질이 성립한다」로 쓰지 않습니다.

<example>
명세가 「P1 파티션의 값은 인코딩 후 디코딩하면 원래 값이 된다」와 「C1 을 어긴 입력은 모두 명세가 지정한 오류 종류로 거절한다」를 말할 때:

```
TC-01  인코딩과 디코딩은 역연산이다             REQ-01
  CI-01  equivalence-partitioning  P1 파티션
  CI-02  property-based  round-trip over P1 (domain = CI-01)

TC-02  C1 위반 입력은 거절한다                   REQ-02
  CI-03  equivalence-partitioning  C1 위반 파티션
  CI-04  property-based  constant-outcome throws (명세의 errorType) over C1 위반 파티션 (domain = CI-03)
```

CI-02 의 케이스는 `inputs` 의 파라미터 하나가 `{ "$generate": { type, domain: "CI-01", constraints, tries } }` 이고 `expected` 는 `kind: "property"`, `property: "round-trip"`, `inverse` 는 public interface 의 디코딩 선언 이름입니다. CI-01 의 concrete 대표값 케이스는 따로 둡니다.
</example>

## 다른 기법과의 관계

- **equivalence-partitioning** ([`beaker:bb-equivalence-partitioning`](../bb-equivalence-partitioning/SKILL.md)): 생성 도메인을 공급합니다. property-based CI 는 EP 파티션 CI 를 대체하지 않고 그 위에 더해집니다.
- **boundary-value-analysis** ([`beaker:bb-boundary-value-analysis`](../bb-boundary-value-analysis/SKILL.md)): 포함하지 않습니다. 무작위 생성이 명세 경계 `T` 와 그 양옆 값을 뽑는다는 보장이 없습니다.
- **metamorphic-relation** ([`beaker:bb-metamorphic-relation`](../bb-metamorphic-relation/SKILL.md)): 겹칩니다. property 가 `Relation` 값이면 단언은 같고 source 입력을 누가 고르느냐만 다릅니다. metamorphic-relation 은 설계자가 고른 concrete 입력, property-based 는 생성 입력입니다. 같은 relation 과 같은 도메인에 CI 를 둘 만들지 않고, 도메인이 명세에 있으면 property-based 하나로 둡니다. 어느 쪽도 다른 쪽을 포함하지 않습니다.
- **fuzzing** ([`beaker:bb-fuzzing`](../bb-fuzzing/SKILL.md)): 둘 다 생성 입력을 쓰지만 fuzzing 의 oracle 은 crash 와 예외이고 property-based 의 oracle 은 명세의 성질입니다.
- **syntax-based** ([`beaker:bb-syntax-based`](../bb-syntax-based/SKILL.md)): 문법이 명세로 주어지면 그 문법에서 유효 입력 생성기를 만들어 `round-trip` 도메인으로 씁니다.
- **error-guessing** ([`beaker:bb-error-guessing`](../bb-error-guessing/SKILL.md)): 라이브러리 edge case(빈 컬렉션, 0, 비 ASCII 문자열)가 error-guessing 의 단골 입력과 겹칩니다. 도메인이 명세 범위 안일 때만 의미가 있습니다.
- **mutation-testing** ([`beaker:wb-mutation-testing`](../wb-mutation-testing/SKILL.md)): property 가 약한지(어떤 변이에도 반례가 안 나오는지)를 재는 데 씁니다.

## beaker 통합

- **verdict**: technique 로 넣을 방향이지만 지금은 보류합니다. 아래 스키마 변경(생성기 마커, `PropertyExpectation`, 결과의 seed 와 반례 자리)이 계약에 들어가기 전까지 `Technique` 값이 아니고, 설계자는 이 기법을 쓰지 않습니다. 그 사이 실행 둘 이상을 비교하는 성질은 `metamorphic-relation` 으로 씁니다.
- **쓰는 설계자**: blackbox-test-designer 만 씁니다. whitebox-test-designer 는 쓰지 않습니다. 화이트박스 기대값은 현재 구현의 출력이라 property 의 근거가 될 명세 문장이 없고, 생성 입력마다 characterization 값을 고정할 수도 없습니다.
- **Coverage Item 단위**: (property, 생성 도메인) 쌍 하나. 케이스 하나가 덮습니다. 시행 횟수는 커버리지 분모와 분자에 들어가지 않습니다.
- **스키마**: concrete `inputs` 원칙에 `$fixture` 와 같은 자리의 예외 하나를 둡니다. `inputs` 의 값 자리에 `{ "$generate": GeneratorSpec }` 을 허용하고, `${CLAUDE_PLUGIN_ROOT}/references/schemas.md` 의 `Expected` union 에 `PropertyExpectation` 을 더합니다. 결과에는 seed, 실제 시행 횟수, shrinking 된 반례를 담는 자리가 필요합니다. 구체 필드는 반환값의 schemaChanges 에 적었습니다.
- **reach**: 생성 입력 중 하나라도 대상이 입력 거절로 끝냈는데 property 가 그 거절을 기대하지 않았으면 `unreached` 이고, 그 입력과 거절 이유 전부를 `rejection` 에 남깁니다. 도달 보강은 다른 케이스처럼 `inputs` 에 없는 필드만 픽스처 빌더로 채웁니다. 생성 파라미터는 채우지 않습니다.
- **incident**: `fail` 이고 `reached` 면 `requirement-implementation-discrepancy` 입니다. evidence 에 shrinking 된 반례와 seed 를 넣어 사람이 같은 입력으로 다시 볼 수 있게 합니다.
- **비용**: 케이스 하나가 시행 횟수만큼 실행됩니다. jqwik 기본값은 1000회입니다. 대상 저장소에 property-based 라이브러리가 없으면 implementer 는 의존성을 더하지 않고 그 케이스를 `unresolved` 로 올립니다. 시험 의존성 추가는 저장소 관례를 바꾸는 일입니다.
- **한계**: 반례를 못 찾은 것은 성질이 성립한다는 증명이 아닙니다. 라이브러리 버전이 바뀌면 같은 seed 라도 입력열이 달라질 수 있어 재실행 동일성(I7)은 라이브러리 버전까지 고정해야 지켜집니다. 출력이 입력의 함수인 성질(정렬 결과가 입력의 순열인가 같은 postcondition)은 `property` 종류로 표현되지 않아 다루지 않습니다.

## 출처

- Koen Claessen, John Hughes, 「QuickCheck: A Lightweight Tool for Random Testing of Haskell Programs」, ICFP 2000, pp. 268-279. 서지 정보를 확인했습니다. https://research.chalmers.se/en/publication/?id=237427
- ISO/IEC/IEEE 29119-4:2021 목차. 5.2 Specification-based test design techniques 아래 5.2.10 Random testing, 5.2.11 Metamorphic testing 과 6.2.10 Random testing coverage 가 있음을 확인했습니다. 본문 정의는 확인하지 못했습니다. https://www.vde-verlag.de/iec-normen/preview-pdf/info_isoiecieee29119-4{ed2.0}en.pdf
- Hypothesis 문서, Replaying failures. 실패 예제 저장과 재실행, `@example` 로 고정한 입력은 shrinking 하지 않는다는 점을 확인했습니다. https://hypothesis.readthedocs.io/en/latest/tutorial/replaying-failures.html
- jqwik User Guide. 기본 시행 1000회, seed 와 `afterFailure`(`PREVIOUS_SEED`, `SAMPLE_FIRST`), shrinking 모드(`BOUNDED` 기본), edge case 혼합(`MIXIN`)을 확인했습니다. https://jqwik.net/docs/current/user-guide.html
- Scott Wlaschin, 「Choosing properties for property-based testing」. round-trip, invariant, idempotence, test oracle 같은 property 유형 분류를 확인했습니다. https://fsharpforfunandprofit.com/posts/property-based-testing-2/
