import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { SlackEventSilenceMonitor } from "../src/slack/SlackEventSilenceMonitor";

const MINUTE_MS = 60_000;
const SILENCE_TIMEOUT_MS = 15 * MINUTE_MS;
const REPEAT_INTERVAL_MS = 60 * MINUTE_MS;

let onSilence: ReturnType<typeof vi.fn<(silentMs: number) => void>>;
let monitor: SlackEventSilenceMonitor;

beforeEach(() => {
    vi.useFakeTimers();
    onSilence = vi.fn();
    monitor = new SlackEventSilenceMonitor({
        silenceTimeoutMs: SILENCE_TIMEOUT_MS,
        repeatIntervalMs: REPEAT_INTERVAL_MS,
        onSilence,
    });
    monitor.start();
});

afterEach(() => {
    monitor.stop();
    vi.useRealTimers();
});

describe("SlackEventSilenceMonitor", () => {
    test("기준 시간 전에는 알리지 않고 지나면 한 번 알린다", () => {
        vi.advanceTimersByTime(SILENCE_TIMEOUT_MS - MINUTE_MS);
        expect(onSilence).not.toHaveBeenCalled();

        vi.advanceTimersByTime(2 * MINUTE_MS);
        expect(onSilence).toHaveBeenCalledOnce();
    });

    test("이벤트가 오면 처음부터 다시 잰다", () => {
        vi.advanceTimersByTime(SILENCE_TIMEOUT_MS - MINUTE_MS);
        monitor.recordEvent();
        vi.advanceTimersByTime(SILENCE_TIMEOUT_MS - MINUTE_MS);

        expect(onSilence).not.toHaveBeenCalled();
    });

    test("끊김이 이어지면 1시간마다 다시 알린다", () => {
        vi.advanceTimersByTime(
            SILENCE_TIMEOUT_MS + REPEAT_INTERVAL_MS + MINUTE_MS,
        );

        expect(onSilence).toHaveBeenCalledTimes(2);
    });

    test("맥이 잠든 시간은 끊김으로 세지 않는다", () => {
        vi.setSystemTime(Date.now() + 8 * REPEAT_INTERVAL_MS);
        vi.advanceTimersByTime(MINUTE_MS);
        expect(onSilence).not.toHaveBeenCalled();

        vi.advanceTimersByTime(SILENCE_TIMEOUT_MS);
        expect(onSilence).toHaveBeenCalledOnce();
    });

    test("멈춘 뒤에는 알리지 않는다", () => {
        monitor.stop();
        vi.advanceTimersByTime(2 * SILENCE_TIMEOUT_MS);

        expect(onSilence).not.toHaveBeenCalled();
    });
});
