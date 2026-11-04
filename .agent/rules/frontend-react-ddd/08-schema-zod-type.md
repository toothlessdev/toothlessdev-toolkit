---
paths:
    - "src/**/*.{ts,tsx}"
---

# 타입 import 와 zod 스키마

## type-only import

`verbatimModuleSyntax` 가 켜져 있어서 타입을 값처럼 import 하면 컴파일 에러가 난다.

- 타입만 쓰면 `import type` 을 쓴다
- 값과 타입을 같이 쓰면 두 줄로 나누는 걸 권장하고, 한 줄에 `type` 을 붙이는 것도 허용한다

```ts
import { formatPrice } from "@/shared/lib/formatPrice";
import type { ProductModel } from "@/domain/product/model/ProductModel";

import { formatPrice, type Price } from "@/shared/lib/price";
```

`'X' is a type and must be imported using a type-only import` 가 나오면 `import type` 으로 바꾼다. 안 쓰는 import 는 바로 지운다.

## 스키마 파일 하나에 스키마 하나

- 파일 이름 `<Domain><Name>Schema.ts`, 위치 `src/applications/<usecase>/schemas/`
- export 모양은 고정한다

```ts
export const ProductFilterSchema = z.object({
    // ...
});

export type ProductFilterSchemaType = z.infer<typeof ProductFilterSchema>;
```

- 타입 이름은 `*SchemaType`
- 스키마끼리 참조는 같은 slice 안에서만
- 여러 스키마를 한 파일에 모으지 않는다
- 스키마 파일에 도메인 타입(`export type Product = { … }`)을 정의하지 않는다. 스키마 파일은 입력 검증과 그 infer 타입만 맡는다

## zod 는 입력 경계에서만

| zod 를 쓴다                                | 타입으로만 다룬다 |
| ------------------------------------------ | ----------------- |
| 폼 입력, react-hook-form submit payload    | 서버 응답         |
| URL · query params                         | 도메인 모델       |
| localStorage · sessionStorage 에서 읽은 값 |                   |

도메인 모델은 `src/domain/<entity>/model/*Model.ts` 에 TypeScript 타입으로 둔다.

## 검증은 폼에서 끝낸다

서비스는 검증된 타입을 받아서 믿는다. 서비스에서 `Schema.parse` 로 다시 검증하지 않는다. 이중 검증은 두 곳을 같이 고쳐야 하게 만든다.

## 리뷰 체크

- 타입 import 가 `import type` 인가
- 스키마가 입력 검증에만 쓰였는가
- 서비스에서 `parse` 를 부르지 않았는가
- `domain` 모델이 타입만으로 되어 있는가
- 스키마 참조가 slice 경계를 넘지 않는가
