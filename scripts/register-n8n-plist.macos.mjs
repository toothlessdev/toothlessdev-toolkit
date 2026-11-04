#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir, userInfo } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { parseArgs } from "node:util";

const MINIMUM_NODE_MAJOR_VERSION = 24;
const BOOTOUT_TIMEOUT_MS = 30_000;
const BOOTOUT_POLL_INTERVAL_MS = 500;
const SYSTEM_PATHS = [
    "/usr/local/bin",
    "/usr/bin",
    "/bin",
    "/usr/sbin",
    "/sbin",
];
const PASSED_THROUGH_ENVIRONMENT_VARIABLES = [
    "NODE_EXTRA_CA_CERTS",
    "N8N_USER_FOLDER",
    "N8N_PORT",
    "N8N_RUNNERS_BROKER_PORT",
];

const launchdService = process.env.N8N_LAUNCHD_SERVICE ?? "io.n8n.local";
const launchdDomain = `gui/${userInfo().uid}`;
const launchdTarget = `${launchdDomain}/${launchdService}`;
const plistPath = path.join(
    homedir(),
    "Library",
    "LaunchAgents",
    `${launchdService}.plist`,
);
const n8nDirectory = path.join(
    process.env.N8N_USER_FOLDER ?? homedir(),
    ".n8n",
);
const logsDirectory = path.join(n8nDirectory, "logs");

function assertSupportedRuntime() {
    if (process.platform !== "darwin")
        throw new Error("launchd 는 macOS 에서만 쓸 수 있습니다");

    /**
     * plist 는 이 스크립트를 실행한 node 경로를 고정합니다.
     * 낮은 버전으로 등록하면 n8n 이 뜨지 못하고 launchd 가 재시작만 반복합니다.
     */
    const nodeMajorVersion = Number(process.versions.node.split(".")[0]);
    if (nodeMajorVersion < MINIMUM_NODE_MAJOR_VERSION)
        throw new Error(
            `Node ${MINIMUM_NODE_MAJOR_VERSION} 이상으로 실행해야 합니다 (현재 ${process.version})`,
        );
}

/**
 * pnpm 으로 실행하면 PATH 맨 앞이 저장소의 node_modules/.bin 이라 which 로 찾을 수 없습니다.
 * 저장소를 지우거나 pnpm install 을 해도 서비스가 깨지지 않도록 전역 설치본을 씁니다.
 */
function findGlobalN8nEntry() {
    const n8nEntry = path.resolve(
        path.dirname(process.execPath),
        "..",
        "lib",
        "node_modules",
        "n8n",
        "bin",
        "n8n",
    );
    if (!existsSync(n8nEntry))
        throw new Error(`전역 n8n 이 없습니다: ${n8nEntry}`);

    return n8nEntry;
}

function findClaudeDirectory() {
    const { status, stdout } = spawnSync("which", ["claude"], {
        encoding: "utf8",
    });

    return status === 0 ? path.dirname(stdout.trim()) : null;
}

function buildEnvironment(claudeDirectory) {
    const searchPaths = [
        path.dirname(process.execPath),
        claudeDirectory,
        ...SYSTEM_PATHS,
    ].filter((searchPath) => searchPath !== null);

    const passedThroughEntries = PASSED_THROUGH_ENVIRONMENT_VARIABLES.filter(
        (name) => process.env[name],
    ).map((name) => [name, process.env[name]]);

    return {
        HOME: homedir(),
        PATH: [...new Set(searchPaths)].join(":"),
        N8N_LISTEN_ADDRESS: "127.0.0.1",
        ...Object.fromEntries(passedThroughEntries),
    };
}

function escapeXml(value) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

function renderPlist(n8nEntry, environment) {
    const environmentEntries = Object.entries(environment)
        .map(
            ([name, value]) =>
                `        <key>${name}</key>\n        <string>${escapeXml(value)}</string>`,
        )
        .join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${escapeXml(launchdService)}</string>

    <key>ProgramArguments</key>
    <array>
        <string>${escapeXml(process.execPath)}</string>
        <string>${escapeXml(n8nEntry)}</string>
        <string>start</string>
    </array>

    <key>EnvironmentVariables</key>
    <dict>
${environmentEntries}
    </dict>

    <key>WorkingDirectory</key>
    <string>${escapeXml(n8nDirectory)}</string>

    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>ThrottleInterval</key>
    <integer>30</integer>

    <key>StandardOutPath</key>
    <string>${escapeXml(path.join(logsDirectory, "launchd.out.log"))}</string>
    <key>StandardErrorPath</key>
    <string>${escapeXml(path.join(logsDirectory, "launchd.err.log"))}</string>
</dict>
</plist>
`;
}

function isServiceRegistered() {
    return (
        spawnSync("launchctl", ["print", launchdTarget], { stdio: "ignore" })
            .status === 0
    );
}

/**
 * bootout 은 프로세스 종료를 기다리지 않고 돌아옵니다.
 * 종료 전에 bootstrap 하면 launchctl 이 error 5 로 실패해서 해제될 때까지 기다립니다.
 */
async function unregisterService() {
    execFileSync("launchctl", ["bootout", launchdTarget], { stdio: "inherit" });

    const deadline = Date.now() + BOOTOUT_TIMEOUT_MS;
    while (isServiceRegistered()) {
        if (Date.now() > deadline)
            throw new Error(`${launchdService} 가 해제되지 않았습니다`);

        await delay(BOOTOUT_POLL_INTERVAL_MS);
    }
}

const { values } = parseArgs({
    options: { "dry-run": { type: "boolean", default: false } },
});

assertSupportedRuntime();

const claudeDirectory = findClaudeDirectory();
const plist = renderPlist(
    findGlobalN8nEntry(),
    buildEnvironment(claudeDirectory),
);

if (values["dry-run"]) {
    process.stdout.write(plist);
    process.exit(0);
}

if (claudeDirectory === null)
    console.warn(
        "claude 를 찾지 못해 PATH 에 넣지 않았습니다. n8n-claude-cli 노드의 Executable 에 절대 경로를 지정해야 합니다",
    );

mkdirSync(logsDirectory, { recursive: true });

if (isServiceRegistered()) await unregisterService();

writeFileSync(plistPath, plist);
execFileSync("launchctl", ["bootstrap", launchdDomain, plistPath], {
    stdio: "inherit",
});

console.info(`${launchdService} 를 등록했습니다: ${plistPath}`);
