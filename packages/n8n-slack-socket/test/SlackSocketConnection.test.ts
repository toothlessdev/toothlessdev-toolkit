import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { SlackSocketConnection } from "../src/slack/SlackSocketConnection";
import { FakeSlackServer } from "./fakeSlackServer";

/** SocketModeClient 의 재연결 지연이 수 초라 그보다 길게 잡습니다. */
const WAIT_TIMEOUT_MS = 15_000;

let server: FakeSlackServer;
let onConnectionLost: ReturnType<typeof vi.fn<(error: Error) => void>>;
let connection: SlackSocketConnection;

beforeEach(async () => {
    server = new FakeSlackServer();
    await server.start();

    onConnectionLost = vi.fn();
    connection = new SlackSocketConnection({
        appToken: "xapp-test",
        filter: { eventTypes: new Set(), allowedSenderIds: new Set() },
        slackApiUrl: server.apiUrl,
        onEvent: () => {},
        onError: () => {},
        onConnectionLost,
        reconnectTimeoutMs: 100,
    });
    await connection.start();
});

afterEach(async () => {
    await connection.stop();
    await server.stop();
});

describe("SlackSocketConnection", () => {
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
