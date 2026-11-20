# Metamorphic Relation (결과 불변식)

**분류** specification-based · **Coverage Item** 각 relation 과 그 relation 을 적용할 입력 묶음

## 언제

다른 기법은 명세 문장이 지정한 값을 기대값으로 씁니다. 그래서 **명세 문장이 틀리면 기대값도 같이 틀립니다.** 같은 변경에서 저자가 쓴 명세(`authored`)가 대표적입니다.

결과 불변식은 기대값을 명세 문장에서 가져오지 않습니다. **입력을 이렇게 바꾸면 결과가 이렇게 바뀌어야 한다**는 관계만 단언하고, 두 실행의 결과끼리 비교합니다. 명세 문장의 값이 틀려도 관계는 살아남습니다.

아래 형태가 있으면 다른 기법과 **함께** 씁니다. 대체하지 않습니다.

| 입력이나 결과의 형태 | 쓸 수 있는 relation |
|---|---|
| 입력이 항목의 집합이고 결과가 항목별 기여를 모은 것 | `decomposition`, `removal`, `irrelevant-addition` |
| 입력 값에 같은 뜻의 다른 표기가 있음 | `equivalent-representation` |
| 같은 입력을 두 번 넣어도 결과가 같아야 함 | `idempotence` |
| 입력 순서가 결과에 영향을 주면 안 됨 | `permutation` |

## relation 종류

`relation` 필드의 값은 아래 여섯 개 중 하나입니다.

| relation | 단언 | 실행 묶음 |
|---|---|---|
| `decomposition` | 전체 집합의 결과 = 항목마다 따로 실행한 결과를 명세의 합성 규칙으로 합친 것 | 전체 1회 + 항목별 n회 |
| `removal` | 항목 `P1` 을 뺀 집합의 결과에는 `P1` 이 기여한 부분이 남지 않음 | 전체 1회 + `P1` 제외 1회 |
| `irrelevant-addition` | `P1` 과 무관한 항목 `P2` 를 더해도 `P1` 에 대한 결과는 같음 | 기본 1회 + `P2` 추가 1회 |
| `equivalent-representation` | 같은 값의 다른 표기 `V1`, `V1'` 은 결과가 같음 | 표기마다 1회 |
| `idempotence` | 같은 입력을 두 번 적용한 결과 = 한 번 적용한 결과 | 1회 + 2회 |
| `permutation` | 입력 순서를 바꾼 결과 = 원래 결과 | 원래 순서 1회 + 바꾼 순서 1회 |

## 규칙

1. **relation 의 근거도 명세입니다.** 「결과는 항목별 기여로 조립된다」, 「같은 값이면」, 「순서와 무관하게」 같은 명세의 성질에서 relation 을 고릅니다. 구현을 짐작해서 relation 을 만들지 않습니다.
2. **기대 절대값을 쓰지 않습니다.** 케이스의 `expected` 는 `kind: "relation"` 이고, `caseRefs` 에 비교할 실행들을 겁니다. 각 실행 케이스의 `expected` 도 같은 relation 을 가리킵니다.
3. **표기 목록은 명세에서 가져옵니다.** `equivalent-representation` 에 쓸 표기는 그 값의 수용 규칙을 정한 명세가 말한 것만 씁니다. 수용 규칙 명세가 없으면 표기를 발명하지 말고 `ambiguities` 에 올립니다.
4. **집합형 입력에는 `removal` 과 `irrelevant-addition` 을 최소 하나씩 둡니다.** 항목 하나가 다른 항목의 결과에 새는 결함은 단일 입력 케이스로는 드러나지 않습니다.

<example>
명세가 「결과는 입력 항목 각각이 기여한 필드를 합친 것이다」라고 말할 때:

```
TC-01  결과는 항목별 기여의 합이다                  REQ-01
  CI-01  decomposition over items = { P1, P2 }
  CI-02  removal of P1 from { P1, P2 }
  CI-03  irrelevant-addition of P3 to { P1 }
```

CI-02 의 케이스 두 개는 `{ P1, P2 }` 실행과 `{ P2 }` 실행이고, 단언은 「두 번째 결과에 `P1` 이 기여한 필드가 없다」입니다. 필드의 값 자체는 단언하지 않습니다.
</example>

## 어디서 신호가 나는가

- 항목 하나를 빼도 그 항목이 쓴 값이 남는 결함 → `removal`
- 같은 값의 다른 표기가 다른 결과를 내는 결함 → `equivalent-representation`
- 관계없는 항목이 끼면 다른 항목의 결과가 바뀌는 결함 → `irrelevant-addition`

이 셋은 명세 문장이 결함과 같은 방향으로 틀려 있어도 잡힙니다.
