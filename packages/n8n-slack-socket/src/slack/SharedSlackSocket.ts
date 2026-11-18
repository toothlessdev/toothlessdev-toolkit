import {
    SLACK_SOURCE_PRIORITY,
    matchesSlackSource,
    type SlackEvent,
    type SlackSource,
    type SlackSourceKind,
} from "./slackEventFilter";
import {
    matchesMessageShortcut,
    type SlackMessageShortcut,
} from "./slackMessageShortcut";
import {
    SlackSocketConnection,
    type SlackEventEnvelope,
    type SlackEventSilence,
} from "./SlackSocketConnection";
import { waitAtMost } from "./waitAtMost";

/**
 * n8n 은 워크플로 게시가 lease(기본 120초)의 70% 를 넘기면 트리거를 실패로 두고 다시 시도하지 않습니다.
 * 그보다 충분히 짧게 잡습니다.
 */
const DEFAULT_CONNECT_WAIT_MS = 10_000;

export interface SlackSourceSubscription {
    readonly appToken: string;
    readonly slackApiUrl?: string;
    readonly source: SlackSource;
    /** 워크플로 ID 입니다. 연결이 끊겼을 때 워크플로마다 한 번만 알리는 데 씁니다. */
    readonly ownerId: string;
    /** 같은 값을 가진 구독은 하나만 유지합니다. 편집기 테스트 실행은 운영 구독을 대체하면 안 되므로 값을 두지 않습니다. */
    readonly activationKey?: string;
    readonly onEvent: (envelope: SlackEventEnvelope) => void;
    readonly onError: (error: Error) => void;
    readonly onConnectionLost: (error: Error) => void;
    readonly onDiagnostic: (message: string) => void;
    readonly onEventSilence: (silence: SlackEventSilence) => void;
    readonly onMessageShortcut: (shortcut: SlackMessageShortcut) => void;
    /** 소켓은 앱 토큰당 하나라 이 값은 소켓을 처음 여는 구독의 것만 적용됩니다. */
    readonly silenceTimeoutMs?: number;
    /** 활성화가 연결을 기다리는 최대 시간입니다. 넘기면 연결은 뒤에서 계속 시도합니다. */
    readonly connectWaitMs?: number;
}

export type UnsubscribeFromSlackSource = () => Promise<void>;

/**
 * Slack 은 같은 앱의 연결들에 이벤트를 나눠 보냅니다. 트리거 노드마다 소켓을 열면
 * 이벤트가 필터가 다른 노드로 가서 사라지므로 앱 토큰당 연결을 하나만 둡니다.
 */
class SharedSlackSocket {
    private readonly ready: Promise<void>;
    private readonly subscriptions = new Set<SlackSourceSubscription>();
    /** 활성화가 아직 끝나지 않은 구독입니다. 실패는 활성화 쪽으로 던지므로 연결 끊김으로 따로 알리지 않습니다. */
    private readonly activatingSubscriptions =
        new Set<SlackSourceSubscription>();
    private readonly connection: SlackSocketConnection;

    constructor(
        private readonly connectionKey: string,
        { appToken, slackApiUrl, silenceTimeoutMs }: SlackSourceSubscription,
    ) {
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
            onMessageShortcut: (shortcut) =>
                this.deliverMessageShortcut(shortcut),
            silenceTimeoutMs,
        });
        this.ready = this.connection.start();
        this.ready.catch((error: Error) => this.abandon(error));
    }

    /**
     * 네트워크가 끊긴 동안에는 연결이 언제 될지 모르므로 잠깐만 기다리고 나머지는 뒤에서 계속 시도합니다.
     * 토큰 오류처럼 바로 실패하면 그대로 던져서 활성화를 실패시킵니다.
     */
    async waitForConnection(
        subscription: SlackSourceSubscription,
        waitMs: number,
    ): Promise<void> {
        this.activatingSubscriptions.add(subscription);
        try {
            await waitAtMost(this.ready, waitMs);
        } finally {
            this.activatingSubscriptions.delete(subscription);
        }
    }

    get subscriptionCount(): number {
        return this.subscriptions.size;
    }

    /**
     * 재연결 실패로 n8n 이 워크플로를 다시 활성화할 때 이전 구독이 남으면
     * 이벤트 하나가 두 번 실행되어 claude 비용도 두 배가 됩니다.
     */
    add(subscription: SlackSourceSubscription): void {
        for (const existing of this.subscriptions) {
            if (
                subscription.activationKey !== undefined &&
                existing.activationKey === subscription.activationKey
            ) {
                this.subscriptions.delete(existing);
                subscription.onDiagnostic(
                    `Slack 구독 교체 activation_key=${subscription.activationKey}`,
                );
            }
        }

        this.subscriptions.add(subscription);
    }

    remove(subscription: SlackSourceSubscription): void {
        this.subscriptions.delete(subscription);
    }

    /** 연결을 기다리지 않고 닫습니다. 기다리면 네트워크가 끊긴 동안 n8n 의 트리거 해제가 같이 멈춥니다. */
    async stop(): Promise<void> {
        await this.connection.stop();
    }

    /** 활성화가 끝난 뒤 연결에 실패하면 n8n 이 트리거를 다시 등록하도록 알리고, 새 활성화는 새 소켓을 열게 합니다. */
    private abandon(error: Error): void {
        forgetSocket(this.connectionKey, this);
        this.notifyConnectionLost(error);
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
            if (this.activatingSubscriptions.has(subscription)) continue;
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

    private deliverMessageShortcut(shortcut: SlackMessageShortcut): void {
        for (const subscription of this.subscriptions) {
            if (
                subscription.source.kind === "messageShortcut" &&
                matchesMessageShortcut(shortcut, subscription.source)
            ) {
                subscription.onMessageShortcut(shortcut);
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
        new SharedSlackSocket(connectionKey, subscription);
    socketsByConnectionKey.set(connectionKey, socket);
    socket.add(subscription);

    try {
        await socket.waitForConnection(
            subscription,
            subscription.connectWaitMs ?? DEFAULT_CONNECT_WAIT_MS,
        );
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
