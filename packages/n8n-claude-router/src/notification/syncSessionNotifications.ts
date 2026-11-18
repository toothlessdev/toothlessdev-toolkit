import type { ClaudeSession } from "claude-cli";

import type {
    NotificationStatus,
    SessionNotification,
    SessionNotificationStore,
} from "../store/SessionNotificationStore";
import {
    buildNotificationBlocks,
    readNotificationTitle,
    renderStatusReply,
    withNotificationStatus,
} from "./sessionNotificationText";

export interface SyncDependencies {
    readonly store: SessionNotificationStore;
    readonly listSessions: () => Promise<readonly ClaudeSession[]>;
    readonly stopSession: (session: ClaudeSession) => Promise<void>;
    readonly stopGraceMs: number;
    readonly nowMs: () => number;
    readonly onStopFailed: (session: ClaudeSession, error: Error) => void;
    /** Claude Desktop 버튼이 세션을 열 폴더입니다. */
    readonly workingDirectory?: string;
    /** 상태 답글에서 멘션할 Slack 사용자 ID 입니다. 비우면 멘션 없이 답글 본문만 만듭니다. */
    readonly mentionUserId?: string;
}

export interface NotificationChange {
    readonly sessionId: string;
    readonly channel: string;
    readonly ts: string;
    readonly text: string;
    readonly blocks: string;
    readonly fallbackText: string;
    readonly status: NotificationStatus;
    readonly remoteControlSessionId?: string;
    /** 원래 메시지 스레드에 달 답글입니다. 사람이 알아야 하는 상태로 바뀔 때만 있습니다. */
    readonly threadReplyText?: string;
}

type AnnouncedStatusGroup = "blocked" | "done" | "failed";

/** doneRunning 과 doneStopped 는 같은 완료라서 프로세스가 멈출 때 답글을 한 번 더 달지 않습니다. */
const ANNOUNCED_STATUS_GROUP: Partial<
    Record<NotificationStatus, AnnouncedStatusGroup>
> = {
    blocked: "blocked",
    doneRunning: "done",
    doneStopped: "done",
    failed: "failed",
};

/** 사람이 Desktop 에서 넘겨받은 세션은 그 사람이 이미 보고 있어서 이후 상태를 알리지 않습니다. */
function buildThreadReplyText(
    previousStatus: NotificationStatus,
    nextStatus: NotificationStatus,
    session: ClaudeSession | undefined,
    mentionUserId: string | undefined,
): string | undefined {
    const nextGroup = ANNOUNCED_STATUS_GROUP[nextStatus];
    if (!nextGroup || previousStatus === "takenOver") return undefined;
    if (ANNOUNCED_STATUS_GROUP[previousStatus] === nextGroup) return undefined;

    const message =
        nextStatus === "blocked"
            ? (session?.needs ?? session?.detail)
            : session?.detail;

    return renderStatusReply({ status: nextStatus, mentionUserId, message });
}

/** 프로세스 없이 working 으로 남은 세션은 죽은 세션이라 진행 중으로 계속 보여 주지 않습니다. */
function resolveStatus(session: ClaudeSession | undefined): NotificationStatus {
    if (!session) return "doneStopped";
    // 사람이 세션을 넘겨받았으면 자동 작업은 끝난 것으로 봅니다.
    if (!session.isBackground) return "takenOver";
    if (session.state === "failed") return "failed";
    if (session.state === "blocked") return "blocked";
    if (session.pid === undefined) return "doneStopped";
    if (session.state === "done") return "doneRunning";

    return "working";
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
    const {
        store,
        listSessions,
        stopSession,
        nowMs,
        onStopFailed,
        workingDirectory,
        mentionUserId,
    } = dependencies;

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
        // 멈춘 세션은 Remote Control 주소가 더 이상 열리지 않아서 claude://resume 으로 되돌립니다.
        const remoteControlSessionId = isSessionRunning
            ? session?.remoteControlSessionId
            : undefined;
        const isButtonChanged =
            remoteControlSessionId !== notification.remoteControlSessionId;

        if (
            status === notification.status &&
            !isButtonChanged &&
            !isSessionRunning
        ) {
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

        if (status !== notification.status || isButtonChanged) {
            const text = withNotificationStatus(notification.text, status);
            changes.push({
                sessionId: notification.sessionId,
                channel: notification.channel,
                ts: notification.ts,
                text,
                blocks: buildNotificationBlocks(text, {
                    sessionId: notification.sessionId,
                    workingDirectory,
                    remoteControlSessionId,
                }),
                fallbackText: readNotificationTitle(text),
                status,
                remoteControlSessionId,
                threadReplyText: buildThreadReplyText(
                    notification.status,
                    status,
                    session,
                    mentionUserId,
                ),
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
