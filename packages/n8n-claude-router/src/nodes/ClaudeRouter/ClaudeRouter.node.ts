import { homedir } from "node:os";
import path from "node:path";

import {
    buildWakeCommand,
    ClaudeCli,
    listClaudeSessions,
    type ClaudeSession,
} from "claude-cli";
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
    ClaudeSessionDeliverer,
    resolveDeliveryTarget,
} from "../../claude/ClaudeSessionDeliverer";
import { ClaudeSessionMatcher } from "../../claude/ClaudeSessionMatcher";
import { resolveWakeTarget } from "../../claude/resolveWakeTarget";
import { ConversationBindingRule } from "../../routing/ConversationBindingRule";
import { SessionMatchRule } from "../../routing/SessionMatchRule";
import { SessionRouter } from "../../routing/SessionRouter";
import { syncSessionNotifications } from "../../notification/syncSessionNotifications";
import { ConversationSessionStore } from "../../store/ConversationSessionStore";
import {
    SessionNotificationStore,
    type NotificationStatus,
} from "../../store/SessionNotificationStore";

interface ClaudeRouterOptions {
    executable?: string;
    model?: string;
    routingInstructions?: string;
    maxCandidates?: number;
    candidateMaxAgeDays?: number;
    shouldIncludeEndedSessions?: boolean;
    maxBudgetUsd?: number;
    timeoutSeconds?: number;
    storePath?: string;
    notificationStorePath?: string;
    stopGraceSeconds?: number;
}

const DEFAULT_EXECUTABLE = "claude";
const DEFAULT_MODEL = "haiku";
const DEFAULT_MAX_CANDIDATES = 20;
const DEFAULT_CANDIDATE_MAX_AGE_DAYS = 7;
const DEFAULT_MAX_BUDGET_USD = 0.2;
const DEFAULT_TIMEOUT_SECONDS = 60;
const DEFAULT_STOP_GRACE_SECONDS = 10;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_SECOND = 1000;

function routerDataPath(fileName: string): string {
    return path.join(
        process.env.N8N_USER_FOLDER ?? homedir(),
        ".n8n",
        "claude-router",
        fileName,
    );
}

function defaultStorePath(): string {
    return routerDataPath("conversation-sessions.json");
}

function createNotificationStore(
    options: ClaudeRouterOptions,
): SessionNotificationStore {
    return new SessionNotificationStore(
        options.notificationStorePath ||
            routerDataPath("session-notifications.json"),
    );
}

function createCli(options: ClaudeRouterOptions): ClaudeCli {
    return new ClaudeCli(
        options.executable || DEFAULT_EXECUTABLE,
        (options.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS) * 1000,
    );
}

function listSessions(
    options: ClaudeRouterOptions,
    workingDirectory: string,
    cancelSignal?: AbortSignal,
): Promise<ClaudeSession[]> {
    return listClaudeSessions({
        executable: options.executable || DEFAULT_EXECUTABLE,
        workingDirectory,
        timeoutMs: (options.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS) * 1000,
        jobsDirectory: path.join(homedir(), ".claude", "jobs"),
        cancelSignal,
    });
}

function createRouter(
    options: ClaudeRouterOptions,
    workingDirectory: string,
    store: ConversationSessionStore,
): SessionRouter {
    const matcher = new ClaudeSessionMatcher(createCli(options), {
        workingDirectory,
        model: options.model || DEFAULT_MODEL,
        maxBudgetUsd: options.maxBudgetUsd ?? DEFAULT_MAX_BUDGET_USD,
        routingInstructions: options.routingInstructions,
    });

    return new SessionRouter(
        [
            new ConversationBindingRule(
                store,
                options.shouldIncludeEndedSessions
                    ? { workingDirectory }
                    : undefined,
            ),
            new SessionMatchRule(matcher, {
                workingDirectory,
                maxCandidates: options.maxCandidates ?? DEFAULT_MAX_CANDIDATES,
                maxAgeMs:
                    (options.candidateMaxAgeDays ??
                        DEFAULT_CANDIDATE_MAX_AGE_DAYS) * MS_PER_DAY,
                nowMs: Date.now,
                shouldIncludeEndedSessions: options.shouldIncludeEndedSessions,
            }),
        ],
        (cancelSignal) => listSessions(options, workingDirectory, cancelSignal),
    );
}

