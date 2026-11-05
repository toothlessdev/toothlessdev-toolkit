export interface SlackEventSilenceMonitorOptions {
    readonly silenceTimeoutMs: number;
    readonly repeatIntervalMs: number;
    readonly onSilence: (silentMs: number) => void;
}

const MAX_CHECK_INTERVAL_MS = 30_000;
const SLEEP_DETECTION_CHECK_COUNT = 3;

/**
 * Slack 이 Enable Events 를 자동으로 끄면 소켓은 붙어 있는데 이벤트만 끊기고, 재연결로도 복구되지 않습니다.
 * 연결 상태로는 구분할 수 없어서 연결된 동안 들어온 이벤트가 없는 시간을 잽니다.
 */
export class SlackEventSilenceMonitor {
    private checkTimer: NodeJS.Timeout | undefined;
    private lastCheckAt = 0;
    private lastEventAt = 0;
    private nextAlertAt = 0;

    constructor(private readonly options: SlackEventSilenceMonitorOptions) {}

    start(): void {
        this.stop();
        this.restartCounting(Date.now());

        this.checkTimer = setInterval(() => this.check(), this.checkIntervalMs);
        this.checkTimer.unref();
    }

    stop(): void {
        clearInterval(this.checkTimer);
        this.checkTimer = undefined;
    }

    recordEvent(): void {
        if (this.checkTimer) this.restartCounting(Date.now());
    }

    private get checkIntervalMs(): number {
        return Math.min(
            MAX_CHECK_INTERVAL_MS,
            this.options.silenceTimeoutMs / 4,
        );
    }

    private restartCounting(now: number): void {
        this.lastCheckAt = now;
        this.lastEventAt = now;
        this.nextAlertAt = now + this.options.silenceTimeoutMs;
    }

    private check(): void {
        const now = Date.now();

        // 맥이 잠든 시간까지 세면 깨어날 때마다 끊긴 소켓을 알아채기 전에 거짓 알림이 갑니다.
        const hasSlept =
            now - this.lastCheckAt >
            this.checkIntervalMs * SLEEP_DETECTION_CHECK_COUNT;
        if (hasSlept) {
            this.restartCounting(now);
            return;
        }

        this.lastCheckAt = now;
        if (now < this.nextAlertAt) return;

        this.nextAlertAt = now + this.options.repeatIntervalMs;
        this.options.onSilence(now - this.lastEventAt);
    }
}
