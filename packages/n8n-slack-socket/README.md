# n8n-slack-socket

Slack Socket Mode 이벤트로 워크플로를 시작하는 n8n 트리거 노드입니다. n8n 쪽에서 먼저 연결을 열기 때문에 로컬 n8n 에서도 터널 없이 이벤트를 받습니다.

## 준비

1. [Slack 앱](https://api.slack.com/apps)을 만들고 Socket Mode 를 켭니다.
2. `connections:write` 스코프로 앱 수준 토큰(`xapp-`)을 만듭니다.
3. Event Subscriptions 를 켜고, 받을 대화 종류의 메시지 이벤트(`message.channels`, `message.groups`, `message.im`, `message.mpim`)를 구독합니다.
4. 앱을 워크스페이스에 설치합니다. 봇 이벤트를 쓰면 받을 채널에 봇을 초대합니다.
5. [루트 README](../../README.md) 대로 노드를 배포합니다.
6. n8n 자격 증명 `Slack Socket Mode API` 에 토큰을 넣고 트리거 노드에서 고릅니다.

노드 설정의 ID 는 Slack 에서 사용자, 그룹, 채널의 상세 정보를 열어 복사합니다.

## 소스

| 소스             | 받는 것                                   | 필수 설정                                       |
| ---------------- | ----------------------------------------- | ----------------------------------------------- |
| Mentions         | 지정한 사용자나 그룹을 멘션한 사람 메시지 | Mentioned User ID 또는 Mentioned User Group IDs |
| Channel Messages | 지정한 채널의 사람 메시지 전체            | Channel IDs                                     |
| Bot Messages     | 지정한 채널에서 허용한 봇의 메시지        | Allowed Bot IDs, Channel IDs                    |
| Event Silence    | 메시지가 아니라 이벤트가 끊긴 상태        | 없음                                            |

- **우선순위:** 한 메시지가 여러 소스에 맞으면 Bot Messages, Mentions, Channel Messages 순으로 한 소스에만 갑니다.
- **봇 메시지:** `attachments` 내용을 `text` 에 합쳐 전달합니다.
- **답글 루프:** 워크플로가 답글에 쓰는 봇이나 채널을 소스에 넣으면 답글이 워크플로를 다시 실행합니다.

## Event Silence

소켓이 연결돼 있는데 이벤트가 15분째 0건이면 한 번, 이후 1시간마다 워크플로를 실행합니다. 출력은 `silentMinutes`, `appId` 입니다.

전달 실패가 쌓이면 Slack 이 앱의 Enable Events 를 끕니다. 소켓은 연결된 채로 이벤트만 끊기고 재연결로도 복구되지 않아서, 앱 설정에서 직접 켜야 합니다. 이벤트가 적은 시간대에는 거짓 알림이 날 수 있으니 워크플로에서 시간대를 거릅니다.

## 동작

- **소켓 공유:** Slack 은 같은 앱의 연결들에 이벤트를 나눠 보내므로 앱 토큰당 소켓을 하나만 엽니다.
- **재연결:** 5분 안에 재연결하지 못하면 n8n 이 워크플로를 다시 활성화합니다.
- **중복:** 재연결 전후로 다시 온 이벤트는 `event_id` 로 거릅니다.
- **로그:** 메시지 본문은 남기지 않습니다.

연결이 끊긴 동안 온 메시지를 다시 가져오는 기능은 없습니다.
