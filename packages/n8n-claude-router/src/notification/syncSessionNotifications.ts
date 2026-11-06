import type { ClaudeSession } from "claude-cli";

import type {
    NotificationStatus,
    SessionNotification,
    SessionNotificationStore,
} from "../store/SessionNotificationStore";

const STATUS_EMOJI: Readonly<Record<NotificationStatus, string>> = {
    working: ":hourglass_flowing_sand:",
    blocked: ":raised_hand:",
    done: ":white_check_mark:",
};

export interface SyncDependencies {
    readonly store: SessionNotificationStore;
    readonly listSessions: () => Promise<readonly ClaudeSession[]>;
    readonly stopSession: (session: ClaudeSession) => Promise<void>;
    readonly stopGraceMs: number;
    readonly nowMs: () => number;
    readonly onStopFailed: (session: ClaudeSession, error: Error) => void;
}

export interface NotificationChange {
    readonly sessionId: string;
    readonly channel: string;
    readonly ts: string;
    readonly text: string;
    readonly status: NotificationStatus;
}

/** 프로세스 없이 working 으로 남은 세션은 죽은 세션이라 모래시계를 계속 보여 주지 않습니다. */
function resolveStatus(session: ClaudeSession | undefined): NotificationStatus {
    // 사람이 세션을 넘겨받았으면 자동 작업은 끝난 것으로 봅니다.
    if (!session || !session.isBackground) return "done";
    if (session.state === "blocked") return "blocked";
    if (session.state === "done" || session.pid === undefined) return "done";

    return "working";
}

export function withStatusEmoji(
    text: string,
    status: NotificationStatus,
): string {
    const body = Object.values(STATUS_EMOJI).reduce(
        (remaining, emoji) =>
            remaining.startsWith(`${emoji} `)
                ? remaining.slice(emoji.length + 1)
                : remaining,
        text,
    );

    return `${STATUS_EMOJI[status]} ${body}`;
}

/**
 * 세션 하나에 알림이 여러 개면 가장 늦게 done 이 된 알림을 기준으로 삼습니다.
 * 전달 직후 새 알림은 대기를 다시 시작해야 하는데, 옛 알림의 시각으로 재면 바로 멈춥니다.
 */
function findStoppableSessions(
    notifications: readonly SessionNotification[],
    sessionById: ReadonlyMap<string, ClaudeSession>,
    { stopGraceMs, nowMs }: Pick<SyncDependencies, "stopGraceMs" | "nowMs">,
): ClaudeSession[] {
    return [...sessionById.values()].filter((session) => {
        const owned = notifications.filter(
            ({ sessionId }) => sessionId === session.sessionId,
        );
        const isRunningDoneBackground =
            session.isBackground &&
            session.pid !== undefined &&
            session.state === "done";
        if (owned.length === 0 || !isRunningDoneBackground) return false;

        return owned.every(
            ({ doneSinceMs }) =>
                doneSinceMs !== undefined &&
                nowMs() - doneSinceMs >= stopGraceMs,
        );
    });
}

/**
 * 바뀐 알림만 돌려줍니다. 저장된 status 는 Slack 수정이 성공한 뒤 호출부가 갱신합니다.
 * 여기서 먼저 고치면 Slack 호출이 실패했을 때 다음 동기화가 다시 시도하지 못합니다.
 */
export async function syncSessionNotifications(
    dependencies: SyncDependencies,
): Promise<NotificationChange[]> {
    const { store, listSessions, stopSession, nowMs, onStopFailed } =
        dependencies;

    // 추적할 알림이 없을 때 1분마다 claude 프로세스를 띄우지 않습니다.
    if (store.list().length === 0) return [];

    const sessionById = new Map(
        (await listSessions()).map((session) => [session.sessionId, session]),
    );
    const changes: NotificationChange[] = [];

    for (const notification of store.list()) {
        const session = sessionById.get(notification.sessionId);
        const status = resolveStatus(session);
        const isSessionRunning = session?.pid !== undefined;

        if (status === notification.status && !isSessionRunning) {
            store.remove(notification);
            continue;
        }

        if (
            session?.state === "done" &&
            notification.doneSinceMs === undefined
        ) {
            store.setDoneSince(notification, nowMs());
        } else if (
            session?.state !== "done" &&
            notification.doneSinceMs !== undefined
        ) {
            store.setDoneSince(notification, undefined);
        }

        if (status !== notification.status) {
            changes.push({
                sessionId: notification.sessionId,
                channel: notification.channel,
                ts: notification.ts,
                text: withStatusEmoji(notification.text, status),
                status,
            });
        }
    }

    const stoppable = findStoppableSessions(
        store.list(),
        sessionById,
        dependencies,
    );
    for (const session of stoppable) {
        try {
            await stopSession(session);
        } catch (error) {
            // 다음 동기화가 다시 시도합니다. 하나가 실패해도 나머지 알림은 처리합니다.
            onStopFailed(session, error as Error);
        }
    }

    return changes;
}
