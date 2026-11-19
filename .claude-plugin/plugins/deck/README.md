# deck

발표 장표를 HTML 슬라이드로 만듭니다. 장마다 그림을 새로 그리는 대신, 전체 그림 하나를 세워 두고 그 안의 도형이 모핑하며 디테일로 들어가는 덱을 목표로 합니다.

## 준비

- Node.js: `capture.mjs` 로 장표를 실제 시간으로 재생하며 찍습니다.
- Google Chrome: `capture.mjs` 가 headless 로 띄웁니다. 다른 위치에 있으면 `CHROME_PATH` 를 지정합니다.
- [uv](https://docs.astral.sh/uv/): `key_change.py` 를 실행합니다. Playwright 와 Pillow 는 uv 가 스크립트 머리말을 보고 설치합니다.
- Python 3: `font_face_css.py` 로 폰트를 base64 `@font-face` 로 만듭니다.

## 실행

```bash
claude plugin install deck@toothlessdev-toolkit
```

Claude Code 에서 장표를 만들어 달라고 하면 `deck` 스킬이 순서를 잡습니다. 직접 부를 수도 있습니다.

```text
/deck:deck 주문 쓰기 경로를 설명하는 15분 덱
```

기본은 16:9(1600x900) 발표 화면입니다. 쇼츠나 휴대폰용 세로 영상이면 요청에 그렇게 적거나 비율을 직접 적습니다.

```text
/deck:deck 동등성 연산자를 설명하는 1분 세로 쇼츠 --aspect 9:16
```

덱이 `window.DECK_STAGE_SIZE = { width, height }` 로 무대 크기를 알리면 `capture.mjs` 와 `key_change.py` 가 그 크기로 화면을 맞춥니다. 알리지 않으면 1600x900 으로 봅니다.

## 스킬

| 스킬     | 하는 일                                                                                    |
| -------- | ------------------------------------------------------------------------------------------ |
| `deck`   | 시안, 이야기 흐름, 청중과 시간, 화면 비율을 받고 아래 넷을 부를 순서를 정합니다            |
| `story`  | 코드 전에 전체 그림과 모핑 스토리보드를 표로 씁니다                                        |
| `look`   | 기준 시안에서 시각 규칙을 뽑고 폰트를 정합니다. SUIT, Pretendard 폰트 파일이 들어 있습니다 |
| `motion` | 스토리보드를 구현하고 실시간 재생으로 확인합니다. 키마다 화면이 얼마나 바뀌는지 잽니다     |
| `check`  | 처음 듣는 사람 기준과 근거 기준으로 내용을 검사합니다. 장표를 직접 고치지 않습니다         |

음성과 자막을 입히는 일과 mp4 영상으로 뽑는 일은 [talkie](../talkie) 가 맡습니다.
