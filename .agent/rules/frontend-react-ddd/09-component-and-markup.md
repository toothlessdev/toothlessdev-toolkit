---
paths:
    - "src/**/*.tsx"
---

# 컴포넌트 분리와 마크업

길다는 이유만으로 쪼개지 않습니다. 아래 기준 중 하나 이상에 근거해서 쪼갭니다.

## 쪼개는 기준

- **재사용**: 2번 이상 반복되는 UI(버튼, 입력, 카드)는 분리합니다. 비즈니스 로직 없는 표현 컴포넌트로 씁니다
- **의미 단위**: 한 컴포넌트에 서로 다른 목적의 UI 가 섞이거나 "여기부터 다른 섹션" 이라는 주석이 필요해지면 의미 기준으로 나눕니다(`ProductView` → `ProductHeader`, `ProductTable`)
- **제어권**: 여러 하위 컴포넌트가 공유하는 상태는 부모가 갖습니다. 그 컴포넌트 안에서 끝나는 UI 상태(모달 열림, 탭 선택)는 자식이 갖습니다
- **변경 빈도**: 자주 바뀌는 정책 · 규칙 로직은 훅이나 별도 컴포넌트로 떼어 안정적인 UI 껍데기를 흔들지 않게 합니다

## 제어권

|         | 부모가 소유(controlled)                                                          | 자식이 소유(self-contained)                               |
| ------- | -------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 대상    | 일관성이 중요한 폼 입력, 여러 곳이 공유하는 값, 부모가 저장 · 검증 · 제출을 다룸 | 드롭다운 · 모달 · 탭 · 아코디언처럼 안에서 끝나는 UI 상태 |
| 모양    | 부모가 state 를 갖고 `value` · `onChange` 를 내려 줌                             | 자식이 `useState` 를 갖고 이벤트 · 결과만 밖으로 냄       |
| 좋은 점 | 흐름 추적과 디버깅이 쉬움                                                        | 부모 리렌더가 줄고 재사용이 쉬움                          |

## 로직과 부수 효과는 훅으로

- 데이터 패칭, 구독, 타이머는 커스텀 훅으로 뺍니다
- 복잡한 계산, 상태 조작, 분기 규칙도 컴포넌트가 아니라 훅에서 다룹니다
- 한 파일에 API 호출 로직과 큰 JSX 를 같이 쓰지 않습니다

```tsx
const { data } = useGetProductByIdQuery(productId);
return <ProductDetail product={data} />;
```

## 마크업

- JSX 블록은 Section · Header · Content · Actions 같은 의미 단위로 나눕니다
- 반복 구조는 `map` 과 작은 컴포넌트로 뺍니다
- `div` 만 쌓이면 의미 단위로 나눠서 풉니다
- 레이아웃 껍데기와 데이터 표현을 나누고, 버튼 묶음은 별도 컴포넌트로 뺍니다

## 쓰기 전에 볼 것

1. 이 UI 가 다른 곳에서 2번 이상 쓰입니까
2. 한 파일이 여러 의미를 처리하고 있지 않습니까
3. 이 상태를 부모가 알아야 합니까, 여기서 끝나도 됩니까
4. 자주 바뀌는 로직이 안정적인 UI 를 흔들고 있지 않습니까
5. 자식 상태 변경이 부모 전체를 다시 그리게 하지 않습니까

## 컴포넌트 선언

### 이름과 선언 방식

- 컴포넌트 이름은 PascalCase 입니다
- 일반 컴포넌트는 arrow function 으로 선언합니다
- 페이지 컴포넌트는 예외입니다. 아래 페이지 컴포넌트 항목을 따릅니다

```tsx
// 올바른 예
export const ProductCard = () => {};

// 잘못된 예
export const productCard = () => {};
export function productCard() {}
```

### Props 타입

- Props 타입은 `interface` 로 정의하고 이름은 `<컴포넌트 이름>Props` 로 짓습니다
- `React.FC` 를 쓰지 않습니다. props 를 구조분해하고 그 뒤에 타입을 붙입니다

```tsx
// 올바른 예
export interface ProductCardProps {
    product: ProductModel;
}
export const ProductCard = ({ product }: ProductCardProps) => {};

// 잘못된 예
export type ProductCardProps = { product: ProductModel }; // interface 를 쓴다
export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {};
```

### 페이지 컴포넌트

- 함수 선언문 `function` 으로 선언하고 `export default function` 으로 내보냅니다
- 이유: 페이지 단위로 `lazy` 를 적용할 때 default export 는 `lazy(() => import("./ProductDetailPage"))` 로 끝납니다. named export 는 `.then((mod) => ({ default: mod.ProductDetailPage }))` 를 덧붙여야 합니다

```tsx
export default function ProductDetailPage() {}
```
