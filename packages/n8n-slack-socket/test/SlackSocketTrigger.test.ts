import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ITriggerFunctions, ITriggerResponse } from "n8n-workflow";

import { SlackSocketTrigger } from "../src/nodes/SlackSocketTrigger/SlackSocketTrigger.node";
import { FakeSlackServer } from "./fakeSlackServer";

const OWNER = "UOWNER";
const mention = {
    type: "message",
    user: "UALLOWED",
    text: `<@${OWNER}> 확인`,
    channel: "C1",
    ts: "1.2",
};

const defaultParameters = {
    eventTypes: "message",
    mentionedUserId: OWNER,
    allowedSenderIds: "UALLOWED",
};

let server: FakeSlackServer;
let emit: ReturnType<typeof vi.fn>;
let logError: ReturnType<typeof vi.fn>;
let response: ITriggerResponse | undefined;

function createTriggerFunctions(parameters: Record<string, string>) {
    return {
        getCredentials: async () => ({ appToken: "xapp-test" }),
        getNodeParameter: (name: string) => parameters[name],
        emit,
        helpers: {
            returnJsonArray: (items: object[]) =>
                items.map((json) => ({ json })),
        },
        logger: { error: logError },
    } as unknown as ITriggerFunctions;
}

async function activate(parameters = defaultParameters) {
    response = await new SlackSocketTrigger().trigger.call(
        createTriggerFunctions(parameters),
    );
}

function emittedItems() {
    return emit.mock.calls.map(([output]) => output[0][0].json);
}

beforeEach(async () => {
    server = new FakeSlackServer();
    await server.start();
    vi.stubEnv("N8N_SLACK_SOCKET_API_URL", server.apiUrl);

    emit = vi.fn();
    logError = vi.fn();
    response = undefined;
});

afterEach(async () => {
    await response?.closeFunction?.();
    await server.stop();
    vi.unstubAllEnvs();
});

describe("SlackSocketTrigger", () => {
    test("조건에 맞는 이벤트를 워크플로로 보내고 ack 한다", async () => {
        await activate();
        const envelopeId = server.sendEvent("Ev1", mention);

        await vi.waitFor(() => expect(emit).toHaveBeenCalledOnce());
        expect(emittedItems()[0]).toEqual({
            ...mention,
            eventId: "Ev1",
            teamId: "T1",
        });
        await vi.waitFor(() =>
            expect(server.acknowledgedEnvelopeIds).toContain(envelopeId),
        );
    });

    test("조건에 안 맞는 이벤트도 ack 하되 워크플로로 보내지 않는다", async () => {
        await activate();
        const envelopeId = server.sendEvent("Ev1", {
            ...mention,
            user: "USTRANGER",
        });

        await vi.waitFor(() =>
            expect(server.acknowledgedEnvelopeIds).toContain(envelopeId),
        );
        expect(emit).not.toHaveBeenCalled();
    });

    test("같은 event_id 는 한 번만 보낸다", async () => {
        await activate();
        server.sendEvent("Ev1", mention);
        const retriedEnvelopeId = server.sendEvent("Ev1", mention);

        await vi.waitFor(() =>
            expect(server.acknowledgedEnvelopeIds).toContain(retriedEnvelopeId),
        );
        expect(emit).toHaveBeenCalledOnce();
    });

    test("events_api 가 아닌 메시지는 ack 만 한다", async () => {
        await activate();
        const envelopeId = server.sendEnvelope({
            type: "slash_commands",
            payload: { command: "/x" },
        });

        await vi.waitFor(() =>
            expect(server.acknowledgedEnvelopeIds).toContain(envelopeId),
        );
        expect(emit).not.toHaveBeenCalled();
    });

    test("Slack 이 연결 교체를 요청하면 다시 연결해 계속 받는다", async () => {
        await activate();
        server.requestReconnect();

        await vi.waitFor(() => expect(server.connectionCount).toBe(2), {
            timeout: 10_000,
        });
        server.sendEvent("Ev2", mention);

        await vi.waitFor(() => expect(emit).toHaveBeenCalledOnce());
    }, 15_000);

    test("토큰이 잘못되면 활성화에 실패한다", async () => {
        server.connectionOpenError = "invalid_auth";

        await expect(activate()).rejects.toThrow("invalid_auth");
    });

    test("닫으면 재연결하지 않고 이벤트를 받지 않는다", async () => {
        await activate();
        await response?.closeFunction?.();
        response = undefined;

        server.sendEvent("Ev3", mention);

        await new Promise((resolve) => setTimeout(resolve, 200));
        expect(emit).not.toHaveBeenCalled();
        expect(server.connectionCount).toBe(1);
    });
});
