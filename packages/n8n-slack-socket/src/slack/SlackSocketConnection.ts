import { LogLevel, SocketModeClient } from "@slack/socket-mode";

import type { SlackEvent, SlackSourceKind } from "./slackEventFilter";

export interface SlackEventEnvelope {
    readonly event_id: string;
    readonly team_id?: string;
    readonly event: SlackEvent;
}

export interface SlackSocketConnectionOptions {
    readonly appToken: string;
    readonly slackApiUrl?: string;
    /** 받을 이벤트면 소스 종류를, 아니면 undefined 를 돌려줍니다. */
    readonly classifyEvent: (event: SlackEvent) => SlackSourceKind | undefined;
    readonly onEvent: (
        envelope: SlackEventEnvelope,
        kind: SlackSourceKind,
    ) => void;
    readonly onError: (error: Error) => void;
    readonly onConnectionLost: (error: Error) => void;
    readonly onDiagnostic: (message: string) => void;
    readonly reconnectTimeoutMs?: number;
}

const MAX_REMEMBERED_EVENT_IDS = 1000;
const DEFAULT_RECONNECT_TIMEOUT_MS = 5 * 60 * 1000;

export class SlackSocketConnection {
    private readonly client: SocketModeClient;
    private readonly rememberedEventIds = new Set<string>();
    private reconnectTimer: NodeJS.Timeout | undefined;

    constructor(private readonly options: SlackSocketConnectionOptions) {
        this.client = new SocketModeClient({
            appToken: options.appToken,
            logLevel: LogLevel.WARN,
            clientOptions: options.slackApiUrl
                ? { slackApiUrl: options.slackApiUrl }
                : undefined,
        });

        this.client.on(
            "slack_event",
            ({ ack, type, body }: SlackEventDelivery) => {
                this.acknowledge(ack);

                if (type === "events_api") this.deliver(body);
            },
        );
        this.client.on("ws_message", (rawMessage: string | ArrayBuffer) =>
            this.reportConnection(rawMessage),
        );
        this.client.on("reconnecting", () => this.startReconnectTimer());
        this.client.on("connected", () => this.clearReconnectTimer());
    }

    async start(): Promise<void> {
        await this.client.start();
    }

    async stop(): Promise<void> {
        this.clearReconnectTimer();

        await this.client.disconnect();
    }

    /**
     * 재연결 중 토큰이 폐기되거나 네트워크 오류가 길어지면 SocketModeClient 는 재시도를 멈추고도
     * 호출부에 알리지 않습니다. 워크플로가 활성으로 보이는데 이벤트만 끊기지 않도록 직접 감지합니다.
     */
    private startReconnectTimer(): void {
        if (this.reconnectTimer) return;

        const timeoutMs =
            this.options.reconnectTimeoutMs ?? DEFAULT_RECONNECT_TIMEOUT_MS;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = undefined;
            this.options.onConnectionLost(
                new Error(`Slack 에 ${timeoutMs}ms 동안 재연결하지 못했습니다`),
            );
        }, timeoutMs);
    }

    private clearReconnectTimer(): void {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = undefined;
    }

    /** ack 가 늦으면 Slack 이 같은 이벤트를 다시 보내므로 워크플로 실행 전에 바로 보냅니다. */
    private acknowledge(ack: () => Promise<void>): void {
        ack().catch((error: Error) => this.options.onError(error));
    }

    /**
     * 연결돼도 이벤트가 오지 않을 때 토큰이 어느 앱 것인지, 같은 앱에 다른 연결이 있는지 구분하려고 남깁니다.
     * Slack 은 앱의 연결들에 이벤트를 나눠 보내므로 연결 수가 2 이상이면 이벤트가 다른 쪽으로 갈 수 있습니다.
     */
    private reportConnection(rawMessage: string | ArrayBuffer): void {
        const message =
            typeof rawMessage === "string"
                ? rawMessage
                : new TextDecoder().decode(rawMessage);
        const parsed = JSON.parse(message) as SlackHelloMessage;
        if (parsed.type !== "hello") return;

        this.options.onDiagnostic(
            `Slack 소켓 연결됨 app_id=${parsed.connection_info?.app_id} num_connections=${parsed.num_connections}`,
        );
    }

    private deliver(envelope: SlackEventEnvelope): void {
        const kind = this.options.classifyEvent(envelope.event);

        // user events 는 속한 채널의 메시지가 전부 와서 걸러진 이벤트까지 남기면 분당 200건이 넘게 쌓입니다.
        if (kind === undefined) return;

        const isNew = this.rememberIfNew(envelope.event_id);

        // 메시지 본문은 로그에 남기지 않습니다.
        const { type, subtype, user, channel, bot_id: botId } = envelope.event;
        this.options.onDiagnostic(
            `Slack 이벤트 수신 outcome=${isNew ? "passed" : "duplicate"} event_id=${envelope.event_id} type=${type} subtype=${subtype} user=${user} channel=${channel} bot_id=${botId} source=${kind}`,
        );

        if (isNew) this.options.onEvent(envelope, kind);
    }

    /** 재연결 전후로 같은 이벤트가 다시 오면 claude 가 두 번 실행되어 비용이 두 배가 됩니다. */
    private rememberIfNew(eventId: string): boolean {
        if (this.rememberedEventIds.has(eventId)) return false;

        this.rememberedEventIds.add(eventId);
        if (this.rememberedEventIds.size > MAX_REMEMBERED_EVENT_IDS) {
            const [oldestEventId] = this.rememberedEventIds;
            this.rememberedEventIds.delete(oldestEventId);
        }

        return true;
    }
}

interface SlackHelloMessage {
    readonly type?: string;
    readonly num_connections?: number;
    readonly connection_info?: { readonly app_id?: string };
}

interface SlackEventDelivery {
    readonly ack: () => Promise<void>;
    readonly type: string;
    readonly body: SlackEventEnvelope;
}
