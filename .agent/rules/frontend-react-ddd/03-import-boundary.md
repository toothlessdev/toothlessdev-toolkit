---
paths:
    - "src/**/*.{ts,tsx}"
---

# import 경계

의존이 퍼지는 범위를 통제하려고 레이어 간, slice 간 import 를 제한한다.

## 레이어 간 (예외 없음)

```
App.tsx → pages → applications → domain → shared
```

- 아래 레이어가 위 레이어를 import 하면 위반이다
- `shared` 는 `shared` 안만 import 한다

필요해 보이면 구조가 잘못된 것이다. 책임을 아래로 옮기거나, 범용 부분을 `shared` 로 올리거나, `pages` 에서 조합한다. 경로를 우회하지 않는다.

## slice 간 (권장)

### domain

- `domain/<entity>` 는 자기 자신과 `shared` 만 쓴다
- 다른 엔티티 참조는 가능하지만 신중히 한다. 도메인 결합과 수정 범위가 커진다. 공통 타입 · 로직은 `shared` 로 올리거나 위 레이어에서 조합한다

### applications

- `applications/<usecase>` 는 `domain` · `shared` 를 import 한다
- 다른 usecase import 는 원칙적으로 금지한다. 공통 로직이 필요하면 도메인 개념은 `domain` 으로 내리고, 범용이면 `shared` 로 올리고, 아니면 `pages` 에서 조합한다

## pages

- `applications` · `domain` · `shared` 를 import 한다. `App.tsx` 는 import 하지 않는다
- 기능 조합, 레이아웃 배치, 라우트 진입점만 맡는다. API 호출 · 상태 로직 · 비즈니스 규칙은 아래로 내린다

## 판단 기준

import 하려는 코드가 도메인에 묶여 있는지, 어디서든 쓸 수 있는지 본다. 도메인에 묶여 있으면 `shared` 에 두지 않는다.
