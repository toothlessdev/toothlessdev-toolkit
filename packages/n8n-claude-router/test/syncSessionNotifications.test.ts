import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import type { ClaudeSession } from "claude-cli";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
    syncSessionNotifications,
    withStatusEmoji,
} from "../src/notification/syncSessionNotifications";
import {
    SessionNotificationStore,
    type SessionNotification,
} from "../src/store/SessionNotificationStore";

const MINUTE_MS = 60_000;
const GRACE_MS = 10 * MINUTE_MS;
const HOURGLASS = ":hourglass_flowing_sand:";
const CHECK = ":white_check_mark:";

let directory: string;
let store: SessionNotificationStore;
let nowMs: number;
let sessions: ClaudeSession[];
let stopSession: ReturnType<
    typeof vi.fn<(session: ClaudeSession) => Promise<void>>
>;
let onStopFailed: ReturnType<
    typeof vi.fn<(session: ClaudeSession, error: Error) => void>
>;
let listSessions: ReturnType<typeof vi.fn<() => Promise<ClaudeSession[]>>>;

function session(
    state: string,
    overrides: Partial<ClaudeSession> = {},
): ClaudeSession {
    return {
        sessionId: "s1",
        backgroundId: "s1short",
        name: "",
        intent: "",
        workingDirectory: "/work",
        isBackground: true,
        startedAtMs: 0,
        pid: 100,
        state,
        ...overrides,
    };
}

function notification(
    overrides: Partial<SessionNotification> = {},
): SessionNotification {
    return {
        sessionId: "s1",
        channel: "C1",
        ts: "1.1",
        text: `${HOURGLASS} 세션을 시작했습니다`,
        status: "working",
        ...overrides,
    };
}

function sync() {
    return syncSessionNotifications({
        store,
        listSessions,
        stopSession,
        stopGraceMs: GRACE_MS,
        nowMs: () => nowMs,
        onStopFailed,
    });
}

beforeEach(() => {
    directory = mkdtempSync(path.join(tmpdir(), "notification-test-"));
    store = new SessionNotificationStore(path.join(directory, "store.json"));
    nowMs = 1_000_000;
    sessions = [];
    stopSession = vi.fn(async () => {});
    onStopFailed = vi.fn();
    listSessions = vi.fn(async () => sessions);
});

afterEach(() => rmSync(directory, { recursive: true, force: true }));

