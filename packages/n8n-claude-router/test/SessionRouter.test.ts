import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import type { ClaudeSession } from "claude-cli";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { resolveWakeTarget } from "../src/claude/resolveWakeTarget";
import { ConversationBindingRule } from "../src/routing/ConversationBindingRule";
import {
    SessionMatchRule,
    selectCandidates,
    type SessionMatch,
} from "../src/routing/SessionMatchRule";
import { SessionRouter } from "../src/routing/SessionRouter";
import { ConversationSessionStore } from "../src/store/ConversationSessionStore";

const NOW_MS = 1_000_000_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WORKING_DIRECTORY = "/work";

function session(id: string, overrides: Partial<ClaudeSession> = {}) {
    return {
        sessionId: id,
        backgroundId: id.slice(0, 8),
        name: `세션 ${id}`,
        intent: "",
        workingDirectory: WORKING_DIRECTORY,
        isBackground: true,
        startedAtMs: NOW_MS - 1000,
        pid: 100,
        ...overrides,
    } satisfies ClaudeSession;
}

const CONVERSATION_KEY = "slack:C1:1.2";
const message = {
    text: "질문",
    source: "slack",
    conversationKey: CONVERSATION_KEY,
};
const criteria = {
    workingDirectory: WORKING_DIRECTORY,
    maxCandidates: 2,
    maxAgeMs: 7 * DAY_MS,
    nowMs: () => NOW_MS,
};

let directory: string;
let store: ConversationSessionStore;
let match: ReturnType<typeof vi.fn<() => Promise<SessionMatch>>>;

function createRouter(sessions: ClaudeSession[]) {
    return new SessionRouter(
        [
            new ConversationBindingRule(store),
            new SessionMatchRule({ match }, criteria),
        ],
        async () => sessions,
    );
}

beforeEach(() => {
    directory = mkdtempSync(path.join(tmpdir(), "claude-router-test-"));
    store = new ConversationSessionStore(path.join(directory, "store.json"));
    match = vi.fn(async () => ({
        sessionId: null,
        confidence: "low",
        reason: "없음",
    }));
});

afterEach(() => rmSync(directory, { recursive: true, force: true }));

