import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

const MAX_CONVERSATIONS = 1000;

type ConversationSessions = Record<string, string>;

/**
 * 대화와 세션의 연결을 JSON 파일에 둡니다. n8n static data 는 수동 실행에서 저장되지 않아
 * 테스트 실행과 게시된 워크플로의 동작이 달라집니다.
 */
export class ConversationSessionStore {
    constructor(private readonly filePath: string) {}

    find(conversationKey: string): string | undefined {
        return this.read()[conversationKey];
    }

    remember(conversationKey: string, sessionId: string): void {
        const conversations = this.read();

        // 다시 넣어야 객체 순서의 맨 뒤로 가서 가장 최근에 쓴 대화가 됩니다.
        delete conversations[conversationKey];
        conversations[conversationKey] = sessionId;

        this.write(dropOldest(conversations));
    }

    private read(): ConversationSessions {
        try {
            return JSON.parse(
                readFileSync(this.filePath, "utf8"),
            ) as ConversationSessions;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};

            throw error;
        }
    }

    /** 쓰는 도중 n8n 이 재시작돼도 파일이 깨지지 않도록 임시 파일을 만든 뒤 교체합니다. */
    private write(conversations: ConversationSessions): void {
        mkdirSync(path.dirname(this.filePath), { recursive: true });

        const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
        writeFileSync(temporaryPath, JSON.stringify(conversations, null, 2));
        renameSync(temporaryPath, this.filePath);
    }
}

function dropOldest(conversations: ConversationSessions): ConversationSessions {
    const entries = Object.entries(conversations);

    return Object.fromEntries(entries.slice(-MAX_CONVERSATIONS));
}
