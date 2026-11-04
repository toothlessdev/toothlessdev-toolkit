---
paths:
  - "**/*.{ts,tsx,js,jsx,mjs,cjs,vue,svelte,java,kt,scala,py,go,rs,rb,php,cs,c,h,cpp,hpp,swift,dart}"
---

# 문제의 복잡성과 표현의 복잡성

판단 질문: 이 복잡함은 문제에서 왔는가, 내가 쓴 방식에서 왔는가.

| 구분 | 뜻 | 대응 |
| --- | --- | --- |
| 문제의 복잡성 | 도메인 규칙, 알고리즘처럼 어떻게 써도 남는 복잡성 | 숨기지 않고 드러낸다 |
| 표현의 복잡성 | 쓰는 방식 때문에 생기고, 문제를 푸는 데는 필요 없는 복잡성 | 없앤다 |

## 표현의 복잡성에서 먼저 없앨 것

- 구현이 하나뿐인 인터페이스, 팩토리, 전략 패턴
- 로직 없이 전달만 하는 계층과 재export
- 아직 없는 요구를 위한 옵션, 설정, 제네릭 파라미터
- 다른 값에서 계산할 수 있는데 따로 저장한 상태
- 타입이나 호출 구조상 일어날 수 없는 경우를 막는 방어 코드. 검증은 외부 입력을 받는 경계에서 한다.

코드베이스의 아키텍처가 정한 인터페이스(포트와 어댑터, 모듈 공개 API 등)는 구현이 하나뿐이어도 없애지 않는다.

```kotlin
// ✗ (example) 구현이 하나뿐인데 인터페이스와 팩토리가 먼저 있습니다
interface RefundAmountStrategy {
    fun calculate(claim: Claim): Long
}

@Component
class DefaultRefundAmountStrategy : RefundAmountStrategy {
    override fun calculate(claim: Claim): Long = claim.lines.sumOf { it.paidAmount }
}

@Component
class RefundAmountStrategyFactory(private val defaultStrategy: DefaultRefundAmountStrategy) {
    fun create(): RefundAmountStrategy = defaultStrategy
}

val amount = refundAmountStrategyFactory.create().calculate(claim)

// ✓ (example) 구현이 둘 이상 실제로 필요해질 때 추상화합니다
val amount = claim.lines.sumOf { it.paidAmount }
```

## 없는 상태를 타입으로 막는다

코드를 읽을 때 가능한 조합을 전부 따지지 않게 한다.

```kotlin
// ✗ (example) 승인됐는데 거절 사유도 있는 조합까지 따져야 합니다
data class RefundResult(
    val isApproved: Boolean,
    val refund: Refund?,
    val rejectionReason: String?,
)

// ✓ (example) 가능한 상태만 남습니다
sealed interface RefundResult {
    data class Approved(val refund: Refund) : RefundResult

    data class Rejected(val rejectionReason: String) : RefundResult
}
```

## 추상화하는 시점

- 이름을 붙일 수 있는 개념이 보일 때 추상화한다. 모양이 닮았다는 것만으로 합치지 않는다.
- 같은 이유로 함께 바뀌는 코드만 합친다.
- 합친 함수가 어느 호출부인지 구분하는 인자(`isAdminRequest` (example))를 받기 시작하면 잘못 합친 것이다. 다시 나눈다.

## 문제의 복잡성은 드러낸다

- 정산 규칙, 동시성, 순서 의존처럼 줄일 수 없는 복잡성을 추상화로 덮지 않는다.
- 관련 규칙을 한 곳에 모으고 적용 순서가 코드에서 보이게 쓴다.
- 짧게 만들려고 경우의 수를 빠뜨리지 않는다.
- 외부 시스템의 제약이나 비직관적인 선택처럼 코드만으로 알 수 없는 이유는 주석으로 남긴다.
- 코드가 이미 말하는 내용은 주석으로 반복하지 않는다. 주석보다 이름과 구조로 먼저 설명한다.
