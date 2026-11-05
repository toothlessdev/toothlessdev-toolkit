import {
    NodeConnectionTypes,
    NodeOperationError,
    type IDataObject,
    type IExecuteFunctions,
    type INodeExecutionData,
    type INodeType,
    type INodeTypeDescription,
} from "n8n-workflow";

import {
    buildClaudeCommand,
    ClaudeCli as ClaudeCliRunner,
    type ClaudeCommand,
    type ClaudeExecutionMode,
} from "claude-cli";

interface ClaudeCliOptions {
    executable?: string;
    permissionMode?: string;
    sessionName?: string;
    model?: string;
    effort?: string;
    systemPrompt?: string;
    appendedSystemPrompt?: string;
    maxBudgetUsd?: number;
    jsonSchema?: string | object;
    isRemoteControlEnabled?: boolean;
    shouldInheritUserConfig?: boolean;
    timeoutSeconds?: number;
    additionalArguments?: string[];
}

const DEFAULT_EXECUTABLE = "claude";
const DEFAULT_PERMISSION_MODE = "dontAsk";
const DEFAULT_MAX_BUDGET_USD = 1;
const DEFAULT_TIMEOUT_SECONDS = 300;

async function runClaude(
    runner: ClaudeCliRunner,
    executionMode: ClaudeExecutionMode,
    command: ClaudeCommand,
    workingDirectory: string,
    cancelSignal?: AbortSignal,
): Promise<IDataObject> {
    if (executionMode === "background") {
        const session = await runner.startBackground(
            command,
            workingDirectory,
            cancelSignal,
        );
        return {
            backgroundId: session.backgroundId,
            sessionId: session.sessionId,
        };
    }

    const claudeResult = await runner.run(
        command,
        workingDirectory,
        cancelSignal,
    );
    return {
        result: claudeResult.result,
        sessionId: claudeResult.sessionId,
        deniedTools: [...claudeResult.deniedTools],
        ...(claudeResult.structuredOutput !== undefined && {
            structuredOutput: claudeResult.structuredOutput as IDataObject,
        }),
    };
}

/** 표현식으로 넣으면 문자열이 아니라 객체로 들어올 수 있습니다. */
function serializeJsonSchema(jsonSchema?: string | object): string | undefined {
    if (!jsonSchema) return undefined;

    return typeof jsonSchema === "string"
        ? jsonSchema
        : JSON.stringify(jsonSchema);
}

function parseTools(rawTools: string): string[] {
    return rawTools
        .split(",")
        .map((tool) => tool.trim())
        .filter(Boolean);
}

