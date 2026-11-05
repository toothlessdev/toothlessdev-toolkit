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

const defaultParameters: Record<string, string> = {
    source: "mentions",
    mentionedUserId: OWNER,
    mentionedUserGroupIds: "SGROUP",
    allowedSenderIds: "UALLOWED",
};
const botParameters = {
    source: "botMessages",
    allowedBotIds: "BGRAFANA",
    channelIds: "CALERT",
};
const channelParameters = {
    source: "channelMessages",
    channelIds: "CFULL",
    allowedSenderIds: "",
};
const grafanaAlert = {
    type: "message",
    user: "UGRAFANABOT",
    bot_id: "BGRAFANA",
    text: "",
    channel: "CALERT",
    attachments: [{ title: "[FIRING:1] 결제", text: "Value: F=97" }],
};

let server: FakeSlackServer;
let emit: ReturnType<typeof vi.fn>;
let logError: ReturnType<typeof vi.fn>;
let responses: ITriggerResponse[];

function createTriggerFunctions(
    parameters: Record<string, string>,
    emitToWorkflow: typeof emit,
) {
    return {
        getCredentials: async () => ({ appToken: "xapp-test" }),
        getNodeParameter: (name: string, fallback?: string) =>
            parameters[name] ?? fallback,
        getWorkflow: () => ({ id: "workflow-1" }),
        emit: emitToWorkflow,
        helpers: {
            returnJsonArray: (items: object[]) =>
                items.map((json) => ({ json })),
        },
        logger: { error: logError, info: vi.fn() },
    } as unknown as ITriggerFunctions;
}

async function activate(parameters = defaultParameters, emitTo = emit) {
    const response = await new SlackSocketTrigger().trigger.call(
        createTriggerFunctions(parameters, emitTo),
    );
    responses.push(response);

    return response;
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
    responses = [];
});

afterEach(async () => {
    await Promise.all(responses.map((response) => response.closeFunction?.()));
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

    test("source 가 저장되지 않아도 Mentions 로 동작한다", async () => {
        const { source: _source, ...withoutSource } = defaultParameters;
        await activate(withoutSource);
        server.sendEvent("EvNoSource", mention);

        await vi.waitFor(() => expect(emit).toHaveBeenCalledOnce());
    });

    test("설정한 사용자 그룹을 멘션한 이벤트도 워크플로로 보낸다", async () => {
        await activate();
        server.sendEvent("EvGroup", {
            ...mention,
            text: "<!subteam^SGROUP|@team> 확인",
        });

        await vi.waitFor(() => expect(emit).toHaveBeenCalledOnce());
    });

    test("Bot Messages 는 attachments 내용을 text 에 합쳐 보낸다", async () => {
        await activate(botParameters);
        server.sendEvent("EvGrafana", grafanaAlert);

        await vi.waitFor(() => expect(emit).toHaveBeenCalledOnce());
        expect(emittedItems()[0].text).toBe("[FIRING:1] 결제\nValue: F=97");
    });

    test("Channel Messages 는 지정 채널의 사람 메시지를 멘션 없이 보낸다", async () => {
        await activate(channelParameters);
        server.sendEvent("EvFull", {
            ...mention,
            text: "멘션 없는 메시지",
            channel: "CFULL",
        });

        await vi.waitFor(() => expect(emit).toHaveBeenCalledOnce());
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
        const response = await activate();
        await response.closeFunction?.();
        responses = [];

        server.sendEvent("Ev3", mention);

        await new Promise((resolve) => setTimeout(resolve, 200));
        expect(emit).not.toHaveBeenCalled();
        expect(server.connectionCount).toBe(1);
    });

    describe("여러 소스 노드", () => {
        let emitToBots: ReturnType<typeof vi.fn>;
        let emitToChannel: ReturnType<typeof vi.fn>;

        beforeEach(() => {
            emitToBots = vi.fn();
            emitToChannel = vi.fn();
        });

        test("소켓 연결을 하나만 열고 이벤트를 소스별로 나눈다", async () => {
            await Promise.all([
                activate(defaultParameters),
                activate(botParameters, emitToBots),
            ]);
            expect(server.connectionCount).toBe(1);

            server.sendEvent("EvMention", mention);
            server.sendEvent("EvAlert", grafanaAlert);

            await vi.waitFor(() => {
                expect(emit).toHaveBeenCalledOnce();
                expect(emitToBots).toHaveBeenCalledOnce();
            });
        });

        test("지정 채널의 멘션은 Mentions 에만 보낸다", async () => {
            await activate(defaultParameters);
            await activate(channelParameters, emitToChannel);

            const envelopeId = server.sendEvent("EvBoth", {
                ...mention,
                channel: "CFULL",
            });

            await vi.waitFor(() =>
                expect(server.acknowledgedEnvelopeIds).toContain(envelopeId),
            );
            await vi.waitFor(() => expect(emit).toHaveBeenCalledOnce());
            expect(emitToChannel).not.toHaveBeenCalled();
        });

        test("같은 소스 노드가 둘이면 둘 다 받는다", async () => {
            const emitToTestRun = vi.fn();
            await activate(defaultParameters);
            await activate(defaultParameters, emitToTestRun);

            server.sendEvent("EvShared", mention);

            await vi.waitFor(() => {
                expect(emit).toHaveBeenCalledOnce();
                expect(emitToTestRun).toHaveBeenCalledOnce();
            });
        });

        test("한 노드를 닫아도 다른 노드는 계속 받고 마지막에 연결을 닫는다", async () => {
            const mentionResponse = await activate(defaultParameters);
            const botResponse = await activate(botParameters, emitToBots);
            responses = [];

            await mentionResponse.closeFunction?.();
            server.sendEvent("EvAfterClose", grafanaAlert);
            await vi.waitFor(() => expect(emitToBots).toHaveBeenCalledOnce());
            expect(server.connectionCount).toBe(1);

            await botResponse.closeFunction?.();
            const reopened = await activate(defaultParameters);
            expect(server.connectionCount).toBe(2);
            await reopened.closeFunction?.();
            responses = [];
        });
    });
});
