import { randomUUID } from "node:crypto";
import { createServer, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import { WebSocket, WebSocketServer } from "ws";

interface Envelope {
    readonly type: string;
    readonly payload: unknown;
}

/** apps.connections.open 과 Socket Mode WebSocket 만 흉내 내는 로컬 서버입니다. */
export class FakeSlackServer {
    connectionOpenError: string | null = null;
    connectionCount = 0;
    openConnectionCount = 0;
    readonly acknowledgedEnvelopeIds: string[] = [];

    private readonly webSocketServer = new WebSocketServer({ noServer: true });
    private readonly httpServer: Server;
    private socket: WebSocket | null = null;
    private isHoldingConnectionOpen = false;
    private readonly heldConnectionOpens: Array<{
        readonly requestUrl: string | undefined;
        readonly response: ServerResponse;
    }> = [];

    constructor() {
        this.httpServer = createServer((request, response) => {
            if (this.isHoldingConnectionOpen) {
                this.heldConnectionOpens.push({
                    requestUrl: request.url,
                    response,
                });
                return;
            }

            this.respondToConnectionOpen(request.url, response);
        });

        this.httpServer.on("upgrade", (request, socket, head) => {
            this.webSocketServer.handleUpgrade(
                request,
                socket,
                head,
                (client) => this.accept(client),
            );
        });
    }

    get apiUrl(): string {
        return `http://127.0.0.1:${this.port}/`;
    }

    async start(): Promise<void> {
        await new Promise<void>((resolve) =>
            this.httpServer.listen(0, "127.0.0.1", resolve),
        );
    }

    async stop(): Promise<void> {
        for (const client of this.webSocketServer.clients) client.terminate();
        this.webSocketServer.close();
        this.httpServer.closeAllConnections();

        await new Promise((resolve) => this.httpServer.close(resolve));
    }

    sendEnvelope(envelope: Envelope): string {
        const envelopeId = randomUUID();
        this.socket?.send(
            JSON.stringify({ envelope_id: envelopeId, ...envelope }),
        );

        return envelopeId;
    }

    sendEvent(eventId: string, event: Record<string, unknown>): string {
        return this.sendEnvelope({
            type: "events_api",
            payload: { event_id: eventId, team_id: "T1", event },
        });
    }

    sendMessageShortcut(payload: Record<string, unknown>): string {
        return this.sendEnvelope({ type: "interactive", payload });
    }

    /** 네트워크가 끊긴 것처럼 apps.connections.open 에 응답하지 않고 붙잡아 둡니다. */
    holdConnectionOpen(): void {
        this.isHoldingConnectionOpen = true;
    }

    releaseConnectionOpen(): void {
        this.isHoldingConnectionOpen = false;
        for (const { requestUrl, response } of this.heldConnectionOpens.splice(
            0,
        )) {
            this.respondToConnectionOpen(requestUrl, response);
        }
    }

    get heldConnectionOpenCount(): number {
        return this.heldConnectionOpens.length;
    }

    /** Slack 이 연결을 교체할 때 보내는 메시지입니다. 클라이언트는 다시 연결해야 합니다. */
    requestReconnect(): void {
        this.socket?.send(
            JSON.stringify({ type: "disconnect", reason: "refresh_requested" }),
        );
    }

    private get port(): number {
        return (this.httpServer.address() as AddressInfo).port;
    }

    private respondToConnectionOpen(
        requestUrl: string | undefined,
        response: ServerResponse,
    ): void {
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify(this.openConnection(requestUrl)));
    }

    private openConnection(requestUrl: string | undefined) {
        if (this.connectionOpenError) {
            return { ok: false, error: this.connectionOpenError };
        }
        if (!requestUrl?.includes("apps.connections.open")) {
            return { ok: false, error: "unknown_method" };
        }

        return { ok: true, url: `ws://127.0.0.1:${this.port}/socket` };
    }

    private accept(client: WebSocket): void {
        this.socket = client;
        this.connectionCount += 1;
        this.openConnectionCount += 1;

        client.on("close", () => {
            this.openConnectionCount -= 1;
        });
        client.on("message", (data) => {
            const { envelope_id: envelopeId } = JSON.parse(data.toString());
            if (envelopeId) this.acknowledgedEnvelopeIds.push(envelopeId);
        });
        client.send(
            JSON.stringify({
                type: "hello",
                num_connections: 1,
                connection_info: { app_id: "AFAKE" },
            }),
        );
    }
}
