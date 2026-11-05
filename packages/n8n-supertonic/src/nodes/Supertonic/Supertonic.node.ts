import {
    NodeConnectionTypes,
    NodeOperationError,
    type IExecuteFunctions,
    type INodeExecutionData,
    type INodeType,
    type INodeTypeDescription,
} from "n8n-workflow";

import { SupertonicCli } from "../../supertonic/SupertonicCli";

interface SupertonicOptions {
    speed?: number;
    qualitySteps?: number;
    executable?: string;
    timeoutSeconds?: number;
    binaryPropertyName?: string;
    fileName?: string;
}

const DEFAULT_EXECUTABLE = "supertonic";
const DEFAULT_SPEED = 1.05;
const DEFAULT_QUALITY_STEPS = 8;
const DEFAULT_TIMEOUT_SECONDS = 120;
const DEFAULT_BINARY_PROPERTY_NAME = "data";
const DEFAULT_FILE_NAME = "speech.wav";
const WAV_MIME_TYPE = "audio/wav";

const VOICE_OPTIONS = [
    "F1",
    "F2",
    "F3",
    "F4",
    "F5",
    "M1",
    "M2",
    "M3",
    "M4",
    "M5",
].map((voice) => ({ name: voice, value: voice }));

/** n8n 은 파일 이름으로 클래스를 찾으므로 클래스 이름을 Supertonic 으로 유지해야 합니다. */
export class Supertonic implements INodeType {
    description: INodeTypeDescription = {
        displayName: "Supertonic",
        name: "supertonic",
        icon: "file:supertonic.svg",
        group: ["transform"],
        version: 1,
        subtitle: '={{$parameter["voice"]}}',
        description: "로컬 supertonic CLI 로 텍스트를 WAV 음성 파일로 만듭니다",
        defaults: { name: "Supertonic" },
        inputs: [NodeConnectionTypes.Main],
        outputs: [NodeConnectionTypes.Main],
        properties: [
            {
                displayName: "Text",
                name: "text",
                type: "string",
                typeOptions: { rows: 4 },
                required: true,
                default: "",
                description: "음성으로 만들 텍스트",
            },
            {
                displayName: "Language",
                name: "language",
                type: "string",
                default: "ko",
                description:
                    "언어 코드. 예: ko, en, ja. 모르면 na 를 넣습니다.",
            },
            {
                displayName: "Voice",
                name: "voice",
                type: "options",
                default: "M1",
                options: VOICE_OPTIONS,
            },
            {
                displayName: "Options",
                name: "options",
                type: "collection",
                placeholder: "Add Option",
                default: {},
                options: [
                    {
                        displayName: "Speed",
                        name: "speed",
                        type: "number",
                        typeOptions: {
                            minValue: 0.7,
                            maxValue: 2,
                            numberPrecision: 2,
                        },
                        default: DEFAULT_SPEED,
                        description: "클수록 빠르게 읽습니다.",
                    },
                    {
                        displayName: "Quality Steps",
                        name: "qualitySteps",
                        type: "number",
                        typeOptions: { minValue: 1 },
                        default: DEFAULT_QUALITY_STEPS,
                        description: "클수록 품질이 좋아지고 느려집니다.",
                    },
                    {
                        displayName: "Executable",
                        name: "executable",
                        type: "string",
                        default: DEFAULT_EXECUTABLE,
                        description:
                            "supertonic 실행 파일. n8n 프로세스의 PATH 에 없으면 절대 경로를 넣습니다.",
                    },
                    {
                        displayName: "Timeout (Seconds)",
                        name: "timeoutSeconds",
                        type: "number",
                        typeOptions: { minValue: 1 },
                        default: DEFAULT_TIMEOUT_SECONDS,
                    },
                    {
                        displayName: "Binary Property Name",
                        name: "binaryPropertyName",
                        type: "string",
                        default: DEFAULT_BINARY_PROPERTY_NAME,
                        description:
                            "출력에서 WAV 파일을 담을 바이너리 필드 이름",
                    },
                    {
                        displayName: "File Name",
                        name: "fileName",
                        type: "string",
                        default: DEFAULT_FILE_NAME,
                    },
                ],
            },
        ],
    };

    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        const items = this.getInputData();
        const outputItems: INodeExecutionData[] = [];

        for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
            try {
                const options = this.getNodeParameter(
                    "options",
                    itemIndex,
                    {},
                ) as SupertonicOptions;
                const language = this.getNodeParameter(
                    "language",
                    itemIndex,
                    "ko",
                ) as string;
                const voice = this.getNodeParameter(
                    "voice",
                    itemIndex,
                    "M1",
                ) as string;

                const cli = new SupertonicCli(
                    options.executable || DEFAULT_EXECUTABLE,
                    (options.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS) * 1000,
                );
                const wav = await cli.synthesize(
                    {
                        text: this.getNodeParameter(
                            "text",
                            itemIndex,
                        ) as string,
                        language,
                        voice,
                        speed: options.speed ?? DEFAULT_SPEED,
                        qualitySteps:
                            options.qualitySteps ?? DEFAULT_QUALITY_STEPS,
                    },
                    this.getExecutionCancelSignal(),
                );

                const binaryPropertyName =
                    options.binaryPropertyName || DEFAULT_BINARY_PROPERTY_NAME;
                outputItems.push({
                    json: { language, voice, byteLength: wav.byteLength },
                    binary: {
                        [binaryPropertyName]:
                            await this.helpers.prepareBinaryData(
                                wav,
                                options.fileName || DEFAULT_FILE_NAME,
                                WAV_MIME_TYPE,
                            ),
                    },
                    pairedItem: { item: itemIndex },
                });
            } catch (error) {
                if (!this.continueOnFail()) {
                    throw new NodeOperationError(
                        this.getNode(),
                        error as Error,
                        { itemIndex },
                    );
                }

                outputItems.push({
                    json: { error: (error as Error).message },
                    pairedItem: { item: itemIndex },
                });
            }
        }

        return [outputItems];
    }
}
