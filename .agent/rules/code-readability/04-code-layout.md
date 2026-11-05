---
paths:
  - "**/*.{ts,tsx,js,jsx,mjs,cjs,vue,svelte,java,kt,scala,py,go,rs,rb,php,cs,c,h,cpp,hpp,swift,dart}"
---

# 코드 배치와 빈 줄

판단 질문: 줄 배치만 봐도 어디까지가 한 덩어리인지 보입니까.

가까이 있는 줄은 한 묶음으로 읽힙니다. 그래서 빈 줄은 하는 일이 바뀌는 곳에만 둡니다. 들여쓰기와 줄 길이는 포매터에 맡깁니다.

## 붙일 줄과 띄울 줄

- 단계가 바뀌면 빈 줄로 나눕니다. 대부분의 함수는 조회와 검증, 핵심 작업, 반환 순서로 나뉩니다.
- 같은 대상을 다루는 줄은 붙이고, 다른 관심사는 띄웁니다.
- early return 과 본문 사이는 띄웁니다.
- 모든 줄을 띄우지 않습니다. 전부 띄우면 어디서 일이 바뀌는지 다시 보이지 않습니다.
- 블록을 여는 괄호 바로 뒤와 닫는 괄호 바로 앞에는 빈 줄을 두지 않습니다.
- 빈 줄은 한 번에 한 줄만 씁니다.

```kotlin
// ✗ (example) 어디까지가 조회와 검증이고 어디부터 저장인지 보이지 않습니다
@Transactional
fun settleOrder(orderId: Long): Settlement {
    val order = orderRepository.findByIdOrNull(orderId) ?: throw OrderNotFoundException(orderId)
    if (order.status != OrderStatus.DELIVERED) throw OrderNotDeliveredException(orderId)
    val fee = calculateFee(order)
    val settlement = Settlement.of(order, fee)
    settlementRepository.save(settlement)
    sellerNotifier.notifySettled(order.sellerId, settlement)
    return settlement
}

// ✓ (example) 조회와 검증, 계산, 저장과 알림, 반환이 네 덩어리로 읽힙니다
@Transactional
fun settleOrder(orderId: Long): Settlement {
    val order = orderRepository.findByIdOrNull(orderId) ?: throw OrderNotFoundException(orderId)
    if (order.status != OrderStatus.DELIVERED) throw OrderNotDeliveredException(orderId)

    val fee = calculateFee(order)
    val settlement = Settlement.of(order, fee)

    settlementRepository.save(settlement)
    sellerNotifier.notifySettled(order.sellerId, settlement)

    return settlement
}
```

## 빈 줄로 정리되지 않을 때

- 한 함수에서 빈 줄로 나눈 덩어리가 5~6개를 넘으면 `01-function-boundaries.md` 기준으로 함수로 뺄지 봅니다.
- 이 숫자는 `01-function-boundaries.md` 의 같이 기억할 항목 수와 별개의 신호입니다. 어느 쪽이든 걸리면 다시 봅니다.

## 파일 안의 위치

- 서로 호출하거나 함께 바뀌는 함수는 가까이 둡니다.
- 타입 선언의 필드가 많으면 관련된 필드끼리 묶어서 띄웁니다.
