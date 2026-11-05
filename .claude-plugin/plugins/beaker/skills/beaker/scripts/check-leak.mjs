#!/usr/bin/env node
/**
 * beaker I2 — black-box payload 에 구현이 새어들어갔는지 검사한다.
 *
 * 파서를 쓰지 않는다. 언어 중립이 목표이므로 어느 언어에서나 도는 텍스트 휴리스틱만 쓴다.
 * 정확도가 낮은 대신 오탐이 사람 눈에 바로 보이는 형태로 나온다.
 *
 * 두 가지를 본다.
 *   1. 구현에만 있고 명세에는 없는 리터럴이 payload 에 나타나는가
 *      → age >= 60 같은 구현 상수가 새는 가장 흔한 경로
 *   2. payload 와 구현이 길게 겹치는 토큰 구간이 있는가
 *      → 선언부 발췌가 body 를 같이 잘라온 경우
 *
 * payload 는 구현의 선언부와 공개 타입을 그대로 잘라 만든 것이라, 아무 면제 없이 비교하면
 * 정상 발췌도 2번에 걸리고 공개 타입의 문자열 리터럴도 1번에 걸린다. 그래서 발췌한 구현 줄
 * 범위를 --ranges 파일로 받아 비교에서 뺀다.
 *   excerpt     시그니처 줄. 2번에서만 뺀다. 기본값 같은 리터럴은 1번이 계속 잡는다.
 *   publicTypes 공개 타입 정의 줄. 1번과 2번 모두에서 뺀다.
 * 범위가 구현의 절반을 넘으면 body 를 통째로 면제했을 수 있어 경고를 낸다.
 */

import { readFileSync } from "node:fs";

const DEFAULT_NGRAM = 8;
const EXEMPTION_WARNING_RATIO = 0.5;

/** 언어를 가리지 않고 흔한 키워드·타입명. 겹쳐도 leak 신호가 아니다. */
const NOISE = new Set([
    "function", "const", "let", "var", "def", "fn", "func", "class", "interface",
    "type", "struct", "enum", "public", "private", "return", "if", "else",
    "string", "number", "int", "float", "bool", "boolean", "void", "null",
    "undefined", "none", "true", "false", "export", "import", "async", "await",
    "0", "1", "-1",
]);

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

function read(path) {
    try {
        return readFileSync(path, "utf8");
    } catch {
        return null;
    }
}

function fail(message) {
    console.error(message);
    process.exit(2);
}

function parseLineRanges(entries, label) {
    return (entries ?? []).map((entry) => {
        const match = /^(\d+)(?:-(\d+))?$/.exec(String(entry));
        if (!match) fail(`--ranges 의 ${label} 형식이 틀렸다: ${entry} ("10-12" 또는 "10")`);
        const start = Number(match[1]);
        const end = Number(match[2] ?? match[1]);
        if (start < 1 || end < start) fail(`--ranges 의 ${label} 범위가 틀렸다: ${entry}`);
        return { start, end };
    });
}

function loadRanges(path) {
    if (!path) return { excerpt: [], publicTypes: [] };
    const text = read(path);
    if (text === null) fail(`ranges 파일을 읽을 수 없다: ${path}`);

    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch {
        fail(`ranges 파일이 JSON 이 아니다: ${path}`);
    }
    return {
        excerpt: parseLineRanges(parsed.excerpt, "excerpt"),
        publicTypes: parseLineRanges(parsed.publicTypes, "publicTypes"),
    };
}

function isInRanges(lineNumber, ranges) {
    return ranges.some((range) => lineNumber >= range.start && lineNumber <= range.end);
}

function blankLines(text, ranges) {
    return text
        .split("\n")
        .map((line, index) => (isInRanges(index + 1, ranges) ? "" : line))
        .join("\n");
}

function keepOnlyLines(text, ranges) {
    return text
        .split("\n")
        .map((line, index) => (isInRanges(index + 1, ranges) ? line : ""))
        .join("\n");
}

function countExemptedLines(text, ranges) {
    return text.split("\n").filter((line, index) => line.trim() !== "" && isInRanges(index + 1, ranges)).length;
}

function tokenize(text) {
    return text.toLowerCase().match(/[a-z_$][a-z0-9_$]*|[0-9]+(?:\.[0-9]+)?/g) ?? [];
}

