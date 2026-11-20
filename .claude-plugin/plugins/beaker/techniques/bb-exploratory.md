# Exploratory Testing

**분류** experience-based 시험 접근법 (설계 기법 아님) · **Coverage Item** 없음. 세션 기반 관리에서 세는 단위는 차터 하나와 세션 하나 · **쓰는 곳** 설계자 둘 다 쓰지 않습니다. 사람이 하고, 리포트는 차터 후보만 남깁니다

`Technique` 값이 아닙니다. 설계 산출물의 `technique` 필드에 `exploratory` 를 쓰지 마세요.

## 언제

exploratory testing 은 시험하는 사람이 실행 중인 시스템을 다루면서 배우고, 그 결과를 보고 다음 시험을 그 자리에서 설계해 실행하는 방식입니다. 설계와 실행이 동시에 일어나고, 기대값은 미리 정해 두지 않고 관찰한 동작을 사람이 판단합니다.

사람이 이 방식을 고르는 때는 아래와 같습니다.

- 명세가 부실하거나 자주 바뀌어서 미리 케이스를 쓸 근거가 없을 때
- 새 기능이라 어디서 문제가 날지 아직 모를 때
- 명세에 없는 이상 동작, UX 문제처럼 명세 문장으로는 기대값을 쓸 수 없는 결함을 찾을 때

세션 기반 관리(session-based test management)는 이 활동에 구조를 붙입니다. 세션은 시간을 정해 둔 한 번의 탐색이고, 차터는 그 세션의 목표입니다. 차터는 흔히 「Explore 대상 With 자원 To discover 찾을 정보」 형태로 씁니다. 세션이 끝나면 무엇을 했고 무엇을 찾았는지 session sheet 에 남깁니다.

## beaker 가 이 기법을 설계에 넣지 않는 이유

beaker 의 불변식과 세 군데에서 부딪힙니다.

1. **블랙박스 설계자는 실행 중인 시스템을 볼 수 없습니다.** `blackbox-test-designer` 는 도구가 없고 payload 만 받습니다. 관찰한 결과로 다음 시험을 고르는 피드백 고리가 없으면 exploratory testing 이 아닙니다. 설계자에게 실행 결과를 돌려주는 순간 구현의 동작이 payload 로 들어가고, I1(블랙박스 설계자가 구현을 읽지 못함)과 I2(payload 에 구현이 없음)가 깨집니다.
2. **기대값이 명세에서 나오지 않습니다.** exploratory testing 의 판정 기준은 사람의 판단과 경험입니다. beaker 는 명세에 없는 기대값을 만들지 않고 `ambiguities` 로 보냅니다. 탐색에서 나온 「이건 이상하다」를 `Expected` 의 `value` · `throws` · `relation` 중 하나로 옮기면 명세에 없는 값을 발명한 것이 됩니다.
3. **Coverage Item 이 없습니다.** ISO/IEC/IEEE 29119-4 는 experience-based 기법으로 error guessing 하나만 두고, 그것에도 「인정된 Coverage Item 이 없다」고 씁니다. exploratory testing 은 29119-4 의 기법 목록에 없습니다. 세션 기반 관리가 세는 세션 수와 영역별 시간은 schemas.md 의 coverage 식에 넣을 분모가 아닙니다.

화이트박스 설계자에게 맡기는 것도 맞지 않습니다. `whitebox-test-designer` 는 구현을 읽어 predicate 와 분기를 세는 역할이고, 실행하며 판단하는 역할이 아닙니다. 실행하며 고른 입력으로 만든 기대값은 characterization 이지 탐색이 아니고, 그 일은 이미 `branch-condition` 이 합니다.

## 규칙

1. 설계자 둘 다 이 기법으로 Test Condition, Coverage Item, Test Case 를 만들지 않습니다.
2. 사람이 탐색해서 찾은 동작을 명세 파일(`basis/requirements.md`)로 옮기지 않습니다. 구두 요구사항을 명세로 승격하지 않는 규칙과 같은 이유입니다. 그 동작이 요구사항이라면 사람이 코드 밖 명세 문서를 고친 뒤 다음 실행에서 `authored` 등급으로 들어옵니다.
3. 탐색 결과를 블랙박스 설계를 다시 돌리는 근거로 쓰지 않습니다. 커버리지가 낮다고 BB 케이스를 더 만들지 않는 규칙과 같습니다.
4. 리포트는 사람이 탐색할 곳을 차터 후보로만 남깁니다. 차터 후보는 이미 산출물에 있는 항목에서만 만듭니다: 설계 단계의 `Ambiguity`, 리포트의 「도달하지 못한 케이스」, `pins: business-rule` 케이스 묶음, mutation 단계가 돌았다면 살아남은 mutant. 새 관찰을 지어내지 않습니다.
5. 차터 후보는 커버리지에 세지 않고 incident 도 아닙니다. `classification` 이 없고, 사람이 세션을 돌린 뒤 찾은 것을 incident 로 올릴지 정합니다.

<example>
설계 단계가 `REQ-` 항목 하나에 대해 「`V1` 과 `V1'` 을 같은 값으로 받는지 명세가 말하지 않는다」는 `Ambiguity` 를 올렸고, 케이스 하나가 `reach: unreached` 로 끝났을 때.

