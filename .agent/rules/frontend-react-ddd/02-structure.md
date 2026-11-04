---
paths:
    - "src/**"
---

# 폴더 구조와 파일 이름

경로와 파일 이름만 보고 역할을 알 수 있게 한다. 정해진 segment 이름 밖의 폴더를 만들지 않는다.

## segment

### domain

```
src/domain/<entity>/
  components/   순수 UI
  containers/   상태 · 로직 연결
  contexts/     React Context
  model/        타입, 도메인 규칙
  hooks/        전용 훅
  lib/ utils/   내부 보조 로직
  store/        상태
```

UI · 훅 · 상태가 있어도 늘 그 엔티티에 딸린 것이다.

### applications

```
src/applications/<usecase>/
  components/   표현 UI
  containers/   조합
  contexts/     기능 범위 Context
  hooks/        기능 훅
  lib/ utils/   내부 로직
  schemas/      입력 검증 스키마
  services/     API, localStorage 같은 부수 효과
  store/        상태
```

`applications` 바로 아래가 usecase slice 다. 사이에 도메인 묶음 폴더(`applications/order/view-order/`)를 두지 않는다. 폴더 깊이만 늘고 import 경계는 그대로라 얻는 게 없다.

### usecase 이름

`<동사>-<도메인>` 으로 짓는다. 어느 도메인 기능인지가 이름에 드러나서 묶음 폴더가 필요 없다.

- 도메인 자리에는 `src/domain/` 의 폴더 이름을 그대로 쓴다(`order`, `product`, `review`). 단수형이다
- 동사는 아래 다섯 개 중에서 고른다. 같은 뜻에 다른 동사(`browse` · `show` · `load` · `compare` · `edit`)를 쓰지 않는다

| 동사     | 쓰는 때                                     | 예               |
| -------- | ------------------------------------------- | ---------------- |
| `view`   | 데이터를 읽어서 보여 준다(목록 · 상세 · 표) | `view-order`     |
| `search` | 검색어나 필터로 대상을 찾는다               | `search-product` |
| `create` | 새로 만든다                                 | `create-review`  |
| `update` | 이미 있는 것을 고친다                       | `update-order`   |
| `delete` | 지운다                                      | `delete-review`  |

- 같은 동사와 도메인으로 usecase 가 둘 이상 필요하면 뒤에 구분하는 말을 붙인다(`view-order-history`). 처음부터 붙이지 않는다

```
src/applications/view-product/    상품 상세
src/applications/search-product/  상품 검색 · 필터
src/applications/view-order/      주문 목록 · 상세
```

### pages · shared

`pages` 는 URL 기준 폴더(`04-routing.md`), `shared` 는 `ui/` · `hooks/` · `lib/` · `utils/` 처럼 종류별로 둔다.

## glob

이 위치와 이름에 있어야 검색 · 자동화 · 리뷰가 파일을 찾는다.

| 대상                  | glob                                           |
| --------------------- | ---------------------------------------------- |
| 모델                  | `src/domain/*/model/*Model.ts`                 |
| domain 컨테이너       | `src/domain/*/containers/*Container.tsx`       |
| domain 컴포넌트       | `src/domain/*/components/*.tsx`                |
| usecase slice         | `src/applications/*/`                          |
| 스키마                | `src/applications/*/schemas/*Schema.ts`        |
| 서비스                | `src/applications/*/services/*.ts`             |
| query key             | `src/applications/*/services/_keys.ts`         |
| applications 컨테이너 | `src/applications/*/containers/*Container.tsx` |
| applications 컴포넌트 | `src/applications/*/components/*.tsx`          |
| 페이지                | `src/pages/*/*Page.tsx`                        |
| 레이아웃              | `src/pages/**/_*Layout.tsx`                    |

## 파일 이름

suffix 로 역할을 드러낸다.

- 모델 `*Model.ts`, 스키마 `*Schema.ts`, 컨테이너 `*Container.tsx`, 페이지 `*Page.tsx`, 레이아웃 `_*Layout.tsx`

```
src/domain/product/model/ProductModel.ts
src/applications/search-product/schemas/ProductFilterSchema.ts
src/applications/view-product/services/getProductById.ts
src/applications/view-product/containers/ProductDetailContainer.tsx
src/pages/product/ProductDetailPage.tsx
src/pages/_RootLayout.tsx
```
