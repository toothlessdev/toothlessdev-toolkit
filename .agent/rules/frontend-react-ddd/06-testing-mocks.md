---
paths:
    - "**/__tests__/**"
    - "**/__mocks__/**"
    - "**/__fixtures__/**"
    - "tests/**"
    - "e2e/**"
---

# 테스트와 목

테스트와 목은 검증 대상 바로 옆에 둡니다.

## 레이어가 아니다

`__tests__` · `__mocks__` · `__fixtures__` 는 slice 를 돕는 폴더입니다. segment 도 아니고 slice 경계도 바꾸지 않습니다. import 규칙(`03-import-boundary.md`)은 그대로 적용합니다. 테스트라고 아무 데나 import 해도 되는 건 아닙니다.

## 위치

- 허용
    - `src/domain/<entity>/__tests__/*`, `src/domain/<entity>/__mocks__/*`
    - `src/applications/<usecase>/__tests__/*`, `src/applications/<usecase>/__mocks__/*`
- 금지: 묶음 폴더에 두기. `src/applications/order/__tests__` 는 안 됩니다. `order` 는 slice 가 아닙니다

## 앱 단위 테스트

라우팅, 여러 기능 조합, 화면 시나리오는 slice 밖 `tests/*` · `e2e/*` 에 둡니다.

## fixture

- 먼저 slice 안 `__fixtures__/` 에 둡니다
- 여러 slice 가 같이 쓰면 `tests/fixtures/*` 에 둡니다

테스트가 대상에서 멀어지면 무엇을 검증하는지 찾기 어렵고, 리팩터링 때 같이 고쳐지지 않아 고아 테스트가 생깁니다.
