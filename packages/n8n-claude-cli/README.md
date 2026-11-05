# n8n-claude-cli

워크플로에서 로컬 `claude` CLI 를 실행하는 n8n 노드입니다. 실행 코드는 [claude-cli](../claude-cli) 를 씁니다.

## 준비

1. `claude` CLI 를 설치하고 한 번 실행해 로그인합니다.
2. Background 모드를 쓸 폴더는 그 폴더에서 `claude` 를 한 번 실행해 신뢰합니다.
3. [루트 README](../../README.md) 대로 노드를 배포합니다.

## 실행 모드

| 모드                | 동작                                                        | 출력                                                     |
| ------------------- | ----------------------------------------------------------- | -------------------------------------------------------- |
| Print (`-p`)        | 끝날 때까지 기다립니다                                      | `result`, `sessionId`, `deniedTools`, `structuredOutput` |
| Background (`--bg`) | 세션을 띄우고 바로 돌아옵니다. 신뢰된 폴더에서만 실행됩니다 | `backgroundId`, `sessionId`                              |

## 주요 설정

| 설정                | 기본값           | 설명                                                             |
| ------------------- | ---------------- | ---------------------------------------------------------------- |
| Tools               | `Read,Grep,Glob` | 쉼표로 구분합니다. `*` 는 전체 내장 도구입니다                   |
| Permission Mode     | `dontAsk`        | 쓰기 도구는 거부되고 `deniedTools` 로 보고됩니다                 |
| Max Budget (USD)    | `1`              | Print 전용입니다. 0 이면 상한이 없습니다                         |
| Timeout (Seconds)   | `300`            |                                                                  |
| JSON Schema         |                  | Print 전용입니다. 결과가 `structuredOutput` 에 담깁니다          |
| Remote Control      | 꺼짐             | Background 전용입니다. 켜야 Claude Desktop 사이드바에 표시됩니다 |
| Inherit User Config | 꺼짐             | 내 MCP 서버, 스킬, 훅, 설정을 씁니다                             |

Executable 에는 n8n 프로세스의 PATH 에 `claude` 가 없을 때 절대 경로를 넣습니다.
