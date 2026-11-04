import { InvalidClaudeRequestError } from "./ClaudeError";

export type ClaudeExecutionMode = "print" | "background";

export interface ClaudeRequest {
    readonly executionMode: ClaudeExecutionMode;
    readonly prompt: string;
    readonly tools: readonly string[];
    readonly permissionMode: string;
    readonly maxBudgetUsd: number;
    readonly resumeSessionId?: string;
    readonly sessionName?: string;
    readonly model?: string;
    readonly effort?: string;
    readonly systemPrompt?: string;
    readonly appendedSystemPrompt?: string;
    readonly additionalArguments?: readonly string[];
}

export interface ClaudeCommand {
    readonly commandLineArguments: readonly string[];
    readonly standardInput: string;
}

const EMPTY_MCP_CONFIG = JSON.stringify({ mcpServers: {} });

const SESSION_ID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** --bg 는 -p 와 같이 쓸 수 없고, --output-format 과 --max-budget-usd 는 -p 에서만 동작합니다. */
function buildModeArguments(request: ClaudeRequest): string[] {
    if (request.executionMode === "background") return ["--bg"];

    return [
        "-p",
        "--output-format",
        "json",
        "--max-budget-usd",
        String(request.maxBudgetUsd),
    ];
}

function buildOptionalArguments(request: ClaudeRequest): string[] {
    const optionalValues: ReadonlyArray<readonly [string, string | undefined]> =
        [
            ["--name", request.sessionName],
            ["--model", request.model],
            ["--effort", request.effort],
            ["--system-prompt", request.systemPrompt],
            ["--append-system-prompt", request.appendedSystemPrompt],
            ["--resume", request.resumeSessionId],
        ];

    return optionalValues.flatMap(([name, value]) =>
        value ? [name, value] : [],
    );
}

/**
 * 프롬프트는 stdin 으로 넘깁니다. 인자로 넘기면 `-` 로 시작하는 메시지가 옵션으로 해석될 수 있습니다.
 * additionalArguments 는 맨 뒤에 둡니다. claude CLI 는 같은 옵션이 반복되면 뒤의 값을 쓰므로
 * 격리 옵션의 기본값도 여기서 덮어쓸 수 있습니다.
 */
export function buildClaudeCommand(request: ClaudeRequest): ClaudeCommand {
    if (
        request.resumeSessionId !== undefined &&
        !SESSION_ID_PATTERN.test(request.resumeSessionId)
    ) {
        throw new InvalidClaudeRequestError(
            `Session ID 는 UUID 형식이어야 합니다: ${request.resumeSessionId}`,
        );
    }

    return {
        commandLineArguments: [
            ...buildModeArguments(request),
            "--permission-mode",
            request.permissionMode,
            "--tools",
            request.tools.join(","),
            "--strict-mcp-config",
            "--mcp-config",
            EMPTY_MCP_CONFIG,
            "--setting-sources",
            "",
            ...buildOptionalArguments(request),
            ...(request.additionalArguments ?? []),
        ],
        standardInput: request.prompt,
    };
}
