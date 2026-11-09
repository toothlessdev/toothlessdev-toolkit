# toothlessdev-toolkit

## 패키지

| 패키지                                          | 역할                                                 |
| ----------------------------------------------- | ---------------------------------------------------- |
| [claude-cli](packages/claude-cli)               | `claude` CLI 명령 조립, 실행, 세션 목록 조회         |
| [n8n-claude-cli](packages/n8n-claude-cli)       | 워크플로에서 `claude` 를 실행하는 노드               |
| [n8n-claude-router](packages/n8n-claude-router) | 메시지를 이어 갈 세션을 찾아 전달하는 노드           |
| [n8n-slack-socket](packages/n8n-slack-socket)   | Slack Socket Mode 이벤트로 워크플로를 시작하는 노드  |
| [n8n-supertonic](packages/n8n-supertonic)       | 로컬 `supertonic` CLI 로 텍스트를 WAV 로 만드는 노드 |
| [n8n-workflows](packages/n8n-workflows)         | 내보낸 워크플로 JSON 의 로컬 보관 폴더 (커밋 안 함)  |

## 시작하기

### 필요한 도구

| 도구                                            | 사용처                                    |
| ----------------------------------------------- | ----------------------------------------- |
| Node 24 이상 ([.nvmrc](.nvmrc))                 | 전체                                      |
| pnpm 10 (`corepack enable`)                     | 전체                                      |
| macOS                                           | `register:n8n-plist` 만. 나머지는 OS 무관 |
| [Claude Code](https://code.claude.com/docs) CLI | `n8n-claude-cli`, `n8n-claude-router`     |
| [uv](https://docs.astral.sh/uv/)                | `n8n-supertonic`                          |

### 설치와 확인

```bash
git clone https://github.com/toothlessdev/toothlessdev-toolkit.git
```

```bash
cd toothlessdev-toolkit
```

```bash
pnpm install
```

```bash
pnpm test
```

```bash
pnpm typecheck
```

### n8n 에서 노드 쓰기

1. n8n 을 전역으로 설치합니다. 지금 쓰는 Node 로 설치해야 등록 스크립트가 찾습니다.

    ```bash
    npm install -g n8n@2.42.2
    ```

2. n8n 을 서비스로 등록합니다.

    ```bash
    pnpm register:n8n-plist
    ```

3. 노드를 배포합니다.

    ```bash
    pnpm deploy:n8n-nodes
    ```

4. <http://localhost:5678> 에서 계정을 만들고, 노드 검색에서 패키지의 노드를 찾습니다.

각 노드에 필요한 준비는 패키지 README 의 준비 절을 봅니다. 로그는 `~/.n8n/logs` 에 쌓입니다.

## 플러그인

[.claude-plugin/plugins](.claude-plugin/plugins) 의 스킬은 Claude Code 플러그인으로 설치합니다. 저장소를 복제할 필요는 없습니다.

```bash
claude plugin marketplace add toothlessdev/toothlessdev-toolkit
```

```bash
claude plugin install bfs@toothlessdev-toolkit
```

| 플러그인                                | 하는 일                                                | 실행                                      |
| --------------------------------------- | ------------------------------------------------------ | ----------------------------------------- |
| [adhd](.claude-plugin/plugins/adhd)     | 작업 마비 부수기, 체크인 같은 실행 지원 도구           | `/adhd:paralysis`, `/adhd:checkin` 등     |
| [beaker](.claude-plugin/plugins/beaker) | 명세와 구현에서 테스트를 따로 만들어 불일치를 찾습니다 | `/beaker:beaker`                          |
| [bfs](.claude-plugin/plugins/bfs)       | 확정한 목록을 나눠 병렬로 처리합니다                   | `/bfs:run`, `/bfs:plan`, `/bfs:recursive` |

## Scripts

### n8n Scripts

```bash
pnpm register:n8n-plist
```

n8n 을 launchd 서비스로 등록합니다. macOS 전용이고 `127.0.0.1` 에서만 받습니다. `--dry-run` 을 붙이면 등록하지 않고 plist 만 출력합니다.

서비스의 PATH 에는 Node 와 `claude` 가 있는 폴더, 시스템 경로만 들어갑니다. 다른 곳에 설치한 실행 파일은 노드의 Executable 옵션에 절대 경로로 넣습니다.

```bash
pnpm deploy:n8n-nodes
```

노드를 빌드해 `~/.n8n/custom` 에 복사하고 n8n 을 재시작합니다. 재시작을 빼려면 `--no-restart` 를 붙입니다.

| 환경 변수             | 기본값         | 설명                                      |
| --------------------- | -------------- | ----------------------------------------- |
| `N8N_USER_FOLDER`     | 홈 폴더        | 이 폴더 아래의 `.n8n` 을 씁니다           |
| `N8N_LAUNCHD_SERVICE` | `io.n8n.local` | launchd 서비스 이름                       |
| `N8N_PORT`            | `5678`         | 등록할 때 값이 있으면 서비스에 전달합니다 |

## 라이선스

[MIT](LICENSE)
