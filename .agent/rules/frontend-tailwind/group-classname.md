# Tailwind CSS 클래스 작성 규칙

## 1. 기본 원칙

- Tailwind CSS 클래스는 `cn()`을 사용하여 **의미적 역할에 따라 그룹화합니다.**
- 클래스는 단순히 길이에 따라 나누지 않고, 서로 연관된 속성끼리 묶습니다.
- 그룹 간 순서를 일관되게 유지합니다.
- 하나의 그룹에 속하는 클래스는 가능한 한 같은 줄에 작성합니다.
- 불필요하게 클래스를 변수나 별도 상수로 추출하지 않습니다.
- 조건부 클래스는 `clsx`의 객체 문법을 우선적으로 사용합니다.
- 기존 스타일, 반응형 동작, 조건부 클래스의 동작을 유지합니다.
- 엄격한 형식보다 가독성과 유지보수성을 우선합니다.

## 2. 클래스 그룹 분류 및 순서

다음 순서를 기본으로 사용합니다.

### 2.1. 레이아웃 및 위치

- `flex`, `grid`, `block`, `inline`, `hidden`
- `relative`, `absolute`, `fixed`, `sticky`
- `inset-0`, `top-0`, `left-0`, `z-10`

### 2.2. 크기

- `w-full`, `h-full`, `size-8`
- `min-w-0`, `max-w-lg`, `min-h-screen`
- `flex-1`, `shrink-0`, `grow`

### 2.3. 정렬 및 배치

- `flex-col`, `flex-row`, `flex-wrap`
- `items-center`, `items-start`, `items-end`
- `justify-center`, `justify-between`, `justify-end`
- `self-center`, `place-items-center`

### 2.4. 간격

- `p-4`, `px-6`, `py-2`
- `m-2`, `mx-auto`, `mt-4`
- `gap-2`, `gap-x-4`, `space-y-2`

### 2.5. 타이포그래피

- `text-sm`, `text-lg`, `text-xl`
- `font-medium`, `font-semibold`, `font-bold`
- `text-center`, `text-left`, `text-right`
- `leading-tight`, `tracking-wide`
- `truncate`, `whitespace-nowrap`

### 2.6. 색상 및 배경

- `text-white`, `text-gray-500`
- `bg-black`, `bg-primary`
- `opacity-50`

### 2.7. 테두리 및 시각 효과

- `rounded-lg`, `rounded-full`
- `border`, `border-gray-200`
- `shadow-md`, `ring-1`

### 2.8. 상호작용 및 기타

- `cursor-pointer`, `select-none`
- `overflow-hidden`, `pointer-events-none`
- `transition-colors`, `duration-200`
- `hover:*`, `focus:*`, `active:*`, `disabled:*`

## 3. 작성 규칙

### 3.1. 의미 단위로 클래스를 분리합니다.

여러 역할의 Tailwind CSS 클래스가 함께 사용되는 경우 `cn()`의 문자열 인자를 분리하여 작성합니다.

**권장하는 방식**

```tsx
<div
    className={cn(
        "flex flex-col items-center justify-center",
        "w-full h-full max-w-lg",
        "gap-4 px-6 py-8",
        "text-center text-sm font-bold text-gray-900",
        "rounded-lg border border-gray-200 bg-white shadow-md",
    )}
/>
```

**권장하지 않는 방식**

```tsx
<div className="flex flex-col items-center justify-center w-full h-full max-w-lg gap-4 px-6 py-8 text-center text-sm font-bold text-gray-900 rounded-lg border border-gray-200 bg-white shadow-md" />
```

### 3.2. 밀접하게 연관된 클래스는 같은 그룹으로 유지합니다.

`flex`, `items-center`, `justify-center`처럼 함께 사용되는 클래스는 같은 줄에 작성합니다.

```tsx
className={cn(
  "flex items-center justify-between",
  "w-full max-w-md",
  "gap-2 px-4 py-2",
  "text-sm font-medium",
)}
```

