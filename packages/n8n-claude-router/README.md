# n8n-claude-router

들어온 메시지를 이어 갈 Claude 세션을 찾아 전달하는 n8n 노드입니다. 같은 작업의 메시지가 새 세션으로 흩어지지 않게 합니다.

## 준비

1. `claude` CLI 를 설치하고 한 번 실행해 로그인합니다.
2. [루트 README](../../README.md) 대로 노드를 배포합니다.

새 세션은 [n8n-claude-cli](../n8n-claude-cli) 로 띄우고 Remember 로 연결합니다. 실행 모드에 따라 이어 가는 방법이 다릅니다.

| Claude CLI 실행 모드 | 세션이 끝난 뒤 프로세스 | 다음 메시지를 넣는 방법             |
| -------------------- | ----------------------- | ----------------------------------- |
| Background (`--bg`)  | 남습니다                | 살아 있으면 Deliver, 멈췄으면 Wake  |
| Print (`-p`)         | 남지 않습니다           | Claude CLI 노드의 Resume Session ID |

## 오퍼레이션

| 오퍼레이션          | 동작                                             | 쓰는 시점                    |
| ------------------- | ------------------------------------------------ | ---------------------------- |
| Route               | 메시지를 넣을 세션을 고릅니다                    | 메시지를 받은 직후           |
| Deliver             | 고른 세션에 메시지를 넣습니다                    | Route 가 세션을 찾았을 때    |
| Wake                | 멈춘 세션을 같은 ID 로 깨우고 메시지를 넣습니다  | Route 가 `resume` 일 때      |
| Remember            | 대화와 새로 띄운 세션을 연결합니다               | 새 세션을 띄운 직후          |
| Render Notification | 세션 알림 메시지 본문을 만듭니다                 | 알림을 보내기 직전           |
| Track Notification  | 세션 상태에 맞춰 고칠 Slack 알림을 기록합니다    | 알림을 보낸 직후             |
| Sync Notifications  | 상태가 바뀐 알림을 돌려주고 끝난 세션을 멈춥니다 | 스케줄 트리거에서 주기적으로 |

결과는 입력 항목의 `routing` 필드에 담깁니다.

## 세션을 고르는 순서

1. **대화 연결:** Conversation Key 에 연결된 세션이 메시지를 받을 수 있으면 LLM 없이 그 세션으로 보냅니다. Include Ended Sessions 를 켜면 같은 폴더의 끝난 백그라운드 세션도 LLM 없이 `resume` 으로 판정합니다.
2. **LLM 매칭:** 살아 있고 작업 폴더가 같은 최근 세션을 후보로 비교합니다. Include Ended Sessions 를 켜면 끝난 백그라운드 세션도 비교합니다.
3. **새 세션:** 확신이 `high` 가 아니거나 후보가 없으면 새 세션으로 판정합니다.

`routing.action` 값에 따라 다음 노드를 나눕니다.

| 값        | 뜻                      | 다음 노드                                                               |
| --------- | ----------------------- | ----------------------------------------------------------------------- |
| `deliver` | 살아 있는 세션을 골랐음 | Deliver                                                                 |
| `resume`  | 끝난 세션을 골랐음      | Wake. Print 세션은 Claude CLI 노드의 Resume Session ID 로도 이어 갑니다 |
| `new`     | 이어 갈 세션이 없음     | n8n-claude-cli 로 새 세션, Remember 로 연결                             |

## Print 모드 세션 이어 가기

Print 모드로 실행한 세션은 `claude agents` 목록에 나오지 않습니다. Remember 의 Register Print Session 을 켜서 기록해 둬야 Route 가 이어 갈 후보로 찾습니다.

1. Crypto 노드(Generate, UUID)로 세션 ID 를 만듭니다.
2. Remember 에 그 ID 를 넣고 Register Print Session 을 켭니다. Session Name 과 Session Intent 에는 세션을 시작한 메시지를 넣고, Session Working Directory 에는 Claude CLI 노드와 같은 절대 경로를 넣습니다.
3. Claude CLI 노드를 Print 모드로 두고 Session ID 에 같은 ID 를 넣어 실행합니다.
4. Route 의 Include Ended Sessions 를 켭니다. 기록해 둔 세션을 고르면 `routing.action` 이 `resume` 입니다.
5. `resume` 경로에는 Claude CLI 노드를 두고 Resume Session ID 에 `routing.sessionId` 를 넣습니다.

