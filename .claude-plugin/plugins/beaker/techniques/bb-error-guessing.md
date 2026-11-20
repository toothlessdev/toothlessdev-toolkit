# Error Guessing

**분류** experience-based · **Coverage Item** 아래 결함 목록의 범주 하나와, 그 범주를 받을 수 있는 파라미터 하나의 쌍 · **쓰는 곳** blackbox-test-designer

## 언제

ISTQB 와 29119-4 의 error guessing 은 테스터의 경험(이 앱이 전에 어떻게 실패했는지, 개발자가 자주 하는 실수, 비슷한 앱의 실패)으로 결함이 날 자리를 예상하고 그 자리를 겨냥하는 기법입니다. 경험을 목록으로 적어 두고 항목마다 시험을 만드는 방식을 fault attack 이라고 부릅니다.

beaker 는 경험 대신 **이 문서의 닫힌 결함 목록**을 씁니다. 블랙박스 설계자는 대상의 실패 이력도, 개발자도, 비슷한 앱도 모릅니다. 설계자가 「여기가 터질 것 같다」고 느끼는 것은 재현할 수 없고 검증할 수도 없습니다. 그래서 beaker 의 error guessing 은 목록이 고정된 fault attack 입니다.

명세의 파티션과 경계가 다룬 입력은 equivalence-partitioning 과 boundary-value-analysis 가 이미 셉니다. error guessing 은 그 밖에서, **public interface 는 받지만 명세가 처리를 말하지 않은 입력**을 찾습니다. 그래서 이 기법이 내는 결과의 상당수는 케이스가 아니라 `ambiguities` 입니다. 그게 이 기법이 beaker 에서 하는 일입니다.

## 결함 목록

`errorCategory` 필드의 값은 아래 일곱 개 중 하나입니다. 범주마다 그 범주를 겨냥할 수 있게 해 주는 타입 조건이 있습니다. 조건이 `<public-types>` 에서 성립하지 않으면 그 범주는 그 파라미터에 적용하지 않습니다.

| errorCategory | 타입 조건 | 겨냥하는 결함 |
|---|---|---|
| `absent-value` | 파라미터나 필드가 nullable 이거나 생략 가능 | 값이 없을 때의 역참조, 기본값 누락 |
| `empty-collection` | 컬렉션 타입 | 빈 입력에서의 나눗셈, 첫 원소 접근, 집계 초기값 |
| `single-element` | 컬렉션 타입 | 루프 종료 조건, 구분자 처리 |
| `duplicate-elements` | 컬렉션 타입이고 명세가 원소를 서로 비교하거나 식별함 | 중복 합산, 중복 제거 누락 |
| `zero-value` | 숫자 타입 | 0 으로 나누기, 부호 판정 |
| `empty-text` | 문자열 타입 | 빈 문자열과 값 없음의 혼동, 길이 0 처리 |
| `time-offset` | 시각 타입이 offset 이나 zone 을 담음 | 같은 시각의 다른 offset 을 다르게 처리 |

목록에 없는 범주를 쓰지 않습니다. 동시 실행, 자원 고갈, 타임아웃처럼 케이스 하나의 `inputs` 로 만들 수 없는 결함은 이 목록에 넣지 않았습니다.

## 규칙

1. **입력은 타입에서, 기대값은 명세에서 가져옵니다.** 범주를 고르는 근거는 `<public-types>` 이고, 그 입력의 결과를 정하는 근거는 `<requirements>` 뿐입니다. 입력을 고를 근거와 기대값을 정할 근거가 다르다는 점이 이 기법을 다른 명세 기반 기법과 가르는 지점입니다.
2. **이미 센 입력은 다시 세지 않습니다.** 같은 Test Condition 에서 equivalence-partitioning 이나 boundary-value-analysis 의 Coverage Item 이 같은 입력을 이미 덮으면 error-guessing 항목을 만들지 않습니다. 명세가 「값이 없으면 거부한다」고 말했다면 그건 이미 무효 파티션입니다.
3. **타입이 막으면 만들지 않습니다.** non-null 타입에 `absent-value` 를 넣을 수 없습니다. public interface 로 만들 수 없는 입력은 Coverage Item 이 되지 않고, 그 사실을 `assumptions` 에 적지도 않습니다. 타입 조건이 성립하지 않았을 뿐입니다.
4. **명세가 결과를 정하면 케이스를 만듭니다.** 기대값은 `Expected` union 의 세 종류로만 씁니다.
    - 명세가 그 입력의 결과를 말하면 `kind: "value"` 입니다.
    - 명세가 그 입력을 거부한다고 말하고 오류 종류까지 정하면 `kind: "throws"` 입니다.
    - 명세가 결과의 관계를 정하면 `kind: "relation"` 입니다. 예를 들어 `time-offset` 은 명세에 시각 수용 규칙이 있을 때 `equivalent-representation` 이 되고, `empty-collection` 은 명세가 항목별 합성 규칙을 말할 때 `decomposition` 의 빈 집합이 됩니다.