그룹의 경계는 절대적인 규칙이 아닙니다.

예를 들어 `flex items-center justify-center`는 레이아웃과 정렬에 해당하지만, 밀접하게 연관되어 있으므로 하나의 그룹으로 작성하는 것을 권장합니다.

### 3.3. 간단한 클래스는 `cn()`으로 감싸지 않습니다.

클래스가 적고 충분히 읽기 쉬운 경우 일반 문자열을 사용합니다.

```tsx
<div className="flex items-center gap-2" />
```

다음과 같은 경우 `cn()`을 사용합니다.

- 여러 의미 그룹이 존재하여 분리하는 것이 가독성에 도움이 되는 경우
- 조건부 스타일이 필요한 경우
- 외부에서 전달받은 `className`과 병합해야 하는 경우
- 반응형 또는 상태별 클래스가 복잡해지는 경우

### 3.4. 조건부 클래스는 객체 문법으로 작성합니다.

조건부 스타일은 `cn()` 내부에서 `clsx`의 객체 문법을 우선적으로 사용합니다.

- 객체의 key에는 적용할 Tailwind CSS 클래스를 작성합니다.
- 객체의 value에는 해당 클래스의 적용 조건을 작성합니다.
- 동일한 조건에 속하는 클래스는 하나의 key로 묶습니다.
- 조건부 클래스는 기본 스타일 그룹 이후에 배치합니다.
- 단순한 조건부 클래스에는 `&&`나 삼항 연산자보다 객체 문법을 우선합니다.
- 상호 배타적인 스타일 선택은 삼항 연산자나 명시적인 매핑을 사용할 수 있습니다.

**권장하는 방식**

```tsx
<button
    className={cn(
        "flex items-center justify-center",
        "w-full h-10 px-4",
        "text-sm font-semibold",
        "rounded-md bg-blue-600 text-white",
        "transition-colors hover:bg-blue-700",
        {
            "cursor-not-allowed opacity-50": isDisabled,
            "ring-2 ring-blue-400": isActive,
            "shadow-md": isElevated,
        },
        className,
    )}
/>
```

**권장하지 않는 방식**

```tsx
<button
    className={cn(
        "flex items-center justify-center",
        isDisabled && "cursor-not-allowed opacity-50",
        isActive && "ring-2 ring-blue-400",
        isElevated ? "shadow-md" : "",
    )}
/>
```

상호 배타적인 스타일은 다음과 같이 작성할 수 있습니다.

```tsx
<button
    className={cn(
        "flex items-center justify-center",
        "rounded-md px-4 py-2",
        variant === "primary"
            ? "bg-blue-600 text-white"
            : "bg-gray-100 text-gray-900",
    )}
/>
```

### 3.5. 반응형 및 상태별 클래스를 구분합니다.

반응형 클래스가 많아지는 경우 기본 스타일과 별도의 그룹으로 분리합니다.

```tsx
<div
    className={cn(
        "flex flex-col items-center",
        "w-full max-w-screen-lg",
        "gap-4 p-4",
        "text-sm font-medium",
        "md:flex-row md:justify-between",
        "md:gap-6 md:p-8",
        "hover:bg-gray-50",
    )}
/>
```

반응형 클래스가 적고 기존 그룹과 밀접하게 연관된 경우 같은 줄에 배치할 수 있습니다.

```tsx
<div
    className={cn(
        "flex flex-col md:flex-row",
        "w-full md:max-w-2xl",
        "gap-2 md:gap-4",
    )}
/>
```

반응형 클래스의 분리 여부는 전체적인 가독성을 기준으로 결정합니다.

### 3.6. 외부 `className`은 마지막에 배치합니다.

외부에서 전달받은 `className`은 기본 스타일 및 조건부 스타일 이후에 배치합니다.

