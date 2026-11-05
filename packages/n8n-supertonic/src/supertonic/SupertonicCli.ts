import { execFile, type ExecFileException } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import {
    buildSupertonicArguments,
    type SupertonicRequest,
} from "./buildSupertonicArguments";
import {
    SupertonicCancelledError,
    SupertonicFailedError,
    SupertonicTimedOutError,
} from "./SupertonicError";

const execFileAsync = promisify(execFile);

const OUTPUT_FILE_NAME = "speech.wav";
const MAX_ERROR_DETAIL_LENGTH = 500;

type ExecFailure = ExecFileException & { stdout?: string; stderr?: string };

export class SupertonicCli {
    constructor(
        private readonly executable: string,
        private readonly timeoutMs: number,
    ) {}

    async synthesize(
        request: SupertonicRequest,
        cancelSignal?: AbortSignal,
    ): Promise<Buffer> {
        const workingDirectory = await mkdtemp(
            path.join(tmpdir(), "n8n-supertonic-"),
        );

        try {
            const outputPath = path.join(workingDirectory, OUTPUT_FILE_NAME);
            await this.execute(
                buildSupertonicArguments(request, outputPath),
                workingDirectory,
                cancelSignal,
            );

            return await readFile(outputPath);
        } finally {
            await rm(workingDirectory, { recursive: true, force: true });
        }
    }

    private async execute(
        commandLineArguments: string[],
        workingDirectory: string,
        cancelSignal?: AbortSignal,
    ): Promise<void> {
        try {
            await execFileAsync(this.executable, commandLineArguments, {
                cwd: workingDirectory,
                timeout: this.timeoutMs,
                signal: cancelSignal,
            });
        } catch (error) {
            throw this.toSupertonicError(error as ExecFailure);
        }
    }

    private toSupertonicError(failure: ExecFailure): Error {
        const options = { cause: failure };

        if (failure.name === "AbortError") {
            return new SupertonicCancelledError(
                "supertonic 실행이 취소됐습니다",
                options,
            );
        }

        if (failure.code === "ENOENT") {
            return new SupertonicFailedError(
                `${this.executable} 를 찾지 못했습니다. uv tool install 'supertonic==1.3.1' --python 3.12 로 설치하거나 Executable 에 절대 경로를 넣어 주세요`,
                options,
            );
        }

        if (failure.signal) {
            return new SupertonicTimedOutError(
                `supertonic 이 ${this.timeoutMs}ms 안에 끝나지 않아 ${failure.signal} 로 종료했습니다`,
                options,
            );
        }

        const detail = (failure.stderr || failure.stdout || failure.message)
            .trim()
            .slice(-MAX_ERROR_DETAIL_LENGTH);
        return new SupertonicFailedError(
            `supertonic 이 실패했습니다: ${detail}`,
            options,
        );
    }
}
