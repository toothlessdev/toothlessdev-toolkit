import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { afterEach, describe, expect, test } from "vitest";

import { buildSupertonicArguments } from "../src/supertonic/buildSupertonicArguments";
import { SupertonicCli } from "../src/supertonic/SupertonicCli";
import {
    InvalidSupertonicRequestError,
    SupertonicCancelledError,
    SupertonicFailedError,
    SupertonicTimedOutError,
} from "../src/supertonic/SupertonicError";
import { createFakeSupertonic, WRITE_WAV_SCRIPT } from "./fakeSupertonic";

const request = {
    text: "안녕하세요",
    language: "ko",
    voice: "M1",
    speed: 1.05,
    qualitySteps: 8,
};

let removeFake: (() => Promise<void>) | undefined;

async function createCli(script: string, timeoutMs = 10_000) {
    const fake = await createFakeSupertonic(script);
    removeFake = fake.remove;

    return { cli: new SupertonicCli(fake.executable, timeoutMs), fake };
}

afterEach(async () => {
    await removeFake?.();
    removeFake = undefined;
});

describe("buildSupertonicArguments", () => {
    test("대시로 시작하는 텍스트가 옵션으로 해석되지 않게 -- 뒤에 넣는다", () => {
        const commandLineArguments = buildSupertonicArguments(
            { ...request, text: "--help" },
            "/tmp/out.wav",
        );

        expect(commandLineArguments.slice(-2)).toEqual(["--", "--help"]);
    });

    test.each(["", "  \n"])("빈 텍스트 %j 는 거부한다", (text) => {
        expect(() =>
            buildSupertonicArguments({ ...request, text }, "/tmp/out.wav"),
        ).toThrow(InvalidSupertonicRequestError);
    });
});

describe("SupertonicCli", () => {
    test("설정을 인자로 넘기고 WAV 를 돌려준 뒤 임시 폴더를 지운다", async () => {
        const { cli, fake } = await createCli(WRITE_WAV_SCRIPT);

        const wav = await cli.synthesize({
            ...request,
            voice: "F2",
            speed: 1.2,
        });

        expect(wav.toString()).toBe("RIFFfake");
        const passedArguments = (await readFile(fake.argumentsPath, "utf8"))
            .trim()
            .split("\n");
        expect(passedArguments).toEqual(
            expect.arrayContaining([
                "tts",
                "ko",
                "F2",
                "1.2",
                "8",
                "안녕하세요",
            ]),
        );
        const outputPath =
            passedArguments[passedArguments.indexOf("--output") + 1];
        expect(existsSync(outputPath)).toBe(false);
    });

    test("0 이 아닌 코드로 끝나면 CLI 가 남긴 오류를 알린다", async () => {
        const { cli } = await createCli(
            "echo \"Voice style 'ZZ' not found\" >&2; exit 1",
        );

        await expect(cli.synthesize(request)).rejects.toThrow(
            /Voice style 'ZZ' not found/,
        );
        await expect(cli.synthesize(request)).rejects.toBeInstanceOf(
            SupertonicFailedError,
        );
    });

    test("실행 파일이 없으면 설치 방법을 알린다", async () => {
        const cli = new SupertonicCli("/nonexistent/supertonic", 1000);

        await expect(cli.synthesize(request)).rejects.toThrow(
            /uv tool install/,
        );
    });

    test("제한 시간을 넘기면 시간 초과로 알린다", async () => {
        const { cli } = await createCli("exec sleep 5", 100);

        await expect(cli.synthesize(request)).rejects.toBeInstanceOf(
            SupertonicTimedOutError,
        );
    });

    test("취소하면 취소로 알린다", async () => {
        const { cli } = await createCli("exec sleep 5");
        const controller = new AbortController();

        const pending = cli.synthesize(request, controller.signal);
        setTimeout(() => controller.abort(), 50);

        await expect(pending).rejects.toBeInstanceOf(SupertonicCancelledError);
    });
});
