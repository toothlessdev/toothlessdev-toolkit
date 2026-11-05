#!/usr/bin/env node
/**
 * beaker PR 모드 — diff 에서 변경 심볼을 뽑는다.
 *
 * 파서를 쓰지 않는다. `git diff` 의 hunk header 가 붙여주는 enclosing function 을
 * 그대로 읽는다. git 이 여러 언어의 funcname 패턴을 내장하고 있고, 해당 드라이버가
 * 없어도 generic 휴리스틱이 동작하므로 언어를 가리지 않는다.
 *
 *   @@ -6 +6 @@ def beta(y):
 *                ^^^^^^^^^^^ 이 부분
 *
 * 이름을 얻지 못하면 파일 단위로 강등하고 그 사실을 결과에 남긴다. 강등을 숨기면
 * 한 파일이 심볼 하나로 세어져 상한 계산이 실제보다 관대해진다.
 *
 * diff 드라이버가 없는 언어(Java, PHP 등)에서는 git 기본 패턴이 들여쓰기된 메서드가 아니라
 * 그 바깥 class 선언 줄을 hunk header 에 찍는다. 그 이름은 변경된 메서드가 아니라 컨테이너이므로
 * granularity "container" 로 따로 표시해 강등과 같이 취급한다. scripts/diff-attributes 로
 * 내장 드라이버를 켜면 메서드 이름이 나온다.
 *
 * 삭제된 파일은 hunk 가 `+++ /dev/null` 뒤에 오므로 새 경로가 없다. 삭제 전 경로를 쓰고
 * deleted 로 표시한다. 삭제는 head 에서 실행할 수 없는 변경이라 테스트 대상이 아니라 별도 목록이다.
 *
 * 입력 diff 는 반드시 `-U0` 이어야 한다. 컨텍스트가 붙으면 hunk header 가 hunk 시작
 * 지점 앞의 함수를 가리켜 변경이 엉뚱한 심볼에 붙는다.
 *
 * branchChanged 는 근사치다. 정식 predicate 분류는 whitebox-test-designer 가 하고,
 * 여기서는 대상 선별 순위를 매기기 위한 값만 만든다.
 */

import { readFileSync } from "node:fs";

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@ ?(.*)$/;
const NULL_PATH = "/dev/null";

/**
 * 조건 분기로 보이는 라인. 언어를 가리지 않으려고 키워드와 논리 연산자만 본다.
 * 삼항 연산자는 optional chaining(`?.`)·nullish(`??`)와 섞여 오탐이 많아 제외한다.
 */
const BRANCH_PATTERNS = [
    /\bif\b/,
    /\belse\b/,
    /\bswitch\b/,
    /\bcase\b/,
    /\bwhen\b/,
    /\bmatch\b/,
    /\bguard\b/,
    /\bunless\b/,
    /\bcatch\b/,
    /&&/,
    /\|\|/,
];

function parseArgs(argv) {
    const args = {};
    for (let i = 2; i < argv.length; i += 1) {
        const token = argv[i];
        if (!token.startsWith("--")) continue;
        const key = token.slice(2);
        const next = argv[i + 1];
        if (next === undefined || next.startsWith("--")) {
            args[key] = true;
        } else {
            args[key] = next;
            i += 1;
        }
    }
    return args;
}

