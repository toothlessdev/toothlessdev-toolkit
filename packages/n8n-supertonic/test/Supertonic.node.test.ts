import type { IExecuteFunctions } from "n8n-workflow";
import { afterEach, describe, expect, test, vi } from "vitest";

import { Supertonic } from "../src/nodes/Supertonic/Supertonic.node";
import { createFakeSupertonic, WRITE_WAV_SCRIPT } from "./fakeSupertonic";

let removeFake: (() => Promise<void>) | undefined;

afterEach(async () => {
    await removeFake?.();
    removeFake = undefined;
});

function createExecuteFunctions(
    parameters: Record<string, unknown>,
    continueOnFail = false,
) {
    const prepareBinaryData = vi.fn(
        async (data: Buffer, fileName: string, mimeType: string) => ({
            data: data.toString(),
            fileName,
            mimeType,
        }),
    );

    const functions = {
        getInputData: () => [{ json: {} }],
        getNodeParameter: (name: string, _index: number, fallback?: unknown) =>
            parameters[name] ?? fallback,
        getExecutionCancelSignal: () => undefined,
        continueOnFail: () => continueOnFail,
        getNode: () => ({ name: "Supertonic" }),
        helpers: { prepareBinaryData },
    } as unknown as IExecuteFunctions;

    return { functions, prepareBinaryData };
}

async function useFakeExecutable(script: string) {
    const fake = await createFakeSupertonic(script);
    removeFake = fake.remove;

    return fake.executable;
}

describe("Supertonic 노드", () => {
    test("WAV 를 지정한 바이너리 필드와 파일 이름으로 내보낸다", async () => {
        const executable = await useFakeExecutable(WRITE_WAV_SCRIPT);
        const { functions } = createExecuteFunctions({
            text: "안녕하세요",
            options: {
                executable,
                binaryPropertyName: "audio",
                fileName: "hello.wav",
            },
        });

        const [[item]] = await new Supertonic().execute.call(functions);

        expect(item.json).toEqual({
            language: "ko",
            voice: "M1",
            byteLength: 8,
        });
        expect(item.binary?.audio).toEqual({
            data: "RIFFfake",
            fileName: "hello.wav",
            mimeType: "audio/wav",
        });
        expect(item.pairedItem).toEqual({ item: 0 });
    });

    test("continueOnFail 이면 오류를 항목으로 내보낸다", async () => {
        const executable = await useFakeExecutable("echo 실패 >&2; exit 1");
        const { functions } = createExecuteFunctions(
            { text: "안녕하세요", options: { executable } },
            true,
        );

        const [[item]] = await new Supertonic().execute.call(functions);

        expect(item.json.error).toContain("실패");
    });

    test("continueOnFail 이 아니면 실행을 실패시킨다", async () => {
        const { functions } = createExecuteFunctions({
            text: "",
            options: {},
        });

        await expect(new Supertonic().execute.call(functions)).rejects.toThrow(
            "읽을 텍스트가 비어 있습니다",
        );
    });
});
