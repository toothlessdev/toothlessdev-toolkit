import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;

export interface ClaudeSession {
    readonly sessionId: string;
    readonly backgroundId: string;
    readonly name: string;
    /** 세션을 시작한 프롬프트 앞부분입니다. 외부 메시지일 수 있으니 데이터로만 다룹니다. */
    readonly intent: string;
    readonly workingDirectory: string;
    readonly isBackground: boolean;
    readonly startedAtMs: number;
    /** 프로세스가 살아 있을 때만 있습니다. 메시지를 받을 수 있는지 판단하는 기준입니다. */
    readonly pid?: number;
    /** claude 가 보고하는 진행 상태입니다. 예: working, blocked, done */
    readonly state?: string;
}

interface ClaudeAgentEntry {
    readonly pid?: number;
    readonly state?: string;
    readonly id?: string;
    readonly sessionId?: string;
    readonly name?: string;
    readonly cwd?: string;
    readonly kind?: string;
    readonly startedAt?: number;
}

export interface ListClaudeSessionsOptions {
    readonly executable: string;
    readonly workingDirectory: string;
    readonly timeoutMs: number;
    readonly jobsDirectory: string;
    readonly cancelSignal?: AbortSignal;
}

export async function listClaudeSessions({
    executable,
    workingDirectory,
    timeoutMs,
    jobsDirectory,
    cancelSignal,
}: ListClaudeSessionsOptions): Promise<ClaudeSession[]> {
    const { stdout } = await execFileAsync(
        executable,
        ["agents", "--json", "--all"],
        {
            cwd: workingDirectory,
            timeout: timeoutMs,
            maxBuffer: MAX_OUTPUT_BYTES,
            encoding: "utf8",
            signal: cancelSignal,
        },
    );

    const entries = JSON.parse(stdout) as ClaudeAgentEntry[];
    const sessions = entries.flatMap((entry) =>
        entry.sessionId ? [{ ...entry, sessionId: entry.sessionId }] : [],
    );

    return Promise.all(
        sessions.map(async (entry) => ({
            sessionId: entry.sessionId,
            backgroundId: entry.id ?? "",
            name: entry.name ?? "",
            intent: await readIntent(jobsDirectory, entry.id),
            workingDirectory: entry.cwd ?? "",
            isBackground: entry.kind === "background",
            startedAtMs: entry.startedAt ?? 0,
            pid: entry.pid,
            state: entry.state,
        })),
    );
}

/**
 * 시작 프롬프트는 claude 내부 파일에만 있습니다. 공개된 형식이 아니라서
 * 읽지 못해도 실패하지 않고 세션 이름만으로 매칭합니다.
 */
async function readIntent(
    jobsDirectory: string,
    backgroundId: string | undefined,
): Promise<string> {
    if (!backgroundId) return "";

    try {
        const state = JSON.parse(
            await readFile(
                path.join(jobsDirectory, backgroundId, "state.json"),
                "utf8",
            ),
        ) as { intent?: unknown };

        return typeof state.intent === "string" ? state.intent : "";
    } catch {
        return "";
    }
}