/** n8n 은 파일 이름으로 클래스를 찾으므로 클래스 이름을 ClaudeCli 로 유지해야 합니다. */
export class ClaudeCli implements INodeType {
    description: INodeTypeDescription = {
        displayName: "Claude CLI",
        name: "claudeCli",
        icon: "file:claude-logo.svg",
        group: ["transform"],
        version: 1,
        subtitle:
            '={{$parameter["executionMode"] === "background" ? "--bg" : "-p"}}',
        description: "로컬 claude CLI 를 격리된 설정으로 실행합니다",
        defaults: { name: "Claude CLI" },
        inputs: [NodeConnectionTypes.Main],
        outputs: [NodeConnectionTypes.Main],
        properties: [
            {
                displayName: "Execution Mode",
                name: "executionMode",
                type: "options",
                noDataExpression: true,
                default: "print",
                options: [
                    {
                        name: "Print (-p)",
                        value: "print",
                        description: "끝날 때까지 기다렸다가 결과를 돌려줍니다",
                    },
                    {
                        name: "Background (--bg)",
                        value: "background",
                        description:
                            "세션을 띄우고 바로 돌아옵니다. 결과는 돌려주지 않고, 신뢰된 폴더에서만 실행됩니다.",
                    },
                ],
            },
            {
                displayName: "Prompt",
                name: "prompt",
                type: "string",
                typeOptions: { rows: 4 },
                required: true,
                default: "",
                description: "claude 에 stdin 으로 전달할 프롬프트",
            },
            {
                displayName: "Working Directory",
                name: "workingDirectory",
                type: "string",
                required: true,
                default: "",
                placeholder: "/Users/me/project",
                description: "claude 를 실행할 폴더의 절대 경로",
            },
            {
                displayName: "Tools",
                name: "tools",
                type: "string",
                default: "Read,Grep,Glob",
                description:
                    "쉼표로 구분한 사용 가능 도구. * 는 전체 내장 도구입니다. Permission Mode 가 dontAsk 면 쓰기 도구는 넣어도 거부되고 Print 모드에서 deniedTools 로 보고됩니다.",
            },
            {
                displayName: "Resume Session ID",
                name: "resumeSessionId",
                type: "string",
                default: "",
                description: "이어갈 세션의 UUID. 비우면 새 세션을 시작합니다.",
            },
            {
                displayName: "Options",
                name: "options",
                type: "collection",
                placeholder: "Add Option",
                default: {},
                options: [
                    {
                        displayName: "Executable",
                        name: "executable",
                        type: "string",
                        default: DEFAULT_EXECUTABLE,
                        description:
                            "claude 실행 파일. n8n 프로세스의 PATH 에 없으면 절대 경로를 넣습니다.",
                    },
                    {
                        displayName: "Permission Mode",
                        name: "permissionMode",
                        type: "options",
                        default: DEFAULT_PERMISSION_MODE,
                        options: [
                            { name: "Accept Edits", value: "acceptEdits" },
                            { name: "Auto", value: "auto" },
                            {
                                name: "Bypass Permissions",
                                value: "bypassPermissions",
                            },
                            { name: "Don't Ask", value: "dontAsk" },
                            { name: "Manual", value: "manual" },
                            { name: "Plan", value: "plan" },
                        ],
                    },
                    {
                        displayName: "Session Name",
                        name: "sessionName",
                        type: "string",
                        default: "",
                    },
                    {
                        displayName: "Model",
                        name: "model",
                        type: "string",
                        default: "",
                    },
                    {
                        displayName: "Effort",
                        name: "effort",
                        type: "string",
                        default: "",
                    },
                    {
                        displayName: "System Prompt",
                        name: "systemPrompt",
                        type: "string",
                        typeOptions: { rows: 3 },
                        default: "",
                    },
                    {
                        displayName: "Additional Arguments",
                        name: "additionalArguments",
                        type: "string",
                        typeOptions: {
                            multipleValues: true,
                            multipleValueButtonText: "Add Argument",
                        },
                        default: [],
                        description:
                            "claude 에 그대로 넘길 인자. 칸 하나가 인자 하나이고, 같은 옵션을 넣으면 위의 설정보다 우선합니다.",
                    },
                    {
                        displayName: "Appended System Prompt",
                        name: "appendedSystemPrompt",
                        type: "string",
                        typeOptions: { rows: 3 },
                        default: "",
                    },
                    {
                        displayName: "Remote Control",
                        name: "isRemoteControlEnabled",
                        type: "boolean",
                        default: false,
                        description:
                            "세션을 Remote Control 로 띄웁니다. 켜야 Claude Desktop 사이드바에 표시됩니다.",
                        displayOptions: {
                            show: { "/executionMode": ["background"] },
                        },
                    },
                    {
                        displayName: "Inherit User Config",
                        name: "shouldInheritUserConfig",
                        type: "boolean",
                        default: false,
                        description:
                            "내 MCP 서버, 스킬, 훅, 설정을 그대로 씁니다. 프롬프트에 외부 입력이 들어가면 그 글이 내 권한으로 실행될 수 있습니다.",
                    },
                    {
                        displayName: "JSON Schema",
                        name: "jsonSchema",
                        type: "json",
                        default: "",
                        description:
                            "답변이 따라야 할 JSON Schema. 결과는 출력의 structuredOutput 에 담기고, Switch 노드에서 분기할 수 있습니다.",
                        displayOptions: {
                            show: { "/executionMode": ["print"] },
                        },
                    },
                    {
                        displayName: "Max Budget (USD)",
                        name: "maxBudgetUsd",
                        type: "number",
                        typeOptions: { minValue: 0, numberPrecision: 2 },
                        default: DEFAULT_MAX_BUDGET_USD,
                        description:
                            "호출 한 번의 비용 상한. 0 이면 상한 없이 실행합니다.",
                        displayOptions: {
                            show: { "/executionMode": ["print"] },
                        },
                    },
                    {
                        displayName: "Timeout (Seconds)",
                        name: "timeoutSeconds",
                        type: "number",
                        typeOptions: { minValue: 1 },
                        default: DEFAULT_TIMEOUT_SECONDS,
                    },
                ],
            },
        ],
    };

    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        const items = this.getInputData();
        const outputItems: INodeExecutionData[] = [];

        for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
            try {
                const options = this.getNodeParameter(
                    "options",
                    itemIndex,
                    {},
                ) as ClaudeCliOptions;
                const resumeSessionId = this.getNodeParameter(
                    "resumeSessionId",
                    itemIndex,
                    "",
                ) as string;

                const executionMode = this.getNodeParameter(
                    "executionMode",
                    itemIndex,
                ) as ClaudeExecutionMode;

                const command = buildClaudeCommand({
                    executionMode,
                    prompt: this.getNodeParameter(
                        "prompt",
                        itemIndex,
                    ) as string,
                    tools: parseTools(
                        this.getNodeParameter("tools", itemIndex) as string,
                    ),
                    permissionMode:
                        options.permissionMode ?? DEFAULT_PERMISSION_MODE,
                    maxBudgetUsd:
                        options.maxBudgetUsd ?? DEFAULT_MAX_BUDGET_USD,
                    jsonSchema: serializeJsonSchema(options.jsonSchema),
                    isRemoteControlEnabled: options.isRemoteControlEnabled,
                    shouldInheritUserConfig: options.shouldInheritUserConfig,
                    resumeSessionId: resumeSessionId || undefined,
                    sessionName: options.sessionName,
                    model: options.model,
                    effort: options.effort,
                    systemPrompt: options.systemPrompt,
                    appendedSystemPrompt: options.appendedSystemPrompt,
                    additionalArguments: options.additionalArguments,
                });

                const runner = new ClaudeCliRunner(
                    options.executable || DEFAULT_EXECUTABLE,
                    (options.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS) * 1000,
                );
                const json = await runClaude(
                    runner,
                    executionMode,
                    command,
                    this.getNodeParameter(
                        "workingDirectory",
                        itemIndex,
                    ) as string,
                    this.getExecutionCancelSignal(),
                );

                outputItems.push({ json, pairedItem: { item: itemIndex } });
            } catch (error) {
                if (!this.continueOnFail()) {
                    throw new NodeOperationError(
                        this.getNode(),
                        error as Error,
                        { itemIndex },
                    );
                }

                outputItems.push({
                    json: { error: (error as Error).message },
                    pairedItem: { item: itemIndex },
                });
            }
        }

        return [outputItems];
    }
}
