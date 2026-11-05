import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
    SlackSocketConnection,
    type SlackEventSilence,
} from "../src/slack/SlackSocketConnection";
import { FakeSlackServer } from "./fakeSlackServer";

/** SocketModeClient 의 재연결 지연이 수 초라 그보다 길게 잡습니다. */
const WAIT_TIMEOUT_MS = 15_000;

let server: FakeSlackServer;
let onConnectionLost: ReturnType<typeof vi.fn<(error: Error) => void>>;
let onDiagnostic: ReturnType<typeof vi.fn<(message: string) => void>>;
let connection: SlackSocketConnection;

beforeEach(async () => {
    server = new FakeSlackServer();
    await server.start();

    onConnectionLost = vi.fn();
    onDiagnostic = vi.fn();
    connection = new SlackSocketConnection({
        appToken: "xapp-test",
        slackApiUrl: server.apiUrl,
        classifyEvent: ({ user }) =>
            user === "UALLOWED" ? "mentions" : undefined,
        onEvent: () => {},
        onError: () => {},
        onConnectionLost,
        onDiagnostic,
        onEventSilence: () => {},
        reconnectTimeoutMs: 100,
    });
    await connection.start();
});

afterEach(async () => {
    await connection.stop();
    await server.stop();
});

describe("이벤트 끊김 감지", () => {
    const SILENCE_TIMEOUT_MS = 200;
    let onEventSilence: ReturnType<
        typeof vi.fn<(silence: SlackEventSilence) => void>
    >;
    let silenceConnection: SlackSocketConnection;

    async function connectWithSilenceTimeout(silenceRepeatIntervalMs = 60_000) {
        onEventSilence = vi.fn();
        silenceConnection = new SlackSocketConnection({
            appToken: "xapp-test",
            slackApiUrl: server.apiUrl,
            classifyEvent: () => undefined,
            onEvent: () => {},
            onError: () => {},
            onConnectionLost: () => {},
            onDiagnostic: () => {},
            onEventSilence,
            silenceTimeoutMs: SILENCE_TIMEOUT_MS,
            silenceRepeatIntervalMs,
        });
        await silenceConnection.start();
    }

    const wait = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));

    afterEach(() => silenceConnection.stop());

    test("연결된 채 이벤트가 없으면 앱 ID 와 함께 알린다", async () => {
        await connectWithSilenceTimeout();

        await vi.waitFor(() => expect(onEventSilence).toHaveBeenCalledOnce());

        const [{ silentMs, appId }] = onEventSilence.mock.calls[0];
        expect(appId).toBe("AFAKE");
        expect(silentMs).toBeGreaterThanOrEqual(SILENCE_TIMEOUT_MS);
    });

    test("필터에 걸러지는 이벤트도 들어오는 동안에는 알리지 않는다", async () => {
        await connectWithSilenceTimeout();

        for (let eventIndex = 0; eventIndex < 8; eventIndex++) {
            server.sendEvent(`EvBusy${eventIndex}`, { type: "message" });
            await wait(50);
        }

        expect(onEventSilence).not.toHaveBeenCalled();
    });

    test("끊김이 이어지면 반복 간격마다 다시 알린다", async () => {
        await connectWithSilenceTimeout(SILENCE_TIMEOUT_MS);

        await vi.waitFor(() =>
            expect(onEventSilence.mock.calls.length).toBeGreaterThanOrEqual(2),
        );
    });

    test("닫은 뒤에는 알리지 않는다", async () => {
        await connectWithSilenceTimeout();
        await silenceConnection.stop();

        await wait(SILENCE_TIMEOUT_MS * 2);

        expect(onEventSilence).not.toHaveBeenCalled();
    });
});

describe("SlackSocketConnection", () => {
    test("연결된 앱 ID 와 필터를 통과한 이벤트만 본문 없이 남긴다", async () => {
        const event = { type: "message", channel: "C1", text: "비밀 본문" };
        server.sendEvent("Ev1", { ...event, user: "UALLOWED" });
        server.sendEvent("Ev1", { ...event, user: "UALLOWED" });
        const filteredEnvelopeId = server.sendEvent("Ev2", {
            ...event,
            user: "USTRANGER",
        });

        await vi.waitFor(() =>
            expect(server.acknowledgedEnvelopeIds).toContain(
                filteredEnvelopeId,
            ),
        );

        const messages = onDiagnostic.mock.calls.map(([message]) => message);
        expect(messages).toHaveLength(3);
        expect(messages[0]).toContain("app_id=AFAKE num_connections=1");
        expect(messages[1]).toContain("outcome=passed event_id=Ev1");
        expect(messages[1]).toContain("source=mentions");
        expect(messages[2]).toContain("outcome=duplicate event_id=Ev1");
        expect(messages.join()).not.toContain("Ev2");
        expect(messages.join()).not.toContain("비밀 본문");
    });

    test(
        "제한 시간 안에 재연결하지 못하면 알리고 정상적으로 닫힌다",
        async () => {
            server.connectionOpenError = "internal_error";
            server.requestReconnect();

            await vi.waitFor(
                () => expect(onConnectionLost).toHaveBeenCalled(),
                {
                    timeout: WAIT_TIMEOUT_MS,
                },
            );
        },
        WAIT_TIMEOUT_MS + 5000,
    );

    test(
        "재연결에 성공하면 알리지 않는다",
        async () => {
            server.requestReconnect();

            await vi.waitFor(() => expect(server.connectionCount).toBe(2), {
                timeout: WAIT_TIMEOUT_MS,
            });
            await new Promise((resolve) => setTimeout(resolve, 300));

            expect(onConnectionLost).not.toHaveBeenCalled();
        },
        WAIT_TIMEOUT_MS + 5000,
    );
});
