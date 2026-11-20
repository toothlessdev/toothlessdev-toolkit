# adopt: 레포에 넣을 시험 만들기

beaker 가 만든 시험 스크립트는 실행하고 결과를 케이스로 되짚기 위한 것입니다. 그래서 `beaker:case <ID>` 주석과 이름 앞 케이스 ID 를 달고, basis 별로 파일을 나눕니다. 이 형태는 저장소의 시험 규약(클래스당 파일 하나, 중첩 그룹, 이름 규칙)과 자주 부딪히고, 도구 흔적을 남깁니다.

`adopt` 는 실행용 시험과 별개로 **저장소에 넣을 시험**을 만듭니다. 사용자가 `adopt` 를 요청할 때만 돕니다.

---

## 입력

| 입력 | 쓰는 곳 |
|---|---|
| `design/test-cases.json` | 어떤 케이스를 넣을지 |
| `results/test-results.json` | `pass`, `fail`, `reach` |
| `reports/incidents.json` | 사람이 닫은 incident 와 `classification` |
| `environment/runner-profile.json` | 러너, 실행 명령 |
| 저장소의 기존 시험 | 규약을 배우는 데만 씁니다 |

## 넣는 케이스와 빼는 케이스

| 케이스 | 넣는가 | 이유 |
|---|---|---|
| `basis: specification`, `pass`, `reach: reached` | 넣음 | 명세를 검증한 회귀 시험 |
| `basis: specification`, `fail` | 넣지 않음 | incident 가 닫히기 전에는 깨진 시험입니다 |
| `basis: code`, `pins: defensive` 또는 `infrastructural` | 넣음 | 구현 방어 동작의 회귀 시험 |
| `basis: code`, `pins: business-rule`, 사람이 확인함 | 넣음 | 사람이 규칙을 확인했습니다 |
| `basis: code`, `pins: business-rule`, 확인 안 됨 | **넣지 않음** | 현재 동작을 고정만 했고 옳은지 검증하지 않았습니다 |
| `reach: unreached`, `skipped`, `unresolved` | 넣지 않음 | 목표 동작을 실행하지 않았습니다 |

「사람이 확인함」은 그 케이스의 condition 에서 나온 incident 가 사람 손으로 `classification` 이 채워지고 `status: "closed"` 인 경우, 또는 사용자가 케이스 ID 를 직접 지정한 경우입니다. 빠진 케이스는 리포트에 목록으로 남깁니다.

## 만드는 형태

`beaker:test-implementer` 를 `<adopt>` 블록과 함께 부릅니다.

1. **대상 클래스나 모듈마다 파일 하나**로 합칩니다. basis 로 나누지 않습니다.
2. 저장소의 기존 시험에서 배운 규약(중첩 그룹, 이름 문장, assertion 헬퍼, 픽스처 빌더)을 그대로 따릅니다.
3. `beaker:case` 주석, `BB-` · `WB-` 이름 접두사, `characterization` 표기를 **남기지 않습니다.**
4. 입력과 기대값은 케이스에서 그대로 옮깁니다. 규약에 맞추려고 값을 바꾸지 않습니다.
5. 배치는 `layout` 이 아니라 저장소가 그 대상의 시험을 두는 자리입니다. 기존 시험 파일이 있으면 그 파일에 추가합니다.

케이스와 시험의 대응은 저장소가 아니라 `.beaker/<target>/adopt/case-map.json` 에만 남깁니다.

```
CaseMapFile {
  adoptedAt        string            ISO 8601
  entries          CaseMapEntry[]
  excluded         ExcludedCase[]
}

CaseMapEntry {
  caseId           Ref<TestCase>
  testPath         string            저장소 안 시험 파일
  testName         string            저장소 규약으로 지은 시험 이름
}

ExcludedCase {
  caseId           Ref<TestCase>
  reason           enum(failing, unverified-characterization, unreached, skipped, unresolved)
}
```

## 확인

1. adopt 한 시험만 러너로 실행합니다. 넣은 케이스가 전부 `pass` 여야 합니다. 원래 결과가 `pass` 였는데 adopt 뒤 실패하면 옮기는 과정에서 값이 바뀐 것이므로 그 시험을 고치지 말고 리포트에 올립니다.
2. adopt 한 파일에 `beaker`, `BB-`, `WB-` 문자열이 없는지 검색합니다.
3. 실행용으로 만든 시험 스크립트(`layout` 아래 파일)는 지우지 않고 목록만 보여 줍니다. 지우는 것은 사용자가 정합니다.
