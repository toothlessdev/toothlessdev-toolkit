---
paths:
    - "src/App.tsx"
    - "src/main.tsx"
    - "src/pages/**"
---

# 페이지와 라우팅

`pages` 는 화면 조합만 합니다. 로직은 아래 레이어로, 라우트 정의는 위(`App.tsx`)로 보냅니다.

## pages

- 하는 일: 기능 조합, 레이아웃 배치, URL 진입점
- 하지 않는 일: 데이터 패칭, 비즈니스 로직, 서버 요청, 복잡한 상태 처리. 필요하면 `applications` · `domain` 의 컨테이너를 씁니다
- 재사용할 코드가 생기면 `pages` 에 두지 않고 `applications` · `domain` · `shared` 로 옮깁니다

## Suspense 경계

페이지 파일 하나만 열면 어디서 데이터를 받고 어디가 스켈레톤으로 바뀌는지 보이게 합니다.

- `<Suspense>` 는 `*Page.tsx` 에서만 쓰고, 컨테이너 하나를 감쌉니다. 예외는 사이드바처럼 레이아웃이 직접 놓는 컨테이너로, 그때만 `_*Layout.tsx` 에서 감쌉니다
- 컨테이너 · 컴포넌트 안에서는 `<Suspense>` 를 쓰지 않습니다
- React Query 훅(`useSuspenseQuery` 를 감싼 `use*Query`)은 컨테이너에서 부릅니다. 컨테이너가 쓰는 usecase 훅 안에서 불러도 됩니다. 컴포넌트는 데이터를 props 로만 받습니다
- `fallback` 에 넣는 스켈레톤은 그 컨테이너와 같은 slice 의 `components/` 에 `*Skeleton.tsx` 로 둡니다
- 한 영역을 따로 로딩하고 싶으면 컨테이너 안에 경계를 더 두지 않습니다. 컨테이너를 나누고 페이지에서 각각 감쌉니다

```tsx
export default function HomePage() {
    return (
        <>
            <Suspense fallback={<OrderSummarySkeleton />}>
                <OrderSummaryContainer />
            </Suspense>
            <Suspense fallback={<ProductListSkeleton />}>
                <ProductListContainer />
            </Suspense>
        </>
    );
}
```

## 폴더는 URL 기준

```
/                  → pages/home/HomePage.tsx
/orders            → pages/order/OrderListPage.tsx
/products/:id      → pages/product/ProductDetailPage.tsx
```

- 파일 이름은 `*Page.tsx`
- 동적 파라미터에 폴더를 만들지 않습니다. `pages/product/[id]/…` · `pages/product/detail/…` 는 금지
- 목록과 상세는 같은 폴더에 `ProductListPage.tsx` · `ProductDetailPage.tsx` 로 둡니다

## 레이아웃

- `pages` 안에만 두고 이름은 `_` 로 시작합니다(`pages/_RootLayout.tsx`, `pages/product/_ProductLayout.tsx`)
- 라우팅 구조와 UI 껍데기만 맡습니다. 데이터 패칭 · 비즈니스 로직은 하지 않습니다

## App.tsx

라우트 정의와 전역 Provider 조립은 `src/App.tsx` 한 파일에서 합니다.

- 모든 Route 정의를 여기서만 합니다
- Route element 에는 `pages` 의 `*Page.tsx` · `_*Layout.tsx` 만 씁니다
- 가드 로직은 `applications` 에 만들고 여기서 조합합니다
- RouterProvider, QueryClientProvider 같은 전역 Provider 도 여기서 감쌉니다
- 비즈니스 로직 · 상태 가공을 넣지 않습니다. 조립만 합니다
- `main.tsx` 는 `App` 을 마운트만 합니다

```tsx
import {
    createBrowserRouter,
    createRoutesFromElements,
    Route,
    RouterProvider,
} from "react-router-dom";

import RootLayout from "@/pages/_RootLayout";
import HomePage from "@/pages/home/HomePage";
import ProductDetailPage from "@/pages/product/ProductDetailPage";
import NotFoundPage from "@/pages/not-found/NotFoundPage";

const router = createBrowserRouter(
    createRoutesFromElements(
        <Route path="/" element={<RootLayout />}>
            <Route index element={<HomePage />} />
            <Route path="products/:id" element={<ProductDetailPage />} />
            <Route path="*" element={<NotFoundPage />} />
        </Route>,
    ),
);

export default function App() {
    return <RouterProvider router={router} />;
}
```

URL 이 바뀌면 `pages` 를, 기능이 바뀌면 `applications` 를, 도메인이 바뀌면 `domain` 을 고칩니다.
