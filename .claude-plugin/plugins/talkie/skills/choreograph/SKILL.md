---
name: choreograph
description: "/talkie:choreograph 로 호출하면 덱 코드를 읽어 플레이어가 덱을 조작할 adapter.js 와 애니메이션 순서 motions.json 을 만듭니다."
disable-model-invocation: true
---

# /talkie:choreograph

- 입력: `deck.html`, `script.json`
- 출력: `adapter.js`, `motions.json` (`${CLAUDE_PLUGIN_ROOT}/schemas/motions.schema.json`)
- `template/player.html` 은 고치지 않습니다. 덱마다 다른 것은 전부 어댑터에 둡니다.

## 어댑터 계약

```ts
interface DeckAdapter {
    slideCount: number;
    hideSelectors?: string[];
    interactiveSelector?: string;
    ownsDocumentAnimations?: boolean;
    prepare?(): void;
    showSlide(slideIndex: number, options: { isDiscontinuous: boolean }): void;
    seekMotion(
        slideIndex: number,
        motionElapsedByName: Record<string, number | null>,
        options: { isDiscontinuous: boolean; localSeconds: number },
    ): void;
}
```

- `window.talkieAdapter` 에 넣습니다. 덱 스크립트 뒤에 실행되므로 덱의 전역 변수와 함수를 쓸 수 있습니다.
- `hideSelectors`: 덱의 자체 이동 버튼, 재생 버튼, 진행 막대처럼 재생 시계를 건너뛰고 상태를 바꾸는 UI 입니다.
- `interactiveSelector`: 눌러도 재생이 토글되면 안 되는 덱 요소입니다.
- `ownsDocumentAnimations`: 어댑터가 CSS 애니메이션 시간을 직접 맞추면 `true` 입니다.
- `motionElapsedByName`: motion 시작 뒤 지난 초이고, 시작 전이면 `null` 입니다. `durationSeconds` 를 넘지 않습니다.
- `isDiscontinuous`: 슬라이더 점프나 탭 복귀처럼 시간이 이어지지 않을 때 `true` 입니다.

## 덱 유형별 시작점

| 덱이 움직이는 방식 | 참고 파일 |
| --- | --- |
| 시계 변수로 매 프레임 그립니다 | `${CLAUDE_PLUGIN_ROOT}/snippets/adapter-clock.js` |
| CSS 애니메이션, Web Animations API | `${CLAUDE_PLUGIN_ROOT}/snippets/adapter-waapi.js` |
| 타이머로 상태를 쌓습니다 | 정확한 탐색이 안 됩니다. 슬라이드 시작점 이동만 보장하고 결과에 밝힙니다 |

## 덱 코드에서 찾을 것

- 덱 자체의 재생 루프를 멈추는 방법입니다. 덱의 시계가 혼자 움직이면 플레이어 시계와 어긋납니다.
- 시간에서 바로 계산되지 않고 쌓이는 상태입니다. `isDiscontinuous` 일 때 지우고 다시 그립니다.
  - 이미 그린 요소를 건너뛰는 증분 그리기
  - 이전 값과 같으면 건너뛰는 단계 비교
  - DOM 순서나 텍스트를 바꾼 뒤 되돌리지 않는 코드
  - 슬라이드 사이를 잇는 연출. 연속 재생일 때만 실행합니다.
- 내부 배속이나 시작 시각 보정입니다. `motionElapsedByName` 을 덱의 시계 값으로 바꿀 때 반영합니다.
- 입력을 기다리는 애니메이션입니다. motion 시작 시각을 대본의 해당 줄에 맞춰, 시작 전에는 기다리는 화면을 그립니다.
- 무한 길이 애니메이션입니다. `durationSeconds: null` 로 둡니다.

## `motions.json`

- 절대 시각을 쓰지 않습니다. `slideStart`, `lineStart`, `lineEnd`, `motionEnd` 로 순서만 적습니다.
- `stageDirection` 이 있는 줄을 시작점으로 씁니다. 없으면 슬라이드 시작에 둡니다.
- `durationSeconds` 는 덱 코드의 값에서 계산합니다. 내부 배속을 나눠 실제 초로 적습니다.
- 다음 슬라이드로 넘어가는 시각은 적지 않습니다. `build_timeline.py` 가 음성과 애니메이션 끝에서 계산합니다.

## 끝내기

- `${CLAUDE_PLUGIN_ROOT}/scripts/run.sh validate.py motions --workspace <작업 폴더>` 를 통과시킵니다.
- `inspect_seek.py` 전체 검사는 돌리지 않습니다. 이 단계에는 음성이 아직 없고, 전체 검사는 조립 뒤에 따로 돕니다.
- `inspect-report.json` 이 있으면 실패 표본과 `inspect/` 의 이미지를 보고 원인이 된 상태를 어댑터에서 고칩니다. 플레이어나 임계값을 고쳐 통과시키지 않습니다.
