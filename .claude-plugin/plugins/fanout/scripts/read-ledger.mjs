import {
    closeSync,
    openSync,
    readFileSync,
    readSync,
    realpathSync,
    statSync,
} from "node:fs";
import path from "node:path";

/**
 * Read 는 256KB 를 넘는 파일을 limit 없이 읽으면 실패합니다. 나눠 읽을 limit 를
 * 계산할 때 이 값보다 조금 작게 잡아 줄 길이 편차를 흡수합니다.
 */
const READ_SIZE_LIMIT_BYTES = 200 * 1024;
const READ_DEFAULT_LINE_LIMIT = 2000;
const BINARY_SNIFF_BYTES = 8000;
const MAX_RANGES_SHOWN = 10;

export function resolveTargetPath(rawPath, cwd) {
    const absolutePath = path.resolve(cwd, rawPath.trim());
    try {
        return realpathSync.native(absolutePath);
    } catch {
        return absolutePath;
    }
}

export function toReadRecord(toolResponse, cwd) {
    const file = toolResponse?.file;
    if (toolResponse?.type !== "text" || !file?.filePath) return null;

    const resolvedPath = resolveTargetPath(file.filePath, cwd);
    const fileStat = statSync(resolvedPath, { throwIfNoEntry: false });

    return {
        path: resolvedPath,
        requestedPath: file.filePath,
        startLine: file.startLine,
        numLines: file.numLines,
        totalLines: file.totalLines,
        mtimeMs: fileStat?.mtimeMs ?? null,
    };
}

export function findUnreadRanges(records, totalLines) {
    const readRanges = records
        .filter((record) => record.numLines > 0)
        .map((record) => [
            record.startLine,
            record.startLine + record.numLines - 1,
        ])
        .sort((left, right) => left[0] - right[0]);

    const unreadRanges = [];
    let nextUnreadLine = 1;
    for (const [rangeStart, rangeEnd] of readRanges) {
        if (rangeStart > nextUnreadLine)
            unreadRanges.push([
                nextUnreadLine,
                Math.min(rangeStart - 1, totalLines),
            ]);
        nextUnreadLine = Math.max(nextUnreadLine, rangeEnd + 1);
        if (nextUnreadLine > totalLines) break;
    }
    if (nextUnreadLine <= totalLines)
        unreadRanges.push([nextUnreadLine, totalLines]);

    return unreadRanges.filter(
        ([rangeStart, rangeEnd]) => rangeStart <= rangeEnd,
    );
}

export function formatRanges(ranges) {
    const shown = ranges
        .slice(0, MAX_RANGES_SHOWN)
        .map(([rangeStart, rangeEnd]) => `${rangeStart}-${rangeEnd}`);
    const hiddenCount = ranges.length - shown.length;
    return hiddenCount > 0
        ? `${shown.join(", ")} 외 ${hiddenCount}개 구간`
        : shown.join(", ");
}

export function suggestReadLimit(sizeBytes, totalLines) {
    const averageLineBytes = Math.max(1, sizeBytes / Math.max(1, totalLines));
    const limitBySize = Math.floor(READ_SIZE_LIMIT_BYTES / averageLineBytes);
    return Math.max(1, Math.min(READ_DEFAULT_LINE_LIMIT, limitBySize));
}

function isBinaryFile(filePath) {
    const buffer = Buffer.alloc(BINARY_SNIFF_BYTES);
    const descriptor = openSync(filePath, "r");
    try {
        const bytesRead = readSync(
            descriptor,
            buffer,
            0,
            BINARY_SNIFF_BYTES,
            0,
        );
        return buffer.subarray(0, bytesRead).includes(0);
    } finally {
        closeSync(descriptor);
    }
}

/**
 * 항목 하나가 전문 충족인지 판정합니다. 근거는 원장의 Read 기록뿐이며,
 * 지금 파일의 mtime 과 같은 기록만 셉니다. 조사 중 파일이 바뀌면 그 전에 읽은
 * 구간은 지금 내용과 대응하지 않기 때문입니다.
 */
export function judgeItem(item, records, cwd) {
    const resolvedPath = resolveTargetPath(item, cwd);
    const fileStat = statSync(resolvedPath, { throwIfNoEntry: false });

    if (!fileStat?.isFile())
        return { item, status: "not-file", path: resolvedPath };
    if (isBinaryFile(resolvedPath))
        return { item, status: "binary", path: resolvedPath };

    const recordsForPath = records.filter(
        (record) => record.path === resolvedPath,
    );
    const currentRecords = recordsForPath.filter(
        (record) => record.mtimeMs === fileStat.mtimeMs,
    );

    if (currentRecords.length === 0) {
        const status = recordsForPath.length > 0 ? "changed" : "unread";
        const totalLines = countReadToolLines(resolvedPath);
        return {
            item,
            status,
            path: resolvedPath,
            totalLines,
            suggestedLimit: suggestReadLimit(fileStat.size, totalLines),
        };
    }

    const totalLines = currentRecords.at(-1).totalLines;
    const unreadRanges = findUnreadRanges(currentRecords, totalLines);
    if (unreadRanges.length === 0)
        return { item, status: "covered", path: resolvedPath, totalLines };

    return {
        item,
        status: "partial",
        path: resolvedPath,
        totalLines,
        unreadRanges,
        suggestedLimit: suggestReadLimit(fileStat.size, totalLines),
    };
}

/**
 * Read 도구의 totalLines 와 같은 방식으로 셉니다. 내용을 \n 으로 나눈 조각 수라서
 * 끝 개행이 있으면 wc -l 보다 하나 많고, 빈 파일도 1 입니다.
 */
export function countReadToolLines(filePath) {
    const content = readFileSync(filePath);
    let newlineCount = 0;
    for (const byte of content) if (byte === 0x0a) newlineCount++;
    return newlineCount + 1;
}

export function describeJudgement(judgement) {
    switch (judgement.status) {
        case "unread":
            return `${judgement.path}: 총 ${judgement.totalLines}줄을 Read 로 읽은 기록이 없습니다. offset 1 부터 limit ${judgement.suggestedLimit} 이하로 끝까지 이어서 읽으세요.`;
        case "changed":
            return `${judgement.path}: 읽은 뒤 파일이 바뀌었습니다. 총 ${judgement.totalLines}줄을 처음부터 limit ${judgement.suggestedLimit} 이하로 다시 읽으세요.`;
        case "partial":
            return `${judgement.path}: 총 ${judgement.totalLines}줄 중 ${formatRanges(judgement.unreadRanges)} 줄을 읽지 않았습니다. 한 번에 limit ${judgement.suggestedLimit} 이하로 읽으세요.`;
        case "binary":
            return `${judgement.path}: 텍스트 파일이 아니라 Read 로 전문을 확인할 수 없습니다. 이 항목은 결과에서 빼세요.`;
        case "not-file":
            return `${judgement.path}: 파일이 아니거나 존재하지 않습니다. 이 항목은 결과에서 빼세요.`;
        default:
            return `${judgement.path}: 알 수 없는 판정 ${judgement.status}`;
    }
}

export function buildDenyReason(judgements) {
    const blocking = judgements.filter(
        (judgement) => judgement.status !== "covered",
    );
    if (blocking.length === 0) return null;

    return [
        `제출 거부: 결과에 넣은 항목 중 ${blocking.length}개를 Read 로 처음부터 끝까지 읽지 않았습니다.`,
        ...blocking.map((judgement) => `- ${describeJudgement(judgement)}`),
        "위 구간을 Read 로 읽은 뒤 다시 제출하세요. 다 읽기 전에는 제출이 계속 거부됩니다.",
    ].join("\n");
}