describe("SessionRouter", () => {
    test("대화에 연결된 세션이 있으면 LLM 없이 전달한다", async () => {
        store.remember(CONVERSATION_KEY, "bound");

        const decision = await createRouter([session("bound")]).route(message);

        expect(decision).toMatchObject({
            action: "deliver",
            sessionId: "bound",
            ruleName: "conversation-binding",
        });
        expect(match).not.toHaveBeenCalled();
    });

    test("Slack 이 아닌 입력도 키만 같으면 같은 세션으로 묶인다", async () => {
        store.remember("gcal:event-1", "bound");

        const decision = await createRouter([session("bound")]).route({
            text: "회의 시작",
            source: "google-calendar",
            conversationKey: "gcal:event-1",
        });

        expect(decision).toMatchObject({
            action: "deliver",
            sessionId: "bound",
        });
    });

    test("키가 비어 있으면 연결을 보지 않고 LLM 규칙으로 간다", async () => {
        store.remember("", "bound");

        const decision = await createRouter([session("bound")]).route({
            ...message,
            conversationKey: "",
        });

        expect(decision.ruleName).not.toBe("conversation-binding");
        expect(match).toHaveBeenCalled();
    });

    test.each([
        ["지워진 세션", []],
        ["프로세스가 끝난 세션", [session("bound", { pid: undefined })]],
        ["사람이 쓰는 세션", [session("bound", { isBackground: false })]],
    ])("연결된 세션이 %s 이면 전달하지 않는다", async (_, sessions) => {
        store.remember(CONVERSATION_KEY, "bound");

        const decision = await createRouter(sessions).route(message);

        expect(decision).toMatchObject({
            action: "new",
            ruleName: "fallback.new-session",
        });
    });

    describe("끝난 세션 이어 가기를 켠 대화 연결", () => {
        function createResumingRouter(sessions: ClaudeSession[]) {
            return new SessionRouter(
                [
                    new ConversationBindingRule(store, {
                        workingDirectory: WORKING_DIRECTORY,
                    }),
                    new SessionMatchRule({ match }, criteria),
                ],
                async () => sessions,
            );
        }

        test("연결된 세션이 끝났으면 LLM 없이 resume 한다", async () => {
            store.remember(CONVERSATION_KEY, "bound");

            const decision = await createResumingRouter([
                session("bound", { pid: undefined }),
            ]).route(message);

            expect(decision).toMatchObject({
                action: "resume",
                sessionId: "bound",
                ruleName: "conversation-binding",
            });
            expect(match).not.toHaveBeenCalled();
        });

        test("연결된 세션이 살아 있으면 그대로 전달한다", async () => {
            store.remember(CONVERSATION_KEY, "bound");

            const decision = await createResumingRouter([
                session("bound"),
            ]).route(message);

            expect(decision.action).toBe("deliver");
        });

        test.each([
            [
                "다른 폴더의 끝난 세션",
                session("bound", {
                    pid: undefined,
                    workingDirectory: "/elsewhere",
                }),
            ],
            [
                "사람이 쓰던 끝난 세션",
                session("bound", { pid: undefined, isBackground: false }),
            ],
        ])("%s 은 resume 하지 않는다", async (_, bound) => {
            store.remember(CONVERSATION_KEY, "bound");

            const decision = await createResumingRouter([bound]).route(message);

            expect(decision.action).toBe("new");
        });
    });

    test("LLM 이 확신하면 고른 세션으로 전달한다", async () => {
        match.mockResolvedValue({
            sessionId: "a",
            confidence: "high",
            reason: "주제 일치",
        });

        const decision = await createRouter([session("a")]).route(message);

        expect(decision).toMatchObject({
            action: "deliver",
            sessionId: "a",
            ruleName: "llm-session-match",
        });
    });

    test.each<[string, SessionMatch]>([
        [
            "확신이 낮을 때",
            { sessionId: "a", confidence: "low", reason: "애매함" },
        ],
        [
            "세션을 고르지 않았을 때",
            { sessionId: null, confidence: "high", reason: "없음" },
        ],
        [
            "후보에 없는 ID 를 답했을 때",
            { sessionId: "injected", confidence: "high", reason: "조작" },
        ],
    ])("%s 는 새 세션을 시작한다", async (_, answer) => {
        match.mockResolvedValue(answer);

        const decision = await createRouter([session("a")]).route(message);

        expect(decision).toMatchObject({
            action: "new",
            ruleName: "fallback.new-session",
        });
    });

    test("후보가 없으면 LLM 을 부르지 않고 새 세션을 시작한다", async () => {
        const decision = await createRouter([]).route(message);

        expect(decision.action).toBe("new");
        expect(match).not.toHaveBeenCalled();
    });

    test("후보 밖의 세션 ID 는 존재하는 세션이어도 거른다", async () => {
        match.mockResolvedValue({
            sessionId: "other-folder",
            confidence: "high",
            reason: "조작",
        });

        const decision = await createRouter([
            session("a"),
            session("other-folder", { workingDirectory: "/elsewhere" }),
        ]).route(message);

        expect(decision.action).toBe("new");
    });

    test("끝난 세션을 후보에 넣으면 LLM 이 고른 끝난 세션은 resume, 산 세션은 deliver 다", async () => {
        const router = new SessionRouter(
            [
                new SessionMatchRule(
                    { match },
                    { ...criteria, shouldIncludeEndedSessions: true },
                ),
            ],
            async () => [session("live"), session("ended", { pid: undefined })],
        );

        match.mockResolvedValue({
            sessionId: "ended",
            confidence: "high",
            reason: "같은 알림",
        });
        await expect(router.route(message)).resolves.toMatchObject({
            action: "resume",
            sessionId: "ended",
        });

        match.mockResolvedValue({
            sessionId: "live",
            confidence: "high",
            reason: "같은 알림",
        });
        await expect(router.route(message)).resolves.toMatchObject({
            action: "deliver",
            sessionId: "live",
        });
    });

    test("옵션을 켜지 않으면 끝난 세션을 답해도 새 세션이다", async () => {
        match.mockResolvedValue({
            sessionId: "ended",
            confidence: "high",
            reason: "같은 알림",
        });

        const decision = await createRouter([
            session("live"),
            session("ended", { pid: undefined }),
        ]).route(message);

        expect(decision.action).toBe("new");
    });

    test("LLM 호출 실패는 숨기지 않고 던진다", async () => {
        match.mockRejectedValue(new Error("claude 실패"));

        await expect(
            createRouter([session("a")]).route(message),
        ).rejects.toThrow("claude 실패");
    });
});

