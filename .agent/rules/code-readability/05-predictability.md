---
paths:
  - "**/*.{ts,tsx,js,jsx,mjs,cjs,vue,svelte,java,kt,scala,py,go,rs,rb,php,cs,c,h,cpp,hpp,swift,dart}"
---

# 이름과 인터페이스의 예측 가능성

판단 질문: 이름과 시그니처만 보고 한 예상과 실제 동작이 같은가.

읽는 사람은 이름과 앞줄을 보고 다음 동작을 예상한다. 예상이 맞으면 그냥 넘어가고, 어긋나면 되돌아가서 이유를 따진다.

## 이름이 약속한 일만 한다

- `get`, `fetch`, `find`, `is`, `calculate` (example) 처럼 조회나 계산을 뜻하는 이름의 함수는 조회와 계산만 한다.
- 상태 변경, 이벤트 발행, 외부 저장, 분석 로그 전송처럼 이름에 없는 부수 효과를 넣지 않는다.
- 호출부에서 관찰되지 않는 내부 메모이제이션은 부수 효과로 보지 않는다.
- 부수 효과가 필요하면 호출부로 올리거나, 여러 일을 한다는 것이 드러나는 이름의 함수로 묶는다.

```kotlin
// ✗ (example) 이름은 조회인데 조회 기록 저장, 이벤트 발행, 감사 로그 전송까지 합니다
fun getCoupon(couponId: Long): Coupon {
    val coupon = couponRepository.findByIdOrNull(couponId) ?: throw CouponNotFoundException(couponId)

    couponViewRepository.save(CouponView(couponId))
    eventPublisher.publishEvent(CouponViewedEvent(couponId))
    auditLogClient.send("coupon_view", couponId)

    return coupon
}

// ✓ (example) 조회는 조회만 하고, 쿠폰 상세 진입에서 하는 일은 그 이름 아래 모읍니다
fun getCoupon(couponId: Long): Coupon =
    couponRepository.findByIdOrNull(couponId) ?: throw CouponNotFoundException(couponId)

fun openCouponDetail(couponId: Long): Coupon {
    val coupon = getCoupon(couponId)

    couponViewRepository.save(CouponView(couponId))
    eventPublisher.publishEvent(CouponViewedEvent(couponId))
    auditLogClient.send("coupon_view", couponId)

    return coupon
}
```

## 이름과 뜻을 맞춘다

- 식별자는 정의로 이동하지 않아도 뜻을 알 수 있게 짓는다. `res`, `flag` 대신 `verificationResult`, `shouldRetry` (example) 를 쓴다.
- 프로젝트 문서나 기존 코드에 정해진 도메인 용어가 있으면 그 단어를 그대로 쓴다.
- 같은 동사는 코드베이스 안에서 같은 뜻으로 쓴다. 코드베이스의 `find` 가 없을 때 `null` 을 돌려주면 새 `find` 함수도 그렇게 한다 (example).
- 실패 표현(`null`, 예외, Result 타입)을 같은 모듈 안에서 섞지 않는다.
- 인자를 변경하지 않는다. 변경해야 하면 이름에 드러낸다.

## 호출부에서 읽히는 인터페이스

- 공용 코드와 API 의 이름은 프레임워크와 생태계의 관례를 따른다.
- 공용 코드의 인터페이스에 특정 도메인 이름을 넣지 않는다.
- 호출부에서 뜻을 알 수 없는 boolean 인자를 쓰지 않는다. 이름 붙은 인자나 옵션 객체로 뜻을 드러내거나 함수를 나눈다.
- HTTP API 는 메서드와 상태 코드의 표준 의미를 따른다.

```kotlin
// ✗ (example) 메서드 이름만으로는 동작을 알 수 없어 쿼리를 열어 봐야 합니다
interface OrderRepository : JpaRepository<Order, Long> {
    @Query("select o from Order o where o.memberId = :memberId and o.status = :status")
    fun orderList(memberId: Long, status: OrderStatus): List<Order>

    @Query("select count(o) > 0 from Order o where o.memberId = :memberId")
    fun check(memberId: Long): Boolean
}

// ✓ (example) Spring Data 의 이름 규칙대로 읽힙니다
interface OrderRepository : JpaRepository<Order, Long> {
    fun findAllByMemberIdAndStatus(memberId: Long, status: OrderStatus): List<Order>

    fun existsByMemberId(memberId: Long): Boolean
}
```

```kotlin
// ✗ (example) true 가 무엇인지 정의를 봐야 합니다
refundService.createRefund(claim, true)

// ✓ (example)
refundService.createRefund(claim, shouldNotifyBuyer = true)
```

## 찾을 수 있는 위치

- 파일 이름과 주요 클래스 이름을 맞춘다.
- `utils`, `common`, `helpers` (example) 처럼 뜻이 넓은 위치에 넣기 전에 도메인 디렉터리에 둘 수 있는지 먼저 본다.
- 코드베이스의 디렉터리 구조가 정한 자리를 따른다.
