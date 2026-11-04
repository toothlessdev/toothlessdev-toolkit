---
paths:
    - "src/**"
---

# 프론트엔드 최상위 규칙

이 프로젝트의 코드를 쓰거나 구조를 바꿀 때 가장 먼저 따르는 규칙이다. 이 폴더의 다른 규칙과 부딪히면 이 문서가 우선한다.

## 레이어

Feature-Sliced Design(FSD) 을 따른다. 레이어는 네 개뿐이다.

| 레이어         | 맡는 일                                                   | slice                     |
| -------------- | --------------------------------------------------------- | ------------------------- |
| `pages`        | 라우트 단위 화면 조합                                     | 없음                      |
| `applications` | 사용자 행동 단위(usecase). 외부 I/O, 입력 검증, 기능 상태 | `applications/<usecase>/` |
| `domain`       | 도메인의 형태와 규칙. 타입, 모델, 순수 로직               | `domain/<entity>/`        |
| `shared`       | 도메인 의미가 없는 범용 코드                              | 없음                      |

`src/App.tsx` 는 레이어가 아니라 앱 진입점이다. 라우팅과 전역 Provider 조립을 맡는다. 위 네 개 말고 다른 레이어를 만들지 않는다.

## 의존 방향

```
App.tsx → pages → applications → domain → shared
```

- 위는 아래를 import 할 수 있고, 아래는 위를 import 하지 못한다
- `domain` → `applications | pages | App.tsx`, `applications` → `pages | App.tsx`, `pages` → `App.tsx`, `shared` → 그 밖의 모든 레이어는 금지다
- 의존이 맞지 않으면 책임을 더 아래 레이어로 옮기거나 공통 부분을 떼어 낸다. import 를 우회해서 뚫지 않는다

## 반드시 지키는 것

- `pages` 는 얇게 둔다. 비즈니스 로직, 데이터 패칭, 외부 API 호출을 하지 않는다
- 외부 I/O(HTTP, localStorage, 쿠키)는 `applications/<usecase>/services` 에서만 한다
- `domain` 은 type · interface → 도메인 모델 → 순수 로직 순서로 담는다. 외부 I/O 를 하지 않는다
- `shared` 에는 UI primitive, 공통 훅, 유틸, 라이브러리 래퍼만 둔다. 도메인 말이 들어가면 `shared` 가 아니다
- `__tests__` · `__mocks__` · 전역 타입은 레이어가 아니다. 그래도 import 규칙은 똑같이 적용한다
- 파일 위치가 애매하면 감으로 두지 말고 `02-structure.md` 의 segment · 이름 규칙으로 정한다

목표는 하나다. 변경이 생겼을 때 어디를 고쳐야 하는지 예측할 수 있어야 한다. 예측이 안 되면 구조가 잘못됐을 가능성이 높다.
