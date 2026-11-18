# 모핑 구현 패턴

스토리보드의 "무엇이 무엇으로 바뀌나" 칸을 보고 패턴을 고릅니다.

`(example)` 이 붙은 코드와 식별자는 패턴의 뜻을 보여 주는 사례입니다. 이름, 좌표, 도메인을 새 덱에 옮기지 않습니다.

| 바뀌는 것                                          | 패턴           |
| -------------------------------------------------- | -------------- |
| 그림 한 장이 여러 단계에 걸쳐 변함 (기본)          | 장면 함수      |
| 같은 도형의 위치, 크기, 색                         | 같은 요소 이동 |
| 도형의 구조가 달라짐 (줄 → 박스, 박스 묶음 → 노드) | 겹쳐서 모핑    |
| 도형은 그대로, 보는 범위만 (전체 ↔ 일부)           | 카메라         |

## 장면 함수

그림 한 장을 여러 단계에 걸쳐 변형하는 덱의 기본 구조입니다. SVG, Canvas, DOM 어디에나 씁니다.

**1. 모든 도형을 처음에 한 번 만들고, 단계마다 지우지 않습니다.** 안 보이는 단계에서는 투명도만 0입니다.

**2. 단계 번호를 받아 모든 도형의 목표 값을 돌려주는 함수를 둡니다.** 이전, 다음, 다시 재생, 장 건너뛰기가 전부 이 함수 하나로 맞습니다. 그림의 구역마다 함수를 나눠 합칩니다.

(example)

```js
function sceneFor(step) {
    const scene = {};
    storageScene(scene, step);
    flowScene(scene, step);
    return scene;
}

function storageScene(scene, step) {
    scene.volume =
        step === 1
            ? {
                  x: 170,
                  y: 250,
                  w: 620,
                  h: 130,
                  o: 1,
                  title: "Cluster volume 하나",
              }
            : {
                  x: 20,
                  y: 205,
                  w: 920,
                  h: 320,
                  o: 1,
                  title: "Cluster volume 하나",
              };
}
```

**3. 나타날 도형은 부모 자리에 숨겨 둡니다.** 이것이 "쪼개지는" 모핑의 핵심입니다. 자식 도형은 쪼개지는 단계 전까지 부모와 같은 자리, 같은 크기로 투명하게 겹쳐 있다가, 그 단계에서 자기 자리로 줄어듭니다.

(example) segment 띠 하나가 4단계에서 replica 여러 개로 쪼개지는 경우

```js
scene[replicaId] =
    step >= 4
        ? { x, y, w: 128, h: 130, o: 1, title }
        : { x: 38, y, w: 884, h: 130, o: 0, title };
```

**4. 재생은 "이전 장면을 깔고 이번 장면으로 트윈" 입니다.** 어느 단계로 뛰어도 같은 결과가 나옵니다.

(example) GSAP 으로 구현한 경우

```js
function play(step) {
    if (activeTimeline) activeTimeline.kill();
    tokenLayer.replaceChildren();

    const scene = sceneFor(step);
    if (reduceMotion.matches) return setScene(scene);

    setScene(sceneFor(Math.max(step - 1, 1)));
    const timeline = gsap.timeline({ onComplete: () => setScene(scene) });
    activeTimeline = timeline;

    morphTo(timeline, scene, 0, MORPH_SECONDS);
    CHOREOGRAPHY[step]?.(timeline, MORPH_SECONDS + FLOW_GAP_SECONDS);
}
```

**5. 구조 모핑과 흐름 연출을 나눕니다.** 도형이 자리 잡은 뒤(`MORPH_SECONDS` 에 짧은 간격을 더한 시각) 그 위로 데이터를 흘립니다. 둘을 동시에 재생하면 눈이 어디를 볼지 모릅니다. 흐름 연출은 단계 번호를 키로 하는 표에 둡니다.

(example)

```js
const CHOREOGRAPHY = {
    7(timeline, at) {
        const arrival = fly(timeline, {
            from: API_BOTTOM,
            to: WRITER_TOP,
            at,
            duration: 0.55,
            text: "INSERT",
        });
        setServerText(timeline, "writer", "락 획득", arrival);
        flash(timeline, "writer", arrival);
    },
};
```

흐름 연출에 쓰는 도구 함수는 세 가지면 충분합니다.

- **토큰 날리기**: 글자 또는 점 토큰이 출발지에서 도착지로 날아갑니다. 0.5~0.7초이고, 도착 시각을 돌려줍니다
- **도착 표시**: 도착하면 대상 테두리를 0.1초 굵게 했다가 0.4초에 돌아옵니다
- **값 바꾸기**: 카운터와 상태 글자는 토큰이 도착한 시각에 맞춰 바꿉니다. 토큰 날리기가 돌려준 도착 시각을 그대로 씁니다

