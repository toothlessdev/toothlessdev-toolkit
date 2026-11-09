import { spawnSync } from "node:child_process";
import {
    appendFileSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    realpathSync,
    rmSync,
    statSync,
    symlinkSync,
    utimesSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

import {
    buildDenyReason,
    countReadToolLines,
    findUnreadRanges,
    judgeItem,
    resolveTargetPath,
    suggestReadLimit,
    toReadRecord,
} from "./read-ledger.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const gateScriptPath = path.join(scriptDirectory, "read-gate.mjs");
const workDirectory = realpathSync(
    mkdtempSync(path.join(tmpdir(), "bfs-read-gate-")),
);

after(() => rmSync(workDirectory, { recursive: true, force: true }));

function writeFixture(name, content) {
    const filePath = path.join(workDirectory, name);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, content);
    return filePath;
}

function lines(count) {
    return Array.from(
        { length: count },
        (_, index) => `line ${index + 1}`,
    ).join("\n");
}

function recordOf(filePath, startLine, numLines, totalLines) {
    return {
        path: filePath,
        startLine,
        numLines,
        totalLines,
        mtimeMs: statSync(filePath).mtimeMs,
    };
}

function range(startLine, numLines) {
    return { startLine, numLines };
}

describe("findUnreadRanges: 읽은 구간과 totalLines 경계", () => {
    const totalLines = 10;

    test("마지막 줄 직전까지 읽으면 마지막 줄이 남는다", () => {
        assert.deepEqual(findUnreadRanges([range(1, 9)], totalLines), [
            [10, 10],
        ]);
    });

    test("마지막 줄까지 읽으면 남는 구간이 없다", () => {
        assert.deepEqual(findUnreadRanges([range(1, 10)], totalLines), []);
    });

    test("첫 줄을 빼고 읽으면 첫 줄이 남는다", () => {
        assert.deepEqual(findUnreadRanges([range(2, 9)], totalLines), [[1, 1]]);
    });

    test("가운데 한 줄을 건너뛰면 그 줄만 남는다", () => {
        assert.deepEqual(
            findUnreadRanges([range(1, 4), range(6, 5)], totalLines),
            [[5, 5]],
        );
    });

    test("겹치는 두 구간은 합쳐서 본다", () => {
        assert.deepEqual(
            findUnreadRanges([range(1, 7), range(4, 7)], totalLines),
            [],
        );
    });

    test("역순으로 읽어도 순서와 상관없이 판정한다", () => {
        assert.deepEqual(
            findUnreadRanges([range(6, 5), range(1, 5)], totalLines),
            [],
        );
    });

    test("파일 끝을 넘은 offset 기록(numLines 0)은 아무 줄도 덮지 않는다", () => {
        assert.deepEqual(findUnreadRanges([range(100, 0)], totalLines), [
            [1, 10],
        ]);
    });

    test("2000줄 구간 하나로 2001줄 파일을 읽으면 2001번 줄이 남는다", () => {
        assert.deepEqual(findUnreadRanges([range(1, 2000)], 2001), [
            [2001, 2001],
        ]);
    });

    test("2000줄 구간 하나로 2000줄 파일을 읽으면 남는 구간이 없다", () => {
        assert.deepEqual(findUnreadRanges([range(1, 2000)], 2000), []);
    });
});

describe("countReadToolLines: Read 의 totalLines 와 같은 방식으로 센다", () => {
    test("끝 개행이 없으면 줄 수 그대로", () => {
        assert.equal(
            countReadToolLines(writeFixture("count/no-newline.txt", "a\nb\nc")),
            3,
        );
    });

    test("끝 개행이 있으면 빈 마지막 줄까지 센다", () => {
        assert.equal(
            countReadToolLines(writeFixture("count/trailing.txt", "a\nb\nc\n")),
            4,
        );
    });

    test("CRLF 도 LF 와 같게 센다", () => {
        assert.equal(
            countReadToolLines(
                writeFixture("count/crlf.txt", "a\r\nb\r\nc\r\n"),
            ),
            4,
        );
    });

    test("빈 파일은 1", () => {
        assert.equal(
            countReadToolLines(writeFixture("count/empty.txt", "")),
            1,
        );
    });
});