describe("syncSessionNotifications", () => {
    test("추적할 알림이 없으면 세션 목록을 읽지 않는다", async () => {
        await expect(sync()).resolves.toEqual([]);

        expect(listSessions).not.toHaveBeenCalled();
    });

    test("상태가 그대로면 고칠 알림이 없다", async () => {
        store.upsert(notification());
        sessions = [session("working")];

        await expect(sync()).resolves.toEqual([]);
    });

    test.each([
        ["done", CHECK, "done"],
        ["blocked", ":raised_hand:", "blocked"],
    ])(
        "세션이 %s 면 이모지를 바꾼 본문을 돌려준다",
        async (state, emoji, status) => {
            store.upsert(notification());
            sessions = [session(state)];

            await expect(sync()).resolves.toEqual([
                {
                    sessionId: "s1",
                    channel: "C1",
                    ts: "1.1",
                    text: `${emoji} 세션을 시작했습니다`,
                    status,
                },
            ]);
        },
    );

    test("done 알림의 세션이 다시 working 이면 모래시계로 돌아간다", async () => {
        store.upsert(notification({ status: "done", text: `${CHECK} 본문` }));
        sessions = [session("working")];

        const [change] = await sync();

        expect(change?.text).toBe(`${HOURGLASS} 본문`);
    });

    test("호출부가 status 를 저장하기 전에는 같은 변경을 다시 돌려준다", async () => {
        store.upsert(notification());
        sessions = [session("done")];

        await expect(sync()).resolves.toHaveLength(1);
        await expect(sync()).resolves.toHaveLength(1);
    });

    test.each([
        ["목록에서 사라진 세션", []],
        [
            "프로세스 없이 working 인 세션",
            [session("working", { pid: undefined })],
        ],
    ])("%s 는 done 으로 표시한다", async (_, listed) => {
        store.upsert(notification());
        sessions = listed;

        const [change] = await sync();

        expect(change?.status).toBe("done");
    });

    test("표시가 맞고 프로세스도 끝난 알림은 추적에서 뺀다", async () => {
        store.upsert(notification({ status: "done" }));
        sessions = [session("done", { pid: undefined })];

        await sync();

        expect(store.list()).toEqual([]);
    });

    test("표시가 아직 안 맞으면 프로세스가 끝났어도 추적을 유지한다", async () => {
        store.upsert(notification());
        sessions = [session("done", { pid: undefined })];

        await sync();

        expect(store.list()).toHaveLength(1);
    });

    test("대기 시간 경계 전에는 멈추지 않고 경계에서 멈춘다", async () => {
        store.upsert(notification());
        sessions = [session("done")];

        await sync();
        nowMs += GRACE_MS - 1;
        await sync();
        expect(stopSession).not.toHaveBeenCalled();

        nowMs += 1;
        await sync();
        expect(stopSession).toHaveBeenCalledExactlyOnceWith(sessions[0]);
    });

    test("대기 중 다시 working 이 되면 대기 시간을 처음부터 잰다", async () => {
        store.upsert(notification());
        sessions = [session("done")];
        await sync();

        nowMs += GRACE_MS - 1;
        sessions = [session("working")];
        await sync();

        nowMs += 1;
        sessions = [session("done")];
        await sync();
        expect(stopSession).not.toHaveBeenCalled();
    });

    test("같은 세션의 새 알림이 대기 중이면 옛 알림 시각으로 멈추지 않는다", async () => {
        store.upsert(notification());
        sessions = [session("done")];
        await sync();

        nowMs += GRACE_MS;
        store.upsert(notification({ ts: "2.2" }));
        await sync();

        expect(stopSession).not.toHaveBeenCalled();
    });

    test.each([
        ["작업 중", session("working")],
        ["답을 기다리는", session("blocked")],
        ["사람이 쓰는", session("done", { isBackground: false })],
    ])("%s 세션은 멈추지 않는다", async (_, listed) => {
        store.upsert(notification({ doneSinceMs: nowMs - GRACE_MS * 2 }));
        sessions = [listed];

        await sync();

        expect(stopSession).not.toHaveBeenCalled();
    });

    test("추적하지 않는 세션은 끝난 지 오래돼도 멈추지 않는다", async () => {
        store.upsert(notification({ doneSinceMs: nowMs - GRACE_MS * 2 }));
        sessions = [
            session("done"),
            session("done", { sessionId: "mine", backgroundId: "mineshort" }),
        ];

        await sync();

        expect(stopSession).toHaveBeenCalledExactlyOnceWith(sessions[0]);
    });

    test("stop 이 실패해도 변경을 돌려주고 알린다", async () => {
        store.upsert(notification({ doneSinceMs: nowMs - GRACE_MS }));
        sessions = [session("done")];
        stopSession.mockRejectedValue(new Error("stop 실패"));

        await expect(sync()).resolves.toHaveLength(1);

        expect(onStopFailed).toHaveBeenCalledOnce();
    });

    test("세션 목록을 못 읽으면 숨기지 않고 던진다", async () => {
        store.upsert(notification());
        listSessions.mockRejectedValue(new Error("목록 실패"));

        await expect(sync()).rejects.toThrow("목록 실패");
    });
});

describe("withStatusEmoji", () => {
    test("상태 이모지가 없는 본문에는 앞에 붙인다", () => {
        expect(withStatusEmoji(":repeat: 본문", "working")).toBe(
            `${HOURGLASS} :repeat: 본문`,
        );
    });

    test("맨 앞 상태 이모지만 바꾸고 본문의 같은 글자는 건드리지 않는다", () => {
        expect(withStatusEmoji(`${HOURGLASS} 본문 ${HOURGLASS}`, "done")).toBe(
            `${CHECK} 본문 ${HOURGLASS}`,
        );
    });
});

describe("SessionNotificationStore", () => {
    test("같은 메시지는 덮어쓰고 다른 메시지는 따로 둔다", () => {
        store.upsert(notification());
        store.upsert(notification({ status: "done" }));
        store.upsert(notification({ ts: "2.2" }));

        expect(store.list().map(({ ts, status }) => [ts, status])).toEqual([
            ["1.1", "done"],
            ["2.2", "working"],
        ]);
    });

    test("표시 상태를 저장해도 대기 시작 시각은 유지한다", () => {
        store.upsert(notification({ doneSinceMs: 123 }));
        store.upsert(notification({ status: "done" }));

        expect(store.list()[0]).toMatchObject({
            status: "done",
            doneSinceMs: 123,
        });
    });

    test("한도를 넘으면 가장 오래된 알림부터 지운다", () => {
        for (let index = 0; index < 1001; index++) {
            store.upsert(notification({ ts: `${index}.0` }));
        }

        const stored = store.list();
        expect(stored).toHaveLength(1000);
        expect(stored[0]?.ts).toBe("1.0");
    });
});