```
차터 후보 1
  출처      Ambiguity (blockedCoverageItems: CI-01)
  차터      Explore S1 의 비교 동작 With V1, V1' To discover 두 표기가 같은 결과를 내는지
  세지 않음  coverage 분모와 incident 목록에 들어가지 않는다

차터 후보 2
  출처      unreached 케이스 BB-03 의 rejection
  차터      Explore S1 의 진입 조건 With rejection 에 나온 거절 이유 To discover 목표 동작에 닿는 입력
```

차터 후보 1 의 답은 명세를 고쳐서 내는 것이지 탐색 결과를 기대값으로 쓰는 것이 아닙니다.
</example>

## 다른 기법과의 관계

- **포함 관계로 줄 세울 수 없습니다.** Coverage Item 이 없어서 다른 기준을 포함하지도, 다른 기준에 포함되지도 않습니다.
- **`bb-error-guessing.md` (error-guessing) 가 기계화할 수 있는 부분을 가져갑니다.** 경험에서 나온 「자주 터지는 곳」 목록을 명세 근거와 함께 쓸 수 있으면 error-guessing 쪽입니다. 29119-4 가 experience-based 기법으로 인정하는 것도 error guessing 하나입니다.
- **`bb-fuzzing.md` (fuzzing), `bb-property-based.md` (property-based) 와 겹칩니다.** 실행하면서 입력을 바꿔 보는 활동이라는 점이 같지만, 둘은 판정 기준(크래시, 명세에서 온 불변식)이 기계로 정해집니다. 사람의 판단이 필요 없는 탐색은 이쪽으로 갑니다.
- **`bb-scenario.md` (scenario) 와 구분합니다.** 사람이 사용 이야기를 지어내는 Kaner 식 scenario testing 은 탐색에 가깝고, beaker 의 `scenario` 는 명세가 정의한 흐름만 셉니다.
- **`bb-metamorphic-relation.md` (metamorphic-relation) 이 명세가 약할 때의 기계적 대안입니다.** 명세 문장의 값이 의심스러울 때 사람 판단 대신 결과끼리의 관계로 판정합니다.

## beaker 통합

- **verdict**: excluded. `Technique` enum 에 넣지 않고, 파이프라인 단계로도 넣지 않습니다. 사람 몫으로 둡니다.
- **쓰는 설계자나 단계**: 없습니다. `test-reporter` 가 리포트에 「사람이 탐색할 곳」 절을 선택적으로 두고 규칙 4 의 출처에서만 차터 후보를 만듭니다.
- **Coverage Item 단위**: 없습니다. 차터 후보 수는 Requirement Coverage, Structural Coverage 어느 쪽에도 들어가지 않습니다.
- **스키마 변경**: 없습니다. 차터 후보는 `reports/report.md` 의 산문 절이고 JSON 산출물을 만들지 않습니다.
- **역할 파일 변경**: `test-reporter.md` 에 선택 절 하나. 설계자 역할 파일은 바꾸지 않습니다.
- **비용**: beaker 쪽 비용은 리포트 절 하나뿐입니다. 탐색 자체의 비용은 사람의 세션 시간이고, 도메인 지식이 없으면 효과가 떨어진다고 ISTQB 가 적습니다.
- **한계**: UX 문제와 명세에 없는 이상 동작은 beaker 가 끝내 찾지 못합니다. beaker 의 대상은 심볼 하나이고 판정은 명세로만 하기 때문입니다. 리포트가 이 사실을 숨기지 않도록 차터 후보 절이 「자동 시험이 다루지 않은 곳」을 사람에게 넘깁니다.

## 출처

- [ISTQB Certified Tester Advanced Level Test Analyst Syllabus v4.0](https://www.istqb.org/wp-content/uploads/sdm-uploads/ISTQB-CTAL-TA-Syllabus-v4.0-EN-4.pdf), 3.4.1 Test Charters Supporting Session-Based Testing. 차터가 세션의 목표와 범위를 정하고 실행할 시험 묶음은 정하지 않는다는 것, 「Explore With To discover」 형식(Hendrickson, Explore It!, 2013 인용), session sheet. 같은 문서 3.1 절은 도메인 지식이 적으면 exploratory testing 이 효과가 없을 수 있다고 적습니다.
- ISO/IEC/IEEE 29119-4:2015, 5.4.1 Error Guessing, 6.4.1 Error Guessing Coverage, D.2.1.9. experience-based 기법이 error guessing 하나이고 인정된 Coverage Item 이 없다는 것. 같은 문서에 exploratory testing 은 기법으로 나오지 않습니다.
- [Session-based testing (Wikipedia)](https://en.wikipedia.org/wiki/Session-based_testing). 세션, 차터, session report, debrief 의 정의. 원 출처는 Jonathan Bach, 「Session-Based Test Management」(2000)이고 [Satisfice 다운로드 페이지](https://www.satisfice.com/download/session-based-test-management)가 있음을 확인했습니다(본문 PDF 는 열지 못했습니다).
- [Exploratory testing (Wikipedia)](https://en.wikipedia.org/wiki/Exploratory_testing). 「simultaneous learning, test design and test execution」 정의, Kaner 의 용어, 재현성과 커버리지 관리가 약점이라는 사례 연구(Itkonen 외).
- Cem Kaner, James Bach, Bret Pettichord, 「Lessons Learned in Software Testing」, Wiley, 2001 (책 이름만 적습니다).
