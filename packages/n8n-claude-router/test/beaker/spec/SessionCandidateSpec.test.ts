import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import type { ClaudeSession } from "claude-cli";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { ConversationBindingRule } from "../../../src/routing/ConversationBindingRule";
import { SessionMatchRule } from "../../../src/routing/SessionMatchRule";
import { SessionRouter } from "../../../src/routing/SessionRouter";
import { ConversationSessionStore } from "../../../src/store/ConversationSessionStore";

const NOW_MS = 1_000_000_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WORKING_DIRECTORY = "/w";

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

const criteria = {
    workingDirectory: WORKING_DIRECTORY,
    maxCandidates: 20,
    maxAgeMs: 7 * DAY_MS,
    nowMs: () => NOW_MS,
};
const alwaysHighMatcher = {
    match: async () => ({
        sessionId: "S-X",
        confidence: "high" as const,
        reason: "항상",
    }),
};
const message = { text: "hello", source: "slack", conversationKey: "K1" };

let directory: string;
let store: ConversationSessionStore;

beforeEach(() => {
    directory = mkdtempSync(path.join(tmpdir(), "claude-router-beaker-"));
    store = new ConversationSessionStore(path.join(directory, "store.json"));
});

afterEach(() => rmSync(directory, { recursive: true, force: true }));

function createMatchRouter(sessions: ClaudeSession[]) {
    return new SessionRouter(
        [new SessionMatchRule(alwaysHighMatcher, criteria)],
        async () => sessions,
    );
}

describe("후보 세션 선정 (specification)", () => {
    // beaker:case BB-1
    test("BB-1 · 후보가 없으면 새 세션이다", async () => {
        const decision = await createMatchRouter([]).route(message);

        expect(decision.action).toBe("new");
    });

    // beaker:case BB-2
    test("BB-2 · 작업 폴더가 다른 세션은 후보가 아니라 새 세션이다", async () => {
        const decision = await createMatchRouter([
            session("S-A", {
                workingDirectory: "/other",
                startedAtMs: NOW_MS,
            }),
        ]).route(message);

        expect(decision.action).toBe("new");
    });

    // beaker:case BB-3
    test("BB-3 · 8일 전 세션은 후보에서 제외되어 새 세션이다", async () => {
        const decision = await createMatchRouter([
            session("S-A", { startedAtMs: NOW_MS - 8 * DAY_MS }),
        ]).route(message);

        expect(decision.action).toBe("new");
    });

    // beaker:case BB-4
    test("BB-4 · 연결 기록이 없는 키는 대화 연결 규칙이 판정하지 않아 새 세션이다", async () => {
        const router = new SessionRouter(
            [
                new ConversationBindingRule(store),
                new SessionMatchRule(alwaysHighMatcher, criteria),
            ],
            async () => [],
        );

        const decision = await router.route(message);

        expect(decision.action).toBe("new");
    });
});
