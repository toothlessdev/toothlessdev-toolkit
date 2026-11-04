import { execFile, type ExecFileException } from "node:child_process";
import { promisify } from "node:util";

import type { ClaudeCommand } from "./buildClaudeCommand";
import {
    ClaudeCancelledError,
    ClaudeFailedError,
    ClaudeTimedOutError,
    excerpt,
} from "./ClaudeError";

const execFileAsync = promisify(execFile);

/** 기본값 1 MB 면 긴 답변에서 프로세스가 강제 종료됩니다. */
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;

/** claude --bg 는 JSON 출력이 없어서 사람이 읽는 첫 줄에서 ID 를 뽑습니다. */
const BACKGROUND_ID_PATTERN = /^backgrounded · ([0-9a-f]+)/m;

type ExecFailure = ExecFileException & { stdout?: string; stderr?: string };

export interface ClaudeResult {
    readonly result: string;
    readonly sessionId: string;
    readonly deniedTools: readonly string[];
    readonly structuredOutput?: unknown;
}

export interface ClaudeBackgroundSession {
    readonly backgroundId: string;
    readonly sessionId: string;
}

interface ProcessOutput {
    readonly exitCode: number | null;
    readonly signal: NodeJS.Signals | null;
    readonly standardOutput: string;
    readonly standardError: string;
}

interface ClaudeJsonOutput {
    readonly is_error?: boolean;
    readonly subtype?: string;
    readonly result?: unknown;
    readonly session_id?: unknown;
    readonly structured_output?: unknown;
    readonly permission_denials?: ReadonlyArray<{ tool_name?: string }>;
}

interface ClaudeAgentEntry {
    readonly id?: string;
    readonly sessionId?: string;
}

export class ClaudeCli {
    constructor(
        private readonly executable: string,
        private readonly timeoutMs: number,
    ) {}

    /** 모든 실패를 `ClaudeError` 로 던져서 호출부가 한곳에서 처리하게 합니다. */
    async run(
        command: ClaudeCommand,
        workingDirectory: string,
        cancelSignal?: AbortSignal,
    ): Promise<ClaudeResult> {
        const output = await this.execute(
            command,
            workingDirectory,
            cancelSignal,
        );
        this.assertSucceeded(output);

        return this.interpret(output, command);
    }

    /** 세션을 띄우고 바로 돌아옵니다. 세션의 결과와 종료는 기다리지 않습니다. */
    async startBackground(
        command: ClaudeCommand,
        workingDirectory: string,
        cancelSignal?: AbortSignal,
    ): Promise<ClaudeBackgroundSession> {
        const output = await this.execute(
            command,
            workingDirectory,
            cancelSignal,
        );
        this.assertSucceeded(output);

        const backgroundId = BACKGROUND_ID_PATTERN.exec(
            output.standardOutput,
        )?.[1];
        if (!backgroundId) {
            throw new ClaudeFailedError(
                `claude --bg 출력에서 세션 ID 를 찾지 못했습니다: ${excerpt(output.standardOutput)}`,
            );
        }

        return {
            backgroundId,
            sessionId: await this.findSessionId(
                backgroundId,
                workingDirectory,
                cancelSignal,
            ),
        };
    }

    /** --bg 출력의 ID 는 8자리라서 --resume 에 넘길 UUID 를 목록에서 찾습니다. */
    private async findSessionId(
        backgroundId: string,
        workingDirectory: string,
        cancelSignal?: AbortSignal,
    ): Promise<string> {
        const output = await this.execute(
            {
                commandLineArguments: ["agents", "--json", "--all"],
                standardInput: "",
            },
            workingDirectory,
            cancelSignal,
        );
        this.assertSucceeded(output);

        const sessions = this.parse<ClaudeAgentEntry[]>(output.standardOutput);
        const sessionId = sessions.find(
            (session) => session.id === backgroundId,
        )?.sessionId;
        if (!sessionId) {
            throw new ClaudeFailedError(
                `claude agents 목록에 ${backgroundId} 세션이 없습니다`,
            );
        }

        return sessionId;
    }

