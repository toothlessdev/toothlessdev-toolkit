import type { ClaudeSession } from "claude-cli";

export interface RoutingMessage {
    readonly text: string;
    /** 프롬프트에 그대로 들어가는 입력 출처입니다. 예: slack, google-calendar */
    readonly source: string;
    /**
     * 같은 대화로 묶을 입력에 같은 값을 줍니다. 예: Slack 은 채널과 스레드 ts, 캘린더는 이벤트 ID.
     * 비어 있으면 이전 대화와 묶지 않습니다.
     */
    readonly conversationKey: string;
}

export type RoutingDecision =
    | {
          readonly action: "deliver";
          readonly sessionId: string;
          readonly reason: string;
      }
    | {
          readonly action: "resume";
          readonly sessionId: string;
          readonly reason: string;
      }
    | {
          readonly action: "new";
          readonly reason: string;
      };

export interface RoutingContext {
    readonly message: RoutingMessage;
    readonly sessions: readonly ClaudeSession[];
    readonly cancelSignal?: AbortSignal;
}

export interface RoutingRule {
    readonly name: string;

    /** null 이면 이 규칙은 판단하지 않고 다음 규칙으로 넘깁니다. */
    decide(context: RoutingContext): Promise<RoutingDecision | null>;
}

/** 프로세스가 살아 있는 백그라운드 세션만 메시지를 받을 수 있습니다. */
export function canReceiveMessage(session: ClaudeSession): boolean {
    return session.isBackground && session.pid !== undefined;
}

/** 프로세스가 끝난 백그라운드 세션은 메시지를 받지 못하지만 --resume 으로 다시 띄울 수 있습니다. */
export function canResume(session: ClaudeSession): boolean {
    return session.isBackground && session.pid === undefined;
}
