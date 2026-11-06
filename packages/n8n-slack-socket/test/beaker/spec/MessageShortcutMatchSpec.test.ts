import { describe, expect, test } from "vitest";

import {
    matchesMessageShortcut,
    type SlackMessageShortcut,
} from "../../../src/slack/slackMessageShortcut";

function shortcut(callbackId: string, userId: string): SlackMessageShortcut {
    return {
        type: "message_action",
        callback_id: callbackId,
        trigger_id: "t1",
        team: { id: "T1" },
        user: { id: userId },
        channel: { id: "C1" },
        message: { type: "message", text: "hi" },
    };
}

function source(allowedUserIds: string[]) {
    return {
        kind: "messageShortcut" as const,
        callbackId: "cb1",
        allowedUserIds: new Set(allowedUserIds),
    };
}

describe("matchesMessageShortcut (specification)", () => {
    // beaker:case BB-5
    test("BB-5 · callback 이 일치하고 허용된 사용자면 true", () => {
        expect(
            matchesMessageShortcut(shortcut("cb1", "U1"), source(["U1"])),
        ).toBe(true);
    });

    // beaker:case BB-6
    test("BB-6 · callback 이 일치해도 허용되지 않은 사용자면 false", () => {
        expect(
            matchesMessageShortcut(shortcut("cb1", "U2"), source(["U1"])),
        ).toBe(false);
    });

    // beaker:case BB-7
    test("BB-7 · 허용된 사용자여도 callback 이 다르면 false", () => {
        expect(
            matchesMessageShortcut(shortcut("other", "U1"), source(["U1"])),
        ).toBe(false);
    });

    // beaker:case BB-8
    test("BB-8 · callback 도 사용자도 맞지 않으면 false", () => {
        expect(
            matchesMessageShortcut(shortcut("other", "U2"), source(["U1"])),
        ).toBe(false);
    });

    // beaker:case BB-9
    test("BB-9 · 허용 목록이 비면 callback 이 일치해도 false", () => {
        expect(matchesMessageShortcut(shortcut("cb1", "U1"), source([]))).toBe(
            false,
        );
    });
});
