import {
    appendFileSync,
    existsSync,
    mkdirSync,
    readFileSync,
    rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
    buildDenyReason,
    judgeItem,
    normalizeSubmittedItem,
    toReadRecord,
} from "./read-ledger.mjs";

/**
 * hooks.json 의 hook 은 전역이라 모든 세션과 에이전트의 도구 호출에 실행됩니다.
 * plugin agent 는 frontmatter hooks 가 무시되므로 여기서 agent_type 으로 걸러야 합니다.
 */
const INVESTIGATOR_AGENT_TYPE = "bfs:investigator";

function ledgerPathOf(hookInput) {
    const dataDirectory =
        process.env.CLAUDE_PLUGIN_DATA ??
        path.join(tmpdir(), "bfs-plugin-data");
    const safeSegment = (value) =>
        String(value ?? "unknown").replace(/[^A-Za-z0-9_-]/g, "_");
    return path.join(
        dataDirectory,
        "read-ledger",
        safeSegment(hookInput.session_id),
        `${safeSegment(hookInput.agent_id)}.jsonl`,
    );
}

function loadRecords(ledgerPath) {
    if (!existsSync(ledgerPath)) return [];
    return readFileSync(ledgerPath, "utf8")
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map((line) => JSON.parse(line));
}

function recordRead(hookInput, ledgerPath) {
    const record = toReadRecord(hookInput.tool_response, hookInput.cwd);
    if (!record) return;

    mkdirSync(path.dirname(ledgerPath), { recursive: true });
    appendFileSync(ledgerPath, `${JSON.stringify(record)}\n`);
}

function denySubmission(reason) {
    process.stdout.write(
        JSON.stringify({
            hookSpecificOutput: {
                hookEventName: "PreToolUse",
                permissionDecision: "deny",
                permissionDecisionReason: reason,
            },
        }),
    );
}

/**
 * bfs 워크플로는 readGate 를 켜면 schema 에 rows[].item 이 있는지 시작할 때 검사합니다.
 * 그래서 rows 가 없는 investigator 제출은 판정할 수 없는 제출로 보고 거부합니다.
 */
function gateSubmission(hookInput, ledgerPath) {
    const rows = hookInput.tool_input?.rows;
    if (!Array.isArray(rows)) {
        denySubmission(
            "제출 거부: 결과에 rows 배열이 없어 Read 게이트가 판정할 수 없습니다. rows[].item 에 파일 경로를 넣어 제출하세요.",
        );
        return;
    }

    const items = [
        ...new Set(
            rows
                .map((row) => row?.item)
                .filter((item) => typeof item === "string")
                .map(normalizeSubmittedItem)
                .filter((item) => item !== ""),
        ),
    ];
    const records = loadRecords(ledgerPath);
    const denyReason = buildDenyReason(
        items.map((item) => judgeItem(item, records, hookInput.cwd)),
    );
    if (denyReason) denySubmission(denyReason);
}

/**
 * hook 이 0 과 2 가 아닌 코드로 끝나면 Claude Code 는 막지 않는 에러로 보고 도구를 그대로 실행합니다.
 * 그래서 제출 판정 중 생긴 예외는 전부 잡아 deny 로 바꿉니다(fail-closed).
 * 입력 JSON 을 해석하지 못하면 agent_type 을 알 수 없으므로, 원문에 investigator 제출의
 * 흔적이 있을 때만 거부합니다. 다른 에이전트의 호출까지 막지 않기 위해서입니다.
 */
function looksLikeInvestigatorSubmission(rawInput) {
    return (
        rawInput.includes(INVESTIGATOR_AGENT_TYPE) &&
        rawInput.includes("StructuredOutput")
    );
}

function describeError(error) {
    return error instanceof Error ? error.message : String(error);
}

const rawInput = readFileSync(0, "utf8");

let hookInput;
try {
    hookInput = JSON.parse(rawInput);
} catch (error) {
    if (looksLikeInvestigatorSubmission(rawInput)) {
        denySubmission(
            `제출 거부: Read 게이트가 hook 입력을 해석하지 못해 판정할 수 없습니다(${describeError(error)}).`,
        );
    }
    process.exit(0);
}

if (hookInput.agent_type === INVESTIGATOR_AGENT_TYPE) {
    const ledgerPath = ledgerPathOf(hookInput);
    const isSubmission =
        hookInput.hook_event_name === "PreToolUse" &&
        hookInput.tool_name === "StructuredOutput";

    if (isSubmission) {
        try {
            gateSubmission(hookInput, ledgerPath);
        } catch (error) {
            denySubmission(
                `제출 거부: Read 게이트가 판정 중 실패했습니다(${describeError(error)}). 다시 제출해도 같으면 이 제출은 받을 수 없습니다.`,
            );
        }
    }

    /**
     * 기록에 실패해도 Read 자체는 막지 않습니다. 그 구간은 원장에 없으므로 제출 때
     * 읽지 않은 구간으로 거부되고, 원인은 stderr 로 남겨 디버그 로그에서 찾을 수 있게 합니다.
     */
    if (
        hookInput.hook_event_name === "PostToolUse" &&
        hookInput.tool_name === "Read"
    ) {
        try {
            recordRead(hookInput, ledgerPath);
        } catch (error) {
            process.stderr.write(
                `bfs Read 게이트: Read 기록 실패(${describeError(error)}), 원장 ${ledgerPath}\n`,
            );
        }
    }
    if (hookInput.hook_event_name === "SubagentStop")
        rmSync(ledgerPath, { force: true });
}
