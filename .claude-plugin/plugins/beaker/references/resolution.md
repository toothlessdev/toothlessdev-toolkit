# incident 닫기

reporter 는 incident 를 올리고 `classification` 을 `null` 로 둡니다. 그 뒤 incident 를 어떻게 닫는지 정하지 않으면, 실제로는 변경 작성자가 자기 기준으로 닫습니다. 그러면 두 가지가 반복됩니다.

- 반례 하나만 막고 닫아서, 같은 입력 범위의 다른 값이 그대로 뚫려 있습니다.
- 명세를 코드에 맞춰 고치고 닫아서, 그 결정이 데이터에 무엇을 남기는지 아무도 답하지 않습니다.

이 문서는 사용자가 「INC-<n> 고쳤다」, 「INC-<n> 닫아줘」라고 할 때 오케스트레이터가 밟는 순서입니다. 사용자가 말하기 전에는 시작하지 않습니다.

---

## 1. 닫는 방식 받기

사용자에게 incident 마다 두 가지를 받습니다. 추측해서 채우지 않습니다.

- `classification`: `references/schemas.md` 의 `Classification` 네 값 중 하나
- `resolution.by`: 아래 네 값 중 하나

| `resolution.by` | 뜻 | 반드시 받을 것 |
|---|---|---|
| `implementation-fix` | 구현을 고쳤다 | 반례가 속한 입력 범위 (`range`) |
| `spec-change` | 명세를 구현에 맞춰 고쳤다 | 그렇게 하면 데이터가 어떻게 되는지 한 줄 (`dataConsequence`) |
| `test-fix` | 테스트가 틀렸다 | 틀린 근거가 된 명세 항목 ID |
| `wont-fix` | 고치지 않는다 | 이유 한 줄 |

`spec-change` 의 `dataConsequence` 는 「값이 남는다 / 지워진다 / 바뀐다」 중 무엇인지와 그 대상을 적는 문장입니다. 답이 「모르겠다」면 닫지 않고 incident 를 열어 둡니다.

---

## 2. 범위 케이스 다시 만들기 (`implementation-fix`)

반례 하나가 통과하는 것으로는 닫지 않습니다. 반례가 속한 **입력 범위 전체**를 케이스로 만듭니다.

1. `range` 를 명세 문장으로 적습니다. 예를 들면 「그 입력이 수용하는 모든 표기」, 「그 경계의 양쪽 이웃」, 「그 조건 조합의 나머지 rule」입니다.
2. 범위를 정하는 명세(수용 규칙, 경계, 조건)가 `basis/requirements.md` 에 없으면 먼저 찾아 붙입니다. `references/process.md` 의 「값을 비교하는 요구사항」 절과 같은 규칙입니다.
3. `beaker:blackbox-test-designer` 를 다시 부릅니다. payload 는 Step 4 와 같고 `<task>` 에 「`range` 의 모든 원소에 대한 케이스」를 적습니다. 구현이나 고친 diff 는 넣지 않습니다.
4. 새 케이스는 기존 ID 를 덮지 않고 새 `BB-` ID 로 append 합니다. 각 케이스의 `resolves` 에 incident ID 를 적습니다.
5. `test-implementer` 로 스크립트를 쓰고 `run` 모드로 실행합니다.

## 3. 닫힘 판정

`run` 결과에서 아래가 모두 참일 때만 `status: "closed"` 로 바꿉니다.

| 조건 | 확인 |
|---|---|
| incident 의 원래 케이스가 `pass` | `results/test-results.json` |
| `resolves` 가 이 incident 인 케이스가 전부 `pass` 이고 `reach: reached` | 같은 파일 |
| `unresolved` 나 `skipped` 로 빠진 범위 케이스가 없음 | implementer 반환값, 결과 파일 |
| `spec-change` 면 `dataConsequence` 가 비어 있지 않음 | `incidents.json` |

하나라도 거짓이면 `status: "open"` 으로 두고, 거짓인 조건을 `resolution.blockedBy` 에 적습니다.

`spec-change` 로 닫을 때는 명세 파일이 바뀌었으므로 `basis/requirements.md` 를 새 원문으로 다시 복사하고, 바뀐 항목의 등급을 `authored` 로 매깁니다. 구현을 보고 고친 명세는 저자가 쓴 명세입니다.

## 4. 기록

`reports/incidents.json` 의 해당 incident 에 `resolution` 을 채우고 `reports/report.md` 의 「incident 닫힘」 절에 한 줄씩 남깁니다.

```
INC-<n>  <classification>  <resolution.by>  범위 케이스 <k>건 pass  runId <runId>
```

## 하지 않는 것

- 반례 하나만 다시 돌려 보고 닫기
- 범위 케이스를 구현을 보고 만들기
- `dataConsequence` 없이 `spec-change` 로 닫기
- 사람이 정하지 않은 `classification` 을 채우기
