---
paths:
    - "src/**/store/**"
    - "src/**/contexts/**"
    - "src/App.tsx"
---

# 상태 관리

상태는 쓰이는 범위에 가장 가깝게 둡니다. 멀리 둘수록 결합과 이해 비용이 커집니다.

## 범위별 위치

| 범위              | 위치                                  | 예                              |
| ----------------- | ------------------------------------- | ------------------------------- |
| 컴포넌트 안       | 컴포넌트 · 컨테이너 내부 `useState`   | 토글, 입력값, 일시적인 인터랙션 |
| slice 안에서 공유 | 그 slice 의 `store/`                  | 기능 · 엔티티 범위 상태         |
| 앱 전역           | `src/App.tsx` 에서 Provider 로 감싸기 | QueryClient, 테마               |

## slice store

위치: `src/applications/<usecase>/store/*`, `src/domain/<entity>/store/*`

- 자기 레이어와 아래 레이어만 import 합니다
- 다른 usecase 의 store 를 직접 참조하지 않습니다. 순환 의존이 시작됩니다
- Zustand 를 쓰면 slice 안에서 만들고 그 기능 범위 밖에서 가져다 쓰지 않습니다

## 전역 store 가 필요할 때

Redux 처럼 전역 store 가 필요하면

- reducer 는 slice 안에 둡니다(`store/slice.ts`)
- 조립(combine, configureStore, Provider)은 `src/App.tsx` 에서 합니다. 파일이 커지면 `src/store.ts` 로 떼되 조립만 합니다
- 조립하는 곳에 비즈니스 로직 · 상태 가공 · 도메인 규칙을 넣지 않습니다

## 하지 않는 것

- 전역 store 에 전부 넣기
- `shared` 에 store 만들기. 도메인 책임이 무너집니다
