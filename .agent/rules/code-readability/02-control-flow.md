---
paths:
  - "**/*.{ts,tsx,js,jsx,mjs,cjs,vue,svelte,java,kt,scala,py,go,rs,rb,php,cs,c,h,cpp,hpp,swift,dart}"
---

# 조건식과 제어 흐름

판단 질문: 위에서 아래로 읽기만 해도 됩니까. 되돌아가서 따져 봐야 합니까.

## 흐름의 방향

- 예외와 실패를 먼저 걸러내고, 정상 흐름을 들여쓰기가 가장 얕은 곳에 둡니다.
- `return` · `throw` 뒤에 `else` 를 쓰지 않습니다.
- 중첩이 2단을 넘으면 early return 이나 함수 분리를 먼저 시도합니다.

```kotlin
// ✗ (example) 지금 어느 조건 안에 있는지 계속 기억해야 합니다
fun getRefundMethod(order: Order): RefundMethod {
    if (order.isPaid) {
        if (order.paymentType == PaymentType.CARD) {
            return RefundMethod.CARD_CANCEL
        } else {
            if (order.hasBankAccount) {
                return RefundMethod.BANK_TRANSFER
            } else {
                return RefundMethod.POINT
            }
        }
    } else {
        throw OrderNotPaidException(order.id)
    }
}

// ✓ (example) 예외를 걸러낸 뒤 위에서 아래로만 읽습니다
fun getRefundMethod(order: Order): RefundMethod {
    if (!order.isPaid) throw OrderNotPaidException(order.id)

    if (order.paymentType == PaymentType.CARD) return RefundMethod.CARD_CANCEL
    if (order.hasBankAccount) return RefundMethod.BANK_TRANSFER

    return RefundMethod.POINT
}
```

## 조건식

- 이중 부정과 괄호 앞 부정은 풀어서 씁니다. `!order.isPaid` (example) 처럼 이름 하나에 붙는 부정은 그대로 씁니다.
- 이름을 부정형으로 짓지 않습니다. `isNotPaid` 대신 `isPaid` (example) 를 씁니다.
- 양쪽 분기가 모두 `return` · `throw` 없이 이어지는 `if` / `else` 는 긍정 조건을 앞에 둡니다.
- 조건이 3개 이상이거나 `&&` 와 `||` 가 섞이면 의미 단위로 이름을 붙입니다.

```kotlin
// ✗ (example) 부정을 머릿속에서 풀어야 합니다
val canCancel = !(order.isShipped || !order.isPaid)

// ✓ (example)
val canCancel = order.isPaid && !order.isShipped
```

```kotlin
// ✗ (example) 조건마다 뜻을 해석해야 합니다
if (ChronoUnit.DAYS.between(order.deliveredAt, today) <= RETURN_PERIOD_DAYS && !product.isCustomMade && (!product.isOpened || product.isDefective)) {
    returnService.requestReturn(order)
}

// ✓ (example) 조건의 뜻이 이름으로 보입니다
val isWithinReturnPeriod = ChronoUnit.DAYS.between(order.deliveredAt, today) <= RETURN_PERIOD_DAYS
val isUnopenedOrDefective = !product.isOpened || product.isDefective

if (isWithinReturnPeriod && !product.isCustomMade && isUnopenedOrDefective) {
    returnService.requestReturn(order)
}
```

## 값 고르기

- 값을 고르는 조건식(삼항 연산자, `if` 식)은 한 단계만 씁니다. 중첩되면 early return 이 있는 함수나 lookup map 으로 바꿉니다.
- 같은 값을 기준으로 3갈래 이상 나뉘면 `when` · `switch` 나 lookup map 을 씁니다.
- 닫힌 타입(sealed class, union 타입 등)의 분기는 빠진 경우가 컴파일 에러가 되게 씁니다.

## 식 하나에 일 하나

- 조건식과 `map` · `filter` 람다 안에서 상태를 바꾸지 않습니다.
- 줄 수를 줄이려고 식을 압축하지 않습니다.
- 합계처럼 값 하나로 줄이는 계산은 언어의 표준 집계 함수를 씁니다.
- 객체나 컬렉션을 조립하는 `fold` · `reduce` 는 표준 함수로 바꿀 수 있는지 먼저 봅니다. 없으면 코드베이스 컨벤션이 따로 없는 한 일반 반복문으로 씁니다.
