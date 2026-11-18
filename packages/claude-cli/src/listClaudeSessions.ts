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
    /**
     * -p 로 실행한 세션입니다. claude agents 목록에 나오지 않아서 호출부가 따로 기록해 둔 것을 합칩니다.
     * 프로세스가 남지 않으므로 메시지는 받지 못하고 --resume 으로만 이어 갑니다.
     */
    readonly isPrint?: boolean;
    /**
     * Remote Control 로 연결된 세션의 ID 입니다(cse_ 로 시작). 프로세스가 살아 있는 동안
     * 다른 곳에서는 이 ID 의 claude.ai/code 주소로만 세션을 열 수 있습니다.
     */
    readonly remoteControlSessionId?: string;
    /** 세션이 사람에게 묻고 기다리는 내용입니다. state 가 blocked 일 때 claude 가 채웁니다. */
    readonly needs?: string;
    /** claude 가 남긴 지금 진행 상황 한 줄입니다. 외부 메시지를 담을 수 있으니 데이터로만 다룹니다. */
    readonly detail?: string;
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
        sessions.map(async (entry) => {
            const jobState = await readJobState(jobsDirectory, entry.id);

            return {
                sessionId: entry.sessionId,
                backgroundId: entry.id ?? "",
                name: entry.name ?? "",
                workingDirectory: entry.cwd ?? "",
                isBackground: entry.kind === "background",
                startedAtMs: entry.startedAt ?? 0,
                pid: entry.pid,
                state: entry.state,
                ...jobState,
            };
        }),
    );
}

type JobState = Pick<
    ClaudeSession,
    "intent" | "remoteControlSessionId" | "needs" | "detail"
>;

function nonEmptyString(value: unknown): string | undefined {
    return typeof value === "string" && value !== "" ? value : undefined;
}

/**
 * 시작 프롬프트, Remote Control 세션 ID, 진행 상황은 claude 내부 파일에만 있습니다. 공개된 형식이 아니라서
 * 읽지 못해도 실패하지 않습니다. 매칭은 세션 이름만으로 하고, 알림 버튼은 로컬 세션을 엽니다.
 */
async function readJobState(
    jobsDirectory: string,
    backgroundId: string | undefined,
): Promise<JobState> {
    if (!backgroundId) return { intent: "" };

    try {
        const state = JSON.parse(
            await readFile(
                path.join(jobsDirectory, backgroundId, "state.json"),
                "utf8",
            ),
        ) as {
            intent?: unknown;
            bridgeSessionId?: unknown;
            needs?: unknown;
            detail?: unknown;
        };

        const optionalFields = {
            remoteControlSessionId: nonEmptyString(state.bridgeSessionId),
            needs: nonEmptyString(state.needs),
            detail: nonEmptyString(state.detail),
        };

        return {
            intent: nonEmptyString(state.intent) ?? "",
            ...Object.fromEntries(
                Object.entries(optionalFields).filter(
                    ([, value]) => value !== undefined,
                ),
            ),
        };
    } catch {
        return { intent: "" };
    }
}
