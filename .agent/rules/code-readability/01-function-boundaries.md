---
paths:
  - "**/*.{ts,tsx,js,jsx,mjs,cjs,vue,svelte,java,kt,scala,py,go,rs,rb,php,cs,c,h,cpp,hpp,swift,dart}"
---

# 함수 경계와 한 번에 읽는 양

판단 질문: 이 줄을 이해하려면 무엇을 같이 기억해야 하는가. 호출부에서 이름만 읽고 넘어갈 수 있는가.

## 같이 기억할 항목 세기

한 줄을 이해하는 데 필요한데 그 줄에 보이지 않는 것을 센다.

- 바깥 `if` · `for` 의 조건
- 뒤에서 또 쓰일 지역 변수
- 앞에서 값이 바뀐 변수
- 앞 단계가 보장했다고 믿어야 하는 전제

조건, 변수, 전제는 각각 한 항목으로 센다. `users.filter { ... }.map { ... }` (example) 같은 관용구는 요소가 여럿이어도 한 항목으로 센다.

항목이 4개쯤 넘으면 아래 순서대로 줄인다.

## 줄이는 순서

가벼운 방법부터 쓴다.

1. 변수 선언을 처음 쓰는 곳 바로 위로 옮겨 유효 범위를 좁힌다.
2. 재할당을 없앤다.
3. 계산 중간 결과에 이름을 붙인다.
4. early return 으로 바깥 조건을 치운다.
5. 그래도 많으면 함수로 뺀다.

## 함수로 빼는 기준

- 호출부에서 이름만 읽고 내부를 열어 보지 않아도 될 때 뺀다.
- 호출부가 하나뿐이어도 뺀다. 목적은 재사용이 아니라 읽는 양을 줄이는 것이다.
- 한 함수 안의 줄은 같은 수준의 일을 말한다. 흐름을 나열하는 함수에 문자열 파싱이나 인덱스 계산을 섞지 않는다.

```kotlin
// ✗ (example) 환불액을 읽는 동안 승인 조건, 합계 계산, 반품 배송비 규칙을 같이 기억해야 합니다
fun createRefund(claim: Claim): Refund? {
    if (claim.status == ClaimStatus.APPROVED && claim.lines.isNotEmpty()) {
        val itemAmount = claim.lines.sumOf { it.paidAmount }
        val returnShippingFee =
            if (claim.reason == ClaimReason.CHANGED_MIND && !claim.order.isFreeReturn) {
                claim.order.returnShippingFee
            } else {
                0L
            }

        return Refund(claimId = claim.id, amount = itemAmount - returnShippingFee)
    }

    return null
}

// ✓ (example) 흐름만 읽고, 배송비 규칙이 궁금할 때만 정의로 이동합니다
fun createRefund(claim: Claim): Refund? {
    if (claim.status != ClaimStatus.APPROVED || claim.lines.isEmpty()) return null

    val itemAmount = claim.lines.sumOf { it.paidAmount }
    val returnShippingFee = calculateReturnShippingFee(claim)

    return Refund(claimId = claim.id, amount = itemAmount - returnShippingFee)
}
```

## 빼지 않는 기준

- 결국 내부를 열어 봐야 호출부를 이해할 수 있으면 빼지 않는다.
- 이름이 `handle`, `process`, `helper`, `doXAndY` (example) 처럼 뜻이 넓거나 일을 나열하는 것밖에 떠오르지 않으면 경계를 다시 정한다.
- 뺀 함수가 바깥 지역 변수를 인자로 4개 넘게 받으면 경계를 다시 본다.
- 식 하나를 감싸는 함수는 이름이 식보다 많은 정보를 줄 때만 만든다.
- 분리한 뒤 정의로 이동하는 횟수만 늘고 같이 기억할 항목이 줄지 않았으면 되돌린다.

```kotlin
// ✗ (example) 식을 감싸기만 해서 정의로 이동하는 횟수만 늘어납니다
fun getClaimLines(claim: Claim): List<ClaimLine> = claim.lines

// ✓ (example) 이름이 식에 없는 정책을 알려줍니다
fun isWithinReturnPeriod(order: Order, today: LocalDate): Boolean =
    ChronoUnit.DAYS.between(order.deliveredAt, today) <= RETURN_PERIOD_DAYS
```
