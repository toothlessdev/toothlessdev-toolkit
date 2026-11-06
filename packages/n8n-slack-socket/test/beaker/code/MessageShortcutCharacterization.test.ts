import type { ITriggerFunctions, ITriggerResponse } from "n8n-workflow";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { SlackSocketTrigger } from "../../../src/nodes/SlackSocketTrigger/SlackSocketTrigger.node";
import { SlackSocketConnection } from "../../../src/slack/SlackSocketConnection";
import { FakeSlackServer } from "../../fakeSlackServer";

const OWNER = "UOWNER";
const WAIT_TIMEOUT_MS = 15_000;

const shortcutParameters = {
    source: "messageShortcut",
    callbackId: "start_session",
    allowedUserIds: OWNER,
};
const mentionParameters: Record<string, string> = {
    source: "mentions",
    mentionedUserId: OWNER,
    mentionedUserGroupIds: "SGROUP",
    allowedSenderIds: "UALLOWED",
};
const shortcut = {
    type: "message_action",
    callback_id: "start_session",
    trigger_id: "trigger-1",
    team: { id: "T1" },
    user: { id: OWNER },
    channel: { id: "C1", name: "general" },
    message: {
        type: "message",
        user: "UOTHER",
        text: "본문",
        ts: "1.2",
        thread_ts: "1.0",
    },
};

let server: FakeSlackServer;
let emit: ReturnType<typeof vi.fn>;
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
        logger: { error: vi.fn(), info: vi.fn() },
    } as unknown as ITriggerFunctions;
}

async function activate(parameters: Record<string, string>, emitTo = emit) {
    const response = await new SlackSocketTrigger().trigger.call(
        createTriggerFunctions(parameters, emitTo),
    );
    responses.push(response);

    return response;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 150));

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

describe("SlackSocketTrigger 메시지 단축키 (code)", () => {
    // beaker:case WB-114
    test("WB-114 · (characterization) Callback ID 설정의 앞뒤 공백은 제거되어 일치한다", async () => {
        await activate({
            ...shortcutParameters,
            callbackId: " start_session ",
        });
        server.sendMessageShortcut(shortcut);

        await vi.waitFor(() => expect(emit).toHaveBeenCalled());
        await settle();

        expect(emit.mock.calls.length).toBe(1);
    });

    // beaker:case WB-115
    test("WB-115 · (characterization) 공백과 빈 항목이 섞인 허용 목록에서도 UOWNER 는 허용된다", async () => {
        await activate({
            ...shortcutParameters,
            allowedUserIds: "UX, ,UOWNER ,",
        });
        server.sendMessageShortcut(shortcut);

        await vi.waitFor(() => expect(emit).toHaveBeenCalled());
        await settle();

        expect(emit.mock.calls.length).toBe(1);
    });

    // beaker:case WB-116
    test("WB-116 · (characterization) 공백과 쉼표만 있는 허용 목록은 아무도 실행할 수 없다", async () => {
        await activate({ ...shortcutParameters, allowedUserIds: " , " });
        const envelopeId = server.sendMessageShortcut(shortcut);
        await vi.waitFor(() =>
            expect(server.acknowledgedEnvelopeIds).toContain(envelopeId),
        );
        await settle();

        expect(emit.mock.calls.length).toBe(0);
    });

    // beaker:case WB-117
    test("WB-117 · (characterization) team 이 없으면 teamId 는 undefined 이다", async () => {
        const { team: _team, ...withoutTeam } = shortcut;
        await activate(shortcutParameters);
        server.sendMessageShortcut(withoutTeam);

        await vi.waitFor(() => expect(emit).toHaveBeenCalledOnce());

        expect(emit.mock.calls[0][0][0][0].json.teamId).toBeUndefined();
    });

    // beaker:case WB-118
    test("WB-118 · (characterization) 출력 channel 은 payload 의 channel.id 이고 원본 메시지의 channel 은 덮어써진다", async () => {
        await activate(shortcutParameters);
        server.sendMessageShortcut({
            ...shortcut,
            message: { ...shortcut.message, channel: "CX" },
            channel: { id: "C1" },
        });

        await vi.waitFor(() => expect(emit).toHaveBeenCalledOnce());

        expect(emit.mock.calls[0][0][0][0].json.channel).toBe("C1");
    });

    // beaker:case WB-119
    test("WB-119 · (characterization) message_action 이 아닌 interactive payload 는 워크플로로 emit 되지 않는다", async () => {
        await activate(shortcutParameters);
        server.sendMessageShortcut({ type: "block_actions" });
        await settle();

        expect(emit.mock.calls.length).toBe(0);
    });

    // beaker:case WB-124
    test("WB-124 · (characterization) 빈 Callback ID 설정은 빈 callback_id 를 가진 payload 와 일치해 emit 된다", async () => {
        await activate({ ...shortcutParameters, callbackId: "" });
        server.sendMessageShortcut({ ...shortcut, callback_id: "" });

        await vi.waitFor(() => expect(emit).toHaveBeenCalled());
        await settle();

        expect(emit.mock.calls.length).toBe(1);
    });
});