/** 숫자 리터럴과 따옴표 문자열 리터럴. 구현 상수가 여기 걸린다. */
function extractLiterals(text) {
    const numbers = text.match(/(?<![a-zA-Z0-9_$.])-?[0-9][0-9_]*(?:\.[0-9]+)?/g) ?? [];
    const strings = text.match(/"[^"\n]{1,64}"|'[^'\n]{1,64}'|`[^`\n]{1,64}`/g) ?? [];
    return new Set([
        ...numbers.map((n) => n.replace(/_/g, "")),
        ...strings.map((s) => s.slice(1, -1)),
    ].filter((literal) => literal.length > 0 && !NOISE.has(literal.toLowerCase())));
}

/** 부분 문자열이 아니라 토큰 경계로 비교한다. 5 가 2025 나 15 에 걸리면 오탐이 많아 검사가 무시된다. */
function appearsAsWholeToken(text, literal) {
    const escaped = literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?<![\\w$.])${escaped}(?![\\w$]|\\.\\d)`).test(text);
}

function findSharedNgrams(payloadTokens, implTokens, size) {
    const implWindows = new Map();
    for (let i = 0; i + size <= implTokens.length; i += 1) {
        const window = implTokens.slice(i, i + size).join(" ");
        if (!implWindows.has(window)) implWindows.set(window, i);
    }

    const matches = [];
    for (let i = 0; i + size <= payloadTokens.length; i += 1) {
        const window = payloadTokens.slice(i, i + size).join(" ");
        if (implWindows.has(window)) matches.push(window);
    }
    return [...new Set(matches)];
}

const args = parseArgs(process.argv);

if (!args.payload || !args.impl) {
    fail("usage: check-leak.mjs --payload <interface.md> --impl <source> [--spec <requirements.md>] [--ranges <excerpt-ranges.json>] [--ngram 8] [--json]");
}

const payload = read(args.payload);
const impl = read(args.impl);
const spec = read(args.spec) ?? "";

if (payload === null) fail(`payload 를 읽을 수 없다: ${args.payload}`);
if (impl === null) fail(`구현 파일을 읽을 수 없다: ${args.impl}`);

const ranges = loadRanges(args.ranges);
const allExemptRanges = [...ranges.excerpt, ...ranges.publicTypes];

const specLiterals = extractLiterals(spec);
const publicTypeLiterals = extractLiterals(keepOnlyLines(impl, ranges.publicTypes));
const leakedLiterals = [...extractLiterals(blankLines(impl, ranges.publicTypes))]
    .filter((literal) => !specLiterals.has(literal))
    .filter((literal) => !publicTypeLiterals.has(literal))
    .filter((literal) => appearsAsWholeToken(payload, literal));

const ngramSize = Number(args.ngram ?? DEFAULT_NGRAM);
const sharedNgrams = findSharedNgrams(tokenize(payload), tokenize(blankLines(impl, allExemptRanges)), ngramSize);

const implLineCount = impl.split("\n").filter((line) => line.trim() !== "").length;
const exemptedLineCount = countExemptedLines(impl, allExemptRanges);
const warnings = [];
if (implLineCount > 0 && exemptedLineCount / implLineCount > EXEMPTION_WARNING_RATIO) {
    warnings.push(`면제 범위가 구현 ${implLineCount}줄 중 ${exemptedLineCount}줄이다. body 를 통째로 면제하지 않았는지 범위를 확인하라.`);
}

const findings = [
    ...leakedLiterals.map((literal) => ({
        rule: "implementation-literal-in-payload",
        detail: literal,
        hint: "구현에는 있고 명세에는 없는 리터럴이다. default value 마스킹이 빠졌거나 body 가 섞였다.",
    })),
    ...sharedNgrams.map((ngram) => ({
        rule: "shared-token-window",
        detail: ngram,
        hint: `payload 와 구현이 ${ngramSize} 토큰 이상 연속으로 겹친다. 선언부 발췌가 body 를 잘라왔을 수 있다.`,
    })),
];

if (args.json) {
    console.log(JSON.stringify({
        payload: args.payload,
        impl: args.impl,
        exempted: { ...ranges, lines: exemptedLineCount, implLines: implLineCount },
        warnings,
        findings,
    }, null, 2));
} else {
    for (const warning of warnings) console.log(`경고: ${warning}\n`);
    if (findings.length === 0) {
        console.log(`leak 없음 — ${args.payload}`);
    } else {
        console.log(`leak 의심 ${findings.length}건 — ${args.payload}\n`);
        for (const finding of findings) {
            console.log(`  [${finding.rule}] ${finding.detail}`);
            console.log(`      ${finding.hint}\n`);
        }
    }
}

process.exit(findings.length === 0 ? 0 : 1);