**6. 요소마다 시작을 조금씩 어긋나게 합니다.** 행은 0.12초, 열은 0.05초 정도씩 늦춥니다. 쪼개질 때 한쪽부터 번지듯 보입니다.

**7. SVG 경로를 트윈한다면 점 개수를 항상 같게 둡니다.** `d` 를 숫자로 보간하므로 점 개수가 다르면 보간되지 않습니다. 직선이어도 같은 점 개수로 씁니다.

(example) 점 4개로 고정한 경로

```js
const pathOf = (...p) =>
    `M${p[0]} ${p[1]} L${p[2]} ${p[3]} L${p[4]} ${p[5]} L${p[6]} ${p[7]}`;
```

**8. 다음 규모로 갈 때는 그림 전체를 복제합니다.** 그림을 묶은 그룹을 미리 복제해 숨겨 두고, 마지막 단계에서 원본을 줄이면서 복제본을 옆에 꺼냅니다.

(example) SVG 에서 `<g id="clone"><use href="#cluster"/></g>` 로 복제해 두고 원본을 `scale: 0.49` 로 줄입니다.

SVG 라면 좌표가 `viewBox` 안의 값이라 무대 축소를 신경 쓰지 않아도 됩니다. CDN 스크립트를 쓴다면 오프라인 발표에 대비해 파일에 내장합니다.

## 같은 요소 이동

요소를 지우지 않고 속성만 바꿉니다. 처음과 끝 위치를 재서 `transform` 으로 움직입니다.

```js
function morphTo(element, applyFinalLayout) {
    var firstBox = element.getBoundingClientRect();
    applyFinalLayout();
    var lastBox = element.getBoundingClientRect();
    var offsetX = (firstBox.left - lastBox.left) / stageScale;
    var offsetY = (firstBox.top - lastBox.top) / stageScale;

    return element.animate(
        [
            { transform: "translate(" + offsetX + "px, " + offsetY + "px)" },
            { transform: "none" },
        ],
        { duration: 900, easing: "cubic-bezier(0.77, 0, 0.175, 1)" },
    );
}
```

**`stageScale` 로 나누는 이유:** 고정 크기 무대를 창 크기에 맞춰 `scale` 하면 `getBoundingClientRect` 는 축소된 값을 돌려주는데, 무대 안 `translate` 는 축소 전 좌표로 동작합니다. 나누지 않으면 창 크기에 따라 도착 지점이 어긋납니다.

## 겹쳐서 모핑

DOM 구조가 달라지는 모핑에 씁니다. (example) 파일 트리의 줄이 파일 박스가 되는 경우

1. 도착 레이아웃을 `opacity: 0` 으로 미리 만들어 도착 위치를 잽니다
2. 출발 요소마다 같은 위치에 겹침 요소를 만들어 무대 위에 띄웁니다
3. 겹침 요소를 도착 위치로 옮기면서 `width`, `height`, `border-radius`, 색을 바꿉니다. 글자는 먼저 흐리게 없앱니다
4. 끝나면 도착 요소를 켜고 겹침 요소를 지웁니다

요소마다 시작을 조금씩 어긋나게 해야 한 덩어리가 순간이동하는 것처럼 보이지 않습니다. 요소가 수백 개면 DOM 대신 canvas 로 처음과 끝 좌표를 보간합니다.

## 카메라

무대 안의 큰 그림을 감싼 요소를 움직입니다. 도형을 건드리지 않으니 안의 애니메이션이 계속 돌아갑니다.

```js
camera.animate(
    [{ transform: "translate(" + x + "px, " + y + "px) scale(" + zoom + ")" }],
    {
        duration: 900,
        easing: "cubic-bezier(0.77, 0, 0.175, 1)",
        fill: "forwards",
    },
);
```

`transform-origin: 0 0` 으로 두면 좌표 계산이 쉽습니다. 좌표는 찍어 본 뒤 맞춥니다. 확대한 채 가장자리가 잘리는 실수가 많습니다.

**실제 화면 캡처를 쓸 때:** 확대하면 흐려지니 2배 해상도로 찍습니다.

## 끼어들기와 되돌리기

- 재생 중 키를 누르면 진행 중인 애니메이션을 취소하고 그 단계의 끝 상태로 넘어갑니다. 발표자를 기다리게 하지 않습니다
- 장을 떠날 때 타이머와 애니메이션을 모두 취소합니다. 안 그러면 돌아왔을 때 두 장면이 겹쳐 돕니다
- `prefers-reduced-motion` 이면 움직임 없이 끝 상태만 보여 줍니다

## 알려진 함정

- WAAPI 키프레임의 `offset` 은 작아지면 안 됩니다. 짧은 구간에서 계산값이 뒤집히면 `Offsets must be monotonically non-decreasing` 오류가 납니다
- `display: flex` 가 `hidden` 속성을 덮어씁니다. `[hidden] { display: none !important; }` 를 둡니다
