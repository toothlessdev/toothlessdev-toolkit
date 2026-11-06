# n8n-claude-router

들어온 메시지를 이어 갈 Claude 세션을 찾아 전달하는 n8n 노드입니다. 같은 작업의 메시지가 새 세션으로 흩어지지 않게 합니다.

## 준비

1. `claude` CLI 를 설치하고 한 번 실행해 로그인합니다.
2. [루트 README](../../README.md) 대로 노드를 배포합니다.

Deliver 는 프로세스가 살아 있는 세션에만 보낼 수 있습니다. 새 세션은 [n8n-claude-cli](../n8n-claude-cli) 의 Background 모드로 띄우고 Remember 로 연결합니다.

## 오퍼레이션

| 오퍼레이션         | 동작                                             | 쓰는 시점                    |
| ------------------ | ------------------------------------------------ | ---------------------------- |
| Route              | 메시지를 넣을 세션을 고릅니다                    | 메시지를 받은 직후           |
| Deliver            | 고른 세션에 메시지를 넣습니다                    | Route 가 세션을 찾았을 때    |
| Wake               | 멈춘 세션을 같은 ID 로 깨우고 메시지를 넣습니다  | Route 가 `resume` 일 때      |
| Remember           | 대화와 새로 띄운 세션을 연결합니다               | 새 세션을 띄운 직후          |
| Track Notification | 세션 상태에 맞춰 고칠 Slack 알림을 기록합니다    | 알림을 보낸 직후             |
| Sync Notifications | 상태가 바뀐 알림을 돌려주고 끝난 세션을 멈춥니다 | 스케줄 트리거에서 주기적으로 |

결과는 입력 항목의 `routing` 필드에 담깁니다.

## 세션을 고르는 순서

1. **대화 연결:** Conversation Key 에 연결된 세션이 메시지를 받을 수 있으면 LLM 없이 그 세션으로 보냅니다. Include Ended Sessions 를 켜면 같은 폴더의 끝난 백그라운드 세션도 LLM 없이 `resume` 으로 판정합니다.
2. **LLM 매칭:** 살아 있고 작업 폴더가 같은 최근 세션을 후보로 비교합니다. Include Ended Sessions 를 켜면 끝난 백그라운드 세션도 비교합니다.
3. **새 세션:** 확신이 `high` 가 아니거나 후보가 없으면 새 세션으로 판정합니다.

`routing.action` 값에 따라 다음 노드를 나눕니다.

| 값        | 뜻                      | 다음 노드                                        |
| --------- | ----------------------- | ------------------------------------------------ |
| `deliver` | 살아 있는 세션을 골랐음 | Deliver                                          |
| `resume`  | 끝난 세션을 골랐음      | Wake                                             |
| `new`     | 이어 갈 세션이 없음     | n8n-claude-cli Background 모드, 그 뒤에 Remember |

## 세션 상태를 알림에 표시하기

Slack 알림의 맨 앞 이모지를 세션 상태에 맞춰 고치고, 끝난 세션의 프로세스를 멈춥니다. 프로세스가 살아 있는 동안은 Claude Desktop 에서 세션을 열 수 없어서 멈춥니다.

1. 알림 본문을 `:hourglass_flowing_sand:` 로 시작해서 보내고 바로 뒤에 Track Notification 을 둡니다.
2. 스케줄 트리거 뒤에 Sync Notifications 를 둡니다. Slack 노드의 메시지 수정으로 `routing.channel`, `routing.ts`, `routing.text` 를 보내고, Include Link to Workflow 를 끕니다.
3. 수정이 성공하면 Track Notification 에 `routing` 값을 넣어 표시한 상태를 저장합니다. 수정이 실패하면 다음 동기화가 다시 시도합니다.

| 세션 상태               | 이모지                     | 프로세스                  |
| ----------------------- | -------------------------- | ------------------------- |
| 작업 중                 | `:hourglass_flowing_sand:` | 둡니다                    |
| 답을 기다림 (`blocked`) | `:raised_hand:`            | 둡니다                    |
| 끝남 (`done`)           | `:white_check_mark:`       | Stop Grace 가 지나면 멈춤 |

- Track Notification 으로 기록한 세션만 멈춥니다. 직접 띄운 세션은 건드리지 않습니다.
- `done` 은 모델이 차례를 마치고 입력을 기다린다는 뜻입니다. 터미널에서 붙어 보는 중인 세션도 Stop Grace 가 지나면 멈춥니다.
- 멈춘 세션은 Deliver 로 보낼 수 없으므로, 후속 메시지를 받는 워크플로에는 Include Ended Sessions 를 켜고 `resume` 경로에 Wake 를 둡니다.

## 주요 설정

| 설정                     | 기본값  | 설명                                                     |
| ------------------------ | ------- | -------------------------------------------------------- |
| Model                    | `haiku` | 매칭과 전달에 쓰는 모델                                  |
| Routing Instructions     |         | 고정 규칙 뒤에 붙는 매칭 기준                            |
| Max Candidates           | `20`    | 후보 세션 수                                             |
| Candidate Max Age (Days) | `7`     | 이보다 오래된 세션은 후보에서 뺍니다                     |
| Include Ended Sessions   | 끔      | 끝난 백그라운드 세션도 후보로 비교합니다                 |
| Stop Grace (Seconds)     | `10`    | `done` 이 된 뒤 프로세스를 멈출 때까지 기다리는 시간     |
| Notification Store Path  |         | 비우면 `~/.n8n/claude-router/session-notifications.json` |
| Max Budget (USD)         | `0.2`   |                                                          |
| Timeout (Seconds)        | `60`    |                                                          |
| Store Path               |         | 비우면 `~/.n8n/claude-router/conversation-sessions.json` |

## 보안

- 세션 이름, 시작 프롬프트, 메시지는 `<external_message>` 로 감싼 데이터로 다룹니다.
- LLM 이 고른 세션 ID 는 후보 목록과 대조합니다. 후보에 없으면 새 세션으로 처리합니다.
- 전달 대상은 코드에서 정합니다.

## 한계

- 전달에 쓰는 세션 주소는 공개되지 않은 `claude` 내부 형식입니다. 형식이 바뀌면 전달은 실패로 드러납니다.
- Wake 는 세션을 처음 띄울 때 저장된 권한과 도구를 그대로 씁니다. 메시지를 넣는 워크플로의 설정은 적용되지 않습니다.
- Claude CLI 노드의 Resume Session ID 로 이으면 옵션을 함께 넘기므로 대화를 복사한 새 세션이 생깁니다.
