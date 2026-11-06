import type { ConversationSessionStore } from "../store/ConversationSessionStore";
import {
    canReceiveMessage,
    canResume,
    type RoutingContext,
    type RoutingDecision,
    type RoutingRule,
} from "./BaseRoutingRule";

export interface EndedSessionResumption {
    /** --resume 은 세션을 시작한 폴더에서만 대화를 찾습니다. */
    readonly workingDirectory: string;
}

/**
 * 같은 대화의 입력은 LLM 없이 저장된 세션으로 보냅니다.
 * 메시지 내용을 읽지 않으므로 작성자가 다른 세션으로 유도할 수 없습니다.
 */
export class ConversationBindingRule implements RoutingRule {
    readonly name = "conversation-binding";

    constructor(
        private readonly store: ConversationSessionStore,
        private readonly endedSessionResumption?: EndedSessionResumption,
    ) {}

    async decide({
        message,
        sessions,
    }: RoutingContext): Promise<RoutingDecision | null> {
        if (!message.conversationKey) return null;

        const sessionId = this.store.find(message.conversationKey);
        if (!sessionId) return null;

        const session = sessions.find(
            (candidate) => candidate.sessionId === sessionId,
        );
        if (!session) return null;

        if (
            this.endedSessionResumption &&
            canResume(session) &&
            session.workingDirectory ===
                this.endedSessionResumption.workingDirectory
        ) {
            return {
                action: "resume",
                sessionId,
                reason: "이 대화에 연결된 끝난 세션입니다",
            };
        }

        if (!canReceiveMessage(session)) return null;

        return {
            action: "deliver",
            sessionId,
            reason: "이 대화에 연결된 세션입니다",
        };
    }
}