- **실행 전에 Remember 를 두는 이유:** 세션이 실행 중일 때 온 다음 메시지도 같은 세션을 고르게 하려는 것입니다. Claude CLI 노드는 같은 세션의 실행이 겹치면 앞 실행이 끝난 뒤에 시작합니다.
- **사람이 열어 둔 세션:** Claude Desktop 이나 터미널에서 열어 둔 세션은 후보에서 뺍니다. 그 세션을 이어 가면 claude 가 복사본을 만듭니다.
- **Wake:** 기록해 둔 Print 세션도 Wake 로 깨울 수 있습니다. 깨우면 같은 ID 의 백그라운드 세션이 되어 프로세스가 남고, Claude Desktop 에서 실행 중에 열어 볼 수 있습니다.

## 세션 상태를 알림에 표시하기

Slack 알림의 상태 원과 Status 줄을 세션 상태에 맞춰 고치고, 끝난 세션의 프로세스를 멈춥니다. 프로세스가 살아 있는 동안은 Claude Desktop 에서 세션을 열 수 없어서 멈춥니다.

1. 알림을 보내기 직전에 Render Notification 을 둡니다. 결과는 `routing.text`(저장할 본문), `routing.blocks`(Slack 블록), `routing.fallbackText`(알림 미리보기용 제목)입니다.
2. Slack 노드의 Message Type 을 Blocks 로 두고 Blocks 에 `routing.blocks`, Notification Text 에 `routing.fallbackText` 를 넣습니다. Unfurl Links 와 Unfurl Media 는 끕니다. 켜 두면 원본 메시지 미리보기가 알림 아래에 펼쳐집니다.
3. 알림을 보낸 바로 뒤에 Track Notification 을 두고, Text 에 Render Notification 의 `routing.text` 를 넣습니다. Slack 이 돌려주는 `message.text` 는 미리보기용 제목이라 상태를 고칠 수 없습니다.
4. 스케줄 트리거 뒤에 Sync Notifications 를 둡니다. Slack 노드의 메시지 수정을 Blocks 로 두고 `routing.channel`, `routing.ts`, `routing.blocks`, `routing.fallbackText` 를 보내고, Include Link to Workflow 를 끕니다.
5. 수정이 성공하면 Track Notification 에 `routing` 값을 넣어 표시한 상태를 저장합니다. Remote Control Session ID 에는 `routing.remoteControlSessionId` 를 넣습니다. 수정이 실패하면 다음 동기화가 다시 시도합니다.
6. 상태가 바뀐 것을 알림으로 받으려면 저장 뒤에 `routing.threadReplyText` 가 비어 있지 않은 항목만 원래 메시지 스레드에 답글로 보냅니다. Slack 은 메시지 수정에는 알림을 보내지 않습니다. 답글은 HTTP Request 노드로 `chat.postMessage` 를 부르고 `channel`, `thread_ts` 에 `routing.channel`, `routing.ts` 를 문자열 그대로 넣습니다. Slack 노드의 답글 대상 칸은 숫자 타입이라 ts 끝자리 0 이 잘릴 수 있습니다.

- **상태 답글:** 확인 필요, 완료, 실패로 바뀔 때만 `routing.threadReplyText` 를 만듭니다. 확인 필요는 세션이 묻는 내용, 완료와 실패는 진행 상황 한 줄을 인용으로 붙입니다. 완료 세션의 프로세스가 멈출 때와 Desktop 에서 넘겨받은 세션은 답글을 만들지 않습니다.
- **멘션:** Sync Notifications 의 Mention User ID 에 넣은 사용자를 답글 맨 앞에서 멘션합니다. 알림을 봇 토큰으로 보내면 멘션 워크플로가 이 답글로 세션을 만들지 않습니다. Slack Socket Trigger 는 `bot_id` 가 있는 메시지를 멘션으로 받지 않습니다.

