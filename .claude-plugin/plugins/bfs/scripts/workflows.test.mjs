import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const WORKFLOW_DIR = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "workflows",
);

/**
 * 워크플로 스크립트는 Workflow 런타임이 주는 전역(agent, parallel, log, phase, workflow)과
 * 최상위 return 으로 동작해서 import 할 수 없습니다. 그래서 원문을 async 함수 본문으로 감싸
 * 전역을 인자로 넣어 실행합니다.
 */
function loadWorkflow(fileName) {
    const source = readFileSync(
        path.join(WORKFLOW_DIR, fileName),
        "utf8",
    ).replace("export const meta", "const meta");
    const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
    const run = new AsyncFunction(
        "args",
        "agent",
        "parallel",
        "log",
        "phase",
        "workflow",
        source,
    );

    return (args, agent) =>
        run(
            args,
            agent,
            (thunks) => Promise.all(thunks.map((thunk) => thunk())),
            () => {},
            () => {},
            () => {
                throw new Error(
                    "이 테스트는 하위 workflow 호출을 다루지 않습니다",
                );
            },
        );
}

function listedItems(prompt) {
    return prompt
        .split("\n")
        .filter((line) => line.startsWith("- "))
        .map((line) => line.slice(2).split(" | ")[0]);
}

const runBfs = loadWorkflow("bfs.js");
const runTraverse = loadWorkflow("traverse.js");

const BFS_ARGS = {
    items: ["a", "b", "c", "d"],
    prompt: "처리:\n{{items}}",
    maxRounds: 2,
    audit: { prompt: "반증:\n{{auditItems}}", ratio: 1 },
};

function bfsAgent(answerAudit) {
    let auditCallCount = 0;
    return async (prompt, options) => {
        const items = listedItems(prompt);
        if (options.phase === "Run")
            return { rows: items.map((item) => ({ item, result: "ok" })) };

        auditCallCount++;
        return answerAudit(items, auditCallCount);
    };
}

describe("bfs 반증 집계", () => {
    test("모든 표본이 응답하면 미검증이 없다", async () => {
        const agent = bfsAgent((items) => ({
            rows: items.map((item) => ({
                item,
                refuted: item === "c",
                reason: "",
            })),
        }));

        const result = await runBfs(BFS_ARGS, agent);

        assert.equal(result.audit.sampledCount, 4);
        assert.equal(result.audit.verifiedCount, 4);
        assert.deepEqual(result.audit.unverified, []);
        assert.deepEqual(
            result.audit.disputed.map((row) => row.item),
            ["c"],
        );
    });

    test("첫 라운드에서 빠진 표본은 다음 라운드에 다시 넣는다", async () => {
        const agent = bfsAgent((items, callCount) => ({
            rows: items
                .filter((item) => callCount > 1 || item !== "b")
                .map((item) => ({ item, refuted: false, reason: "" })),
        }));

        const result = await runBfs(BFS_ARGS, agent);

        assert.equal(result.audit.verifiedCount, 4);
        assert.deepEqual(result.audit.unverified, []);
    });

    test("끝까지 응답하지 않은 표본은 미검증으로 돌려주고 검증 수에서 뺀다", async () => {
        const agent = bfsAgent((items) => ({
            rows: items
                .filter((item) => item !== "b")
                .map((item) => ({ item, refuted: false, reason: "" })),
        }));

        const result = await runBfs(BFS_ARGS, agent);

        assert.equal(result.audit.sampledCount, 4);
        assert.equal(result.audit.verifiedCount, 3);
        assert.deepEqual(result.audit.unverified, ["b"]);
    });

    test("반증 샤드가 실패하면 그 표본 전부가 미검증이다", async () => {
        const agent = bfsAgent(() => null);

        const result = await runBfs(BFS_ARGS, agent);

        assert.equal(result.audit.verifiedCount, 0);
        assert.deepEqual(result.audit.unverified, ["a", "b", "c", "d"]);
        assert.equal(result.audit.failedShardCount, 2);
    });

    test("표본에 없는 항목의 반증 행은 disputed 에 넣지 않는다", async () => {
        const agent = bfsAgent((items) => ({
            rows: [
                ...items.map((item) => ({ item, refuted: false, reason: "" })),
                { item: "z", refuted: true, reason: "" },
            ],
        }));

        const result = await runBfs(BFS_ARGS, agent);

        assert.deepEqual(result.audit.disputed, []);
        assert.equal(result.audit.verifiedCount, 4);
    });
});

const TRAVERSE_ARGS = { seeds: ["root"], prompt: "순회:\n{{nodes}}" };

function traverseAgent(answerCritic) {
    let criticCallCount = 0;
    return async (prompt, options) => {
        if (options.phase === "Traverse") {
            return {
                rows: listedItems(prompt).map((node) => ({
                    node,
                    result: "",
                    children: [],
                })),
            };
        }

        criticCallCount++;
        return answerCritic(criticCallCount);
    };
}

describe("traverse critic 집계", () => {
    test("critic 이 실패하면 놓친 연결 없음과 구분해 실패 라운드로 센다", async () => {
        const result = await runTraverse(
            TRAVERSE_ARGS,
            traverseAgent(() => null),
        );

        assert.deepEqual(result.criticGaps, []);
        assert.equal(result.criticCompletedRounds, 0);
        assert.equal(result.criticFailedRounds, 1);
    });

    test("critic 이 놓친 연결 없음으로 답하면 완료 라운드로 센다", async () => {
        const result = await runTraverse(
            TRAVERSE_ARGS,
            traverseAgent(() => ({ gaps: [] })),
        );

        assert.equal(result.criticCompletedRounds, 1);
        assert.equal(result.criticFailedRounds, 0);
    });

    test("critic 이 실패한 라운드 다음 라운드에서 다시 점검한다", async () => {
        const result = await runTraverse(
            { ...TRAVERSE_ARGS, criticRounds: 2 },
            traverseAgent((callCount) =>
                callCount === 1 ? null : { gaps: [] },
            ),
        );

        assert.equal(result.criticFailedRounds, 1);
        assert.equal(result.criticCompletedRounds, 1);
    });
});
