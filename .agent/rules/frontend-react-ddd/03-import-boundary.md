---
paths:
    - "src/**/*.{ts,tsx}"
---

# import 경계

의존이 퍼지는 범위를 통제하려고 레이어 간, slice 간 import 를 제한합니다.

## 레이어 간 (예외 없음)

```
App.tsx → pages → applications → domain → shared
```

- 아래 레이어가 위 레이어를 import 하면 위반입니다
- `shared` 는 `shared` 안만 import 합니다

필요해 보이면 구조가 잘못된 것입니다. 책임을 아래로 옮기거나, 범용 부분을 `shared` 로 올리거나, `pages` 에서 조합합니다. 경로를 우회하지 않습니다.

## slice 간 (권장)

### domain

- `domain/<entity>` 는 자기 자신과 `shared` 만 씁니다
- 다른 엔티티 참조는 가능하지만 신중히 합니다. 도메인 결합과 수정 범위가 커집니다. 공통 타입 · 로직은 `shared` 로 올리거나 위 레이어에서 조합합니다

### applications

- `applications/<usecase>` 는 `domain` · `shared` 를 import 합니다
- 다른 usecase import 는 원칙적으로 금지합니다. 공통 로직이 필요하면 도메인 개념은 `domain` 으로 내리고, 범용이면 `shared` 로 올리고, 아니면 `pages` 에서 조합합니다

## pages

- `applications` · `domain` · `shared` 를 import 합니다. `App.tsx` 는 import 하지 않습니다
- 기능 조합, 레이아웃 배치, 라우트 진입점만 맡습니다. API 호출 · 상태 로직 · 비즈니스 규칙은 아래로 내립니다

## 판단 기준

import 하려는 코드가 도메인에 묶여 있는지, 어디서든 쓸 수 있는지 봅니다. 도메인에 묶여 있으면 `shared` 에 두지 않습니다.