async function routeItem(
    context: IExecuteFunctions,
    itemIndex: number,
    store: ConversationSessionStore,
    options: ClaudeRouterOptions,
): Promise<IDataObject> {
    const conversationKey = context.getNodeParameter(
        "conversationKey",
        itemIndex,
        "",
    ) as string;
    const router = createRouter(
        options,
        context.getNodeParameter("workingDirectory", itemIndex) as string,
        store,
    );
    const decision = await router.route(
        {
            text: context.getNodeParameter("messageText", itemIndex) as string,
            source: context.getNodeParameter("source", itemIndex, "") as string,
            conversationKey,
        },
        context.getExecutionCancelSignal(),
    );

    // 본문과 LLM 의 이유는 외부 메시지의 영향을 받으므로 로그에 남기지 않습니다.
    context.logger.info(
        `Claude Router: rule=${decision.ruleName} action=${decision.action} conversation=${conversationKey}`,
    );

    return {
        action: decision.action,
        sessionId: decision.action === "new" ? "" : decision.sessionId,
        ruleName: decision.ruleName,
        reason: decision.reason,
        conversationKey,
    };
}

async function deliverItem(
    context: IExecuteFunctions,
    itemIndex: number,
    options: ClaudeRouterOptions,
): Promise<IDataObject> {
    const workingDirectory = context.getNodeParameter(
        "workingDirectory",
        itemIndex,
    ) as string;
    const sessionId = context.getNodeParameter(
        "sessionId",
        itemIndex,
    ) as string;
    const cancelSignal = context.getExecutionCancelSignal();

    // 라우팅 뒤에 세션이 끝났거나 pid 가 바뀌었을 수 있어 보내기 직전에 다시 찾습니다.
    const target = resolveDeliveryTarget(
        await listSessions(options, workingDirectory, cancelSignal),
        sessionId,
        workingDirectory,
    );

    await new ClaudeSessionDeliverer(createCli(options), {
        workingDirectory,
        model: options.model || DEFAULT_MODEL,
        maxBudgetUsd: options.maxBudgetUsd ?? DEFAULT_MAX_BUDGET_USD,
    }).deliver(
        target.pid,
        context.getNodeParameter("messageText", itemIndex) as string,
        cancelSignal,
    );

    return { delivered: true, sessionId };
}

async function wakeItem(
    context: IExecuteFunctions,
    itemIndex: number,
    options: ClaudeRouterOptions,
): Promise<IDataObject> {
    const workingDirectory = context.getNodeParameter(
        "workingDirectory",
        itemIndex,
    ) as string;
    const sessionId = context.getNodeParameter(
        "sessionId",
        itemIndex,
    ) as string;
    const cancelSignal = context.getExecutionCancelSignal();

    // 라우팅 뒤에 세션이 다시 떴거나 사람이 열었을 수 있어 깨우기 직전에 다시 찾습니다.
    resolveWakeTarget(
        await listSessions(options, workingDirectory, cancelSignal),
        sessionId,
        workingDirectory,
    );

    const session = await createCli(options).startBackground(
        buildWakeCommand(
            sessionId,
            context.getNodeParameter("messageText", itemIndex) as string,
        ),
        workingDirectory,
        cancelSignal,
    );

    return { ...session };
}

function rememberItem(
    context: IExecuteFunctions,
    itemIndex: number,
    store: ConversationSessionStore,
): IDataObject {
    const conversationKey = context.getNodeParameter(
        "conversationKey",
        itemIndex,
    ) as string;
    const sessionId = context.getNodeParameter(
        "sessionId",
        itemIndex,
    ) as string;
    store.remember(conversationKey, sessionId);

    return { conversationKey, sessionId };
}

