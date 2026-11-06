import {
    NodeConnectionTypes,
    type INodeType,
    type INodeTypeDescription,
    type ITriggerFunctions,
    type ITriggerResponse,
} from "n8n-workflow";

import { subscribeToSlackSource } from "../../slack/SharedSlackSocket";
import type {
    SlackSource,
    SlackSourceKind,
} from "../../slack/slackEventFilter";
import { withBotAttachmentText } from "../../slack/slackMessageText";

function parseCommaSeparated(rawValue: string): Set<string> {
    return new Set(
        rawValue
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
    );
}

function readSource(trigger: ITriggerFunctions): SlackSource {
    const readText = (name: string) =>
        trigger.getNodeParameter(name, "") as string;
    const readIds = (name: string) => parseCommaSeparated(readText(name));
    // n8n 편집기는 기본값과 같은 파라미터를 저장할 때 뺍니다.
    const kind = trigger.getNodeParameter(
        "source",
        "mentions",
    ) as SlackSourceKind;

    switch (kind) {
        case "mentions":
            return {
                kind,
                mentionedUserId:
                    readText("mentionedUserId").trim() || undefined,
                mentionedUserGroupIds: readIds("mentionedUserGroupIds"),
                allowedSenderIds: readIds("allowedSenderIds"),
            };
        case "channelMessages":
            return {
                kind,
                channelIds: readIds("channelIds"),
                allowedSenderIds: readIds("allowedSenderIds"),
            };
        case "botMessages":
            return {
                kind,
                allowedBotIds: readIds("allowedBotIds"),
                channelIds: readIds("channelIds"),
            };
        case "eventSilence":
            return { kind };
        case "messageShortcut":
            return {
                kind,
                callbackId: readText("callbackId").trim(),
                allowedUserIds: readIds("allowedUserIds"),
            };
    }
}

/** n8n 은 파일 이름으로 클래스를 찾으므로 클래스 이름을 SlackSocketTrigger 로 유지해야 합니다. */
export class SlackSocketTrigger implements INodeType {
    description: INodeTypeDescription = {
        displayName: "Slack Socket Trigger",
        name: "slackSocketTrigger",
        icon: "file:slack-logo.svg",
        group: ["trigger"],
        version: 1,
        description: "Slack Socket Mode 메시지로 워크플로를 시작합니다",
        defaults: { name: "Slack Socket Trigger" },
        inputs: [],
        outputs: [NodeConnectionTypes.Main],
        credentials: [{ name: "slackSocketApi", required: true }],
        properties: [
            {
                displayName: "Source",
                name: "source",
                type: "options",
                default: "mentions",
                description:
                    "이 노드가 받을 메시지. 한 메시지가 여러 소스에 맞으면 Bot Messages, Mentions, Channel Messages 순으로 한 소스에만 갑니다.",
                options: [
                    {
                        name: "Mentions",
                        value: "mentions",
                        description:
                            "지정한 사용자나 그룹을 멘션한 사람 메시지",
                    },
                    {
                        name: "Channel Messages",
                        value: "channelMessages",
                        description: "지정한 채널의 사람 메시지 전체",
                    },
                    {
                        name: "Bot Messages",
                        value: "botMessages",
                        description: "지정한 채널에서 허용한 봇의 메시지",
                    },
                    {
                        name: "Message Shortcut",
                        value: "messageShortcut",
                        description:
                            "허용한 사용자가 메시지 메뉴에서 단축키를 누른 메시지",
                    },
                    {
                        name: "Event Silence",
                        value: "eventSilence",
                        description:
                            "소켓은 연결돼 있는데 이벤트가 15분째 0건일 때 한 번, 이후 1시간마다 실행합니다. Slack 이 Enable Events 를 끈 경우를 알아채는 데 씁니다.",
                    },
                ],
            },
            {
                displayName: "Mentioned User ID",
                name: "mentionedUserId",
                type: "string",
                default: "",
                placeholder: "U0123456789",
                description: "이 사용자를 멘션한 메시지를 받습니다.",
                displayOptions: { show: { source: ["mentions"] } },
            },
            {
                displayName: "Mentioned User Group IDs",
                name: "mentionedUserGroupIds",
                type: "string",
                default: "",
                placeholder: "S0123456789,S9876543210",
                description:
                    "쉼표로 구분한 사용자 그룹. 이 그룹을 멘션한 메시지도 받습니다.",
                displayOptions: { show: { source: ["mentions"] } },
            },
            {
                displayName: "Channel IDs",
                name: "channelIds",
                type: "string",
                default: "",
                placeholder: "C0123456789,C9876543210",
                description:
                    "쉼표로 구분한 채널. 비우면 아무것도 받지 않습니다. 워크플로 답글이 올라가는 채널을 Channel Messages 에 넣으면 답글이 워크플로를 다시 실행합니다.",
                displayOptions: {
                    show: { source: ["channelMessages", "botMessages"] },
                },
            },
            {
                displayName: "Callback ID",
                name: "callbackId",
                type: "string",
                default: "",
                required: true,
                placeholder: "start_session",
                description: "Slack 앱에서 단축키를 만들 때 정한 Callback ID",
                displayOptions: { show: { source: ["messageShortcut"] } },
            },
            {
                displayName: "Allowed User IDs",
                name: "allowedUserIds",
                type: "string",
                default: "",
                required: true,
                placeholder: "U0123456789,U9876543210",
                description:
                    "쉼표로 구분한 사용자. 단축키를 눌러도 되는 사람입니다. 비우면 아무도 실행할 수 없습니다.",
                displayOptions: { show: { source: ["messageShortcut"] } },
            },
            {
                displayName: "Allowed Sender IDs",
                name: "allowedSenderIds",
                type: "string",
                default: "",
                placeholder: "U0123456789,U9876543210",
                description:
                    "쉼표로 구분한 허용 발신자. 비우면 모든 사람의 메시지를 받습니다.",
                displayOptions: {
                    show: { source: ["mentions", "channelMessages"] },
                },
            },
            {
                displayName: "Allowed Bot IDs",
                name: "allowedBotIds",
                type: "string",
                default: "",
                placeholder: "B0123456789,B9876543210",
                description:
                    "쉼표로 구분한 봇. 워크플로가 답글에 쓰는 봇은 넣지 마세요.",
                displayOptions: { show: { source: ["botMessages"] } },
            },
        ],
    };

