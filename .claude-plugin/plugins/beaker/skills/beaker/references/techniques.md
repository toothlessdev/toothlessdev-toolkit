# test techniques

ISO/IEC/IEEE 29119-4 의 분류를 따릅니다. 기법은 **Test Condition 을 Coverage Item 으로 바꾸는 규칙**입니다.

```
Test Condition  --[technique]-->  Coverage Item  -->  Test Case
```

기법을 고른다는 건 "이 조건에서 무엇을 세어야 충분한가"를 정하는 것입니다.

---

## 표현 규약 — 먼저 읽어라

이 문서들은 세 가지 형태로 말합니다. 형태가 곧 구속력입니다.

| 형태 | 구속력 | 다루는 법 |
|---|---|---|
| 타입 블록 · 제약 표 | **계약** | 필드 이름·열거값·접두사를 리터럴로 지킵니다 |
| 산문 규칙 | **규범** | 판단 기준으로 삼습니다 |
| `<example>` 로 감싼 것 | **참고** | 흐름만 봅니다. 값은 하나도 가져오지 않습니다 |

`<example>` 안의 이름과 값은 전부 자리표시자입니다. `paramA`, `fieldX`, `T`, `C1`, `S1`, `P1` 은 이름이 아니라 슬롯이며 대상에 대해 아무것도 말하지 않습니다.

- **경계와 임계값은 기호(`T`)로 씁니다.** 예시에 리터럴 경계 숫자가 보이면 그건 이 문서의 오류입니다
- 표기법(`->`, `= one of {}`)은 어떤 프로그래밍 언어도 아닙니다. 대상 언어의 문법으로 읽지 마세요
- 예시의 도메인을 대상에 투영하지 마세요

산출물에 쓸 값은 **전부 대상의 명세 또는 구현에서 나와야 합니다.**

---

## 지원 기법

| 기법 | 분류 | 쓰는 에이전트 | Coverage Item 이 되는 것 |
|---|---|---|---|
| [equivalence-partitioning](techniques/equivalence-partitioning.md) | specification-based | BB | 각 파티션 |
| [boundary-value-analysis](techniques/boundary-value-analysis.md) | specification-based | BB | 각 경계값 |
| [decision-table](techniques/decision-table.md) | specification-based | BB | 각 rule |
| [state-transition](techniques/state-transition.md) | specification-based | BB, WB | 각 transition |
| [branch-condition](techniques/branch-condition.md) | structure-based | WB | 각 분기 결과 |

**5개가 전부입니다.** 목록에 없는 기법 이름을 `technique` 필드에 쓰지 마세요.

---

## 선택 규칙

Test Condition 의 **형태**를 보고 고릅니다. 도메인이 아니라 형태입니다. 조건 하나에 기법이 둘 이상 붙어도 됩니다.

| 조건의 형태 | 기법 |
|---|---|
| 값의 부류가 나뉘고 부류마다 결과가 다릅니다 | equivalence-partitioning |
| 순서 있는 도메인에 임계값이 있습니다 | + boundary-value-analysis |
| 불리언 조건 여러 개의 조합으로 결과가 결정됩니다 | decision-table |
| 같은 입력이라도 이전 이력에 따라 결과가 다릅니다 | state-transition |

EP 와 BVA 는 거의 항상 같이 갑니다. 파티션을 나누면 그 경계가 따라 나옵니다.

화이트박스 설계자는 `branch-condition` 이 기본이고, 대상이 상태를 갖고 있으면 `state-transition` 을 추가합니다.

---

## 공통 규칙

**1. Coverage Item 마다 테스트 케이스가 최소 1개.**

커버리지 지표가 이 관계로 계산됩니다. 케이스를 못 만든 커버리지 항목은 그대로 남기세요 — 지우면 커버리지가 100% 로 보이는 거짓말이 됩니다.

**2. `rationale` 에 기법의 논리를 적습니다.**

"BVA 를 썼다"가 아니라 "명세가 지정한 경계이고 반대편의 가장 가까운 값"처럼 적습니다. 몇 주 뒤 이 케이스를 지워도 되는지 판단하려면 그 문장이 필요합니다.

**3. 명세에 없는 값을 만들어내지 않습니다.**

파티션·경계·조합·전이를 나눌 근거가 명세에 없으면 발명하지 말고 `ambiguities` 에 올리세요. 발명한 값은 검증하는 게 아무것도 없으면서 통과하거나 실패합니다.
