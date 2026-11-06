import type { MessageShortcutSource, SlackEvent } from "./slackEventFilter";

export interface SlackMessageShortcut {
    readonly type: string;
    readonly callback_id: string;
    readonly trigger_id: string;
    readonly team?: { readonly id?: string };
    readonly user: { readonly id: string };
    readonly channel: { readonly id: string };
    readonly message: SlackEvent;
}

/**
 * 단축키는 워크스페이스의 다른 사람에게도 보일 수 있고, 눌리면 내 권한으로 세션이 뜹니다.
 * 그래서 다른 소스와 달리 허용 목록이 비면 아무도 통과시키지 않습니다.
 */
export function matchesMessageShortcut(
    shortcut: SlackMessageShortcut,
    source: MessageShortcutSource,
): boolean {
    return (
        shortcut.type === "message_action" &&
        shortcut.callback_id === source.callbackId &&
        source.allowedUserIds.has(shortcut.user.id)
    );
}
