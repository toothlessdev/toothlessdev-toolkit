export interface SlackEvent {
    readonly type: string;
    readonly user?: string;
    readonly text?: string;
    readonly subtype?: string;
    readonly bot_id?: string;
    readonly channel?: string;
    readonly [field: string]: unknown;
}

export interface MentionsSource {
    readonly kind: "mentions";
    readonly mentionedUserId?: string;
    readonly mentionedUserGroupIds: ReadonlySet<string>;
    /** 비어 있으면 모든 사람을 통과시킵니다. */
    readonly allowedSenderIds: ReadonlySet<string>;
}

export interface ChannelMessagesSource {
    readonly kind: "channelMessages";
    readonly channelIds: ReadonlySet<string>;
    /** 비어 있으면 모든 사람을 통과시킵니다. */
    readonly allowedSenderIds: ReadonlySet<string>;
}

export interface BotMessagesSource {
    readonly kind: "botMessages";
    readonly allowedBotIds: ReadonlySet<string>;
    readonly channelIds: ReadonlySet<string>;
}

/** 메시지가 아니라 이벤트가 끊긴 상태를 받습니다. 어떤 메시지와도 맞지 않습니다. */
export interface EventSilenceSource {
    readonly kind: "eventSilence";
}

export interface MessageShortcutSource {
    readonly kind: "messageShortcut";
    readonly callbackId: string;
    readonly allowedUserIds: ReadonlySet<string>;
}

export type SlackSource =
    | MessageShortcutSource
    | MentionsSource
    | ChannelMessagesSource
    | BotMessagesSource
    | EventSilenceSource;
export type SlackSourceKind = SlackSource["kind"];

/**
 * 지정 채널의 멘션은 mentions 와 channelMessages 를 모두 만족합니다.
 * 앞선 종류에만 보내야 같은 메시지로 세션이 두 개 뜨지 않습니다.
 */
export const SLACK_SOURCE_PRIORITY: readonly SlackSourceKind[] = [
    "botMessages",
    "mentions",
    "channelMessages",
];

/** 수정, 삭제 같은 subtype 까지 받으면 메시지를 고칠 때마다 워크플로가 다시 실행됩니다. */
const HUMAN_MESSAGE_SUBTYPES: ReadonlySet<string> = new Set([
    "file_share",
    "thread_broadcast",
]);

/** 봇은 botMessages 로만 받습니다. 워크플로의 답글이 다시 워크플로를 실행하는 무한 루프를 막습니다. */
function isHumanMessage(event: SlackEvent): boolean {
    if (event.bot_id || !event.user) return false;

    return (
        event.subtype === undefined || HUMAN_MESSAGE_SUBTYPES.has(event.subtype)
    );
}

function isAllowedSender(
    event: SlackEvent,
    allowedSenderIds: ReadonlySet<string>,
): boolean {
    return allowedSenderIds.size === 0 || allowedSenderIds.has(event.user!);
}

function isInChannels(
    event: SlackEvent,
    channelIds: ReadonlySet<string>,
): boolean {
    return event.channel !== undefined && channelIds.has(event.channel);
}

function mentionsUser(text: string, userId: string): boolean {
    return text.includes(`<@${userId}>`) || text.includes(`<@${userId}|`);
}

function mentionsUserGroup(text: string, groupId: string): boolean {
    return (
        text.includes(`<!subteam^${groupId}>`) ||
        text.includes(`<!subteam^${groupId}|`)
    );
}

function matchesMentions(event: SlackEvent, source: MentionsSource): boolean {
    const text = event.text ?? "";
    const isMentioned =
        (source.mentionedUserId !== undefined &&
            mentionsUser(text, source.mentionedUserId)) ||
        [...source.mentionedUserGroupIds].some((groupId) =>
            mentionsUserGroup(text, groupId),
        );

    return (
        isHumanMessage(event) &&
        isMentioned &&
        isAllowedSender(event, source.allowedSenderIds)
    );
}

function matchesChannelMessages(
    event: SlackEvent,
    source: ChannelMessagesSource,
): boolean {
    return (
        isHumanMessage(event) &&
        isInChannels(event, source.channelIds) &&
        isAllowedSender(event, source.allowedSenderIds)
    );
}

function matchesBotMessages(
    event: SlackEvent,
    source: BotMessagesSource,
): boolean {
    const isOriginalBotMessage =
        event.subtype === undefined || event.subtype === "bot_message";

    return (
        isOriginalBotMessage &&
        event.thread_ts === undefined &&
        event.bot_id !== undefined &&
        source.allowedBotIds.has(event.bot_id) &&
        isInChannels(event, source.channelIds)
    );
}

export function matchesSlackSource(
    event: SlackEvent,
    source: SlackSource,
): boolean {
    if (event.type !== "message") return false;

    switch (source.kind) {
        case "mentions":
            return matchesMentions(event, source);
        case "channelMessages":
            return matchesChannelMessages(event, source);
        case "botMessages":
            return matchesBotMessages(event, source);
        case "eventSilence":
        case "messageShortcut":
            return false;
    }
}
