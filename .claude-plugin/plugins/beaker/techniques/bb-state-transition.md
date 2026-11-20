# State Transition Testing

**분류** specification-based (WB 에서도 씀) · **Coverage Item** 각 transition

## 언제

같은 입력이라도 이전 이력에 따라 결과가 다를 때.

## 규칙

1. 명세에서 **상태**와 **이벤트**를 뽑습니다.
2. `(현재 상태, 이벤트) → (다음 상태, 출력)` 표를 만듭니다.
3. transition 하나가 Coverage Item 하나. **0-switch coverage** 를 기준으로 합니다.
4. 명세에 정의되지 않은 `(상태, 이벤트)` 쌍은 **invalid transition** 으로 따로 표시합니다.

상태 `S1..Sn`, 이벤트 `e1..em` 에 대해:

| # | 현재 | 이벤트 | 다음 | 근거 |
|---|---|---|---|---|
| T1 | S1 | e1 | S2 | REQ-nn |
| T2 | S2 | e1 | S3 | REQ-nn |
| T3 | S1 | e2 | S4 | REQ-mm |
| T4 | S3 | e2 | (거부) | REQ-kk |

**T4 처럼 거부되어야 하는 transition 도 Coverage Item 입니다.** 오히려 이쪽에서 결함이 잘 나옵니다.

## 케이스는 경로로 만든다

transition 하나를 테스트하려면 거기까지 가는 경로가 필요합니다. `preconditions` 에 도달 경로를 적습니다. 시작 상태에서 어떤 이벤트를 어떤 순서로 적용해 그 상태에 이르는지를 문장으로 씁니다.

거부되어야 하는 transition 은 `expected.kind` 가 `throws` 이거나, 명세가 상태 불변을 요구하면 `value` 입니다. **명세가 지정한 쪽을 씁니다.**

## 명세에 없는 transition 을 발명하지 마라

명세가 `(Si, ej)` 의 결과를 말하지 않으면 `ambiguities` 에 `Ambiguity` 항목을 올립니다. "당연히 거부되겠지"는 근거가 아닙니다. 실제로 많은 결함이 그 "당연히" 에서 나옵니다.

## 도출 흐름

<example>
명세가 상태 `S1..Sn` 과 이벤트 `e1..em` 을 정의할 때.

```
Test Condition  transition 묶음 단위 또는 상태 단위

Coverage Item   transition 하나당 하나
  T1   (S1, e1) → S2          명세가 정의한 전이
  T2   (S2, e1) → S3          명세가 정의한 전이
  T3   (S3, e2) → 거부         명세가 금지한 전이 — 이쪽에서 결함이 잘 나온다

Test Case
  preconditions  대상 상태까지의 도달 경로
  inputs         그 상태에서 적용할 이벤트
  expected       명세가 지정한 다음 상태 또는 거부 방식
  rationale      어느 명세 항목이 이 전이를 정의/금지하는가
```

상태와 이벤트 이름은 **명세의 어휘를 그대로** 씁니다. `S1`, `e1` 은 이 문서의 기호입니다.
</example>