    private async execute(
        command: ClaudeCommand,
        workingDirectory: string,
        cancelSignal?: AbortSignal,
    ): Promise<ProcessOutput> {
        const pending = execFileAsync(
            this.executable,
            [...command.commandLineArguments],
            {
                cwd: workingDirectory,
                timeout: this.timeoutMs,
                maxBuffer: MAX_OUTPUT_BYTES,
                encoding: "utf8",
                signal: cancelSignal,
            },
        );

        // 입력을 읽기 전에 끝나는 프로세스가 있으면 EPIPE 로 이 프로세스까지 죽습니다.
        pending.child.stdin?.on("error", () => {});
        pending.child.stdin?.end(command.standardInput);

        try {
            const { stdout, stderr } = await pending;
            return {
                exitCode: 0,
                signal: null,
                standardOutput: stdout,
                standardError: stderr,
            };
        } catch (error) {
            const failure = error as ExecFailure;

            if (failure.name === "AbortError") {
                throw new ClaudeCancelledError("claude 실행이 취소됐습니다", {
                    cause: failure,
                });
            }

            // code 가 문자열이면(ENOENT, 출력 한도 초과) 보고할 종료 코드가 없습니다.
            if (typeof failure.code === "string") {
                throw new ClaudeFailedError(
                    `${this.executable} 를 실행하지 못했습니다 (cwd: ${workingDirectory}): ${failure.message}`,
                    { cause: failure },
                );
            }

            return {
                exitCode: failure.code ?? null,
                signal: failure.signal ?? null,
                standardOutput: failure.stdout ?? "",
                standardError: failure.stderr ?? "",
            };
        }
    }

    private assertSucceeded(output: ProcessOutput): void {
        if (output.signal) {
            throw new ClaudeTimedOutError(
                `claude 가 ${this.timeoutMs}ms 안에 끝나지 않아 ${output.signal} 로 중단됐습니다`,
            );
        }

        if (output.exitCode !== 0) {
            const detail = output.standardError || output.standardOutput;
            throw new ClaudeFailedError(
                `claude 가 종료 코드 ${output.exitCode} 로 실패했습니다: ${excerpt(detail)}`,
            );
        }
    }

    private interpret(
        output: ProcessOutput,
        command: ClaudeCommand,
    ): ClaudeResult {
        const parsedOutput = this.parse<ClaudeJsonOutput>(
            output.standardOutput,
        );
        if (parsedOutput.is_error) {
            const detail =
                typeof parsedOutput.result === "string"
                    ? parsedOutput.result
                    : (parsedOutput.subtype ?? "알 수 없는 오류");
            throw new ClaudeFailedError(
                `claude 가 오류를 반환했습니다: ${excerpt(detail)}`,
            );
        }

        if (
            typeof parsedOutput.result !== "string" ||
            typeof parsedOutput.session_id !== "string"
        ) {
            throw new ClaudeFailedError(
                `claude 출력에 result 나 session_id 가 없습니다: ${excerpt(output.standardOutput)}`,
            );
        }

        /**
         * 값이 없는 채로 돌려주면 다음 Switch 노드의 조건이 undefined 가 되어
         * 오류 없이 fallback 분기로 빠집니다. Additional Arguments 로 넘긴 경우도 함께 잡습니다.
         */
        const expectsStructuredOutput =
            command.commandLineArguments.includes("--json-schema");
        if (expectsStructuredOutput && parsedOutput.structured_output == null) {
            throw new ClaudeFailedError(
                `--json-schema 를 넘겼지만 claude 출력에 structured_output 이 없습니다: ${excerpt(output.standardOutput)}`,
            );
        }

        const deniedTools = (parsedOutput.permission_denials ?? []).flatMap(
            (denial) => (denial.tool_name ? [denial.tool_name] : []),
        );

        return {
            result: parsedOutput.result,
            sessionId: parsedOutput.session_id,
            deniedTools: [...new Set(deniedTools)],
            structuredOutput: parsedOutput.structured_output ?? undefined,
        };
    }

    private parse<ParsedOutput>(standardOutput: string): ParsedOutput {
        try {
            return JSON.parse(standardOutput) as ParsedOutput;
        } catch (error) {
            throw new ClaudeFailedError(
                `claude 출력이 JSON 이 아닙니다: ${excerpt(standardOutput)}`,
                { cause: error },
            );
        }
    }
}
