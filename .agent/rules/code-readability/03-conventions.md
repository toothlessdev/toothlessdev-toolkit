---
paths:
  - "**/*.{ts,tsx,js,jsx,mjs,cjs,vue,svelte,java,kt,scala,py,go,rs,rb,php,cs,c,h,cpp,hpp,swift,dart}"
---

# 관용 패턴과 코드베이스 일관성

판단 질문: 이 코드베이스를 읽어 본 사람에게 처음 보는 모양인가.

읽는 사람이 이미 아는 패턴은 한 덩어리로 읽히고, 처음 보는 패턴은 요소를 하나씩 따져 읽게 된다. 관용 패턴이 읽기 쉬운 이유는 더 옳아서가 아니라 이미 익숙해서다.

## 쓰기 전에 찾는다

- 새 함수, 컴포넌트, 테스트를 쓰기 전에 같은 역할의 기존 코드를 찾아 읽는다.
- 에러 처리, 로깅, 호출 방식, 파일 위치, 테스트 구조를 찾은 코드에 맞춘다.
- 같은 일을 하는 유틸리티가 이미 있으면 새로 만들지 않고 쓴다.

## 관용구를 고른다

- 언어와 프레임워크의 표준 API와 관용구가 있으면 직접 구현하지 않는다.
- 단순한 문법으로 쓸 수 있으면 메타프로그래밍, 리플렉션, 복잡한 제네릭, 연산자 트릭, 여러 단계로 겹친 체이닝을 쓰지 않는다.

```kotlin
// ✗ (example) 표준 함수가 있는 검사를 인덱스로 풀어 썼습니다
val isRegistered = registeredNames.indexOf(name) != -1

// ✓ (example)
val isRegistered = name in registeredNames
```

```kotlin
// ✗ (example) 스코프 함수를 겹쳐 써서 어느 경우에 저장되고 어느 경우에 예외가 나는지 따져야 합니다
val coupon = couponRepository.findByIdOrNull(couponId)
    ?.takeIf { it.isActive }
    ?.also { couponUsageRepository.save(CouponUsage(it.id, memberId)) }
    ?: throw CouponNotUsableException(couponId)

// ✓ (example) 검증과 저장이 줄 순서대로 읽힙니다
val coupon = couponRepository.findByIdOrNull(couponId)
if (coupon == null || !coupon.isActive) throw CouponNotUsableException(couponId)

couponUsageRepository.save(CouponUsage(coupon.id, memberId))
```

## 같은 일은 같은 모양으로

- 같은 종류의 작업은 동사, 인자 순서, 반환 형태를 맞춘다.
- 나란히 놓인 코드는 줄 모양도 맞춰서 차이가 나는 부분만 눈에 띄게 한다.

```kotlin
// ✗ (example) 같은 조회인데 이름과 호출 모양이 제각각이라 줄마다 따로 읽힙니다
val buyerInfo = buyerClient.fetchBuyer(orderId)
val shipping_data = shippingClient.loadByOrder(OrderKey(orderId))
val payment = paymentClient.getPaymentOfOrder(orderId)

// ✓ (example) 세 줄이 같은 조회라는 것이 한 번에 보입니다
val buyer = buyerClient.fetchBuyer(orderId)
val shipping = shippingClient.fetchShipping(orderId)
val payment = paymentClient.fetchPayment(orderId)
```

## 기존 패턴과 다르게 쓸 때

- 기존 패턴을 따를 수 없는 이유가 있을 때만 다르게 쓴다.
- 이유는 그 코드에만 해당하면 코드 주석에, 이번 변경 전체에 해당하면 커밋 본문에 남긴다.
- 기존 패턴 일괄 변경은 이번 변경에 섞지 않고 별도 작업으로 제안한다.
- 코드베이스에 없는 라이브러리나 패턴은 팀이 함께 익혀야 하므로 도입 전에 사용자에게 묻는다.