Render Notification 이 만드는 블록은 본문 하나와 버튼 하나입니다.

```text
:large_yellow_circle: *원본 메시지 첫 줄*

> :vertical_traffic_light: *Status:* 진행 중 (Claude 조사 중)
> :link: *Triggered via:* <실행 화면 주소|워크플로 이름> (<원본 링크|원본 메시지>)
> :compass: *Routing:* 새 세션 (`세션 ID`)

[Claude Desktop 에서 열기]   ← 버튼
```

- **제목:** Source Text 의 첫 줄을 80자까지 씁니다. 멘션(`<@…>`, `<!subteam^…>`, `<!here>`)은 지웁니다. 그대로 두면 알림 채널에서 그 사람이나 그룹이 다시 호출됩니다.
- **Triggered via:** Workflow Name 기본값은 `{{ $workflow.name }}` 입니다. Execution URL 에 n8n 실행 화면 주소(예: `http://localhost:5678/workflow/{{ $workflow.id }}/executions/{{ $execution.id }}`)를 넣으면 이름에 링크를 겁니다.
- **Routing:** 새 세션, 진행 중인 세션에 전달, 끝난 세션을 다시 깨움 중 하나입니다. None 이면 줄을 쓰지 않습니다.
- **버튼:** Session ID 가 있을 때만 붙습니다. 알림을 보낸 Slack 앱의 Interactivity 가 켜져 있는데 아무도 응답하지 않으면 누른 뒤 경고 아이콘이 뜹니다. 세션은 그대로 열립니다.
- **실행 중인 세션의 버튼:** 백그라운드 프로세스가 살아 있는 세션을 `claude://resume` 으로 열면 Claude Desktop 이 다른 곳에서 실행 중이라며 거부합니다. 그래서 Sync Notifications 가 프로세스가 살아 있고 Remote Control 로 연결된 세션의 버튼을 `Claude Desktop 에서 열기 (실행 중)`(`claude://code/session_…`)으로 바꾸고, 프로세스가 멈추면 `Claude Desktop 에서 열기`(`claude://resume`)로 되돌립니다. claude.ai/code 주소는 Slack 에서 누르면 브라우저로 열려서 쓰지 않습니다. 상태가 그대로여도 버튼이 바뀌면 고칩니다.
- **살아 있는 세션의 첫 알림:** Remote Control 세션 ID 는 세션이 뜬 뒤에 정해지므로 Render Notification 에서는 Show Desktop Button 을 끄고 보냅니다. 다음 동기화가 버튼을 붙입니다.

| 상태 값       | 원                      | Status 줄                           | 프로세스                  |
| ------------- | ----------------------- | ----------------------------------- | ------------------------- |
| `working`     | `:large_yellow_circle:` | 진행 중 (Claude 조사 중)            | 둡니다                    |
| `blocked`     | `:large_orange_circle:` | 확인 필요 (답이나 권한 승인 기다림) | 둡니다                    |
| `doneRunning` | `:large_green_circle:`  | 완료 (응답 끝남, 곧 세션 정리)      | Stop Grace 가 지나면 멈춤 |
| `doneStopped` | `:large_green_circle:`  | 완료 (응답 끝남, 세션 정리됨)       | 멈춰 있음                 |
| `takenOver`   | `:large_green_circle:`  | 완료 (Desktop 에서 넘겨받음)        | 둡니다                    |
| `failed`      | `:red_circle:`          | 실패 (Claude 실행 실패)             | 둡니다                    |
| `rejected`    | `:white_circle:`        | 보내지 않음 (인젝션 의심)           | 세션 없음                 |

- `rejected` 는 Render Notification 에서만 씁니다. 세션이 없어서 Track Notification 으로 기록하지 않습니다.

### Print 모드 세션의 알림

Print 모드는 Claude CLI 노드가 끝날 때 결과를 알 수 있어서 Track Notification 과 Sync Notifications 를 쓰지 않고 워크플로에서 직접 고칩니다.

