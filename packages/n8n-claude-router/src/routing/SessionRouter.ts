import type { ClaudeSession } from "claude-cli";

import type {
    RoutingDecision,
    RoutingMessage,
    RoutingRule,
} from "./BaseRoutingRule";

export type RoutedDecision = RoutingDecision & {
    readonly ruleName: string;
};

const FALLBACK_RULE_NAME = "fallback.new-session";

export class SessionRouter {
    constructor(
        private readonly rules: readonly RoutingRule[],
        private readonly listSessions: (
            cancelSignal?: AbortSignal,
        ) => Promise<readonly ClaudeSession[]>,
    ) {}

    /** 규칙을 순서대로 묻고 처음 판단한 규칙을 따릅니다. 아무도 판단하지 않으면 새 세션입니다. */
    async route(
        message: RoutingMessage,
        cancelSignal?: AbortSignal,
    ): Promise<RoutedDecision> {
        const sessions = await this.listSessions(cancelSignal);

        for (const rule of this.rules) {
            const decision = await rule.decide({
                message,
                sessions,
                cancelSignal,
            });
            if (decision) return { ...decision, ruleName: rule.name };
        }

        return {
            action: "new",
            reason: "메시지를 넣을 세션을 찾지 못했습니다",
            ruleName: FALLBACK_RULE_NAME,
        };
    }
}