function trackNotificationItem(
    context: IExecuteFunctions,
    itemIndex: number,
    options: ClaudeRouterOptions,
): IDataObject {
    const notification = {
        sessionId: context.getNodeParameter("sessionId", itemIndex) as string,
        channel: context.getNodeParameter("channel", itemIndex) as string,
        ts: context.getNodeParameter("ts", itemIndex) as string,
        text: context.getNodeParameter("text", itemIndex) as string,
        status: context.getNodeParameter(
            "status",
            itemIndex,
        ) as NotificationStatus,
    };
    createNotificationStore(options).upsert(notification);

    return { ...notification };
}

async function syncNotificationsItem(
    context: IExecuteFunctions,
    itemIndex: number,
    options: ClaudeRouterOptions,
): Promise<IDataObject[]> {
    const workingDirectory = context.getNodeParameter(
        "workingDirectory",
        itemIndex,
    ) as string;
    const cancelSignal = context.getExecutionCancelSignal();
    const cli = createCli(options);

    const changes = await syncSessionNotifications({
        store: createNotificationStore(options),
        listSessions: () =>
            listSessions(options, workingDirectory, cancelSignal),
        stopSession: (session) =>
            cli.stopBackground(
                session.backgroundId,
                workingDirectory,
                cancelSignal,
            ),
        stopGraceMs:
            (options.stopGraceSeconds ?? DEFAULT_STOP_GRACE_SECONDS) *
            MS_PER_SECOND,
        nowMs: Date.now,
        onStopFailed: (session, error) =>
            context.logger.warn(
                `Claude Router: stop 실패 session=${session.sessionId}: ${error.message}`,
            ),
    });

    return changes.map((change) => ({ ...change }));
}

async function runOperation(
    context: IExecuteFunctions,
    operation: string,
    itemIndex: number,
    store: ConversationSessionStore,
    options: ClaudeRouterOptions,
): Promise<IDataObject | IDataObject[]> {
    if (operation === "route") {
        return routeItem(context, itemIndex, store, options);
    }
    if (operation === "deliver") {
        return deliverItem(context, itemIndex, options);
    }
    if (operation === "wake") {
        return wakeItem(context, itemIndex, options);
    }
    if (operation === "trackNotification") {
        return trackNotificationItem(context, itemIndex, options);
    }
    if (operation === "syncNotifications") {
        return syncNotificationsItem(context, itemIndex, options);
    }

    return rememberItem(context, itemIndex, store);
}

