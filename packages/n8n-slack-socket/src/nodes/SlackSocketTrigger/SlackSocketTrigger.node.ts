import {
    NodeConnectionTypes,
    type INodeType,
    type INodeTypeDescription,
    type ITriggerFunctions,
    type ITriggerResponse,
} from "n8n-workflow";

import { SlackSocketConnection } from "../../slack/SlackSocketConnection";

function parseCommaSeparated(rawValue: string): Set<string> {
    return new Set(
        rawValue
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
    );
}

/** n8n 은 파일 이름으로 클래스를 찾으므로 클래스 이름을 SlackSocketTrigger 로 유지해야 합니다. */
export class SlackSocketTrigger implements INodeType {
    description: INodeTypeDescription = {
        displayName: "Slack Socket Trigger",
        name: "slackSocketTrigger",
        icon: "file:slack.svg",
        group: ["trigger"],
        version: 1,
        description: "Slack Socket Mode 이벤트로 워크플로를 시작합니다",
        defaults: { name: "Slack Socket Trigger" },
        inputs: [],
        outputs: [NodeConnectionTypes.Main],
        credentials: [{ name: "slackSocketApi", required: true }],
        properties: [
            {
                displayName: "Event Types",
                name: "eventTypes",
                type: "string",
                default: "message",
                description:
                    "쉼표로 구분한 Slack 이벤트 유형. 비우면 모든 유형을 받습니다.",
            },
            {
                displayName: "Mentioned User ID",
                name: "mentionedUserId",
                type: "string",
                default: "",
                placeholder: "U0123456789",
                description:
                    "이 사용자를 멘션한 메시지만 받습니다. 비우면 멘션 여부를 보지 않습니다.",
            },
            {
                displayName: "Allowed Sender IDs",
                name: "allowedSenderIds",
                type: "string",
                default: "",
                placeholder: "U0123456789,U9876543210",
                description:
                    "쉼표로 구분한 허용 발신자. 비우면 채널의 모든 사람이 워크플로를 실행할 수 있습니다.",
            },
        ],
    };

    async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
        const { appToken } = await this.getCredentials<{ appToken: string }>(
            "slackSocketApi",
        );
        const eventTypes = parseCommaSeparated(
            this.getNodeParameter("eventTypes", "") as string,
        );
        const mentionedUserId = this.getNodeParameter(
            "mentionedUserId",
            "",
        ) as string;
        const allowedSenderIds = parseCommaSeparated(
            this.getNodeParameter("allowedSenderIds", "") as string,
        );

        const connection = new SlackSocketConnection({
            appToken,
            filter: {
                eventTypes,
                mentionedUserId: mentionedUserId.trim() || undefined,
                allowedSenderIds,
            },
            // 가짜 Slack 서버로 n8n 전체 경로를 검증할 때만 씁니다.
            slackApiUrl: process.env.N8N_SLACK_SOCKET_API_URL,
            onEvent: (envelope) => {
                this.emit([
                    this.helpers.returnJsonArray([
                        {
                            ...envelope.event,
                            eventId: envelope.event_id,
                            teamId: envelope.team_id,
                        },
                    ]),
                ]);
            },
            onError: (error) => this.logger.error(error.message),
            onConnectionLost: (error) => this.emitError(error),
        });
        await connection.start();

        return { closeFunction: () => connection.stop() };
    }
}
