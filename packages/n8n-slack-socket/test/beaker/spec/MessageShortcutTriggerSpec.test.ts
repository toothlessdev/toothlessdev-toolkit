import type { ITriggerFunctions, ITriggerResponse } from "n8n-workflow";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { SlackSocketTrigger } from "../../../src/nodes/SlackSocketTrigger/SlackSocketTrigger.node";
import { FakeSlackServer } from "../../fakeSlackServer";

let server: FakeSlackServer;
let emit: ReturnType<typeof vi.fn>;
let responses: ITriggerResponse[];

function createTriggerFunctions(parameters: Record<string, string>) {
    return {
        getCredentials: async () => ({ appToken: "xapp-test" }),
        getNodeParameter: (name: string, fallback?: string) =>
            parameters[name] ?? fallback,
        getWorkflow: () => ({ id: "workflow-1" }),
        emit,
        helpers: {
            returnJsonArray: (items: object[]) =>
                items.map((json) => ({ json })),
        },
        logger: { error: vi.fn(), info: vi.fn() },
    } as unknown as ITriggerFunctions;
}

async function activate(parameters: Record<string, string>) {
    const response = await new SlackSocketTrigger().trigger.call(
        createTriggerFunctions(parameters),
    );
    responses.push(response);

    return response;
}

function emittedItems() {
    return emit.mock.calls.flatMap(([output]) => output[0]);
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 150));

function shortcutFrom(userId: string) {
    return {
        type: "message_action",
        callback_id: "cb1",
        trigger_id: "t1",
        team: { id: "T1" },
        user: { id: userId },
        channel: { id: "C1" },
        message: { type: "message", user: "U9", text: "hi" },
    };
}

function parameters(allowedUserIds: string) {
    return { source: "messageShortcut", callbackId: "cb1", allowedUserIds };
}

beforeEach(async () => {
    server = new FakeSlackServer();
    await server.start();
    vi.stubEnv("N8N_SLACK_SOCKET_API_URL", server.apiUrl);

    emit = vi.fn();
    responses = [];
});

afterEach(async () => {
    await Promise.all(responses.map((response) => response.closeFunction?.()));
    await server.stop();
    vi.unstubAllEnvs();
});

describe("메시지 단축키 트리거 (specification)", () => {
    async function sendAllowedShortcut() {
        await activate(parameters("U1,U3"));
        server.sendMessageShortcut(shortcutFrom("U1"));
        await vi.waitFor(() => expect(emit).toHaveBeenCalledOnce());
    }

    // beaker:case BB-10
    test("BB-10 · 통과하면 항목 하나가 나오고 원본 text 가 보존된다", async () => {
        await sendAllowedShortcut();

        expect(emittedItems()).toHaveLength(1);
        expect(emittedItems()[0].json.text).toBe("hi");
    });

    // beaker:case BB-11
    test("BB-11 · channel 이 C1 로 추가된다", async () => {
        await sendAllowedShortcut();

        expect(emittedItems()[0].json.channel).toBe("C1");
    });

    // beaker:case BB-12
    test("BB-12 · triggeredBy 는 단축키를 누른 사용자 U1 이다", async () => {
        await sendAllowedShortcut();

        expect(emittedItems()[0].json.triggeredBy).toBe("U1");
    });

    // beaker:case BB-13
    test("BB-13 · callbackId 가 cb1 로 추가된다", async () => {
        await sendAllowedShortcut();

        expect(emittedItems()[0].json.callbackId).toBe("cb1");
    });

    // beaker:case BB-14
    test("BB-14 · teamId 가 T1 로 추가된다", async () => {
        await sendAllowedShortcut();

        expect(emittedItems()[0].json.teamId).toBe("T1");
    });

    // beaker:case BB-15
    test("BB-15 · 허용되지 않은 사용자는 항목을 내보내지 못한다", async () => {
        await activate(parameters("U1,U3"));
        const envelopeId = server.sendMessageShortcut(shortcutFrom("U2"));
        await vi.waitFor(() =>
            expect(server.acknowledgedEnvelopeIds).toContain(envelopeId),
        );
        await settle();

        expect(emittedItems()).toHaveLength(0);
    });

    // beaker:case BB-16
    test("BB-16 · Allowed User IDs 가 비면 항목을 내보내지 못한다", async () => {
        await activate(parameters(""));
        const envelopeId = server.sendMessageShortcut(shortcutFrom("U1"));
        await vi.waitFor(() =>
            expect(server.acknowledgedEnvelopeIds).toContain(envelopeId),
        );
        await settle();

        expect(emittedItems()).toHaveLength(0);
    });
});
