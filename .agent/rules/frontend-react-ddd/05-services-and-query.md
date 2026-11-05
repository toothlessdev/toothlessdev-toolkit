---
paths:
    - "src/applications/**/services/**"
---

# 서비스와 React Query

외부 I/O 가 일어나는 곳을 한 군데로 모읍니다. HTTP, localStorage, 쿠키 접근은 서비스에서만 합니다.

## query key

위치: `applications/<usecase>/services/_keys.ts`

- 키는 모두 화살표 함수로 씁니다. 인자가 없어도 함수로 씁니다(인자를 더하기 쉽고 키 모양이 일정합니다)
- 키 객체 이름은 UPPER_SNAKE_CASE
- 배열의 앞 두 칸은 UPPER_SNAKE_CASE 문자열입니다. 첫 칸은 도메인(`"PRODUCT"`), 둘째 칸은 키 이름(`"DETAIL"`)이고, 인자는 그 뒤에 붙입니다
    - 키 이름을 문자열로 한 번 더 적는 이유: 같은 도메인 안에서 `ALL` · `DETAIL` 이 서로 다른 캐시 항목으로 갈리고, 도메인 첫 칸만 넘겨 `invalidateQueries` 로 묶어 무효화할 수 있습니다

```ts
type QueryKeyFactory = Record<string, (...args: never[]) => readonly unknown[]>;

export const PRODUCT_QUERY_KEY = {
    ALL: () => ["PRODUCT", "ALL"],
    DETAIL: (productId: string) => ["PRODUCT", "DETAIL", productId],
} satisfies QueryKeyFactory;
```

## 서비스 파일

위치: `applications/<usecase>/services/*.ts`

- 한 파일에 요청 타입, 응답 타입, 호출 함수, `useQuery` · `useMutation` 훅을 같이 둡니다
- 요청 · 응답 타입은 `export interface` 로 정의합니다. 이름은 `<호출 함수 이름>RequestBody` · `<호출 함수 이름>ResponseBody` 입니다(`GetProductByIdResponseBody`)
    - `RequestBody` 는 body 가 있는 요청에만 둡니다. body 가 없는 `get` 은 식별자를 함수 인자로 직접 받습니다
- 호출 함수는 함수 선언문으로 씁니다(`export async function getProductById()`). 비동기임이 앞에서 보입니다
- 파일 이름은 호출 함수 이름과 같습니다(`getProductById.ts`, `getProducts.ts`)
- 이름은 HTTP 메서드가 아니라 뜻으로 짓습니다. `get` · `create` · `edit` · `delete` 처럼 동작이 드러나는 동사를 쓰고(`signup` 처럼 뜻이 분명한 동사도 됩니다) `fetch` · `post` · `put` · `patch` 는 쓰지 않습니다
- 무엇을 기준으로 가져오는지 밝혀야 하면 끝에 `By<기준>` 을 붙입니다(`getProductById`)

```ts
import { useSuspenseQuery } from "@tanstack/react-query";

import { PRODUCT_QUERY_KEY } from "./_keys";

export interface GetProductByIdResponseBody {
    id: string;
    name: string;
    price: number;
}

export async function getProductById(productId: string) {
    return api.get<GetProductByIdResponseBody>(`/products/${productId}`);
}

export const useGetProductByIdQuery = (productId: string) =>
    useSuspenseQuery({
        queryKey: PRODUCT_QUERY_KEY.DETAIL(productId),
        queryFn: () => getProductById(productId),
    });
```

body 가 있는 요청은 이렇게 씁니다.

```ts
export interface CreateOrderRequestBody {
    productId: string;
    quantity: number;
}

export interface CreateOrderResponseBody {
    orderId: string;
}

export async function createOrder(request: CreateOrderRequestBody) {
    return api.post<CreateOrderResponseBody>("/orders", request);
}
```

## 훅을 부르는 곳

- `use*Query` 훅은 컨테이너(또는 컨테이너가 쓰는 usecase 훅)에서만 부릅니다. 컴포넌트에서 부르지 않습니다
- 로딩 상태는 페이지의 `<Suspense>` 가 맡습니다(`04-routing.md` 의 Suspense 경계). 컨테이너에서 `isLoading` 으로 분기하지 않습니다

## zod 를 쓰지 않는다

- 서비스에서 `parse` · `safeParse` 를 하지 않습니다. 서버 응답은 타입으로만 다룹니다
- 폼 입력 검증은 폼 레이어에서 끝냅니다(`08-schema-zod-type.md`)

## 서비스가 맡지 않는 것

UI 검증, 데이터 가공, 도메인 규칙. 가공 · 규칙은 `domain` 의 순수 로직이나 usecase 의 `lib` 에 둡니다.
