import { describe, expect, test } from "vitest";

import {
    matchesSlackEventFilter,
    type SlackEventFilter,
} from "../src/slack/slackEventFilter";

const OWNER = "UOWNER";
const filter: SlackEventFilter = {
    eventTypes: new Set(["message"]),
    mentionedUserId: OWNER,
    allowedSenderIds: new Set(["UALLOWED"]),
};
const mention = {
    type: "message",
    user: "UALLOWED",
    text: `<@${OWNER}> 확인 부탁`,
};

describe("matchesSlackEventFilter", () => {
    test("허용된 발신자의 멘션은 통과한다", () => {
        expect(matchesSlackEventFilter(mention, filter)).toBe(true);
    });

    test("이름이 붙은 멘션 형식도 인식한다", () => {
        const event = { ...mention, text: `<@${OWNER}|daegeon> 확인` };
        expect(matchesSlackEventFilter(event, filter)).toBe(true);
    });

    test.each([
        ["ID 앞부분만 같은 멘션", { text: `<@${OWNER}2> 확인` }],
        ["멘션 없는 메시지", { text: "확인 부탁" }],
        ["text 없는 메시지", { text: undefined }],
        ["허용되지 않은 발신자", { user: "USTRANGER" }],
        ["발신자 없는 이벤트", { user: undefined }],
        ["봇 메시지", { bot_id: "B1" }],
        ["메시지 수정 이벤트", { subtype: "message_changed" }],
        ["다른 이벤트 유형", { type: "reaction_added" }],
    ])("%s 는 거른다", (_, override) => {
        expect(
            matchesSlackEventFilter({ ...mention, ...override }, filter),
        ).toBe(false);
    });

    test("파일 첨부 메시지의 멘션은 통과한다", () => {
        const event = { ...mention, subtype: "file_share" };
        expect(matchesSlackEventFilter(event, filter)).toBe(true);
    });

    test("설정을 비우면 사람이 보낸 이벤트는 모두 통과한다", () => {
        const emptyFilter = {
            eventTypes: new Set<string>(),
            allowedSenderIds: new Set<string>(),
        };
        const event = { type: "reaction_added", user: "USTRANGER" };

        expect(matchesSlackEventFilter(event, emptyFilter)).toBe(true);
        expect(
            matchesSlackEventFilter({ ...event, bot_id: "B1" }, emptyFilter),
        ).toBe(false);
    });
});
