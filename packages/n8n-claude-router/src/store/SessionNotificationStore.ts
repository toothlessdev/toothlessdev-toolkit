import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

const MAX_NOTIFICATIONS = 1000;

export type NotificationStatus = "working" | "blocked" | "done";

export interface SessionNotification {
    readonly sessionId: string;
    readonly channel: string;
    readonly ts: string;
    readonly text: string;
    readonly status: NotificationStatus;
    /** 세션이 done 인 것을 처음 본 시각입니다. 이 시각부터 대기 시간을 잽니다. */
    readonly doneSinceMs?: number;
}

type StoredNotifications = Record<string, SessionNotification>;

function notificationKey({
    channel,
    ts,
}: Pick<SessionNotification, "channel" | "ts">): string {
    return `${channel}:${ts}`;
}

/**
 * 동기화 중에 다른 실행이 알림을 추가할 수 있어서 읽기와 쓰기 사이에 await 를 두지 않습니다.
 * 한 번 읽어 둔 목록을 나중에 통째로 쓰면 그 사이에 추가된 알림이 사라집니다.
 */
export class SessionNotificationStore {
    constructor(private readonly filePath: string) {}

    list(): SessionNotification[] {
        return Object.values(this.read());
    }

    upsert(notification: SessionNotification): void {
        const notifications = this.read();
        const key = notificationKey(notification);
        // 표시 상태를 저장할 때 대기 시작 시각이 지워지면 stop 대기가 처음부터 다시 시작됩니다.
        const doneSinceMs =
            notification.doneSinceMs ?? notifications[key]?.doneSinceMs;

        delete notifications[key];
        notifications[key] = { ...notification, doneSinceMs };

        this.write(notifications);
    }

    setDoneSince(
        notification: Pick<SessionNotification, "channel" | "ts">,
        doneSinceMs: number | undefined,
    ): void {
        const notifications = this.read();
        const key = notificationKey(notification);
        const stored = notifications[key];
        if (!stored) return;

        notifications[key] = { ...stored, doneSinceMs };
        this.write(notifications);
    }

    remove(notification: Pick<SessionNotification, "channel" | "ts">): void {
        const notifications = this.read();

        delete notifications[notificationKey(notification)];
        this.write(notifications);
    }

    private read(): StoredNotifications {
        try {
            return JSON.parse(
                readFileSync(this.filePath, "utf8"),
            ) as StoredNotifications;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};

            throw error;
        }
    }

    private write(notifications: StoredNotifications): void {
        mkdirSync(path.dirname(this.filePath), { recursive: true });

        const entries = Object.entries(notifications).slice(-MAX_NOTIFICATIONS);
        const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
        writeFileSync(
            temporaryPath,
            JSON.stringify(Object.fromEntries(entries), null, 2),
        );
        renameSync(temporaryPath, this.filePath);
    }
}
