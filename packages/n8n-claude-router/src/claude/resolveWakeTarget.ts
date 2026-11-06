import { ClaudeFailedError, type ClaudeSession } from "claude-cli";

import { canResume } from "../routing/BaseRoutingRule";

/**
 * 같은 세션을 다른 프로세스가 잡고 있으면 claude 가 조용히 복사본을 만듭니다.
 * 사람이 Claude Desktop 에서 열어 둔 세션이 그런 경우라서 깨우지 않고 실패로 드러냅니다.
 */
export function resolveWakeTarget(
    sessions: readonly ClaudeSession[],
    sessionId: string,
    workingDirectory: string,
): ClaudeSession {
    const sameSessions = sessions.filter(
        (candidate) => candidate.sessionId === sessionId,
    );
    const target = sameSessions.find(canResume);
    const isHeldElsewhere = sameSessions.some(({ pid }) => pid !== undefined);

    if (
        !target ||
        isHeldElsewhere ||
        target.workingDirectory !== workingDirectory
    ) {
        throw new ClaudeFailedError(`깨울 수 없는 세션입니다: ${sessionId}`);
    }

    return target;
}
