import { LogLevel, SocketModeClient } from "@slack/socket-mode";

import {
    matchesSlackEventFilter,
    type SlackEvent,
    type SlackEventFilter,
} from "./slackEventFilter";

export interface SlackEventEnvelope {
    readonly event_id: string;
    readonly team_id?: string;
    readonly event: SlackEvent;
}

export interface SlackSocketConnectionOptions {
    readonly appToken: string;
    readonly filter: SlackEventFilter;
    readonly slackApiUrl?: string;
    readonly onEvent: (envelope: SlackEventEnvelope) => void;
    readonly onError: (error: Error) => void;
    readonly onConnectionLost: (error: Error) => void;
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

    private deliver(envelope: SlackEventEnvelope): void {
        if (!matchesSlackEventFilter(envelope.event, this.options.filter)) {
            return;
        }
        if (!this.rememberIfNew(envelope.event_id)) return;

        this.options.onEvent(envelope);
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

interface SlackEventDelivery {
    readonly ack: () => Promise<void>;
    readonly type: string;
    readonly body: SlackEventEnvelope;
}
