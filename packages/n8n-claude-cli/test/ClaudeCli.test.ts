import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, describe, expect, test } from "vitest";

import { ClaudeCli } from "../src/claude/ClaudeCli";
import {
    ClaudeCancelledError,
    ClaudeFailedError,
    ClaudeTimedOutError,
} from "../src/claude/ClaudeError";

const temporaryDirectory = mkdtempSync(path.join(tmpdir(), "claude-cli-test-"));
let scriptCount = 0;

function writeFakeClaude(body: string): string {
    scriptCount += 1;
    const scriptPath = path.join(temporaryDirectory, `claude-${scriptCount}`);
    writeFileSync(scriptPath, `#!/bin/sh\n${body}\n`);
    chmodSync(scriptPath, 0o755);

    return scriptPath;
}

const command = { commandLineArguments: ["-p"], standardInput: "질문" };

afterAll(() => rmSync(temporaryDirectory, { recursive: true, force: true }));

describe("ClaudeCli", () => {
    test("stdin 을 넘기고 출력을 해석한다", async () => {
        const executable = writeFakeClaude(
            `input=$(cat); printf '{"result":"%s","session_id":"s1"}' "$input"`,
        );

        await expect(
            new ClaudeCli(executable, 5000).run(command, temporaryDirectory),
        ).resolves.toEqual({
            result: "질문",
            sessionId: "s1",
            deniedTools: [],
        });
    });

    test("거부된 도구를 중복 없이 돌려준다", async () => {
        const executable = writeFakeClaude(
            `cat >/dev/null; echo '{"result":"r","session_id":"s","permission_denials":[{"tool_name":"Bash"},{"tool_name":"Bash"},{"tool_name":"Write"}]}'`,
        );

        const result = await new ClaudeCli(executable, 5000).run(
            command,
            temporaryDirectory,
        );
        expect(result.deniedTools).toEqual(["Bash", "Write"]);
    });

    test("입력을 읽지 않고 끝나도 죽지 않는다", async () => {
        const executable = writeFakeClaude(
            `echo '{"result":"r","session_id":"s"}'`,
        );
        const largeCommand = {
            ...command,
            standardInput: "x".repeat(1024 * 1024),
        };

        await expect(
            new ClaudeCli(executable, 5000).run(
                largeCommand,
                temporaryDirectory,
            ),
        ).resolves.toMatchObject({ result: "r" });
    });

    test.each([
        [
            "0 이 아닌 종료 코드",
            `echo 'No conversation' >&2; exit 1`,
            "No conversation",
        ],
        ["JSON 이 아닌 출력", `echo 'not json'`, "JSON"],
        [
            "is_error 응답",
            `echo '{"is_error":true,"result":"한도 초과"}'`,
            "한도 초과",
        ],
        [
            "result 없는 오류",
            `echo '{"is_error":true,"subtype":"error_max_budget_usd"}'`,
            "error_max_budget_usd",
        ],
        ["session_id 누락", `echo '{"result":"r"}'`, "session_id"],
    ])("%s 는 ClaudeFailedError 로 던진다", async (_, body, message) => {
        const runner = new ClaudeCli(writeFakeClaude(body), 5000);
        const running = runner.run(command, temporaryDirectory);

        await expect(running).rejects.toBeInstanceOf(ClaudeFailedError);
        await expect(running).rejects.toThrow(message);
    });

    test("실행 파일이 없으면 ClaudeFailedError 로 던진다", async () => {
        await expect(
            new ClaudeCli("/nonexistent/claude", 5000).run(
                command,
                temporaryDirectory,
            ),
        ).rejects.toBeInstanceOf(ClaudeFailedError);
    });

    test("시간 초과는 ClaudeTimedOutError 로 던진다", async () => {
        const executable = writeFakeClaude("exec sleep 5");

        await expect(
            new ClaudeCli(executable, 100).run(command, temporaryDirectory),
        ).rejects.toBeInstanceOf(ClaudeTimedOutError);
    });

    describe("startBackground", () => {
        const backgroundCommand = {
            commandLineArguments: ["--bg"],
            standardInput: "질문",
        };
        const sessionId = "61ec17e6-ab70-4dfe-ab0c-9dcecd7796fb";

        test("--bg 출력의 ID 로 UUID 를 찾아 돌려준다", async () => {
            const executable = writeFakeClaude(
                `if [ "$1" = "agents" ]; then
                    echo '[{"id":"00000000","sessionId":"other"},{"id":"61ec17e6","sessionId":"${sessionId}"}]'
                else
                    cat >/dev/null
                    echo 'backgrounded · 61ec17e6 · 이름'
                fi`,
            );

            await expect(
                new ClaudeCli(executable, 5000).startBackground(
                    backgroundCommand,
                    temporaryDirectory,
                ),
            ).resolves.toEqual({ backgroundId: "61ec17e6", sessionId });
        });

        test.each([
            [
                "신뢰되지 않은 폴더",
                `echo 'Workspace not trusted.' >&2; exit 1`,
                "Workspace not trusted",
            ],
            ["ID 없는 출력", `echo 'hello'`, "세션 ID"],
            [
                "목록에 없는 세션",
                `if [ "$1" = "agents" ]; then echo '[]'; else echo 'backgrounded · 61ec17e6'; fi`,
                "61ec17e6",
            ],
        ])("%s 는 ClaudeFailedError 로 던진다", async (_, body, message) => {
            const running = new ClaudeCli(
                writeFakeClaude(body),
                5000,
            ).startBackground(backgroundCommand, temporaryDirectory);

            await expect(running).rejects.toBeInstanceOf(ClaudeFailedError);
            await expect(running).rejects.toThrow(message);
        });
    });

    test("취소하면 ClaudeCancelledError 로 던진다", async () => {
        const executable = writeFakeClaude("exec sleep 5");
        const controller = new AbortController();
        const running = new ClaudeCli(executable, 5000).run(
            command,
            temporaryDirectory,
            controller.signal,
        );
        controller.abort();

        await expect(running).rejects.toBeInstanceOf(ClaudeCancelledError);
    });
});
