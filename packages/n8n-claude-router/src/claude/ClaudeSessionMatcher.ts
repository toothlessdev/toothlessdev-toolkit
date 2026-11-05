import {
    buildClaudeCommand,
    ClaudeFailedError,
    type ClaudeCli,
    type ClaudeSession,
} from "claude-cli";

import type { SessionMatch, SessionMatcher } from "../routing/SessionMatchRule";
import type { RoutingMessage } from "../routing/BaseRoutingRule";
import {
    buildSessionMatchPrompt,
    SESSION_MATCH_SCHEMA,
} from "./buildSessionMatchPrompt";

export interface ClaudeSessionMatcherOptions {
    readonly workingDirectory: string;
    readonly model: string;
    readonly maxBudgetUsd: number;
    readonly routingInstructions?: string;
}

export class ClaudeSessionMatcher implements SessionMatcher {
    constructor(
        private readonly cli: ClaudeCli,
        private readonly options: ClaudeSessionMatcherOptions,
    ) {}

    /** 도구를 하나도 주지 않습니다. 메시지에 속더라도 답을 잘못 고르는 것 말고는 할 수 있는 일이 없습니다. */
    async match(
        message: RoutingMessage,
        candidates: readonly ClaudeSession[],
        cancelSignal?: AbortSignal,
    ): Promise<SessionMatch> {
        const command = buildClaudeCommand({
            executionMode: "print",
            prompt: buildSessionMatchPrompt(
                message,
                candidates,
                this.options.routingInstructions,
            ),
            tools: [],
            permissionMode: "dontAsk",
            maxBudgetUsd: this.options.maxBudgetUsd,
            jsonSchema: SESSION_MATCH_SCHEMA,
            model: this.options.model,
        });

        const { structuredOutput } = await this.cli.run(
            command,
            this.options.workingDirectory,
            cancelSignal,
        );

        return parseSessionMatch(structuredOutput);
    }
}

function parseSessionMatch(output: unknown): SessionMatch {
    const { sessionId, confidence, reason } = (output ?? {}) as Record<
        string,
        unknown
    >;
    const isValid =
        (sessionId === null || typeof sessionId === "string") &&
        (confidence === "high" || confidence === "low") &&
        typeof reason === "string";
    if (!isValid) {
        throw new ClaudeFailedError(
            `세션 매칭 출력 형식이 올바르지 않습니다: ${JSON.stringify(output)}`,
        );
    }

    return { sessionId, confidence, reason } as SessionMatch;
}