```tsx
function Button({
    className,
    isActive,
}: {
    className?: string;
    isActive?: boolean;
}) {
    return (
        <button
            className={cn(
                "flex items-center justify-center",
                "h-10 px-4",
                "rounded-md bg-blue-600 text-white",
                {
                    "ring-2 ring-blue-400": isActive,
                },
                className,
            )}
        />
    );
}
```

`cn()`이 `clsx`와 `tailwind-merge`를 조합한 유틸리티인 경우, 외부 클래스가 기본 클래스와 충돌할 때 의도한 우선순위로 병합되도록 합니다.

### 3.7. 불필요한 그룹 분리를 피합니다.

클래스를 한 개씩 분리하거나 지나치게 세분화하지 않습니다.

**권장하는 방식**

```tsx
className={cn(
  "flex items-center justify-center",
  "w-full h-12",
  "gap-2 px-4",
  "text-sm font-semibold",
)}
```

**권장하지 않는 방식**

```tsx
className={cn(
  "flex",
  "items-center",
  "justify-center",
  "w-full",
  "h-12",
  "gap-2",
  "px-4",
  "text-sm",
  "font-semibold",
)}
```

### 3.8. 기존 스타일과 동작을 변경하지 않습니다.

- 클래스 정리만을 목적으로 기존 유틸리티를 제거하거나 추가하지 않습니다.
- 조건부 표현식과 반응형 스타일의 동작을 유지합니다.
- `tailwind-merge` 사용 시 충돌하는 클래스의 병합 결과에 주의합니다.
- 기존에 사용하던 CSS 변수, 커스텀 유틸리티 및 디자인 토큰을 유지합니다.
- 클래스 그룹화 과정에서 기존 렌더링 결과가 변경되지 않도록 합니다.
- 클래스 정렬이 실제 스타일 우선순위에 영향을 줄 수 있는 경우 기존 순서를 유지합니다.

## 4. Agent 동작 지침

React 컴포넌트를 작성하거나 수정할 때 다음 지침을 자동으로 적용합니다.

1. Tailwind CSS 클래스를 식별합니다.
2. 각 클래스를 의미적 역할에 따라 그룹화합니다.
3. 정의된 그룹 순서에 맞게 정렬합니다.
4. 밀접하게 연관된 클래스는 같은 줄에 유지합니다.
5. 여러 의미 그룹이 존재하는 경우 `cn()`으로 분리하여 작성합니다.
6. 간단한 클래스 조합은 인라인 문자열로 유지합니다.
7. 조건부 클래스는 `clsx` 객체 문법을 우선적으로 사용합니다.
8. 반응형 및 상태별 클래스는 가독성을 기준으로 그룹화합니다.
9. 외부 `className`은 마지막에 배치합니다.
10. 기존 스타일과 동작을 변경하지 않습니다.
11. 불필요한 추상화나 과도한 줄바꿈을 피합니다.
12. 별도 지시가 없어도 새로운 컴포넌트 작성 및 기존 컴포넌트 수정 시 해당 규칙을 적용합니다.

## 5. 최종 작성 예시

```tsx
function Card({
    title,
    description,
    isSelected,
    isDisabled,
    className,
}: CardProps) {
    return (
        <div
            className={cn(
                "flex flex-col",
                "w-full max-w-md",
                "gap-4 p-6",
                "rounded-xl border border-gray-200 bg-white",
                "shadow-sm transition-colors",
                {
                    "border-blue-500 bg-blue-50": isSelected,
                    "pointer-events-none opacity-50": isDisabled,
                    "hover:border-gray-300": !isDisabled && !isSelected,
                },
                className,
            )}
        >
            <h3
                className={cn(
                    "text-lg font-bold text-gray-900",
                    "leading-tight",
                )}
            >
                {title}
            </h3>

            <p className="text-sm text-gray-500">{description}</p>
        </div>
    );
}
```

**목표:** Tailwind CSS 클래스의 역할을 쉽게 파악할 수 있도록 의미 단위로 정리하고, 조건부 스타일을 선언적으로 관리하며, 프로젝트 전체에서 일관된 스타일 작성 방식을 유지합니다.
