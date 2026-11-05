# n8n-supertonic

로컬 `supertonic` CLI 로 텍스트를 WAV 파일로 만드는 n8n 노드입니다. 음성 합성은 n8n 프로세스 밖의 Python CLI 가 맡습니다.

## 준비

```bash
uv tool install 'supertonic==1.3.1' --python 3.12
```

```bash
supertonic download
```

[루트 README](../../README.md) 대로 노드를 배포합니다.

n8n 서비스의 PATH 에 `supertonic` 이 없으면 Executable 옵션에 절대 경로를 넣습니다. 경로는 `which supertonic` 으로 확인합니다.

모델은 설치할 때 받지 않고 `supertonic download` 나 첫 합성 때 받습니다. 첫 합성 때 받으면 다운로드 시간도 노드의 Timeout 에 포함됩니다.

## 설정

| 설정                 | 기본값       | 설명                              |
| -------------------- | ------------ | --------------------------------- |
| Text                 |              | 음성으로 만들 텍스트              |
| Language             | `ko`         | 언어 코드. 모르면 `na`            |
| Voice                | `M1`         | `F1`~`F5`, `M1`~`M5`              |
| Speed                | `1.05`       | 0.7~2. 클수록 빠르게 읽습니다     |
| Quality Steps        | `8`          | 클수록 품질이 좋아지고 느려집니다 |
| Timeout (Seconds)    | `120`        |                                   |
| Binary Property Name | `data`       | WAV 를 담을 바이너리 필드         |
| File Name            | `speech.wav` |                                   |

출력 JSON 은 `language`, `voice`, `byteLength` 입니다.

## 한계

- 호출마다 모델을 다시 읽습니다.
- CLI 에 실행 장치 옵션이 없어 CPU 로 실행합니다.
- 지금 쓰는 `supertonic` 공식 저장소는 보관(archived) 상태라 버전을 고정합니다.
