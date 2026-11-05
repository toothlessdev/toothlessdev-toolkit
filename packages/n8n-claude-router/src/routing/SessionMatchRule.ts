import type { ClaudeSession } from "claude-cli";

import {
    canReceiveMessage,
    type RoutingContext,
    type RoutingDecision,
    type RoutingMessage,
    type RoutingRule,
} from "./BaseRoutingRule";

export interface SessionMatch {
    readonly sessionId: string | null;
    readonly confidence: "high" | "low";
    readonly reason: string;
}

export interface SessionMatcher {
    match(
        message: RoutingMessage,
        candidates: readonly ClaudeSession[],
        cancelSignal?: AbortSignal,
    ): Promise<SessionMatch>;
}

export interface CandidateCriteria {
    readonly workingDirectory: string;
    readonly maxCandidates: number;
    readonly maxAgeMs: number;
    readonly nowMs: () => number;
}

/** 후보를 좁힐수록 LLM 이 잘못 고를 대상과 비용이 함께 줄어듭니다. */
export function selectCandidates(
    sessions: readonly ClaudeSession[],
    { workingDirectory, maxCandidates, maxAgeMs, nowMs }: CandidateCriteria,
): ClaudeSession[] {
    const oldestStartedAtMs = nowMs() - maxAgeMs;

    return sessions
        .filter(
            (session) =>
                canReceiveMessage(session) &&
                session.workingDirectory === workingDirectory &&
                session.startedAtMs >= oldestStartedAtMs,
        )
        .toSorted((left, right) => right.startedAtMs - left.startedAtMs)
        .slice(0, maxCandidates);
}

export class SessionMatchRule implements RoutingRule {
    readonly name = "llm-session-match";

    constructor(
        private readonly matcher: SessionMatcher,
        private readonly criteria: CandidateCriteria,
    ) {}

    async decide({
        message,
        sessions,
        cancelSignal,
    }: RoutingContext): Promise<RoutingDecision | null> {
        const candidates = selectCandidates(sessions, this.criteria);
        if (candidates.length === 0) return null;

        const match = await this.matcher.match(
            message,
            candidates,
            cancelSignal,
        );
        if (match.confidence !== "high" || !match.sessionId) return null;

        /**
         * LLM 답은 메시지 내용의 영향을 받으므로 믿지 않습니다.
         * 후보에 없는 ID 를 그대로 넘기면 작성자가 임의의 세션에 메시지를 넣을 수 있습니다.
         */
        const isCandidate = candidates.some(
            (candidate) => candidate.sessionId === match.sessionId,
        );
        if (!isCandidate) return null;

        return {
            action: "deliver",
            sessionId: match.sessionId,
            reason: match.reason,
        };
    }
}