1. 실행 전에 Render Notification(Status: Working, Show Desktop Button 끔)으로 알림을 보냅니다. 실행 중인 세션을 Claude Desktop 에서 열면 claude 가 복사본을 만들어서 버튼을 숨깁니다.
2. Claude CLI 노드의 On Error 를 Continue (using error output) 로 둡니다.
3. 성공 출력 뒤에 Render Notification(Status: Done), 오류 출력 뒤에 Render Notification(Status: Failed)을 둡니다.
4. Slack 노드의 메시지 수정으로 1번에서 보낸 알림의 `channel` 과 `message_timestamp` 에 `routing.blocks` 를 보냅니다.

- 이전 형식(맨 앞 `:hourglass_flowing_sand:`, `:raised_hand:`, `:white_check_mark:`)으로 보낸 알림은 맨 앞 이모지만 새 원으로 바꾸고 버튼은 붙이지 않습니다.

- Track Notification 으로 기록한 세션만 멈춥니다. 직접 띄운 세션은 건드리지 않습니다.
- `done` 은 모델이 차례를 마치고 입력을 기다린다는 뜻입니다. 터미널에서 붙어 보는 중인 세션도 Stop Grace 가 지나면 멈춥니다.
- 멈춘 세션은 Deliver 로 보낼 수 없으므로, 후속 메시지를 받는 워크플로에는 Include Ended Sessions 를 켜고 `resume` 경로에 Wake 를 둡니다.

## 주요 설정

| 설정                     | 기본값  | 설명                                                                                       |
| ------------------------ | ------- | ------------------------------------------------------------------------------------------ |
| Model                    | `haiku` | 매칭과 전달에 쓰는 모델                                                                    |
| Routing Instructions     |         | 고정 규칙 뒤에 붙는 매칭 기준                                                              |
| Max Candidates           | `20`    | 후보 세션 수                                                                               |
| Candidate Max Age (Days) | `7`     | 이보다 오래된 세션은 후보에서 뺍니다                                                       |
| Include Ended Sessions   | 끔      | 끝난 백그라운드 세션도 후보로 비교합니다                                                   |
| Stop Grace (Seconds)     | `10`    | `done` 이 된 뒤 프로세스를 멈출 때까지 기다리는 시간                                       |
| Notification Store Path  |         | 비우면 `~/.n8n/claude-router/session-notifications.json`                                   |
| Print Session Store Path |         | 비우면 `~/.n8n/claude-router/print-sessions.json`. Route 와 Remember 에 같은 값을 넣습니다 |
| Max Budget (USD)         | `0.2`   |                                                                                            |
| Timeout (Seconds)        | `60`    |                                                                                            |
| Store Path               |         | 비우면 `~/.n8n/claude-router/conversation-sessions.json`                                   |

## 보안

- 세션 이름, 시작 프롬프트, 메시지는 `<external_message>` 로 감싼 데이터로 다룹니다.
- LLM 이 고른 세션 ID 는 후보 목록과 대조합니다. 후보에 없으면 새 세션으로 처리합니다.
- 전달 대상은 코드에서 정합니다.

## 한계

- 전달에 쓰는 세션 주소는 공개되지 않은 `claude` 내부 형식입니다. 형식이 바뀌면 전달은 실패로 드러납니다.
- Wake 는 세션을 처음 띄울 때 저장된 권한과 도구를 그대로 씁니다. 메시지를 넣는 워크플로의 설정은 적용되지 않습니다.
- 다른 프로세스가 잡고 있는 세션(사람이 열어 둔 세션, 살아 있는 백그라운드 세션)을 Claude CLI 노드의 Resume Session ID 로 이으면 claude 가 대화를 복사한 새 세션을 만듭니다. 이때 노드가 돌려주는 `sessionId` 는 새 세션의 ID 입니다.
- Print 세션의 기록은 n8n 을 실행하는 장비의 파일에만 있습니다. 기록 파일을 지우면 Route 가 그 세션을 찾지 못하고 새 세션으로 판정합니다.
