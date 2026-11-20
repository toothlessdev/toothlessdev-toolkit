# Equivalence Partitioning

**분류** specification-based · **Coverage Item** 각 파티션

## 언제

명세가 입력(또는 출력)을 부류로 나누고, 부류 안에서는 결과가 같을 때.

## 규칙

1. 각 파라미터의 도메인을 **결과가 같은 구간**으로 나눕니다.
2. 유효 파티션과 무효 파티션을 **둘 다** 만듭니다.
3. 파티션 하나가 Coverage Item 하나.
4. 파티션마다 대표값 1개로 케이스를 만듭니다.

```
paramA 의 도메인을 명세가 임계값 T 로 가른다면

  partition: paramA <  T          valid
  partition: paramA >= T          valid
  partition: paramA ∉ domain      invalid
```

열거형이면 각 값이 파티션이고, 명세가 다루지 않는 값이 무효 파티션입니다.

```
paramB = one of { V1, V2 }

  partition: paramB = V1          valid
  partition: paramB = V2          valid
  partition: paramB ∉ {V1, V2}    invalid
```

## 파티션의 근거는 명세에서만

명세가 어떤 값을 특별 취급하지 않는데 "그 값은 따로 봐야 할 것 같다"는 느낌으로 파티션을 쪼개지 마세요. 그건 발명입니다.

근거가 없으면 `ambiguities` 에 `Ambiguity` 항목을 올립니다. `question` 에는 명세가 그 값의 취급을 지정하지 않는다는 사실을 적습니다.

## 무효 파티션은 한 케이스에 하나씩

무효 입력 두 개를 한 케이스에 넣으면 하나가 다른 하나를 가려서 어느 쪽이 걸린 건지 알 수 없습니다.

```
✗  { paramA: <무효>, paramB: <무효> }
✓  { paramA: <무효>, paramB: <유효 대표값> }
✓  { paramA: <유효 대표값>, paramB: <무효> }
```

## 도출 흐름

<example>
명세가 paramA 를 임계값 `T` 로 가르고, paramB 가 두 값을 갖는 열거형일 때.

```
Test Condition ①  paramA 구간별 결과 판정
  CI  paramA < T          유효 — 명세가 이 구간에 지정한 결과
  CI  paramA >= T         유효 — 명세가 이 구간에 지정한 결과
  CI  paramA 가 도메인 밖  무효

Test Condition ②  paramB 값별 결과 판정
  CI  paramB = <값1>      유효
  CI  paramB = <값2>      유효
  CI  paramB 가 열거 밖    무효
```

Coverage Item 마다 대표값 1개로 케이스를 만듭니다. 무효 파티션 케이스에서는 나머지 파라미터에 유효 대표값을 넣습니다.

`description` 에는 `T`, `<값1>` 이 아니라 **명세에서 읽어낸 실제 값**을 씁니다.
</example>
