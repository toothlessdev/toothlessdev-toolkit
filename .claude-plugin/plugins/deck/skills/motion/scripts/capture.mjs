/**
 * 장표를 headless Chrome 에서 실제 시간으로 재생하며 찍습니다.
 * --virtual-time-budget 은 requestAnimationFrame 과 transition 프레임을 제대로 못 찍어서 쓰지 않습니다.
 *
 * 사용법: node capture.mjs <deck.html> <저장 폴더> '<계획 JSON>'
 * 계획 항목: {"slide":3,"at":[1500,6000]} 또는 {"slide":5,"keys":["ArrowRight"],"keyWaitMs":700}
 * "slide":"all" 은 모든 장을 같은 시각에 찍습니다. 장 수는 window.DECK_STEP_COUNT, 없으면 .slide 개수입니다. 장 이동은 #s번호 해시를 씁니다.
 * {"walk":30,"keyWaitMs":1500} 은 1장부터 다음 키를 30번 누르며 단계마다 찍습니다. 키로 진행하는 덱의 뒷단계를 볼 때 씁니다.
 * "name" 을 주면 파일 이름 앞에 붙습니다. 같은 장을 두 번 찍을 때 씁니다.
 * 끝나면 찍은 사진을 한 장에 모은 contact.jpg 를 만듭니다.
 */
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const CHROME_PATH =
    process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const VIEWPORT = { width: 1600, height: 900 };
const SLIDE_LOAD_WAIT_MS = 900;
const DEFAULT_KEY_WAIT_MS = 700;
const KEY_CODES = { ArrowRight: 39, ArrowLeft: 37, " ": 32, Enter: 13 };
const CONTACT_COLUMN_COUNT = 5;

const sleep = (durationMs) => new Promise((resolve) => setTimeout(resolve, durationMs));

async function connectToChrome(debugPort) {
    for (let attempt = 0; attempt < 40; attempt++) {
        try {
            const response = await fetch(`http://127.0.0.1:${debugPort}/json`);
            const targets = await response.json();
            const page = targets.find((target) => target.type === "page");
            if (page) return new WebSocket(page.webSocketDebuggerUrl);
        } catch {
            // Chrome 이 아직 포트를 열지 않았으면 잠시 뒤 다시 시도합니다.
        }
        await sleep(250);
    }
    throw new Error("Chrome 디버그 포트에 연결하지 못했습니다");
}

function createDevtoolsClient(socket, scriptErrors) {
    let nextRequestId = 1;
    const pendingRequests = new Map();

    socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.id && pendingRequests.has(message.id)) {
            pendingRequests.get(message.id)(message);
            pendingRequests.delete(message.id);
        }
        if (message.method === "Runtime.exceptionThrown") {
            const details = message.params.exceptionDetails;
            scriptErrors.push(details.exception?.description ?? details.text);
        }
    };

    return (method, params = {}) =>
        new Promise((resolve) => {
            const requestId = nextRequestId++;
            pendingRequests.set(requestId, resolve);
            socket.send(JSON.stringify({ id: requestId, method, params }));
        });
}

async function runCapturePlan(send, deckUrl, outputDirectory, plan) {
    const takeShot = async (name) => {
        const response = await send("Page.captureScreenshot", { format: "jpeg", quality: 80 });
        writeFileSync(
            path.join(outputDirectory, `${name}.jpg`),
            Buffer.from(response.result.data, "base64"),
        );
    };
    const pressKey = async (key) => {
        const keyEvent = { key, code: key, windowsVirtualKeyCode: KEY_CODES[key] };
        await send("Input.dispatchKeyEvent", { type: "keyDown", ...keyEvent });
        await send("Input.dispatchKeyEvent", { type: "keyUp", ...keyEvent });
    };

    // 해시만 바꾸면 다시 로드되지 않아 장면이 처음부터 재생되지 않습니다. 쿼리를 바꿔 새로 엽니다.
    let loadCount = 0;
    const openSlide = async (slideNumber) => {
        loadCount += 1;
        await send("Page.navigate", { url: `${deckUrl}?load=${loadCount}#s${slideNumber}` });
        await sleep(SLIDE_LOAD_WAIT_MS);
    };

    const captureEntry = async (slideNumber, entry) => {
        const prefix = entry.name ? `${entry.name}-` : "";
        await openSlide(slideNumber);

        let elapsedMs = 0;
        for (const shotAtMs of entry.at ?? []) {
            await sleep(shotAtMs - elapsedMs);
            elapsedMs = shotAtMs;
            await takeShot(`${prefix}s${slideNumber}-${shotAtMs}`);
        }

        if (!entry.keys) return;
        await takeShot(`${prefix}s${slideNumber}-key0`);
        for (const [index, key] of entry.keys.entries()) {
            await pressKey(key);
            await sleep(entry.keyWaitMs ?? DEFAULT_KEY_WAIT_MS);
            await takeShot(`${prefix}s${slideNumber}-key${index + 1}`);
        }
    };

    const walkThroughSteps = async (entry) => {
        const prefix = entry.name ? `${entry.name}-` : "walk-";
        await openSlide(1);
        for (let stepNumber = 1; stepNumber <= entry.walk; stepNumber++) {
            await sleep(entry.keyWaitMs ?? DEFAULT_KEY_WAIT_MS);
            await takeShot(`${prefix}${String(stepNumber).padStart(3, "0")}`);
            await pressKey("ArrowRight");
        }
    };

    for (const entry of plan) {
        if (entry.walk) {
            await walkThroughSteps(entry);
            continue;
        }

        if (entry.slide !== "all") {
            await captureEntry(entry.slide, entry);
            continue;
        }

        await openSlide(1);
        const countResponse = await send("Runtime.evaluate", {
            expression: "window.DECK_STEP_COUNT ?? document.querySelectorAll('.slide').length",
            returnByValue: true,
        });
        const slideCount = countResponse.result.result.value;
        for (let slideNumber = 1; slideNumber <= slideCount; slideNumber++) {
            await captureEntry(slideNumber, entry);
        }
    }
}

