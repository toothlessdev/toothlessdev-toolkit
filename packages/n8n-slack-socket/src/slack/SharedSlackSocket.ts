import {
    SLACK_SOURCE_PRIORITY,
    matchesSlackSource,
    type SlackEvent,
    type SlackSource,
    type SlackSourceKind,
} from "./slackEventFilter";
import {
    SlackSocketConnection,
    type SlackEventEnvelope,
    type SlackEventSilence,
} from "./SlackSocketConnection";

export interface SlackSourceSubscription {
    readonly appToken: string;
    readonly slackApiUrl?: string;
    readonly source: SlackSource;
    /** 워크플로 ID 입니다. 연결이 끊겼을 때 워크플로마다 한 번만 알리는 데 씁니다. */
    readonly ownerId: string;
    readonly onEvent: (envelope: SlackEventEnvelope) => void;
    readonly onError: (error: Error) => void;
    readonly onConnectionLost: (error: Error) => void;
    readonly onDiagnostic: (message: string) => void;
    readonly onEventSilence: (silence: SlackEventSilence) => void;
    /** 소켓은 앱 토큰당 하나라 이 값은 소켓을 처음 여는 구독의 것만 적용됩니다. */
    readonly silenceTimeoutMs?: number;
}

export type UnsubscribeFromSlackSource = () => Promise<void>;

/**
 * Slack 은 같은 앱의 연결들에 이벤트를 나눠 보냅니다. 트리거 노드마다 소켓을 열면
 * 이벤트가 필터가 다른 노드로 가서 사라지므로 앱 토큰당 연결을 하나만 둡니다.
 */
class SharedSlackSocket {
    readonly ready: Promise<void>;

    private readonly subscriptions = new Set<SlackSourceSubscription>();
    private readonly connection: SlackSocketConnection;

    constructor({
        appToken,
        slackApiUrl,
        silenceTimeoutMs,
    }: SlackSourceSubscription) {
        this.connection = new SlackSocketConnection({
            appToken,
            slackApiUrl,
            classifyEvent: (event) => this.findWinningKind(event),
            onEvent: (envelope, kind) => this.deliver(envelope, kind),
            onError: (error) => this.anySubscription()?.onError(error),
            onConnectionLost: (error) => this.notifyConnectionLost(error),
            onDiagnostic: (message) =>
                this.anySubscription()?.onDiagnostic(message),
            onEventSilence: (silence) => this.notifyEventSilence(silence),
            silenceTimeoutMs,
        });
        this.ready = this.connection.start();
    }

    get subscriptionCount(): number {
        return this.subscriptions.size;
    }

    add(subscription: SlackSourceSubscription): void {
        this.subscriptions.add(subscription);
    }

    remove(subscription: SlackSourceSubscription): void {
        this.subscriptions.delete(subscription);
    }

    async stop(): Promise<void> {
        await this.ready.catch(() => {});
        await this.connection.stop();
    }

    private findWinningKind(event: SlackEvent): SlackSourceKind | undefined {
        return SLACK_SOURCE_PRIORITY.find((kind) =>
            [...this.subscriptions].some(
                ({ source }) =>
                    source.kind === kind && matchesSlackSource(event, source),
            ),
        );
    }

    /** 같은 종류의 구독자에게는 모두 보냅니다. 편집기 테스트 실행이 운영 워크플로의 이벤트를 뺏지 않게 합니다. */
    private deliver(envelope: SlackEventEnvelope, kind: string): void {
        for (const subscription of this.subscriptions) {
            if (
                subscription.source.kind === kind &&
                matchesSlackSource(envelope.event, subscription.source)
            ) {
                subscription.onEvent(envelope);
            }
        }
    }

    private notifyConnectionLost(error: Error): void {
        const notifiedOwnerIds = new Set<string>();

        for (const subscription of [...this.subscriptions]) {
            if (notifiedOwnerIds.has(subscription.ownerId)) continue;

            notifiedOwnerIds.add(subscription.ownerId);
            subscription.onConnectionLost(error);
        }
    }

    private notifyEventSilence(silence: SlackEventSilence): void {
        for (const subscription of this.subscriptions) {
            if (subscription.source.kind === "eventSilence") {
                subscription.onEventSilence(silence);
            }
        }
    }

    private anySubscription(): SlackSourceSubscription | undefined {
        const [firstSubscription] = this.subscriptions;
        return firstSubscription;
    }
}

const socketsByConnectionKey = new Map<string, SharedSlackSocket>();

function forgetSocket(connectionKey: string, socket: SharedSlackSocket): void {
    if (socketsByConnectionKey.get(connectionKey) === socket) {
        socketsByConnectionKey.delete(connectionKey);
    }
}

export async function subscribeToSlackSource(
    subscription: SlackSourceSubscription,
): Promise<UnsubscribeFromSlackSource> {
    const { appToken, slackApiUrl } = subscription;
    const connectionKey = `${slackApiUrl ?? ""}|${appToken}`;

    const socket =
        socketsByConnectionKey.get(connectionKey) ??
        new SharedSlackSocket(subscription);
    socketsByConnectionKey.set(connectionKey, socket);
    socket.add(subscription);

    try {
        await socket.ready;
    } catch (error) {
        socket.remove(subscription);
        forgetSocket(connectionKey, socket);
        throw error;
    }

    return async () => {
        socket.remove(subscription);
        if (socket.subscriptionCount > 0) return;

        forgetSocket(connectionKey, socket);
        await socket.stop();
    };
}
