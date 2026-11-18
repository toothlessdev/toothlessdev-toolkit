import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { ClaudeSession } from "claude-cli";

const MAX_SESSIONS = 1000;
/** 후보마다 프롬프트에 들어가므로 세션을 고르는 데 필요한 앞부분만 둡니다. */
const MAX_INTENT_LENGTH = 500;

/**
 * -p 로 실행한 세션은 claude agents 목록에 나오지 않습니다.
 * 세션을 띄울 때 여기에 적어 둬야 다음 메시지가 이어 갈 후보로 찾을 수 있습니다.
 */
export interface PrintSession {
    readonly sessionId: string;
    readonly name: string;
    /** 세션을 시작한 메시지입니다. 외부 메시지일 수 있으니 데이터로만 다룹니다. */
    readonly intent: string;
    readonly workingDirectory: string;
    readonly startedAtMs: number;
}

type StoredSessions = Record<string, PrintSession>;

export class PrintSessionStore {
    constructor(private readonly filePath: string) {}

    list(): PrintSession[] {
        return Object.values(this.read());
    }

    /** 이어 간 세션을 다시 등록해도 처음 시작한 시각과 메시지를 그대로 둡니다. */
    register(session: PrintSession): void {
        const sessions = this.read();
        if (sessions[session.sessionId]) return;

        sessions[session.sessionId] = {
            ...session,
            intent: session.intent.slice(0, MAX_INTENT_LENGTH),
        };
        this.write(sessions);
    }

    private read(): StoredSessions {
        try {
            return JSON.parse(
                readFileSync(this.filePath, "utf8"),
            ) as StoredSessions;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};

            throw error;
        }
    }

    private write(sessions: StoredSessions): void {
        mkdirSync(path.dirname(this.filePath), { recursive: true });

        const entries = Object.entries(sessions).slice(-MAX_SESSIONS);
        const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
        writeFileSync(
            temporaryPath,
            JSON.stringify(Object.fromEntries(entries), null, 2),
        );
        renameSync(temporaryPath, this.filePath);
    }
}

/**
 * 사람이 Claude Desktop 에서 열어 둔 세션은 목록에 프로세스가 있는 항목으로 나옵니다.
 * 그 세션을 -p 로 이어 가면 claude 가 복사본을 만들므로 후보에서 뺍니다.
 * 프로세스가 없는 같은 ID 의 항목은 기록해 둔 -p 세션으로 바꿉니다.
 */
export function mergePrintSessions(
    listedSessions: readonly ClaudeSession[],
    printSessions: readonly PrintSession[],
): ClaudeSession[] {
    const liveSessionIds = new Set(
        listedSessions
            .filter(({ pid }) => pid !== undefined)
            .map(({ sessionId }) => sessionId),
    );
    const resumablePrintSessions = printSessions.filter(
        ({ sessionId }) => !liveSessionIds.has(sessionId),
    );
    const printSessionIds = new Set(
        resumablePrintSessions.map(({ sessionId }) => sessionId),
    );

    return [
        ...listedSessions.filter(
            ({ sessionId }) => !printSessionIds.has(sessionId),
        ),
        ...resumablePrintSessions.map((session) => ({
            ...session,
            backgroundId: "",
            isBackground: false,
            isPrint: true,
        })),
    ];
}
