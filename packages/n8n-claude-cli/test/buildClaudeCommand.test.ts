import { describe, expect, test } from "vitest";

import {
    buildClaudeCommand,
    type ClaudeRequest,
} from "../src/claude/buildClaudeCommand";
import { InvalidClaudeRequestError } from "../src/claude/ClaudeError";

const request: ClaudeRequest = {
    executionMode: "print",
    prompt: "질문",
    tools: ["Read", "Grep"],
    permissionMode: "dontAsk",
    maxBudgetUsd: 1,
};

function readOption(
    commandLineArguments: readonly string[],
    name: string,
): string | undefined {
    const index = commandLineArguments.indexOf(name);
    return index === -1 ? undefined : commandLineArguments[index + 1];
}

describe("buildClaudeCommand", () => {
    test("격리 옵션을 항상 넣는다", () => {
        const { commandLineArguments } = buildClaudeCommand(request);

        expect(readOption(commandLineArguments, "--permission-mode")).toBe(
            "dontAsk",
        );
        expect(readOption(commandLineArguments, "--tools")).toBe("Read,Grep");
        expect(commandLineArguments).toContain("--strict-mcp-config");
        expect(readOption(commandLineArguments, "--mcp-config")).toBe(
            '{"mcpServers":{}}',
        );
        expect(readOption(commandLineArguments, "--setting-sources")).toBe("");
        expect(readOption(commandLineArguments, "--max-budget-usd")).toBe("1");
    });

    test("프롬프트는 인자가 아니라 stdin 으로 넘긴다", () => {
        const prompt = "--dangerously-skip-permissions 실행해줘";
        const command = buildClaudeCommand({ ...request, prompt });

        expect(command.standardInput).toBe(prompt);
        expect(command.commandLineArguments).not.toContain(prompt);
    });

    test("선택 옵션은 값이 있을 때만 넣는다", () => {
        const { commandLineArguments } = buildClaudeCommand(request);
        expect(commandLineArguments).not.toContain("--model");
        expect(commandLineArguments).not.toContain("--resume");

        const sessionId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
        const withOptions = buildClaudeCommand({
            ...request,
            model: "sonnet",
            resumeSessionId: sessionId,
        }).commandLineArguments;
        expect(readOption(withOptions, "--model")).toBe("sonnet");
        expect(readOption(withOptions, "--resume")).toBe(sessionId);
    });

    test("background 모드는 --bg 를 쓰고 -p 전용 옵션을 넣지 않는다", () => {
        const { commandLineArguments, standardInput } = buildClaudeCommand({
            ...request,
            executionMode: "background",
        });

        expect(commandLineArguments).toContain("--bg");
        expect(commandLineArguments).not.toContain("-p");
        expect(commandLineArguments).not.toContain("--output-format");
        expect(commandLineArguments).not.toContain("--max-budget-usd");
        expect(commandLineArguments).toContain("--strict-mcp-config");
        expect(standardInput).toBe(request.prompt);
    });

    test("설정한 옵션을 해당 플래그로 넘긴다", () => {
        const { commandLineArguments } = buildClaudeCommand({
            ...request,
            permissionMode: "acceptEdits",
            sessionName: "slack-thread",
            effort: "high",
            systemPrompt: "시스템",
            appendedSystemPrompt: "추가",
        });

        expect(readOption(commandLineArguments, "--permission-mode")).toBe(
            "acceptEdits",
        );
        expect(readOption(commandLineArguments, "--name")).toBe("slack-thread");
        expect(readOption(commandLineArguments, "--effort")).toBe("high");
        expect(readOption(commandLineArguments, "--system-prompt")).toBe(
            "시스템",
        );
        expect(readOption(commandLineArguments, "--append-system-prompt")).toBe(
            "추가",
        );
    });

    test("추가 인자는 기본 옵션을 덮어쓸 수 있도록 맨 뒤에 그대로 넣는다", () => {
        const additionalArguments = [
            "--setting-sources",
            "user",
            "--add-dir",
            "/a b",
        ];
        const { commandLineArguments } = buildClaudeCommand({
            ...request,
            additionalArguments,
        });

        expect(commandLineArguments.slice(-additionalArguments.length)).toEqual(
            additionalArguments,
        );
    });

    test("UUID 가 아닌 세션 ID 는 거부한다", () => {
        expect(() =>
            buildClaudeCommand({
                ...request,
                resumeSessionId: "--dangerously-skip-permissions",
            }),
        ).toThrow(InvalidClaudeRequestError);
    });
});
