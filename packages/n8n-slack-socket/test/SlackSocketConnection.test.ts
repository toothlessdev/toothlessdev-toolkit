import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { SlackSocketConnection } from "../src/slack/SlackSocketConnection";
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
        reconnectTimeoutMs: 100,
    });
    await connection.start();
});

afterEach(async () => {
    await connection.stop();
    await server.stop();
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
