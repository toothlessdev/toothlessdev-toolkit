import type { NotificationStatus } from "../store/SessionNotificationStore";

/** rejected 는 세션 없이 한 번 보내고 끝나는 알림이라 동기화 대상 상태에는 없습니다. */
export type NotificationDisplayStatus = NotificationStatus | "rejected";
export type NotificationRouting = "new" | "delivered" | "resumed";

export interface SessionNotificationContent {
    readonly status: NotificationDisplayStatus;
    /** 제목으로 쓸 원본 메시지입니다. 첫 줄만 씁니다. */
    readonly sourceText: string;
    readonly sourceUrl: string;
    readonly workflowName: string;
    /** 알림을 만든 n8n 실행 화면 주소입니다. 비우면 워크플로 이름을 링크 없이 씁니다. */
    readonly executionUrl?: string;
    readonly routing?: NotificationRouting;
    readonly sessionId?: string;
    readonly workingDirectory?: string;
    /**
     * false 면 세션 ID 가 있어도 Desktop 버튼을 붙이지 않습니다. -p 세션은 실행 중에 Desktop 에서 열면
     * claude 가 복사본을 만들어서, 끝난 뒤에만 버튼을 보여 줍니다.
     */
    readonly shouldShowDesktopButton?: boolean;
}

/** Slack 노드에 넣는 값입니다. text 는 저장해 두고 상태가 바뀔 때 다시 고치는 본문입니다. */
export interface RenderedNotification {
    readonly text: string;
    readonly blocks: string;
    readonly fallbackText: string;
}

const STATUS_DISPLAY: Readonly<
    Record<
        NotificationDisplayStatus,
        { emoji: string; label: string; detail: string }
    >
> = {
    working: {
        emoji: ":large_yellow_circle:",
        label: "진행 중",
        detail: "Claude 조사 중",
    },
    blocked: {
        emoji: ":large_orange_circle:",
        label: "확인 필요",
        detail: "답이나 권한 승인 기다림",
    },
    doneRunning: {
        emoji: ":large_green_circle:",
        label: "완료",
        detail: "응답 끝남, 곧 세션 정리",
    },
    doneStopped: {
        emoji: ":large_green_circle:",
        label: "완료",
        detail: "응답 끝남, 세션 정리됨",
    },
    takenOver: {
        emoji: ":large_green_circle:",
        label: "완료",
        detail: "Desktop 에서 넘겨받음",
    },
    failed: {
        emoji: ":red_circle:",
        label: "실패",
        detail: "Claude 실행 실패",
    },
    rejected: {
        emoji: ":white_circle:",
        label: "보내지 않음",
        detail: "인젝션 의심",
    },
};

/** 형식을 바꾸기 전에 보낸 알림도 저장소에 남아 있어서 예전 상태 이모지도 바꿔 줍니다. */
const LEGACY_STATUS_EMOJIS = [
    ":hourglass_flowing_sand:",
    ":raised_hand:",
    ":white_check_mark:",
];

const ROUTING_LABEL: Readonly<Record<NotificationRouting, string>> = {
    new: "새 세션",
    delivered: "진행 중인 세션에 전달",
    resumed: "끝난 세션을 다시 깨움",
};

const STATUS_LINE_PREFIX = "> :vertical_traffic_light: *Status:*";
/** 인용구 없이 보내던 바로 전 형식의 Status 줄입니다. */
const UNQUOTED_STATUS_LINE_PREFIX = ":vertical_traffic_light: *Status:*";
const MAX_TITLE_LENGTH = 80;