5. **명세가 결과를 정하지 않으면 `ambiguities` 로 보냅니다.** Coverage Item 은 `conditions` 에 남기고, `Ambiguity` 의 `blockedCoverageItems` 에 그 id 를 적습니다. `question` 에는 「public interface 는 이 입력을 받지만 명세가 결과를 지정하지 않는다」를 범주 이름과 함께 씁니다.
6. **「예외가 나지 않는다」를 기대값으로 만들지 않습니다.** 명세가 그 입력을 정상 입력이라고 말하지 않았다면 오류를 내는 것도 명세 위반이 아닐 수 있습니다. `Expected` 에 그런 종류가 없는 것도 같은 이유입니다. 명시적 오라클 없이 이상 종료만 보는 일은 fuzzing 몫입니다.
7. **`rationale` 에는 범주와 타입 조건을 적습니다.** 「파라미터 P1 이 컬렉션 타입이고 명세의 파티션이 빈 컬렉션을 다루지 않음」처럼 씁니다.

<example>
`<public-types>` 에서 P1 은 컬렉션 타입, P2 는 nullable 타입, P3 은 non-null 문자열 타입이고, REQ 항목 하나가 「결과는 P1 의 각 원소가 기여한 값을 합친 것이다」라고 말할 때.

```
TC-01  결과는 P1 원소별 기여의 합이다                       REQ 항목
  CI-01  equivalence-partitioning  P1 이 원소를 가진 컬렉션
  CI-02  error-guessing  empty-collection    P1
         → 명세의 합성 규칙이 빈 집합을 정의하면 decomposition 케이스
         → 정의하지 않으면 blocked, ambiguities 로
  CI-03  error-guessing  single-element      P1
  CI-04  error-guessing  duplicate-elements  P1
         → 명세가 원소를 식별하지 않으면 타입 조건 불성립. 만들지 않음
  CI-05  error-guessing  absent-value        P2
         → 명세가 P2 없음의 결과를 말하지 않으면 blocked

P3 은 non-null 이므로 absent-value 를 적용하지 않습니다.
empty-text 는 명세가 P3 의 빈 값을 거부한다고 말했다면 이미 무효 파티션이므로 만들지 않습니다.
```
</example>

## 다른 기법과의 관계

- **equivalence-partitioning (bb-equivalence-partitioning.md)**: 앞단입니다. error guessing 은 EP 파티션이 덮지 않은 입력만 셉니다. EP 의 「파티션을 느낌으로 쪼개지 않는다」 규칙은 그대로 남고, error guessing 은 쪼개는 대신 닫힌 목록과 타입 조건으로 질문을 만듭니다.
- **boundary-value-analysis (bb-boundary-value-analysis.md)**: `zero-value`, `empty-collection`, `empty-text` 는 명세 도메인의 최솟값과 겹칠 때가 많습니다. 명세가 그 경계를 말하면 BVA 가 세고, error guessing 은 만들지 않습니다.
- **metamorphic-relation (bb-metamorphic-relation.md)**: `time-offset` 과 `empty-collection` 은 relation 기대값으로 이어질 때가 많습니다. 수용 규칙이나 합성 규칙이 없으면 두 기법 모두 `ambiguities` 로 갑니다.
- **fuzzing (bb-fuzzing.md)**: 둘 다 결함이 잘 나는 입력을 겨냥합니다. fuzzing 은 많은 입력과 이상 종료 오라클을 쓰고, error guessing 은 범주당 입력 하나와 명세 오라클을 씁니다.
- **exploratory (bb-exploratory.md)**: 둘 다 experience-based 입니다. 목록이 정해지지 않은 경험 기반 탐색은 exploratory 몫이고, beaker 의 error guessing 은 목록이 닫혀 있습니다.
- **syntax-based (bb-syntax-based.md)**: 문자열 입력의 형식 오류는 문법이 있으면 syntax-based 가 세고, 문법이 없을 때 남는 `empty-text` 만 error guessing 이 셉니다.
- **mutation-testing (wb-mutation-testing.md)**: 둘 다 fault-based 입니다. mutation 의 결함 목록은 구현에 넣는 operator 이고, error guessing 의 결함 목록은 입력 범주입니다.
- 포함 관계는 없습니다. error guessing 은 구조나 명세 논리식을 세는 기준이 아니라서, 커버리지 기준 계층의 어느 기준도 이 기법을 포함하지 않고 이 기법도 어느 기준을 포함하지 않습니다.

