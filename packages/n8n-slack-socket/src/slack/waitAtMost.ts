/** promise 가 timeoutMs 안에 끝나지 않으면 기다리기를 그만둡니다. 실패는 그대로 던집니다. */
export async function waitAtMost(
    promise: Promise<unknown>,
    timeoutMs: number,
): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<void>((resolve) => {
        timer = setTimeout(resolve, timeoutMs);
    });

    try {
        await Promise.race([promise, timeout]);
    } finally {
        clearTimeout(timer);
    }
}