export function renderSessionNotification(
    content: SessionNotificationContent,
): RenderedNotification {
    const { emoji } = STATUS_DISPLAY[content.status];
    const title = toNotificationTitle(content.sourceText);
    const workflowLink = content.executionUrl
        ? `<${escapeSlackText(content.executionUrl)}|${content.workflowName}>`
        : content.workflowName;

    const lines = [
        `${emoji} *${title}*`,
        "",
        `${STATUS_LINE_PREFIX} ${renderStatusValue(content.status)}`,
        `> :link: *Triggered via:* ${workflowLink} (<${escapeSlackText(content.sourceUrl)}|원본 메시지>)`,
    ];
    if (content.routing) {
        const sessionSuffix = content.sessionId
            ? ` (\`${content.sessionId}\`)`
            : "";
        lines.push(
            `> :compass: *Routing:* ${ROUTING_LABEL[content.routing]}${sessionSuffix}`,
        );
    }
    const text = lines.join("\n");

    return {
        text,
        blocks: buildNotificationBlocks(text, {
            sessionId:
                content.shouldShowDesktopButton === false
                    ? undefined
                    : content.sessionId,
            workingDirectory: content.workingDirectory,
        }),
        fallbackText: title,
    };
}

export interface NotificationButtonTarget {
    readonly sessionId?: string;
    readonly workingDirectory?: string;
    /**
     * 프로세스가 살아 있는 세션의 Remote Control ID 입니다. 있으면 버튼이 claude://code 로 엽니다.
     * 살아 있는 세션을 claude://resume 으로 열면 Desktop 이 다른 곳에서 실행 중이라며 거부합니다.
     */
    readonly remoteControlSessionId?: string;
}

/**
 * 저장해 둔 본문으로 블록을 다시 만듭니다. 버튼은 지금 형식(인용구 Status 줄)일 때만 붙입니다.
 * 예전 형식은 본문에 Desktop 링크가 이미 있어서 버튼까지 붙이면 같은 링크가 두 번 보입니다.
 */
export function buildNotificationBlocks(
    text: string,
    {
        sessionId,
        workingDirectory,
        remoteControlSessionId,
    }: NotificationButtonTarget,
): string {
    const blocks: object[] = [
        { type: "section", text: { type: "mrkdwn", text } },
    ];

    const isCurrentFormat = text
        .split("\n")
        .some((line) => line.startsWith(`${STATUS_LINE_PREFIX} `));
    if (sessionId && isCurrentFormat) {
        blocks.push({
            type: "actions",
            elements: [
                remoteControlSessionId
                    ? {
                          type: "button",
                          action_id: "open_claude_remote_control",
                          text: {
                              type: "plain_text",
                              text: "Claude Desktop 에서 열기 (실행 중)",
                          },
                          url: buildRemoteControlUrl(remoteControlSessionId),
                      }
                    : {
                          type: "button",
                          action_id: "open_claude_desktop",
                          text: {
                              type: "plain_text",
                              text: "Claude Desktop 에서 열기",
                          },
                          url: buildResumeUrl(sessionId, workingDirectory),
                      },
            ],
        });
    }

    return JSON.stringify({ blocks });
}

/** 맨 앞 상태 원과 Status 줄만 바꿉니다. 나머지 줄은 보낸 그대로 둡니다. */
export function withNotificationStatus(
    text: string,
    status: NotificationStatus,
): string {
    const { emoji } = STATUS_DISPLAY[status];
    const [firstLine, ...restLines] = text.split("\n");

    const statusEmojis = [
        ...Object.values(STATUS_DISPLAY).map((display) => display.emoji),
        ...LEGACY_STATUS_EMOJIS,
    ];
    const currentEmoji = statusEmojis.find((statusEmoji) =>
        firstLine.startsWith(`${statusEmoji} `),
    );
    const title = currentEmoji
        ? firstLine.slice(currentEmoji.length + 1)
        : firstLine;

    return [
        `${emoji} ${title}`,
        ...restLines.map((line) => replaceStatusLine(line, status)),
    ].join("\n");
}

const MAX_REPLY_MESSAGE_LENGTH = 500;

/**
 * 상태가 바뀐 것을 알리는 스레드 답글입니다. 원래 메시지 수정은 Slack 이 알림을 보내지 않아서 따로 답글을 답니다.
 * message 는 claude 가 쓴 글이라 외부 메시지를 담을 수 있습니다. 링크와 멘션이 되지 않게 이스케이프합니다.
 */