/** hunk header 꼬리에서 심볼을 뽑는다. 못 뽑으면 null. */
function symbolFromContext(context) {
    const trimmed = context.trim();
    if (trimmed === "") return null;

    const called = trimmed.match(/([A-Za-z_$][\w$]*)\s*\(/);
    if (called) return { name: called[1], granularity: "symbol" };

    const declared = trimmed.match(
        /\b(?:class|struct|interface|enum|type|trait|impl|object|module|namespace)\s+([A-Za-z_$][\w$]*)/,
    );
    if (declared) return { name: declared[1], granularity: "container" };

    const identifiers = trimmed.match(/[A-Za-z_$][\w$]*/g);
    return identifiers ? { name: identifiers[identifiers.length - 1], granularity: "symbol" } : null;
}

function looksLikeBranch(line) {
    return BRANCH_PATTERNS.some((pattern) => pattern.test(line));
}

/** `--- a/path\t2024-...` 같은 헤더 줄의 경로 부분. */
function pathFromHeader(text) {
    const path = text.split("\t")[0];
    return path === NULL_PATH ? NULL_PATH : path.replace(/^[ab]\//, "");
}

function parseDiff(diff) {
    const byId = new Map();
    const degradedFiles = new Set();
    const degradedContainers = new Set();
    const deletedFiles = new Set();

    let oldPath = null;
    let file = null;
    let isDeleted = false;
    let current = null;
    let newLine = 0;
    let remainingOld = 0;
    let remainingNew = 0;

    const openEntry = (path, resolved, deleted) => {
        const id = resolved ? `${path}::${resolved.name}` : path;
        if (!byId.has(id)) {
            byId.set(id, {
                id,
                file: path,
                symbol: resolved ? resolved.name : null,
                granularity: resolved ? resolved.granularity : "file",
                deleted,
                hunks: 0,
                addedLines: 0,
                removedLines: 0,
                branchChanged: false,
                changedLines: [],
            });
        }
        if (deleted) deletedFiles.add(path);
        else if (!resolved) degradedFiles.add(path);
        else if (resolved.granularity === "container") degradedContainers.add(id);

        const entry = byId.get(id);
        entry.hunks += 1;
        return entry;
    };

    for (const line of diff.split("\n")) {
        const insideHunk = remainingOld > 0 || remainingNew > 0;

        if (insideHunk) {
            if (line.startsWith("\\")) continue;

            if (line.startsWith("+")) {
                remainingNew -= 1;
                if (current) {
                    current.addedLines += 1;
                    current.changedLines.push(newLine);
                    if (looksLikeBranch(line)) current.branchChanged = true;
                }
                newLine += 1;
            } else if (line.startsWith("-")) {
                remainingOld -= 1;
                if (current) {
                    current.removedLines += 1;
                    if (looksLikeBranch(line)) current.branchChanged = true;
                }
            } else {
                remainingOld -= 1;
                remainingNew -= 1;
                newLine += 1;
            }
            continue;
        }

        if (line.startsWith("diff --git")) {
            oldPath = null;
            file = null;
            isDeleted = false;
            current = null;
            continue;
        }
        if (line.startsWith("--- ")) {
            oldPath = pathFromHeader(line.slice(4));
            continue;
        }
        if (line.startsWith("+++ ")) {
            const newPath = pathFromHeader(line.slice(4));
            isDeleted = newPath === NULL_PATH;
            file = isDeleted ? oldPath : newPath;
            if (file === NULL_PATH) file = null;
            current = null;
            continue;
        }

        const header = HUNK_HEADER.exec(line);
        if (!header) continue;

        remainingOld = header[2] === undefined ? 1 : Number(header[2]);
        remainingNew = header[4] === undefined ? 1 : Number(header[4]);
        newLine = Number(header[3]);

        if (file === null) {
            current = null;
        } else if (isDeleted) {
            current = openEntry(file, null, true);
        } else {
            current = openEntry(file, symbolFromContext(header[5]), false);
        }
    }

    return {
        symbols: [...byId.values()],
        degradedFiles: [...degradedFiles],
        degradedContainers: [...degradedContainers],
        deletedFiles: [...deletedFiles],
    };
}

const args = parseArgs(process.argv);
const source = args.diff ?? "-";

let diff;
try {
    diff = source === "-" ? readFileSync(0, "utf8") : readFileSync(source, "utf8");
} catch {
    console.error(`diff 를 읽을 수 없다: ${source}`);
    process.exit(2);
}

/**
 * diff 는 반드시 -U0 이어야 한다. 컨텍스트가 붙으면 hunk header 가 변경된 줄이 아니라
 * hunk 시작 지점 앞의 함수를 가리켜, 변경이 엉뚱한 심볼에 붙는다. 조용히 틀리므로
 * 검사해서 알린다.
 */
function hasContextLines(text) {
    return text.split("\n").some((line) => line.startsWith(" ") && line.trim() !== "");
}

const { symbols, degradedFiles, degradedContainers, deletedFiles } = parseDiff(diff);
const contextWarning = hasContextLines(diff)
    ? "diff 에 컨텍스트 줄이 있다. -U0 으로 다시 만들어라 — 그렇지 않으면 변경이 엉뚱한 심볼에 붙는다."
    : null;

const result = {
    symbols,
    degradedToFile: degradedFiles,
    degradedToContainer: degradedContainers,
    deletedFiles,
    warning: contextWarning,
    totals: {
        symbols: symbols.length,
        branchChanged: symbols.filter((s) => s.branchChanged).length,
        degraded: degradedFiles.length,
        degradedToContainer: degradedContainers.length,
        deleted: deletedFiles.length,
    },
};

if (args.json) {
    console.log(JSON.stringify(result, null, 2));
} else {
    if (contextWarning) console.log(`경고: ${contextWarning}\n`);
    console.log(
        `변경 심볼 ${result.totals.symbols}개 · 분기 변경 ${result.totals.branchChanged}개 · 파일 강등 ${result.totals.degraded}개 · 컨테이너 단위 ${result.totals.degradedToContainer}개 · 삭제 파일 ${result.totals.deleted}개\n`,
    );
    for (const entry of symbols) {
        const mark = entry.branchChanged ? "분기" : "  · ";
        const name = entry.deleted ? "(삭제)" : entry.granularity === "file" ? "(강등)" : entry.granularity === "container" ? `${entry.symbol} (컨테이너)` : entry.symbol;
        console.log(`  [${mark}] ${entry.file}  ${name}  +${entry.addedLines}/-${entry.removedLines}`);
    }
    if (degradedFiles.length > 0) {
        console.log(`\n심볼 이름을 얻지 못해 파일 단위로 강등: ${degradedFiles.join(", ")}`);
    }
    if (degradedContainers.length > 0) {
        console.log(`\n메서드가 아니라 컨테이너(class 등) 이름만 얻음: ${degradedContainers.join(", ")}`);
    }
    if (deletedFiles.length > 0) {
        console.log(`\n삭제된 파일 (head 에서 실행 불가): ${deletedFiles.join(", ")}`);
    }
}