describe("resolveTargetPath: 원장 경로와 항목 경로를 같은 대상으로 맞춘다", () => {
    test("상대경로는 cwd 기준으로 푼다", () => {
        const filePath = writeFixture("resolve/a.txt", "a");
        assert.equal(
            resolveTargetPath("resolve/a.txt", workDirectory),
            filePath,
        );
    });

    test("./ 와 겹친 / 가 있어도 같은 경로가 된다", () => {
        const filePath = writeFixture("resolve/b.txt", "b");
        assert.equal(
            resolveTargetPath("./resolve//b.txt", workDirectory),
            filePath,
        );
    });

    test("symlink 는 실제 파일 경로로 푼다", () => {
        const filePath = writeFixture("resolve/target.txt", "t");
        const linkPath = path.join(workDirectory, "resolve/link.txt");
        symlinkSync(filePath, linkPath);
        assert.equal(resolveTargetPath(linkPath, workDirectory), filePath);
    });

    test(
        "macOS 의 /tmp 는 /private/tmp 로 푼다",
        { skip: process.platform !== "darwin" },
        () => {
            assert.equal(resolveTargetPath("/tmp", "/"), "/private/tmp");
        },
    );

    test("대소문자 무시 파일시스템에서는 실제 대소문자로 푼다", () => {
        const filePath = writeFixture("resolve/CaseFile.txt", "c");
        const differentCasePath = path.join(
            workDirectory,
            "resolve/casefile.txt",
        );
        if (!existsSync(differentCasePath)) return;
        assert.equal(
            resolveTargetPath(differentCasePath, workDirectory),
            filePath,
        );
    });

    test("없는 경로는 정규화한 절대경로를 그대로 돌려준다", () => {
        assert.equal(
            resolveTargetPath("missing/x.txt", workDirectory),
            path.join(workDirectory, "missing/x.txt"),
        );
    });
});

describe("toReadRecord: Read 결과에서 원장 한 줄을 만든다", () => {
    test("text 결과는 구간과 mtime 을 남긴다", () => {
        const filePath = writeFixture("record/a.txt", "a\nb\n");
        const record = toReadRecord(
            {
                type: "text",
                file: {
                    filePath,
                    content: "a\nb\n",
                    numLines: 3,
                    startLine: 1,
                    totalLines: 3,
                },
            },
            workDirectory,
        );
        assert.deepEqual(record, {
            path: filePath,
            requestedPath: filePath,
            startLine: 1,
            numLines: 3,
            totalLines: 3,
            mtimeMs: statSync(filePath).mtimeMs,
        });
    });

    test("text 가 아닌 결과는 기록하지 않는다", () => {
        assert.equal(
            toReadRecord(
                { type: "image", file: { filePath: "/x.png" } },
                workDirectory,
            ),
            null,
        );
    });

    test("file 이 없는 결과는 기록하지 않는다", () => {
        assert.equal(toReadRecord("Error: EISDIR", workDirectory), null);
    });
});

