import {
    chmodSync,
    mkdirSync,
    mkdtempSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, describe, expect, test } from "vitest";

import { ClaudeCli } from "../src/ClaudeCli";
import { ClaudeFailedError } from "../src/ClaudeError";
import { listClaudeSessions } from "../src/listClaudeSessions";

const directory = mkdtempSync(path.join(tmpdir(), "claude-cli-sessions-"));

function writeFakeClaude(name: string, body: string): string {
    const scriptPath = path.join(directory, name);
    writeFileSync(scriptPath, `#!/bin/sh\n${body}\n`);
    chmodSync(scriptPath, 0o755);

    return scriptPath;
}

afterAll(() => rmSync(directory, { recursive: true, force: true }));

describe("listClaudeSessions", () => {
    test("세션 목록과 시작 프롬프트를 합치고, 파일이 없으면 비워 둔다", async () => {
        const jobsDirectory = path.join(directory, "jobs");
        mkdirSync(path.join(jobsDirectory, "b1"), { recursive: true });
        writeFileSync(
            path.join(jobsDirectory, "b1", "state.json"),
            JSON.stringify({ intent: "시작 프롬프트" }),
        );
        const entries = [
            {
                pid: 42,
                id: "b1",
                sessionId: "s1",
                name: "이름",
                cwd: "/work",
                kind: "background",
                startedAt: 5,
            },
            {
                id: "b2",
                sessionId: "s2",
                cwd: "/work",
                kind: "interactive",
                startedAt: 6,
            },
            { id: "b3", kind: "background" },
        ];

        const sessions = await listClaudeSessions({
            executable: writeFakeClaude(
                "agents",
                `echo '${JSON.stringify(entries)}'`,
            ),
            workingDirectory: directory,
            timeoutMs: 5000,
            jobsDirectory,
        });

        expect(sessions).toEqual([
            {
                sessionId: "s1",
                backgroundId: "b1",
                name: "이름",
                intent: "시작 프롬프트",
                workingDirectory: "/work",
                isBackground: true,
                startedAtMs: 5,
                pid: 42,
            },
            {
                sessionId: "s2",
                backgroundId: "b2",
                name: "",
                intent: "",
                workingDirectory: "/work",
                isBackground: false,
                startedAtMs: 6,
                pid: undefined,
            },
        ]);
    });
});

describe("ClaudeCli.runCollectingToolCalls", () => {
    const command = { commandLineArguments: ["-p"], standardInput: "질문" };

    test("도구 호출과 결과를 짝지어 돌려준다", async () => {
        const stream = path.join(directory, "stream.jsonl");
        writeFileSync(
            stream,
            [
                {
                    type: "assistant",
                    message: {
                        content: [
                            {
                                type: "tool_use",
                                id: "t1",
                                name: "SendMessage",
                                input: { to: "a" },
                            },
                        ],
                    },
                },
                {
                    type: "user",
                    message: {
                        content: [
                            {
                                type: "tool_result",
                                tool_use_id: "t1",
                                is_error: true,
                                content: [{ type: "text", text: "실패" }],
                            },
                        ],
                    },
                },
                { type: "result", is_error: false, result: "끝" },
            ]
                .map((event) => JSON.stringify(event))
                .join("\n"),
        );
        const cli = new ClaudeCli(
            writeFakeClaude("stream", `cat > /dev/null; cat "${stream}"`),
            5000,
        );

        await expect(
            cli.runCollectingToolCalls(command, directory),
        ).resolves.toEqual([
            {
                name: "SendMessage",
                input: { to: "a" },
                isError: true,
                resultText: "실패",
            },
        ]);
    });

    test.each([
        [
            "result 이벤트가 없을 때",
            `echo '{"type":"system"}'`,
            "result 이벤트",
        ],
        [
            "오류 결과일 때",
            `echo '{"type":"result","is_error":true,"result":"한도 초과"}'`,
            "한도 초과",
        ],
    ])("%s 는 실패로 처리한다", async (_, body, expected) => {
        const cli = new ClaudeCli(
            writeFakeClaude(`failure-${expected}`, `cat > /dev/null; ${body}`),
            5000,
        );
        const running = cli.runCollectingToolCalls(command, directory);

        await expect(running).rejects.toBeInstanceOf(ClaudeFailedError);
        await expect(running).rejects.toThrow(expected);
    });
});
