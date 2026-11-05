# Branch / Condition Coverage

**분류** structure-based · **Coverage Item** 각 분기 결과 · **쓰는 곳** whitebox-test-designer 전용

블랙박스 설계자는 이 기법을 쓰지 않습니다. 쓸 수 있다면 그건 구현이 payload 에 샜다는 뜻입니다.

## 규칙

1. 대상의 분기를 전부 열거합니다. 조건 분기, 다중 분기, 삼항, 단축평가, early return, 예외 경로, 루프 진입/미진입.
2. 각 분기의 **참/거짓 결과 각각**이 Coverage Item 입니다.
3. 복합 조건은 **원자 조건까지 쪼갭니다.**

```
분기 조건이  P1 ∧ P2  이면

  CI: P1 참        CI: P1 거짓
  CI: P2 참        CI: P2 거짓
```

단축평가 때문에 `P1` 이 거짓이면 `P2` 가 평가되지 않습니다. 그 사실도 기록합니다.

## predicate 분류가 먼저다

Coverage Item 을 만들기 전에 분류하세요. 이 기법에서 가장 중요한 단계입니다.

| class | 판별 기준 |
|---|---|
| `business-rule` | 값이 바뀌면 제품 동작이 바뀝니다. 도메인 규칙을 표현합니다 |
| `defensive` | 잘못된 입력·상태로부터 스스로를 보호합니다 |
| `infrastructural` | 도메인과 무관한 실행 환경 관심사 |

**셋 다 Coverage Item 이 됩니다.** 구조 커버리지는 전부 세야 합니다.

**`business-rule` 만 incident 후보입니다.** 명세 근거가 없는 `business-rule` predicate 만 `incidentCandidates` 에 올립니다.

애매하면 `defensive` 로 분류하세요. 실무 코드의 predicate 대다수가 `defensive` / `infrastructural` 이고, 그걸 전부 incident 로 올리면 리포트가 노이즈에 덮여 아무도 안 읽습니다.

분류 기준은 **predicate 가 무엇을 판단하는가**이지 predicate 가 어떻게 생겼는가가 아닙니다. 같은 비교 연산이라도 도메인 규칙일 수도 방어 코드일 수도 있습니다.

## 기대값은 characterization 이다

여기서 만드는 케이스의 기대값은 **현재 구현이 실제로 하는 일**입니다. 옳음을 주장하는 게 아닙니다.

`expectedDescription` 에 `(characterization)` 표기를 반드시 남깁니다. 이 테스트가 나중에 깨졌을 때 "버그"가 아니라 "의도된 변경일 수 있음"으로 읽혀야 합니다.

## 도달 불가 분기

어떤 입력으로도 도달할 수 없는 분기를 찾으면 케이스를 만들지 말고 `notes` 에 `Note` 항목으로 기록합니다. `issue` 는 `unreachable-branch`, `detail` 에는 도달을 막는 선행 조건을 적습니다.

죽은 코드이거나, 도달 조건을 네가 못 찾은 것입니다. 둘 다 사람이 볼 가치가 있습니다.

## 도출 흐름

<example>
분기 조건이 복합 조건 `P1 ∧ P2` 이고, `P1` 이 도메인 규칙, `P2` 가 방어 코드일 때.

```
Test Condition ①
  predicate       P1 의 원문
  predicateClass  business-rule
  CI   P1 참인 경로 / P1 거짓인 경로

Test Condition ②
  predicate       P2 의 원문
  predicateClass  defensive
  CI   P2 참인 경로 / P2 거짓인 경로

incidentCandidates
  P1 에 대응하는 명세 항목을 못 찾았다면 여기 올린다.
  P2 는 defensive 이므로 올리지 않는다. 커버리지 항목으로만 센다.
```

네 개 커버리지 항목 전부가 구조 커버리지 분모에 들어갑니다. incident 후보만 걸러지는 것이지 커버리지가 걸러지는 게 아닙니다.
</example>
