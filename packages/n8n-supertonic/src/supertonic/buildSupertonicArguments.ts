import { InvalidSupertonicRequestError } from "./SupertonicError";

export interface SupertonicRequest {
    readonly text: string;
    readonly language: string;
    readonly voice: string;
    readonly speed: number;
    readonly qualitySteps: number;
}

export function buildSupertonicArguments(
    request: SupertonicRequest,
    outputPath: string,
): string[] {
    if (request.text.trim() === "") {
        throw new InvalidSupertonicRequestError("읽을 텍스트가 비어 있습니다");
    }

    return [
        "tts",
        "--output",
        outputPath,
        "--lang",
        request.language,
        "--voice",
        request.voice,
        "--speed",
        String(request.speed),
        "--steps",
        String(request.qualitySteps),
        // 텍스트가 대시로 시작해도 옵션으로 해석되지 않게 합니다. 텍스트는 외부 메시지일 수 있습니다.
        "--",
        request.text,
    ];
}
