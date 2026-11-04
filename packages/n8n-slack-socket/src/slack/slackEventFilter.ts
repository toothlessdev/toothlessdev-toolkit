export interface SlackEvent {
    readonly type: string;
    readonly user?: string;
    readonly text?: string;
    readonly subtype?: string;
    readonly bot_id?: string;
    readonly [field: string]: unknown;
}

export interface SlackEventFilter {
    /** 비어 있으면 모든 이벤트 유형을 통과시킵니다. */
    readonly eventTypes: ReadonlySet<string>;
    readonly mentionedUserId?: string;
    /** 비어 있으면 모든 발신자를 통과시킵니다. */
    readonly allowedSenderIds: ReadonlySet<string>;
}

/** 수정, 삭제 같은 subtype 까지 받으면 메시지를 고칠 때마다 워크플로가 다시 실행됩니다. */
const HUMAN_MESSAGE_SUBTYPES: ReadonlySet<string> = new Set([
    "file_share",
    "thread_broadcast",
]);

function isHumanEvent(event: SlackEvent): boolean {
    if (event.bot_id || !event.user) return false;

    return (
        event.subtype === undefined || HUMAN_MESSAGE_SUBTYPES.has(event.subtype)
    );
}

function mentionsUser(text: string, userId: string): boolean {
    return text.includes(`<@${userId}>`) || text.includes(`<@${userId}|`);
}

/** 봇 이벤트는 설정과 무관하게 거릅니다. 워크플로의 답글이 다시 워크플로를 실행하는 무한 루프를 막습니다. */
export function matchesSlackEventFilter(
    event: SlackEvent,
    filter: SlackEventFilter,
): boolean {
    if (filter.eventTypes.size > 0 && !filter.eventTypes.has(event.type)) {
        return false;
    }
    if (!isHumanEvent(event)) return false;
    if (
        filter.mentionedUserId &&
        !mentionsUser(event.text ?? "", filter.mentionedUserId)
    ) {
        return false;
    }

    return (
        filter.allowedSenderIds.size === 0 ||
        filter.allowedSenderIds.has(event.user!)
    );
}
