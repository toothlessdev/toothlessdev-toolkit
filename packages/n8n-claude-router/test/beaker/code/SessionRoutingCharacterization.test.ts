import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import type { ClaudeSession } from "claude-cli";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ConversationBindingRule } from "../../../src/routing/ConversationBindingRule";
import {
    SessionMatchRule,
    selectCandidates,
    type SessionMatch,
} from "../../../src/routing/SessionMatchRule";
import { SessionRouter } from "../../../src/routing/SessionRouter";
import { ConversationSessionStore } from "../../../src/store/ConversationSessionStore";

const NOW_MS = 1_000_000_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WORKING_DIRECTORY = "/work";
const CONVERSATION_KEY = "slack:C1:1.2";

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

beforeEach(() => {
    directory = mkdtempSync(path.join(tmpdir(), "claude-router-beaker-"));
    store = new ConversationSessionStore(path.join(directory, "store.json"));
    match = vi.fn(async () => ({
        sessionId: null,
        confidence: "low",
        reason: "없음",
    }));
});

afterEach(() => rmSync(directory, { recursive: true, force: true }));

describe("selectCandidates (code)", () => {
    // beaker:case WB-101
    test("WB-101 · (characterization) 정확히 7일 전 세션은 후보에 포함된다", () => {
        const candidates = selectCandidates(
            [session("edge", { startedAtMs: NOW_MS - 7 * DAY_MS })],
            criteria,
        );

        expect(candidates[0].sessionId).toBe("edge");
    });

    // beaker:case WB-102
    test("WB-102 · (characterization) 7일보다 1ms 오래된 세션은 후보에서 제외된다", () => {
        const candidates = selectCandidates(
            [session("over", { startedAtMs: NOW_MS - 7 * DAY_MS - 1 })],
            criteria,
        );

        expect(candidates).toHaveLength(0);
    });

    // beaker:case WB-103
    test("WB-103 · (characterization) 끝 슬래시만 다른 작업 폴더는 같은 폴더로 취급되지 않는다", () => {
        const candidates = selectCandidates(
            [session("slash", { workingDirectory: "/work/" })],
            criteria,
        );

        expect(candidates).toHaveLength(0);
    });
});

describe("취소 신호 전파 (code)", () => {
    // beaker:case WB-104
    test("WB-104 · (characterization) matcher 는 세 번째 인자로 같은 cancelSignal 을 받는다", async () => {
        const cancelSignal = new AbortController().signal;
        const router = new SessionRouter(
            [new SessionMatchRule({ match }, criteria)],
            async () => [session("live")],
        );

        await router.route(message, cancelSignal);

        expect((match.mock.calls[0] as unknown[])[2]).toBe(cancelSignal);
    });

    // beaker:case WB-106
    test("WB-106 · (characterization) cancelSignal 이 listSessions 와 규칙 context 양쪽에 전달된다", async () => {
        const cancelSignal = new AbortController().signal;
        const listSessions = vi.fn(
            async (_cancelSignal?: AbortSignal): Promise<ClaudeSession[]> => [],
        );
        const decide = vi.fn(
            async (_context: { cancelSignal?: AbortSignal }) => null,
        );
        const spyRule = { name: "spy", decide };
        const router = new SessionRouter([spyRule as never], listSessions);

        await router.route(message, cancelSignal);

        expect(decide.mock.calls[0]?.[0].cancelSignal).toBe(cancelSignal);
        expect(listSessions.mock.calls[0]?.[0]).toBe(cancelSignal);
    });
});

describe("ConversationBindingRule (code)", () => {
    // beaker:case WB-105
    test("WB-105 · (characterization) 다른 폴더, 30일 전 세션이어도 연결돼 있으면 deliver 한다", async () => {
        store.remember(CONVERSATION_KEY, "bound");
        const router = new SessionRouter(
            [new ConversationBindingRule(store)],
            async () => [
                session("bound", {
                    workingDirectory: "/elsewhere",
                    startedAtMs: NOW_MS - 30 * DAY_MS,
                }),
            ],
        );

        const decision = await router.route(message);

        expect(decision.action).toBe("deliver");
    });
});
