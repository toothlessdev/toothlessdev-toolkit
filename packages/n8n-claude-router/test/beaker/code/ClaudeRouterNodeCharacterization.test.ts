import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { listClaudeSessions, type ClaudeSession } from "claude-cli";
import { NodeOperationError } from "n8n-workflow";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ClaudeRouter } from "../../../src/nodes/ClaudeRouter/ClaudeRouter.node";

const { runMock } = vi.hoisted(() => ({ runMock: vi.fn() }));

vi.mock("claude-cli", async (importOriginal) => ({
    ...(await importOriginal<typeof import("claude-cli")>()),
    listClaudeSessions: vi.fn(),
    ClaudeCli: class {
        run = runMock;
    },
}));

const DAY_MS = 24 * 60 * 60 * 1000;
const WORKING_DIRECTORY = "/work";
const listSessionsMock = vi.mocked(listClaudeSessions);

function session(id: string, overrides: Partial<ClaudeSession> = {}) {
    return {
        sessionId: id,
        backgroundId: id.slice(0, 8),
        name: `세션 ${id}`,
        intent: "",
        workingDirectory: WORKING_DIRECTORY,
        isBackground: true,
        startedAtMs: Date.now() - 1000,
        pid: 100,
        ...overrides,
    } satisfies ClaudeSession;
}

function matcherSelects(sessionId: string) {
    runMock.mockResolvedValue({
        result: "",
        sessionId: "",
        deniedTools: [],
        structuredOutput: { sessionId, confidence: "high", reason: "시험" },
    });
}

let directory: string;

beforeEach(() => {
    directory = mkdtempSync(path.join(tmpdir(), "claude-router-node-"));
    listSessionsMock.mockReset();
    runMock.mockReset();
});

afterEach(() => rmSync(directory, { recursive: true, force: true }));

function execute(
    parameters: Record<string, unknown>,
    shouldContinueOnFail = false,
) {
    const options = {
        ...(parameters.options as Record<string, unknown> | undefined),
        storePath: path.join(directory, "store.json"),
    };
    const allParameters: Record<string, unknown> = { ...parameters, options };
    const context = {
        getInputData: () => [{ json: {} }],
        getNodeParameter: (name: string, _index: number, fallback?: unknown) =>
            allParameters[name] ?? fallback,
        getExecutionCancelSignal: () => undefined,
        continueOnFail: () => shouldContinueOnFail,
        getNode: () => ({ name: "Claude Router", type: "claudeRouter" }),
        logger: { info: vi.fn() },
    };

    return new ClaudeRouter().execute.call(context as never) as Promise<
        { json: Record<string, any> }[][]
    >;
}

const routeParameters = {
    operation: "route",
    messageText: "질문",
    workingDirectory: WORKING_DIRECTORY,
    conversationKey: "k",
};

describe("ClaudeRouter 노드 (code)", () => {
    // beaker:case WB-107
    test("WB-107 · (characterization) action=new 이면 routing.sessionId 는 빈 문자열이다", async () => {
        listSessionsMock.mockResolvedValue([]);

        const output = await execute({ ...routeParameters, options: {} });

        expect(output[0][0].json.routing.sessionId).toBe("");
    });

    // beaker:case WB-108
    test("WB-108 · (characterization) action=resume 이면 routing.sessionId 에 고른 세션 ID 가 들어간다", async () => {
        listSessionsMock.mockResolvedValue([
            session("ended", { pid: undefined }),
        ]);
        matcherSelects("ended");

        const output = await execute({
            ...routeParameters,
            options: { shouldIncludeEndedSessions: true },
        });

        expect(output[0][0].json.routing.sessionId).toBe("ended");
    });

    // beaker:case WB-109
    test("WB-109 · (characterization) remember 는 store 에 저장하고 {conversationKey, sessionId} 를 돌려준다. operation 이 'unknown' 이어도 같은 결과", async () => {
        const parameters = {
            conversationKey: "slack:C1:1.2",
            sessionId: "s1",
            options: {},
        };
        const expected = { conversationKey: "slack:C1:1.2", sessionId: "s1" };

        const remembered = await execute({
            ...parameters,
            operation: "remember",
        });
        const unknown = await execute({ ...parameters, operation: "unknown" });

        expect(remembered[0][0].json.routing).toEqual(expected);
        expect(unknown[0][0].json.routing).toEqual(expected);
    });

    // beaker:case WB-110
    test("WB-110 · (characterization) continueOnFail 이 켜져 있으면 오류 메시지를 json.error 로 내고 던지지 않는다", async () => {
        listSessionsMock.mockRejectedValue(new Error("mock 오류 메시지"));

        const output = await execute({ operation: "route", options: {} }, true);

        expect(output[0][0].json.error).toBe("mock 오류 메시지");
    });

    // beaker:case WB-111
    test("WB-111 · (characterization) continueOnFail 이 꺼져 있으면 NodeOperationError 로 던진다", async () => {
        listSessionsMock.mockRejectedValue(new Error("mock 오류 메시지"));

        const execution = execute({ operation: "route", options: {} }, false);

        await expect(execution).rejects.toBeInstanceOf(NodeOperationError);
        await expect(execution).rejects.toThrow("mock 오류 메시지");
    });

    // beaker:case WB-112
    test("WB-112 · (characterization) candidateMaxAgeDays=2 이면 3일 전 세션은 후보가 아니라 new 가 된다", async () => {
        listSessionsMock.mockResolvedValue([
            session("old", { startedAtMs: Date.now() - 3 * DAY_MS }),
        ]);
        matcherSelects("old");

        const output = await execute({
            operation: "route",
            messageText: "질문",
            workingDirectory: WORKING_DIRECTORY,
            options: { candidateMaxAgeDays: 2 },
        });

        expect(output[0][0].json.routing.action).toBe("new");
    });

    // beaker:case WB-113
    test("WB-113 · (characterization) Include Ended Sessions 옵션이 켜지면 끝난 세션이 resume 으로 라우팅된다", async () => {
        listSessionsMock.mockResolvedValue([
            session("ended", { pid: undefined }),
        ]);
        matcherSelects("ended");

        const output = await execute({
            operation: "route",
            messageText: "질문",
            workingDirectory: WORKING_DIRECTORY,
            options: { shouldIncludeEndedSessions: true },
        });

        expect(output[0][0].json.routing.action).toBe("resume");
    });
});