/** n8n 은 파일 이름으로 클래스를 찾으므로 클래스 이름을 ClaudeRouter 로 유지해야 합니다. */
export class ClaudeRouter implements INodeType {
    description: INodeTypeDescription = {
        displayName: "Claude Router",
        name: "claudeRouter",
        icon: "file:router.svg",
        group: ["transform"],
        version: 1,
        subtitle: '={{$parameter["operation"]}}',
        description: "입력을 넣을 claude 세션을 고르고 메시지를 전달합니다",
        defaults: { name: "Claude Router" },
        inputs: [NodeConnectionTypes.Main],
        outputs: [NodeConnectionTypes.Main],
        properties: [
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                default: "route",
                options: [
                    {
                        name: "Route",
                        value: "route",
                        description: "입력을 넣을 세션을 고릅니다",
                    },
                    {
                        name: "Deliver",
                        value: "deliver",
                        description:
                            "고른 세션에 복사본 없이 메시지를 넣습니다",
                    },
                    {
                        name: "Wake",
                        value: "wake",
                        description:
                            "멈춘 세션을 같은 ID 로 깨우고 메시지를 넣습니다",
                    },
                    {
                        name: "Remember",
                        value: "remember",
                        description: "대화와 새로 띄운 세션을 연결합니다",
                    },
                    {
                        name: "Track Notification",
                        value: "trackNotification",
                        description:
                            "세션 상태에 맞춰 고칠 Slack 알림을 기록합니다",
                    },
                    {
                        name: "Sync Notifications",
                        value: "syncNotifications",
                        description:
                            "상태가 바뀐 알림을 돌려주고, 끝난 지 오래된 세션을 멈춥니다",
                    },
                ],
            },
            {
                displayName: "Message Text",
                name: "messageText",
                type: "string",
                typeOptions: { rows: 3 },
                required: true,
                default: "",
                placeholder: "={{ $json.text }}",
                description:
                    "Route 는 세션을 고를 때 읽고, Deliver 와 Wake 는 세션에 넣습니다",
                displayOptions: {
                    show: { operation: ["route", "deliver", "wake"] },
                },
            },
            {
                displayName: "Source",
                name: "source",
                type: "string",
                default: "",
                placeholder: "slack",
                description:
                    "입력 출처. 세션을 고르는 LLM 에게 그대로 보여줍니다.",
                displayOptions: { show: { operation: ["route"] } },
            },
            {
                displayName: "Conversation Key",
                name: "conversationKey",
                type: "string",
                default: "",
                placeholder:
                    "={{ $json.channel }}:{{ $json.thread_ts || $json.ts }}",
                description:
                    "같은 대화로 묶을 입력에 같은 값을 줍니다. 비우면 이전 대화와 묶지 않습니다.",
                displayOptions: { show: { operation: ["route"] } },
            },
            {
                displayName: "Conversation Key",
                name: "conversationKey",
                type: "string",
                required: true,
                default: "",
                placeholder:
                    "={{ $('Claude Router').item.json.routing.conversationKey }}",
                description: "Route 결과의 conversationKey",
                displayOptions: { show: { operation: ["remember"] } },
            },
            {
                displayName: "Working Directory",
                name: "workingDirectory",
                type: "string",
                required: true,
                default: "",
                placeholder: "/Users/me/project",
                description:
                    "이 폴더에서 시작한 세션만 후보이자 수신자가 됩니다. Claude CLI 노드와 같은 절대 경로를 넣습니다.",
                displayOptions: {
                    show: {
                        operation: [
                            "route",
                            "deliver",
                            "wake",
                            "syncNotifications",
                        ],
                    },
                },
            },
            {
                displayName: "Session ID",
                name: "sessionId",
                type: "string",
                required: true,
                default: "={{ $json.routing.sessionId }}",
                description: "알림이 가리키는 세션의 UUID",
                displayOptions: { show: { operation: ["trackNotification"] } },
            },
            {
                displayName: "Channel",
                name: "channel",
                type: "string",
                required: true,
                default: "={{ $json.channel }}",
                description: "알림을 보낸 채널 ID",
                displayOptions: { show: { operation: ["trackNotification"] } },
            },
            {
                displayName: "Message Timestamp",
                name: "ts",
                type: "string",
                required: true,
                default: "={{ $json.message_timestamp }}",
                description: "Slack 노드가 돌려준 메시지 타임스탬프",
                displayOptions: { show: { operation: ["trackNotification"] } },
            },
            {
                displayName: "Text",
                name: "text",
                type: "string",
                required: true,
                default: "={{ $json.message.text }}",
                description:
                    "알림 메시지 본문. 상태 이모지를 앞에 바꿔 넣습니다.",
                displayOptions: { show: { operation: ["trackNotification"] } },
            },
            {
                displayName: "Status",
                name: "status",
                type: "options",
                default: "working",
                options: [
                    { name: "Working", value: "working" },
                    { name: "Blocked", value: "blocked" },
                    { name: "Done", value: "done" },
                ],
                description: "지금 메시지에 표시된 상태",
                displayOptions: { show: { operation: ["trackNotification"] } },
            },
            {
                displayName: "Session ID",
                name: "sessionId",
                type: "string",
                required: true,
                default: "={{ $json.routing.sessionId }}",
                description: "Route 결과의 sessionId",
                displayOptions: { show: { operation: ["deliver", "wake"] } },
            },
            {
                displayName: "Session ID",
                name: "sessionId",
                type: "string",
                required: true,
                default: "={{ $json.sessionId }}",
                description: "Claude CLI 노드가 돌려준 sessionId",
                displayOptions: { show: { operation: ["remember"] } },
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
                    },
                    {
                        displayName: "Model",
                        name: "model",
                        type: "string",
                        default: DEFAULT_MODEL,
                    },
                    {
                        displayName: "Routing Instructions",
                        name: "routingInstructions",
                        type: "string",
                        typeOptions: { rows: 4 },
                        default: "",
                        description:
                            "세션을 고르는 기준을 고정 규칙 뒤에 덧붙입니다. 외부 입력을 표현식으로 넣으면 인젝션이 되므로 직접 쓴 문구만 넣습니다.",
                    },
                    {
                        displayName: "Max Candidates",
                        name: "maxCandidates",
                        type: "number",
                        typeOptions: { minValue: 1 },
                        default: DEFAULT_MAX_CANDIDATES,
                    },
                    {
                        displayName: "Candidate Max Age (Days)",
                        name: "candidateMaxAgeDays",
                        type: "number",
                        typeOptions: { minValue: 1 },
                        default: DEFAULT_CANDIDATE_MAX_AGE_DAYS,
                    },
                    {
                        displayName: "Include Ended Sessions",
                        name: "shouldIncludeEndedSessions",
                        type: "boolean",
                        default: false,
                        description:
                            "Whether to compare ended background sessions too. Route 가 이런 세션을 고르면 action 이 resume 이고, Claude CLI 노드의 Resume Session ID 로 이어 갑니다.",
                    },
                    {
                        displayName: "Max Budget (USD)",
                        name: "maxBudgetUsd",
                        type: "number",
                        typeOptions: { minValue: 0, numberPrecision: 2 },
                        default: DEFAULT_MAX_BUDGET_USD,
                    },
                    {
                        displayName: "Timeout (Seconds)",
                        name: "timeoutSeconds",
                        type: "number",
                        typeOptions: { minValue: 1 },
                        default: DEFAULT_TIMEOUT_SECONDS,
                    },
                    {
                        displayName: "Store Path",
                        name: "storePath",
                        type: "string",
                        default: "",
                        description:
                            "대화와 세션의 연결을 저장할 파일. 비우면 ~/.n8n/claude-router/conversation-sessions.json 입니다.",
                    },
                    {
                        displayName: "Notification Store Path",
                        name: "notificationStorePath",
                        type: "string",
                        default: "",
                        description:
                            "추적할 알림을 저장할 파일. 비우면 ~/.n8n/claude-router/session-notifications.json 입니다.",
                    },
                    {
                        displayName: "Stop Grace (Seconds)",
                        name: "stopGraceSeconds",
                        type: "number",
                        typeOptions: { minValue: 0 },
                        default: DEFAULT_STOP_GRACE_SECONDS,
                        description:
                            "세션이 done 이 된 뒤 프로세스를 멈출 때까지 기다리는 시간",
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
                const operation = this.getNodeParameter(
                    "operation",
                    itemIndex,
                ) as string;
                const options = this.getNodeParameter(
                    "options",
                    itemIndex,
                    {},
                ) as ClaudeRouterOptions;
                const store = new ConversationSessionStore(
                    options.storePath || defaultStorePath(),
                );

                const routing = await runOperation(
                    this,
                    operation,
                    itemIndex,
                    store,
                    options,
                );

                for (const result of [routing].flat()) {
                    outputItems.push({
                        json: { ...items[itemIndex].json, routing: result },
                        pairedItem: { item: itemIndex },
                    });
                }
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