describe("judgeItem: 항목 종류별 판정", () => {
    test("전부 읽은 텍스트 파일은 covered", () => {
        const filePath = writeFixture("judge/covered.txt", lines(5));
        assert.equal(
            judgeItem(filePath, [recordOf(filePath, 1, 5, 5)], workDirectory)
                .status,
            "covered",
        );
    });

    test("일부만 읽은 파일은 partial 이고 빠진 구간을 돌려준다", () => {
        const filePath = writeFixture("judge/partial.txt", lines(5));
        const judgement = judgeItem(
            filePath,
            [recordOf(filePath, 1, 3, 5)],
            workDirectory,
        );
        assert.equal(judgement.status, "partial");
        assert.deepEqual(judgement.unreadRanges, [[4, 5]]);
    });

    test("기록이 없는 파일은 unread 이고 Read 기준 줄 수를 알려 준다", () => {
        const filePath = writeFixture("judge/unread.txt", "a\nb\n");
        const judgement = judgeItem(filePath, [], workDirectory);
        assert.equal(judgement.status, "unread");
        assert.equal(judgement.totalLines, 3);
    });

    test("빈 파일은 한 번 읽으면 covered", () => {
        const filePath = writeFixture("judge/empty.txt", "");
        assert.equal(
            judgeItem(filePath, [recordOf(filePath, 1, 1, 1)], workDirectory)
                .status,
            "covered",
        );
    });

    test("읽은 뒤 mtime 이 바뀌면 changed", () => {
        const filePath = writeFixture("judge/changed.txt", lines(3));
        const staleRecord = {
            ...recordOf(filePath, 1, 3, 3),
            mtimeMs: statSync(filePath).mtimeMs - 5000,
        };
        assert.equal(
            judgeItem(filePath, [staleRecord], workDirectory).status,
            "changed",
        );
    });

    test("바뀐 뒤 다시 다 읽으면 covered", () => {
        const filePath = writeFixture("judge/reread.txt", lines(3));
        const staleRecord = {
            ...recordOf(filePath, 1, 3, 3),
            mtimeMs: statSync(filePath).mtimeMs - 5000,
        };
        assert.equal(
            judgeItem(
                filePath,
                [staleRecord, recordOf(filePath, 1, 3, 3)],
                workDirectory,
            ).status,
            "covered",
        );
    });

    test("다른 파일의 기록은 세지 않는다", () => {
        const filePath = writeFixture("judge/mine.txt", lines(3));
        const otherPath = writeFixture("judge/other.txt", lines(3));
        assert.equal(
            judgeItem(filePath, [recordOf(otherPath, 1, 3, 3)], workDirectory)
                .status,
            "unread",
        );
    });

    test("symlink 로 읽은 기록도 실제 파일 항목에 센다", () => {
        const filePath = writeFixture("judge/real.txt", lines(3));
        const linkPath = path.join(workDirectory, "judge/real-link.txt");
        symlinkSync(filePath, linkPath);
        const record = toReadRecord(
            {
                type: "text",
                file: {
                    filePath: linkPath,
                    numLines: 3,
                    startLine: 1,
                    totalLines: 3,
                },
            },
            workDirectory,
        );
        assert.equal(
            judgeItem(filePath, [record], workDirectory).status,
            "covered",
        );
    });

    test("바이너리 파일은 binary", () => {
        const filePath = writeFixture(
            "judge/binary.bin",
            Buffer.from([0x41, 0x00, 0x42]),
        );
        assert.equal(judgeItem(filePath, [], workDirectory).status, "binary");
    });

    test("디렉터리는 not-file", () => {
        mkdirSync(path.join(workDirectory, "judge/dir"), { recursive: true });
        assert.equal(
            judgeItem(path.join(workDirectory, "judge/dir"), [], workDirectory)
                .status,
            "not-file",
        );
    });

    test("없는 경로는 not-file", () => {
        assert.equal(
            judgeItem(
                path.join(workDirectory, "judge/none.txt"),
                [],
                workDirectory,
            ).status,
            "not-file",
        );
    });
});

describe("suggestReadLimit: 256KB 제한 안에서 나눠 읽을 limit", () => {
    test("짧은 줄은 기본 limit 2000 을 넘지 않는다", () => {
        assert.equal(suggestReadLimit(10_000, 1000), 2000);
    });

    test("긴 줄은 한 번에 200KB 이하가 되게 줄인다", () => {
        assert.equal(suggestReadLimit(300_000, 1500), 1024);
    });
});