    async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
        const { appToken } = await this.getCredentials<{ appToken: string }>(
            "slackSocketApi",
        );

        const unsubscribe = await subscribeToSlackSource({
            appToken,
            // 가짜 Slack 서버로 n8n 전체 경로를 검증할 때만 씁니다.
            slackApiUrl: process.env.N8N_SLACK_SOCKET_API_URL,
            source: readSource(this),
            ownerId: this.getWorkflow().id ?? "unsaved-workflow",
            onEvent: (envelope) => {
                this.emit([
                    this.helpers.returnJsonArray([
                        {
                            ...withBotAttachmentText(envelope.event),
                            eventId: envelope.event_id,
                            teamId: envelope.team_id,
                        },
                    ]),
                ]);
            },
            onError: (error) => this.logger.error(error.message),
            onConnectionLost: (error) => this.emitError(error),
            onDiagnostic: (message) => this.logger.info(message),
            onMessageShortcut: (shortcut) => {
                this.emit([
                    this.helpers.returnJsonArray([
                        {
                            ...withBotAttachmentText(shortcut.message),
                            channel: shortcut.channel.id,
                            triggeredBy: shortcut.user.id,
                            callbackId: shortcut.callback_id,
                            teamId: shortcut.team?.id,
                        },
                    ]),
                ]);
            },
            onEventSilence: ({ silentMs, appId }) => {
                this.emit([
                    this.helpers.returnJsonArray([
                        {
                            type: "event_silence",
                            silentMinutes: Math.round(silentMs / 60_000),
                            appId,
                        },
                    ]),
                ]);
            },
            // 가짜 Slack 서버로 알림 경로를 검증할 때만 씁니다.
            silenceTimeoutMs:
                Number(process.env.N8N_SLACK_SOCKET_SILENCE_TIMEOUT_MS) ||
                undefined,
        });

        return { closeFunction: unsubscribe };
    }
}