describe("SharedSlackSocket 구독자 분리 (code)", () => {
    // beaker:case WB-120
    test("WB-120 · (characterization) callbackId 가 맞는 구독자만 emit 하고 다른 callbackId 구독자는 받지 않는다", async () => {
        const emitToOther = vi.fn();
        await activate(shortcutParameters);
        await activate(
            { ...shortcutParameters, callbackId: "other" },
            emitToOther,
        );
        server.sendMessageShortcut(shortcut);

        await vi.waitFor(() => expect(emit).toHaveBeenCalledOnce());
        await settle();

        expect(emitToOther.mock.calls.length).toBe(0);
    });

    // beaker:case WB-121
    test("WB-121 · (characterization) 같은 callbackId/허용 사용자의 구독자는 모두 한 번씩 받는다", async () => {
        const emitToTestRun = vi.fn();
        await activate(shortcutParameters);
        await activate(shortcutParameters, emitToTestRun);
        server.sendMessageShortcut(shortcut);

        await vi.waitFor(() => {
            expect(emit).toHaveBeenCalled();
            expect(emitToTestRun).toHaveBeenCalled();
        });
        await settle();

        expect(emit.mock.calls.length + emitToTestRun.mock.calls.length).toBe(
            2,
        );
    });

    // beaker:case WB-122
    test("WB-122 · (characterization) messageShortcut 이 아닌 구독자는 단축키 payload 를 받지 않는다", async () => {
        const emitToMentions = vi.fn();
        await activate(mentionParameters, emitToMentions);
        await activate(shortcutParameters);
        server.sendMessageShortcut(shortcut);

        await vi.waitFor(() => expect(emit).toHaveBeenCalledOnce());
        await settle();

        expect(emitToMentions.mock.calls.length).toBe(0);
    });
});

describe("SlackSocketConnection 중복 제거 (code)", () => {
    // beaker:case WB-123
    test(
        "WB-123 · (characterization) 1000개를 넘으면 가장 오래된 trigger_id 는 잊혀 재전송 시 다시 전달된다",
        async () => {
            const onMessageShortcut = vi.fn();
            const connection = new SlackSocketConnection({
                appToken: "xapp-test",
                slackApiUrl: server.apiUrl,
                classifyEvent: () => undefined,
                onEvent: () => {},
                onError: () => {},
                onConnectionLost: () => {},
                onDiagnostic: () => {},
                onEventSilence: () => {},
                onMessageShortcut,
            });
            await connection.start();

            try {
                for (let index = 0; index <= 1000; index++) {
                    server.sendMessageShortcut({
                        ...shortcut,
                        trigger_id: `t${index}`,
                    });
                }
                const resentEnvelopeId = server.sendMessageShortcut({
                    ...shortcut,
                    trigger_id: "t0",
                });
                await vi.waitFor(
                    () =>
                        expect(server.acknowledgedEnvelopeIds).toContain(
                            resentEnvelopeId,
                        ),
                    { timeout: WAIT_TIMEOUT_MS },
                );
                await settle();

                expect(onMessageShortcut.mock.calls.length).toBe(1002);
            } finally {
                await connection.stop();
            }
        },
        WAIT_TIMEOUT_MS + 5000,
    );
});
