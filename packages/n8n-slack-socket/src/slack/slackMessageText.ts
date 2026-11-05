import type { SlackEvent } from "./slackEventFilter";

interface SlackAttachment {
    readonly title?: string;
    readonly text?: string;
    readonly fallback?: string;
}

function readAttachmentText(attachment: SlackAttachment): string {
    const visibleText = [attachment.title, attachment.text]
        .filter(Boolean)
        .join("\n");

    return visibleText || (attachment.fallback ?? "");
}

/**
 * Grafana 같은 봇은 본문을 attachments 에만 담아 text 가 빕니다. 다음 노드가 text 만 읽어도
 * 알림 내용을 받도록 합칩니다. 사람 메시지의 attachments 는 링크 미리보기라 합치지 않습니다.
 */
export function withBotAttachmentText(event: SlackEvent): SlackEvent {
    if (!event.bot_id || !Array.isArray(event.attachments)) return event;

    const attachments = event.attachments as readonly SlackAttachment[];
    const text = [event.text, ...attachments.map(readAttachmentText)]
        .filter(Boolean)
        .join("\n");

    return { ...event, text };
}
