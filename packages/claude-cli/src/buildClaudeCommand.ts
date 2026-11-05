import { InvalidClaudeRequestError } from "./ClaudeError";

export type ClaudeExecutionMode = "print" | "background";

export interface ClaudeRequest {
    readonly executionMode: ClaudeExecutionMode;
    readonly prompt: string;
    readonly tools: readonly string[];
    readonly permissionMode: string;
    readonly maxBudgetUsd: number;
    readonly jsonSchema?: string;
    readonly isRemoteControlEnabled?: boolean;
    /** 켜면 사용자의 MCP 서버, 스킬, 훅, 설정을 그대로 읽습니다. 외부 입력을 넘길 때는 위험합니다. */
    readonly shouldInheritUserConfig?: boolean;
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

/**
 * 빈 --setting-sources 는 사용자 설정의 remoteControlAtStartup 도 읽지 않아서
 * 세션이 Claude Desktop 사이드바에 뜨지 않습니다. 이 값만 따로 넘겨 다시 켭니다.
 */
const REMOTE_CONTROL_SETTINGS = JSON.stringify({
    remoteControlAtStartup: true,
});

const ALL_TOOLS = "*";

/** claude CLI 는 --tools "*" 를 오류 없이 도구 0개로 처리합니다. 전체 도구를 뜻하는 값은 default 입니다. */
function buildToolsArgument(tools: readonly string[]): string {
    return tools.includes(ALL_TOOLS) ? "default" : tools.join(",");
}

function buildIsolationArguments(request: ClaudeRequest): string[] {
    if (request.shouldInheritUserConfig) return [];

    return [
        "--strict-mcp-config",
        "--mcp-config",
        EMPTY_MCP_CONFIG,
        "--setting-sources",
        "",
    ];
}

const SESSION_ID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** --bg 는 -p 와 같이 쓸 수 없고, --output-format, --max-budget-usd, --json-schema 는 -p 에서만 동작합니다. */
function buildModeArguments(request: ClaudeRequest): string[] {
    if (request.executionMode === "background") {
        return [
            "--bg",
            ...(request.isRemoteControlEnabled
                ? ["--settings", REMOTE_CONTROL_SETTINGS]
                : []),
        ];
    }

    return [
        "-p",
        "--output-format",
        "json",
        // 0 은 상한 없음으로 다룹니다.
        ...(request.maxBudgetUsd > 0
            ? ["--max-budget-usd", String(request.maxBudgetUsd)]
            : []),
        ...(request.jsonSchema ? ["--json-schema", request.jsonSchema] : []),
    ];
}

function assertValidJsonSchema(jsonSchema: string): void {
    let parsedSchema: unknown;
    try {
        parsedSchema = JSON.parse(jsonSchema);
    } catch (error) {
        throw new InvalidClaudeRequestError(
            `JSON Schema 가 올바른 JSON 이 아닙니다: ${jsonSchema}`,
            { cause: error },
        );
    }

    if (
        typeof parsedSchema !== "object" ||
        parsedSchema === null ||
        Array.isArray(parsedSchema)
    ) {
        throw new InvalidClaudeRequestError(
            `JSON Schema 는 객체여야 합니다: ${jsonSchema}`,
        );
    }
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
    if (request.jsonSchema) assertValidJsonSchema(request.jsonSchema);

    return {
        commandLineArguments: [
            ...buildModeArguments(request),
            "--permission-mode",
            request.permissionMode,
            "--tools",
            buildToolsArgument(request.tools),
            ...buildIsolationArguments(request),
            ...buildOptionalArguments(request),
            ...(request.additionalArguments ?? []),
        ],
        standardInput: request.prompt,
    };
}
