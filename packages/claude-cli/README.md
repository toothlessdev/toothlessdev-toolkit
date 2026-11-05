# claude-cli

`claude` CLI 를 실행하는 TypeScript 라이브러리입니다. npm 에 배포하지 않고 이 저장소의 패키지에서 `workspace:*` 로 씁니다.

## 준비

`claude` CLI 를 설치하고 한 번 실행해 로그인합니다.

## 사용

```ts
import { buildClaudeCommand, ClaudeCli } from "claude-cli";

const command = buildClaudeCommand({
    executionMode: "print",
    prompt: "이 폴더의 테스트 구조를 요약해 주세요",
    tools: ["Read", "Grep", "Glob"],
    permissionMode: "dontAsk",
    maxBudgetUsd: 1,
});

const { result, sessionId } = await new ClaudeCli("claude", 300_000).run(
    command,
    "/path/to/project",
);
```

## API

| 이름                               | 설명                                                       |
| ---------------------------------- | ---------------------------------------------------------- |
| `buildClaudeCommand(request)`      | 요청을 CLI 인자와 stdin 으로 바꿉니다                      |
| `ClaudeCli.run`                    | `-p` 로 실행하고 결과를 돌려줍니다                         |
| `ClaudeCli.runCollectingToolCalls` | 실제 호출된 도구와 결과를 돌려줍니다. `stream-json` 필요   |
| `ClaudeCli.startBackground`        | `--bg` 로 세션을 띄우고 바로 돌아옵니다                    |
| `listClaudeSessions(options)`      | 세션 목록을 읽습니다. 살아 있는 세션에만 `pid` 가 있습니다 |

## 동작

- **격리:** 기본으로 MCP 서버와 사용자 설정을 읽지 않습니다. `shouldInheritUserConfig` 를 켜면 읽습니다.
- **프롬프트:** 인자가 아니라 stdin 으로 넘겨서 옵션으로 해석되지 않습니다.
- **비용 상한:** `maxBudgetUsd` 가 0 이면 상한 없이 실행합니다. `-p` 에서만 적용됩니다.
- **도구:** `tools` 의 `*` 는 전체 내장 도구입니다.
- **추가 인자:** `additionalArguments` 는 맨 뒤에 붙어서 앞의 옵션보다 우선합니다.

## 오류

모두 `ClaudeError` 를 상속합니다.

| 클래스                      | 상황             |
| --------------------------- | ---------------- |
| `InvalidClaudeRequestError` | 요청 값이 잘못됨 |
| `ClaudeFailedError`         | CLI 실행 실패    |
| `ClaudeTimedOutError`       | 시간 초과        |
| `ClaudeCancelledError`      | 취소됨           |
