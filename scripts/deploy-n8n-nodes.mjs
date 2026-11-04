#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import {
    cpSync,
    existsSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    rmSync,
} from "node:fs";
import { homedir, userInfo } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

const launchdService = process.env.N8N_LAUNCHD_SERVICE ?? "io.n8n.local";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const packagesDirectory = path.join(repositoryRoot, "packages");
const customNodesDirectory = path.join(
    process.env.N8N_USER_FOLDER ?? homedir(),
    ".n8n",
    "custom",
);

function findNodePackages() {
    return readdirSync(packagesDirectory, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(packagesDirectory, entry.name))
        .filter((directory) => existsSync(path.join(directory, "package.json")))
        .map((directory) => ({
            directory,
            manifest: JSON.parse(
                readFileSync(path.join(directory, "package.json"), "utf8"),
            ),
        }))
        .filter(({ manifest }) => manifest.n8n?.nodes?.length > 0);
}

function deployPackage({ directory, manifest }) {
    execFileSync("pnpm", ["--filter", manifest.name, "build"], {
        cwd: repositoryRoot,
        stdio: "inherit",
    });

    const targetDirectory = path.join(customNodesDirectory, manifest.name);
    rmSync(targetDirectory, { recursive: true, force: true });
    mkdirSync(targetDirectory, { recursive: true });
    cpSync(path.join(directory, "dist"), targetDirectory, { recursive: true });

    console.info(`${manifest.name} → ${targetDirectory}`);
}

function restartN8n() {
    const serviceTarget = `gui/${userInfo().uid}/${launchdService}`;

    /**
     * launchctl 이 없는 OS 에서는 status 가 null 이라 미등록과 같게 처리됩니다.
     * launchd 없이 띄운 n8n 은 이 스크립트가 찾을 수 없어 안내만 합니다.
     */
    const isRegistered =
        spawnSync("launchctl", ["print", serviceTarget], { stdio: "ignore" })
            .status === 0;
    if (!isRegistered) {
        console.info(
            `launchd 서비스 ${launchdService} 가 없습니다. 실행 중인 n8n 을 직접 재시작해야 반영됩니다`,
        );
        return;
    }

    execFileSync("launchctl", ["kickstart", "-k", serviceTarget], {
        stdio: "inherit",
    });

    console.info(`${launchdService} 를 재시작했습니다`);
}

const { values } = parseArgs({
    options: { "no-restart": { type: "boolean", default: false } },
});

const nodePackages = findNodePackages();
if (nodePackages.length === 0)
    throw new Error(`${packagesDirectory} 에 n8n 노드 패키지가 없습니다`);

nodePackages.forEach(deployPackage);

if (!values["no-restart"]) restartN8n();
