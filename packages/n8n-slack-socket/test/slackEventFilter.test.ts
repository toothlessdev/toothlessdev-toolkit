import { describe, expect, test } from "vitest";

import {
    matchesSlackSource,
    type BotMessagesSource,
    type ChannelMessagesSource,
    type MentionsSource,
} from "../src/slack/slackEventFilter";

const OWNER = "UOWNER";
const mentions: MentionsSource = {
    kind: "mentions",
    mentionedUserId: OWNER,
    mentionedUserGroupIds: new Set(["SGROUP", "SOTHER"]),
    allowedSenderIds: new Set(["UALLOWED"]),
};
const channelMessages: ChannelMessagesSource = {
    kind: "channelMessages",
    channelIds: new Set(["CFULL"]),
    allowedSenderIds: new Set(["UALLOWED"]),
};
const botMessages: BotMessagesSource = {
    kind: "botMessages",
    allowedBotIds: new Set(["BGRAFANA"]),
    channelIds: new Set(["CALERT"]),
};

const mention = {
    type: "message",
    user: "UALLOWED",
    text: `<@${OWNER}> 확인`,
    channel: "COTHER",
};
const channelMessage = {
    type: "message",
    user: "UALLOWED",
    text: "멘션 없는 메시지",
    channel: "CFULL",
};
const botMessage = {
    type: "message",
    user: "UGRAFANABOT",
    bot_id: "BGRAFANA",
    text: "",
    channel: "CALERT",
};

describe("Mentions 소스", () => {
    test.each([
        ["사용자 멘션", `<@${OWNER}> 확인`],
        ["이름이 붙은 사용자 멘션", `<@${OWNER}|daegeon> 확인`],
        ["그룹 멘션", "<!subteam^SGROUP> 확인"],
        ["이름이 붙은 그룹 멘션", "<!subteam^SOTHER|@team> 확인"],
    ])("%s 은 통과한다", (_, text) => {
        expect(matchesSlackSource({ ...mention, text }, mentions)).toBe(true);
    });

    test("파일 첨부와 스레드 공유의 멘션은 통과한다", () => {
        for (const subtype of ["file_share", "thread_broadcast"]) {
            expect(matchesSlackSource({ ...mention, subtype }, mentions)).toBe(
                true,
            );
        }
    });

    test.each([
        ["ID 앞부분만 같은 멘션", { text: `<@${OWNER}2> 확인` }],
        ["ID 앞부분만 같은 그룹", { text: "<!subteam^SGROUP2> 확인" }],
        ["설정하지 않은 그룹", { text: "<!subteam^SNONE|@x> 확인" }],
        ["@channel", { text: "<!channel> 확인" }],
        ["멘션 없는 메시지", { text: "확인" }],
        ["text 없는 메시지", { text: undefined }],
        ["허용되지 않은 발신자", { user: "USTRANGER" }],
        ["발신자 없는 이벤트", { user: undefined }],
        ["봇 메시지", { bot_id: "BGRAFANA" }],
        ["메시지 수정", { subtype: "message_changed" }],
        ["다른 이벤트 유형", { type: "reaction_added" }],
    ])("%s 는 거른다", (_, override) => {
        expect(matchesSlackSource({ ...mention, ...override }, mentions)).toBe(
            false,
        );
    });

    test("멘션 대상이 비면 아무것도 받지 않는다", () => {
        const empty: MentionsSource = {
            kind: "mentions",
            mentionedUserGroupIds: new Set(),
            allowedSenderIds: new Set(),
        };

        expect(matchesSlackSource(mention, empty)).toBe(false);
    });

    test("허용 발신자가 비면 모든 사람을 받는다", () => {
        const anyone = { ...mentions, allowedSenderIds: new Set<string>() };

        expect(
            matchesSlackSource({ ...mention, user: "UANYONE" }, anyone),
        ).toBe(true);
    });
});

describe("Channel Messages 소스", () => {
    test("지정 채널의 멘션 없는 사람 메시지는 통과한다", () => {
        expect(matchesSlackSource(channelMessage, channelMessages)).toBe(true);
    });

    test.each([
        ["다른 채널", { channel: "COTHER" }],
        ["채널 없는 이벤트", { channel: undefined }],
        ["허용되지 않은 발신자", { user: "USTRANGER" }],
        ["봇 메시지", { bot_id: "BGRAFANA" }],
        ["메시지 수정", { subtype: "message_changed" }],
        ["다른 이벤트 유형", { type: "reaction_added" }],
    ])("%s 는 거른다", (_, override) => {
        expect(
            matchesSlackSource(
                { ...channelMessage, ...override },
                channelMessages,
            ),
        ).toBe(false);
    });

    test("채널이 비면 아무것도 받지 않는다", () => {
        const empty = { ...channelMessages, channelIds: new Set<string>() };

        expect(matchesSlackSource(channelMessage, empty)).toBe(false);
    });
});

describe("Bot Messages 소스", () => {
    test("지정 채널의 허용된 봇 메시지는 통과한다", () => {
        expect(matchesSlackSource(botMessage, botMessages)).toBe(true);
    });

    test("user 없는 bot_message subtype 도 통과한다", () => {
        const { user: _user, ...withoutUser } = botMessage;

        expect(
            matchesSlackSource(
                { ...withoutUser, subtype: "bot_message" },
                botMessages,
            ),
        ).toBe(true);
    });

    test.each([
        ["허용되지 않은 봇", { bot_id: "BOTHER" }],
        ["다른 채널", { channel: "COTHER" }],
        ["메시지 수정", { subtype: "message_changed" }],
        ["다른 이벤트 유형", { type: "reaction_added" }],
        ["사람 메시지", { bot_id: undefined }],
        ["스레드 답글", { thread_ts: "1793824405.632829" }],
    ])("%s 는 거른다", (_, override) => {
        expect(
            matchesSlackSource({ ...botMessage, ...override }, botMessages),
        ).toBe(false);
    });
});