export function renderStatusReply({
    status,
    mentionUserId,
    message,
}: {
    status: NotificationStatus;
    mentionUserId?: string;
    message?: string;
}): string {
    const { emoji, label } = STATUS_DISPLAY[status];
    const mention = mentionUserId ? `<@${mentionUserId}> ` : "";
    const head = `${mention}${emoji} *${label}*`;
    if (!message) return head;

    const characters = Array.from(message.replace(/\s+/g, " ").trim());
    const shortened =
        characters.length <= MAX_REPLY_MESSAGE_LENGTH
            ? characters.join("")
            : `${characters.slice(0, MAX_REPLY_MESSAGE_LENGTH - 1).join("")}…`;

    return `${head}\n> ${escapeSlackText(shortened)}`;
}

/** 첫 줄의 제목만 돌려줍니다. Slack 알림 미리보기에 쓰는 대체 텍스트입니다. */
export function readNotificationTitle(text: string): string {
    const [firstLine] = text.split("\n");
    return firstLine.replace(/^:[\w+'-]+:\s*/, "").replace(/\*/g, "");
}

/**
 * 원본의 멘션을 그대로 옮기면 알림 채널에서 그 사람이나 그룹이 다시 호출됩니다.
 * 굵게 표시가 제목의 `*` 와 섞이지 않게 서식 기호도 지웁니다.
 */
export function toNotificationTitle(sourceText: string): string {
    const firstLine = sourceText
        .replace(/<[!@][^>]*>/g, "")
        .replace(/<[^>|]+\|([^>]*)>/g, "$1")
        .replace(/<([^>]+)>/g, "$1")
        .split("\n")
        .map((line) =>
            line
                .replace(/^(\s*:[\w+'-]+:)+/, "")
                .replace(/[*~`]/g, "")
                .replace(/\s+/g, " ")
                .trim(),
        )
        .find((line) => line.length > 0);

    if (!firstLine) return "(본문 없음)";

    const characters = Array.from(firstLine);
    if (characters.length <= MAX_TITLE_LENGTH) return firstLine;

    return `${characters.slice(0, MAX_TITLE_LENGTH - 1).join("")}…`;
}

function renderStatusValue(status: NotificationDisplayStatus): string {
    const { label, detail } = STATUS_DISPLAY[status];
    return `${label} (${detail})`;
}

function replaceStatusLine(line: string, status: NotificationStatus): string {
    for (const prefix of [STATUS_LINE_PREFIX, UNQUOTED_STATUS_LINE_PREFIX]) {
        if (line.startsWith(`${prefix} `)) {
            return `${prefix} ${renderStatusValue(status)}`;
        }
    }

    return line;
}

function buildResumeUrl(sessionId: string, workingDirectory?: string): string {
    return (
        `claude://resume?session=${encodeURIComponent(sessionId)}` +
        (workingDirectory ? `&cwd=${encodeURIComponent(workingDirectory)}` : "")
    );
}

/**
 * claude.ai/code 주소는 Slack 에서 누르면 브라우저로 열립니다. Claude Desktop 은 claude://code/<세션 ID> 를
 * 받아야 앱 안에서 엽니다. claude 는 세션을 cse_ ID 로 기록하지만 claude.ai 쪽 주소에는 session_ 으로 씁니다.
 */
function buildRemoteControlUrl(remoteControlSessionId: string): string {
    const compatSessionId = remoteControlSessionId.startsWith("cse_")
        ? `session_${remoteControlSessionId.slice("cse_".length)}`
        : remoteControlSessionId;

    return `claude://code/${encodeURIComponent(compatSessionId)}`;
}

/** Slack 은 링크 안의 & < > 를 엔티티로 받아야 링크를 끊지 않습니다. */
function escapeSlackText(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}