describe("resolveWakeTarget", () => {
    const ended = session("s1", { pid: undefined });

    test("같은 폴더의 멈춘 백그라운드 세션을 돌려준다", () => {
        expect(resolveWakeTarget([ended], "s1", WORKING_DIRECTORY)).toBe(ended);
    });

    test.each([
        ["없는 세션", []],
        ["살아 있는 세션", [session("s1")]],
        ["다른 폴더의 세션", [{ ...ended, workingDirectory: "/elsewhere" }]],
        [
            "사람이 쓰던 세션",
            [session("s1", { pid: undefined, isBackground: false })],
        ],
        [
            "사람이 Desktop 에서 열어 둔 세션",
            [ended, session("s1", { isBackground: false })],
        ],
    ])("%s 은 깨우지 않는다", (_, sessions) => {
        expect(() =>
            resolveWakeTarget(sessions, "s1", WORKING_DIRECTORY),
        ).toThrow("깨울 수 없는 세션");
    });
});

describe("selectCandidates", () => {
    test("같은 폴더에서 살아 있는 최근 백그라운드 세션만 최신순으로 고른다", () => {
        const candidates = selectCandidates(
            [
                session("old", { startedAtMs: NOW_MS - 8 * DAY_MS }),
                session("interactive", { isBackground: false }),
                session("ended", { pid: undefined }),
                session("elsewhere", { workingDirectory: "/elsewhere" }),
                session("first", { startedAtMs: NOW_MS - 3000 }),
                session("second", { startedAtMs: NOW_MS - 2000 }),
                session("third", { startedAtMs: NOW_MS - 1000 }),
            ],
            criteria,
        );

        expect(candidates.map(({ sessionId }) => sessionId)).toEqual([
            "third",
            "second",
        ]);
    });

    test("옵션을 켜도 사람이 쓰는 세션과 다른 폴더, 기간 밖의 끝난 세션은 뺀다", () => {
        const candidates = selectCandidates(
            [
                session("ended", { pid: undefined }),
                session("interactive-ended", {
                    pid: undefined,
                    isBackground: false,
                }),
                session("elsewhere-ended", {
                    pid: undefined,
                    workingDirectory: "/elsewhere",
                }),
                session("old-ended", {
                    pid: undefined,
                    startedAtMs: NOW_MS - 8 * DAY_MS,
                }),
            ],
            { ...criteria, shouldIncludeEndedSessions: true },
        );

        expect(candidates.map(({ sessionId }) => sessionId)).toEqual(["ended"]);
    });
});

describe("ConversationSessionStore", () => {
    test("파일이 없으면 비어 있고, 덮어쓰면 최신 세션을 돌려준다", () => {
        expect(store.find(CONVERSATION_KEY)).toBeUndefined();

        store.remember(CONVERSATION_KEY, "first");
        store.remember(CONVERSATION_KEY, "second");

        const reopened = new ConversationSessionStore(
            path.join(directory, "store.json"),
        );
        expect(reopened.find(CONVERSATION_KEY)).toBe("second");
    });

    test("한도를 넘으면 가장 오래 안 쓴 대화부터 지운다", () => {
        store.remember("oldest", "a");
        store.remember("touched", "b");
        for (let index = 0; index < 998; index++) {
            store.remember(`conversation-${index}`, "c");
        }
        store.remember("touched", "b2");
        store.remember("newest", "d");

        expect(store.find("oldest")).toBeUndefined();
        expect(store.find("touched")).toBe("b2");
        expect(store.find("newest")).toBe("d");
    });
});
