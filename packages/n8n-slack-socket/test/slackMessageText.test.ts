import { describe, expect, test } from "vitest";

import { withBotAttachmentText } from "../src/slack/slackMessageText";

const botMessage = { type: "message", bot_id: "B1", text: "" };

describe("withBotAttachmentText", () => {
    test("봇의 attachments 제목과 본문을 text 로 합친다", () => {
        const event = {
            ...botMessage,
            attachments: [{ title: "[FIRING:1] 결제", text: "Value: F=97" }],
        };

        expect(withBotAttachmentText(event).text).toBe(
            "[FIRING:1] 결제\nValue: F=97",
        );
    });

    test("기존 text 뒤에 붙이고 attachments 는 그대로 둔다", () => {
        const attachments = [{ text: "본문" }];
        const event = { ...botMessage, text: "머리말", attachments };

        expect(withBotAttachmentText(event)).toEqual({
            ...event,
            text: "머리말\n본문",
            attachments,
        });
    });

    test("제목과 본문이 없으면 fallback 을 쓴다", () => {
        const event = {
            ...botMessage,
            attachments: [{ fallback: "대체 문구" }],
        };

        expect(withBotAttachmentText(event).text).toBe("대체 문구");
    });

    test.each([
        [
            "사람 메시지",
            {
                type: "message",
                text: "링크",
                attachments: [{ text: "미리보기" }],
            },
        ],
        ["attachments 없는 봇 메시지", { ...botMessage, text: "본문" }],
    ])("%s 는 바꾸지 않는다", (_, event) => {
        expect(withBotAttachmentText(event)).toBe(event);
    });
});