async function writeContactSheet(send, outputDirectory) {
    const shotNames = readdirSync(outputDirectory)
        .filter((name) => name.endsWith(".jpg") && name !== "contact.jpg")
        .sort();
    if (shotNames.length === 0) return;

    const contactHtmlPath = path.join(outputDirectory, "contact.html");
    const cells = shotNames
        .map((name) => `<figure><img src="${name}"><figcaption>${name}</figcaption></figure>`)
        .join("");
    writeFileSync(
        contactHtmlPath,
        `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:8px;background:#fff;font:12px sans-serif;display:grid;grid-template-columns:repeat(${CONTACT_COLUMN_COUNT},1fr);gap:8px}
figure{margin:0}img{width:100%;display:block;border:1px solid #ddd}
</style>${cells}`,
    );

    await send("Page.navigate", { url: `file://${path.resolve(contactHtmlPath)}` });
    await sleep(SLIDE_LOAD_WAIT_MS);
    const layoutMetrics = await send("Page.getLayoutMetrics");
    const { width, height } = layoutMetrics.result.cssContentSize;
    const response = await send("Page.captureScreenshot", {
        format: "jpeg",
        quality: 75,
        captureBeyondViewport: true,
        clip: { x: 0, y: 0, width, height, scale: 1 },
    });
    writeFileSync(
        path.join(outputDirectory, "contact.jpg"),
        Buffer.from(response.result.data, "base64"),
    );
}

async function main() {
    const [deckPath, outputDirectory, planJson] = process.argv.slice(2);
    if (!deckPath || !outputDirectory || !planJson) {
        console.error("사용법: node capture.mjs <deck.html> <저장 폴더> '<계획 JSON>'");
        process.exit(2);
    }
    mkdirSync(outputDirectory, { recursive: true });

    const profileDirectory = mkdtempSync(path.join(tmpdir(), "deck-capture-"));
    const debugPort = 9400 + (process.pid % 500);
    const chrome = spawn(
        CHROME_PATH,
        [
            "--headless=new",
            "--disable-gpu",
            "--hide-scrollbars",
            `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
            `--remote-debugging-port=${debugPort}`,
            `--user-data-dir=${profileDirectory}`,
            "about:blank",
        ],
        { stdio: "ignore" },
    );

    const scriptErrors = [];
    try {
        const socket = await connectToChrome(debugPort);
        await new Promise((resolve) => (socket.onopen = resolve));
        const send = createDevtoolsClient(socket, scriptErrors);

        await send("Page.enable");
        await send("Runtime.enable");
        await send("Emulation.setDeviceMetricsOverride", {
            ...VIEWPORT,
            deviceScaleFactor: 1,
            mobile: false,
        });

        const deckUrl = `file://${path.resolve(deckPath)}`;
        await runCapturePlan(send, deckUrl, outputDirectory, JSON.parse(planJson));
        await writeContactSheet(send, outputDirectory);
        socket.close();
    } finally {
        chrome.kill();
        // Chrome 이 프로필을 놓을 때까지 잠시 기다리지 않으면 삭제가 실패할 수 있습니다.
        await sleep(300);
        rmSync(profileDirectory, { recursive: true, force: true });
    }

    console.log("errors:", JSON.stringify(scriptErrors));
    process.exit(scriptErrors.length > 0 ? 1 : 0);
}

await main();