describe("buildDenyReason: 거부 사유", () => {
    test("전부 covered 면 거부하지 않는다", () => {
        assert.equal(buildDenyReason([{ status: "covered" }]), null);
    });

    test("막힌 항목을 한 번에 전부 적는다", () => {
        const reason = buildDenyReason([
            { status: "covered", path: "/a" },
            {
                status: "partial",
                path: "/b",
                totalLines: 10,
                unreadRanges: [[4, 5]],
                suggestedLimit: 2000,
            },
            {
                status: "unread",
                path: "/c",
                totalLines: 3,
                suggestedLimit: 2000,
            },
        ]);
        assert.match(reason, /2개/);
        assert.match(reason, /\/b: 총 10줄 중 4-5 줄/);
        assert.match(reason, /\/c: 총 3줄/);
        assert.doesNotMatch(reason, /\/a:/);
    });
});

describe("read-gate.mjs: hook 입력에 대한 동작", () => {
    const pluginDataDirectory = path.join(workDirectory, "plugin-data");
    const sessionId = "session-1";

    function runGateWithRawInput(rawInput) {
        const result = spawnSync("node", [gateScriptPath], {
            input: rawInput,
            env: { ...process.env, CLAUDE_PLUGIN_DATA: pluginDataDirectory },
            encoding: "utf8",
        });
        assert.equal(result.status, 0, result.stderr);
        return result.stdout === "" ? null : JSON.parse(result.stdout);
    }

    function runGate(hookInput) {
        return runGateWithRawInput(
            JSON.stringify({
                session_id: sessionId,
                cwd: workDirectory,
                ...hookInput,
            }),
        );
    }

    function ledgerPathOf(agentId) {
        return path.join(
            pluginDataDirectory,
            "read-ledger",
            sessionId,
            `${agentId}.jsonl`,
        );
    }

    function readEvent(agentId, filePath, startLine, numLines, totalLines) {
        return {
            hook_event_name: "PostToolUse",
            tool_name: "Read",
            agent_type: "bfs:investigator",
            agent_id: agentId,
            tool_response: {
                type: "text",
                file: {
                    filePath,
                    content: "",
                    numLines,
                    startLine,
                    totalLines,
                },
            },
        };
    }

    function submitEvent(agentId, items, agentType = "bfs:investigator") {
        return {
            hook_event_name: "PreToolUse",
            tool_name: "StructuredOutput",
            agent_type: agentType,
            agent_id: agentId,
            tool_input: { rows: items.map((item) => ({ item, result: "x" })) },
        };
    }

    test("investigator 가 아닌 에이전트는 기록도 판정도 하지 않는다", () => {
        const filePath = writeFixture("gate/other-agent.txt", lines(4));
        runGate({
            ...readEvent("agent-other", filePath, 1, 2, 4),
            agent_type: "Explore",
        });
        assert.equal(existsSync(ledgerPathOf("agent-other")), false);
        assert.equal(
            runGate(submitEvent("agent-other", [filePath], "Explore")),
            null,
        );
    });

    test("메인 세션(agent_type 없음)도 통과시킨다", () => {
        const { agent_type, ...mainSessionSubmit } = submitEvent("agent-main", [
            "/nonexistent",
        ]);
        assert.equal(runGate(mainSessionSubmit), null);
    });

    test("일부만 읽고 제출하면 빠진 구간을 사유로 거부한다", () => {
        const filePath = writeFixture("gate/partial.txt", lines(4));
        runGate(readEvent("agent-partial", filePath, 1, 2, 4));
        const output = runGate(submitEvent("agent-partial", [filePath]));
        assert.equal(output.hookSpecificOutput.permissionDecision, "deny");
        assert.match(
            output.hookSpecificOutput.permissionDecisionReason,
            /3-4 줄/,
        );
    });

    test("빠진 구간을 마저 읽으면 통과시킨다", () => {
        const filePath = writeFixture("gate/complete.txt", lines(4));
        runGate(readEvent("agent-complete", filePath, 1, 2, 4));
        runGate(readEvent("agent-complete", filePath, 3, 2, 4));
        assert.equal(runGate(submitEvent("agent-complete", [filePath])), null);
    });

    test("다른 에이전트가 읽은 기록은 인정하지 않는다", () => {
        const filePath = writeFixture("gate/shared.txt", lines(4));
        runGate(readEvent("agent-first", filePath, 1, 4, 4));
        const output = runGate(submitEvent("agent-second", [filePath]));
        assert.equal(output.hookSpecificOutput.permissionDecision, "deny");
    });

    test("rows 가 없는 investigator 제출은 판정할 수 없어 거부한다", () => {
        const output = runGate({
            ...submitEvent("agent-norows", []),
            tool_input: { summary: "x" },
        });
        assert.equal(output.hookSpecificOutput.permissionDecision, "deny");
        assert.match(
            output.hookSpecificOutput.permissionDecisionReason,
            /rows 배열이 없어/,
        );
    });

    test("fail-closed: 원장이 깨져 판정 중 예외가 나면 거부한다", () => {
        const filePath = writeFixture("gate/corrupt.txt", lines(2));
        runGate(readEvent("agent-corrupt", filePath, 1, 2, 2));
        appendFileSync(ledgerPathOf("agent-corrupt"), "{not json\n");
        const output = runGate(submitEvent("agent-corrupt", [filePath]));
        assert.equal(output.hookSpecificOutput.permissionDecision, "deny");
        assert.match(
            output.hookSpecificOutput.permissionDecisionReason,
            /판정 중 실패했습니다/,
        );
    });

    test("fail-closed: 해석할 수 없는 입력이 investigator 제출로 보이면 거부한다", () => {
        const output = runGateWithRawInput(
            '{"agent_type":"bfs:investigator","tool_name":"StructuredOutput",',
        );
        assert.equal(output.hookSpecificOutput.permissionDecision, "deny");
        assert.match(
            output.hookSpecificOutput.permissionDecisionReason,
            /해석하지 못해/,
        );
    });

    test("해석할 수 없는 입력이 다른 에이전트 것이면 막지 않는다", () => {
        assert.equal(
            runGateWithRawInput(
                '{"agent_type":"Explore","tool_name":"StructuredOutput",',
            ),
            null,
        );
    });

    test("빈 rows 는 판정할 항목이 없어 통과시킨다", () => {
        assert.equal(runGate(submitEvent("agent-empty", [])), null);
    });

    test("SubagentStop 이면 그 에이전트의 원장을 지운다", () => {
        const filePath = writeFixture("gate/cleanup.txt", lines(2));
        runGate(readEvent("agent-cleanup", filePath, 1, 2, 2));
        assert.equal(existsSync(ledgerPathOf("agent-cleanup")), true);
        runGate({
            hook_event_name: "SubagentStop",
            agent_type: "bfs:investigator",
            agent_id: "agent-cleanup",
        });
        assert.equal(existsSync(ledgerPathOf("agent-cleanup")), false);
    });

    test("원장 기록 후 파일이 바뀌면 다시 읽기 전까지 거부한다", () => {
        const filePath = writeFixture("gate/mutated.txt", lines(2));
        runGate(readEvent("agent-mutated", filePath, 1, 2, 2));
        const future = new Date(Date.now() + 60_000);
        utimesSync(filePath, future, future);
        const output = runGate(submitEvent("agent-mutated", [filePath]));
        assert.match(
            output.hookSpecificOutput.permissionDecisionReason,
            /파일이 바뀌었습니다/,
        );
    });

    test("원장 한 줄에는 파일 내용을 남기지 않는다", () => {
        const filePath = writeFixture("gate/no-content.txt", "secret\n");
        runGate({
            ...readEvent("agent-content", filePath, 1, 2, 2),
            tool_response: {
                type: "text",
                file: {
                    filePath,
                    content: "secret\n",
                    numLines: 2,
                    startLine: 1,
                    totalLines: 2,
                },
            },
        });
        assert.doesNotMatch(
            readFileSync(ledgerPathOf("agent-content"), "utf8"),
            /secret/,
        );
    });
});