## beaker 통합

- **verdict**: technique. `Technique` 값은 `error-guessing` 입니다.
- **쓰는 설계자**: blackbox-test-designer. whitebox-test-designer 는 쓰지 않습니다. 구현에서는 null 검사나 빈 컬렉션 처리가 실제 predicate 로 보이므로 branch-condition 이 이미 셉니다.
- **Coverage Item 단위**: (errorCategory, 파라미터) 쌍 하나. 타입 조건이 성립하고 EP·BVA 가 덮지 않은 쌍만 Coverage Item 이 됩니다.
- **「명세에 없는 값을 발명하지 않는다」와의 충돌 해소**: 입력은 public types 로 만들 수 있는 값이라 발명이 아니고, 기대값은 명세에서만 나옵니다. 명세가 결과를 정하지 않은 쌍은 blocked Coverage Item 과 `Ambiguity` 가 되고, reporter 가 `ambiguous-requirement` incident 로 올립니다.
- **스키마 변경**: `CoverageItem` 에 `errorCategory` 필드를 더합니다. `technique` 이 `error-guessing` 이면 필수이고, 아니면 생략합니다.
- **커버리지**: 식은 바꾸지 않습니다. blocked 항목이 Requirement Coverage 분모에 들어가 수치를 낮추므로, 리포트는 그중 error-guessing 항목 수를 따로 적습니다.
- **비용**: 파라미터 수 곱하기 적용되는 범주 수만큼 Coverage Item 이 생깁니다. 대부분 케이스 하나씩이라 실행 비용은 작고, 늘어나는 것은 `ambiguities` 를 사람이 읽는 비용입니다.
- **한계**: 목록 밖의 결함은 찾지 못합니다. 대상 도메인의 실패 이력을 쓰지 않으므로 ISTQB 가 말하는 경험의 이점은 없습니다. 동시성과 시간 경과처럼 케이스 하나로 만들 수 없는 결함은 다루지 않습니다.

## 출처

- ISTQB, Certified Tester Foundation Level Syllabus v4.0.1(2024), 4.4.1 Error Guessing 과 4.4.3 Checklist-Based Testing. 경험 출처 세 가지, 입력·출력·로직·계산·인터페이스·데이터 결함 범주, fault attack 정의를 확인했습니다. [ISTQB_CTFL_Syllabus_v4.0.1.pdf](https://www.istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf)
- ISO/IEC/IEEE 29119-4:2021, 3.33 experience-based testing 정의와, 목차의 5.4.1 Error guessing 및 6.4 Error guessing coverage. 정의와 목차만 확인했고 5.4.1 본문은 확인하지 못했습니다. [표준 미리보기](https://cdn.standards.iteh.ai/samples/79430/6c93dfe4a05b46a8895e04dfd74ddd24/ISO-IEC-IEEE-29119-4-2021.pdf)
- Glenford J. Myers, *The Art of Software Testing* (1979), error guessing 절. 0 과 빈 입력 같은 단골 상황 목록의 원전입니다(책 이름과 절만 적습니다).
- James A. Whittaker, *How to Break Software* (2003). 공격 목록 방식의 fault attack 입니다(책 이름만 적습니다).
- [Error guessing, Wikipedia](https://en.wikipedia.org/wiki/Error_guessing). Myers 의 원전과 fault attack, 결함 카탈로그 문헌의 연결을 확인했습니다.
