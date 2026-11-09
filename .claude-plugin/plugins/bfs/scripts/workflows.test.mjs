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

    test("critic 이 실패하면 기본 criticRounds 1 에서도 같은 라운드 안에서 다시 시도한다", async () => {
        const result = await runTraverse(
            TRAVERSE_ARGS,
            traverseAgent((callCount) =>
                callCount === 1 ? null : { gaps: [] },
            ),
        );

        assert.equal(result.criticFailedRounds, 0);
        assert.equal(result.criticCompletedRounds, 1);
    });
});

describe("traverse 노드 정규화", () => {
    test("root 끝에 / 가 있어도 절대경로 자식을 상대경로 노드와 같게 본다", async () => {
        const agent = async (prompt, options) => {
            if (options.phase === "Critic") return { gaps: [] };

            return {
                rows: listedItems(prompt).map((node) => ({
                    node,
                    result: "",
                    children:
                        node === "a.ts" ? ["/repo/b.ts", "/repo/a.ts"] : [],
                })),
            };
        };

        const result = await runTraverse(
            { seeds: ["a.ts"], prompt: "순회:\n{{nodes}}", root: "/repo/" },
            agent,
        );

        assert.deepEqual(
            result.rows.map((row) => row.node),
            ["a.ts", "b.ts"],
        );
    });
});

describe("bfs 인자 검증과 응답 형식", () => {
    test("audit.ratio 가 0 이면 시작할 때 거부한다", async () => {
        await assert.rejects(
            runBfs(
                { ...BFS_ARGS, audit: { ...BFS_ARGS.audit, ratio: 0 } },
                bfsAgent(() => null),
            ),
            /audit.ratio/,
        );
    });

    test("coverage: false 와 audit 를 같이 넘기면 시작할 때 거부한다", async () => {
        await assert.rejects(
            runBfs(
                { ...BFS_ARGS, coverage: false },
                bfsAgent(() => null),
            ),
            /coverage: false 와 함께/,
        );
    });

    test("coverage 를 켜고 rows[].item 이 없는 schema 를 넘기면 시작할 때 거부한다", async () => {
        await assert.rejects(
            runBfs(
                {
                    ...BFS_ARGS,
                    audit: undefined,
                    schema: {
                        type: "object",
                        properties: { summary: { type: "string" } },
                    },
                },
                bfsAgent(() => null),
            ),
            /rows\[\]\.item/,
        );
    });

    test("rows 가 배열이 아닌 응답은 실패한 샤드로 세고 다음 라운드에 다시 넣는다", async () => {
        let runCallCount = 0;
        const agent = async (prompt, options) => {
            if (options.phase !== "Run") return null;

            runCallCount++;
            if (runCallCount === 1) return { rows: "망가진 응답" };
            return {
                rows: listedItems(prompt).map((item) => ({
                    item,
                    result: "ok",
                })),
            };
        };

        const result = await runBfs({ ...BFS_ARGS, audit: undefined }, agent);

        assert.equal(result.covered, 4);
        assert.deepEqual(result.missing, []);
    });

    test("반증 에이전트가 item 에 앞선 결과까지 붙여 돌려줘도 같은 항목으로 센다", async () => {
        const agent = bfsAgent((items) => ({
            rows: items.map((item) => ({
                item: `- ${item} | 앞선 결과: {"result":"ok"}`,
                refuted: false,
                reason: "",
            })),
        }));

        const result = await runBfs(BFS_ARGS, agent);

        assert.equal(result.audit.verifiedCount, 4);
        assert.deepEqual(result.audit.unverified, []);
    });

    test("lineCountByItem 을 넘기면 반증 샤드도 줄 예산으로 나눈다", async () => {
        const auditShardSizes = [];
        const agent = async (prompt, options) => {
            const items = listedItems(prompt);
            if (options.phase === "Run")
                return { rows: items.map((item) => ({ item, result: "ok" })) };

            auditShardSizes.push(items.length);
            return {
                rows: items.map((item) => ({
                    item,
                    refuted: false,
                    reason: "",
                })),
            };
        };

        await runBfs(
            {
                ...BFS_ARGS,
                lineBudget: 100,
                lineCountByItem: { a: 60, b: 60, c: 30, d: 30 },
            },
            agent,
        );

        assert.deepEqual(auditShardSizes, [1, 2, 1]);
    });
});
