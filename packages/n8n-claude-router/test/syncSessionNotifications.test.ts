import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import type { ClaudeSession } from "claude-cli";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { syncSessionNotifications } from "../src/notification/syncSessionNotifications";
import {
    SessionNotificationStore,
    type SessionNotification,
} from "../src/store/SessionNotificationStore";

const MINUTE_MS = 60_000;
const GRACE_MS = 10 * MINUTE_MS;
const WORKING = ":large_yellow_circle:";
const DONE = ":large_green_circle:";

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
        text: `${WORKING} 세션을 시작했습니다`,
        status: "working",
        ...overrides,
    };
}

function sync(mentionUserId?: string) {
    return syncSessionNotifications({
        store,
        listSessions,
        stopSession,
        stopGraceMs: GRACE_MS,
        nowMs: () => nowMs,
        onStopFailed,
        workingDirectory: "/work",
        mentionUserId,
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
        ["done", DONE, "doneRunning", "완료"],
        ["blocked", ":large_orange_circle:", "blocked", "확인 필요"],
        ["failed", ":red_circle:", "failed", "실패"],
    ])(
        "세션이 %s 면 이모지를 바꾼 본문과 블록, 상태 답글을 돌려준다",
        async (state, emoji, status, label) => {
            store.upsert(notification());
            sessions = [session(state)];

            const text = `${emoji} 세션을 시작했습니다`;
            await expect(sync()).resolves.toEqual([
                {
                    sessionId: "s1",
                    channel: "C1",
                    ts: "1.1",
                    text,
                    blocks: JSON.stringify({
                        blocks: [
                            { type: "section", text: { type: "mrkdwn", text } },
                        ],
                    }),
                    fallbackText: "세션을 시작했습니다",
                    status,
                    threadReplyText: `${emoji} *${label}*`,
                },
            ]);
        },
    );

    test("멈춘 done 세션과 사람이 넘겨받은 세션을 구분한다", async () => {
        store.upsert(notification());
        store.upsert(notification({ sessionId: "s2", ts: "2.2" }));
        sessions = [
            session("done", { pid: undefined }),
            session("done", { sessionId: "s2", isBackground: false }),
        ];

        const changes = await sync();

        expect(
            changes.map(({ sessionId, status }) => [sessionId, status]),
        ).toEqual([
            ["s1", "doneStopped"],
            ["s2", "takenOver"],
        ]);
    });

    test("지금 형식 알림은 블록에 Claude Desktop 버튼을 다시 붙인다", async () => {
        store.upsert(
            notification({
                text: `${WORKING} *제목*\n\n> :vertical_traffic_light: *Status:* 진행 중 (Claude 조사 중)`,
            }),
        );
        sessions = [session("done")];

        const [change] = await sync();
        const blocks = JSON.parse(change.blocks).blocks;

        expect(blocks[1].elements[0].url).toBe(
            "claude://resume?session=s1&cwd=%2Fwork",
        );
    });

    describe("스레드 답글", () => {
        test("확인 필요로 바뀌면 멘션과 세션이 묻는 내용을 담는다", async () => {
            store.upsert(notification());
            sessions = [
                session("blocked", {
                    needs: "범위를 정해 주세요",
                    detail: "불일치 3곳",
                }),
            ];

            const [change] = await sync("U1");

            expect(change.threadReplyText).toBe(
                "<@U1> :large_orange_circle: *확인 필요*\n> 범위를 정해 주세요",
            );
        });

        test("완료와 실패로 바뀌면 진행 상황 한 줄을 담는다", async () => {
            store.upsert(notification());
            store.upsert(notification({ sessionId: "s2", ts: "2.2" }));
            sessions = [
                session("done", { detail: "정리 끝" }),
                session("failed", { sessionId: "s2", detail: "권한 없음" }),
            ];

            const changes = await sync("U1");

            expect(
                changes.map(({ threadReplyText }) => threadReplyText),
            ).toEqual([
                "<@U1> :large_green_circle: *완료*\n> 정리 끝",
                "<@U1> :red_circle: *실패*\n> 권한 없음",
            ]);
        });

        test.each([
            ["진행 중으로 바뀔 때", "blocked", session("working")],
            [
                "완료 세션의 프로세스가 멈출 때",
                "doneRunning",
                session("done", { pid: undefined }),
            ],
            [
                "넘겨받은 세션이 끝날 때",
                "takenOver",
                session("done", { pid: undefined }),
            ],
        ] as const)(
            "%s 는 답글을 만들지 않는다",
            async (_, previous, current) => {
                store.upsert(notification({ status: previous }));
                sessions = [current];

                const [change] = await sync("U1");

                expect(change.threadReplyText).toBeUndefined();
            },
        );

        test("세션이 쓴 글의 멘션과 링크는 이스케이프한다", async () => {
            store.upsert(notification());
            sessions = [session("done", { detail: "<!channel> <@U9> 끝" })];

            const [change] = await sync();

            expect(change.threadReplyText).toBe(
                ":large_green_circle: *완료*\n> &lt;!channel&gt; &lt;@U9&gt; 끝",
            );
        });
    });

    describe("버튼 주소", () => {
        const currentFormatText = `${WORKING} *제목*\n\n> :vertical_traffic_light: *Status:* 진행 중 (Claude 조사 중)`;

        function buttonUrl(blocks: string): string {
            return JSON.parse(blocks).blocks[1].elements[0].url;
        }

        test("실행 중인 Remote Control 세션은 상태가 그대로여도 claude://code 로 바꾼다", async () => {
            store.upsert(notification({ text: currentFormatText }));
            sessions = [
                session("working", { remoteControlSessionId: "cse_abc" }),
            ];

            const [change] = await sync();

            expect(change.status).toBe("working");
            expect(change.remoteControlSessionId).toBe("cse_abc");
            expect(buttonUrl(change.blocks)).toBe("claude://code/session_abc");
        });

        test("이미 Remote Control 주소로 바꾼 알림은 다시 고치지 않는다", async () => {
            store.upsert(
                notification({
                    text: currentFormatText,
                    remoteControlSessionId: "cse_abc",
                }),
            );
            sessions = [
                session("working", { remoteControlSessionId: "cse_abc" }),
            ];

            await expect(sync()).resolves.toEqual([]);
        });

        test("프로세스가 멈추면 claude://resume 으로 되돌린다", async () => {
            store.upsert(
                notification({
                    text: currentFormatText,
                    status: "doneStopped",
                    remoteControlSessionId: "cse_abc",
                }),
            );
            sessions = [
                session("done", {
                    pid: undefined,
                    remoteControlSessionId: "cse_abc",
                }),
            ];

            const [change] = await sync();

            expect(change.remoteControlSessionId).toBeUndefined();
            expect(buttonUrl(change.blocks)).toBe(
                "claude://resume?session=s1&cwd=%2Fwork",
            );
        });
    });

    test("done 알림의 세션이 다시 working 이면 진행 중으로 돌아간다", async () => {
        store.upsert(
            notification({ status: "doneRunning", text: `${DONE} 본문` }),
        );
        sessions = [session("working")];

        const [change] = await sync();

        expect(change?.text).toBe(`${WORKING} 본문`);
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
    ])("%s 는 정리된 done 으로 표시한다", async (_, listed) => {
        store.upsert(notification());
        sessions = listed;

        const [change] = await sync();

        expect(change?.status).toBe("doneStopped");
    });

    test("표시가 맞고 프로세스도 끝난 알림은 추적에서 뺀다", async () => {
        store.upsert(notification({ status: "doneStopped" }));
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

describe("SessionNotificationStore", () => {
    test("같은 메시지는 덮어쓰고 다른 메시지는 따로 둔다", () => {
        store.upsert(notification());
        store.upsert(notification({ status: "doneStopped" }));
        store.upsert(notification({ ts: "2.2" }));

        expect(store.list().map(({ ts, status }) => [ts, status])).toEqual([
            ["1.1", "doneStopped"],
            ["2.2", "working"],
        ]);
    });

    test("표시 상태를 저장해도 대기 시작 시각은 유지한다", () => {
        store.upsert(notification({ doneSinceMs: 123 }));
        store.upsert(notification({ status: "doneStopped" }));

        expect(store.list()[0]).toMatchObject({
            status: "doneStopped",
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
