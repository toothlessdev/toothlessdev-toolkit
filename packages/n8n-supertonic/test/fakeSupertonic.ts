import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/** 실제 모델을 읽지 않도록 --output 경로에 고정 바이트를 쓰는 가짜 CLI 를 만듭니다. */
export async function createFakeSupertonic(script: string) {
    const directory = await mkdtemp(path.join(tmpdir(), "fake-supertonic-"));
    const executable = path.join(directory, "supertonic");

    await writeFile(executable, `#!/bin/sh\n${script}\n`);
    await chmod(executable, 0o755);

    return {
        executable,
        argumentsPath: path.join(directory, "arguments.txt"),
        remove: () => rm(directory, { recursive: true, force: true }),
    };
}

export const WRITE_WAV_SCRIPT = `
printf '%s\\n' "$@" > "$(dirname "$0")/arguments.txt"
printf 'RIFFfake' > "$3"
`;
