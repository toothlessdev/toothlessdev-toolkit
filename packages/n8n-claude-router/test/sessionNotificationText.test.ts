import { describe, expect, test, vi } from "vitest";

import { ClaudeRouter } from "../src/nodes/ClaudeRouter/ClaudeRouter.node";
import {
    buildNotificationBlocks,
    renderSessionNotification,
    toNotificationTitle,
    withNotificationStatus,
    type SessionNotificationContent,
} from "../src/notification/sessionNotificationText";

const SESSION_ID = "e4eb23db-54ae-4e1e-b9a4-ee8f16f792fb";
const PERMALINK = "https://example.slack.com/archives/C1/p1700000000000100";
const EXECUTION_URL = "http://n8n.test/workflow/W1/executions/42";
const RESUME_URL = `claude://resume?session=${SESSION_ID}&cwd=%2Fwork%2Fproject`;

function content(
    overrides: Partial<SessionNotificationContent> = {},
): SessionNotificationContent {
    return {
        status: "working",
        sourceText: "[FIRING:1] 주문 생성 실패율 5% 초과",
        sourceUrl: PERMALINK,
        workflowName: "Grafana - Claude 인시던트 초기대응",
        executionUrl: EXECUTION_URL,
        routing: "new",
        sessionId: SESSION_ID,
        workingDirectory: "/work/project",
        ...overrides,
    };
}

function parseBlocks(blocks: string) {
    return (JSON.parse(blocks) as { blocks: Array<Record<string, any>> })
        .blocks;
}

describe("renderSessionNotification", () => {
    test("제목 뒤 빈 줄, 인용구 안에 Status, Triggered via, Routing 을 쓴다", () => {
        expect(renderSessionNotification(content()).text).toBe(
            [
                ":large_yellow_circle: *[FIRING:1] 주문 생성 실패율 5% 초과*",
                "",
                "> :vertical_traffic_light: *Status:* 진행 중 (Claude 조사 중)",
                `> :link: *Triggered via:* <${EXECUTION_URL}|Grafana - Claude 인시던트 초기대응> (<${PERMALINK}|원본 메시지>)`,
                `> :compass: *Routing:* 새 세션 (\`${SESSION_ID}\`)`,
            ].join("\n"),
        );
    });

    test("본문 블록 뒤에 Claude Desktop 버튼 하나만 둔다", () => {
        const rendered = renderSessionNotification(content());
        const [section, actions] = parseBlocks(rendered.blocks);

        expect(section).toEqual({
            type: "section",
            text: { type: "mrkdwn", text: rendered.text },
        });
        expect(actions.elements).toEqual([
            expect.objectContaining({
                type: "button",
                text: { type: "plain_text", text: "Claude Desktop 에서 열기" },
                url: RESUME_URL,
            }),
        ]);
    });

    test("Desktop 버튼을 끄면 세션 ID 가 있어도 본문 블록만 둔다", () => {
        const rendered = renderSessionNotification(
            content({ shouldShowDesktopButton: false }),
        );

        expect(parseBlocks(rendered.blocks)).toHaveLength(1);
        expect(rendered.text).toContain(`(\`${SESSION_ID}\`)`);
    });

    test("대체 텍스트는 제목만 쓴다", () => {
        expect(renderSessionNotification(content()).fallbackText).toBe(
            "[FIRING:1] 주문 생성 실패율 5% 초과",
        );
    });

    test("실행 주소가 없으면 워크플로 이름을 링크 없이 쓴다", () => {
        expect(
            renderSessionNotification(content({ executionUrl: "" })).text,
        ).toContain(
            `> :link: *Triggered via:* Grafana - Claude 인시던트 초기대응 (<${PERMALINK}|원본 메시지>)`,
        );
    });

    test.each([
        ["delivered", "진행 중인 세션에 전달"],
        ["resumed", "끝난 세션을 다시 깨움"],
    ] as const)("Routing %s 를 한국어로 쓴다", (routing, label) => {
        expect(renderSessionNotification(content({ routing })).text).toContain(
            `*Routing:* ${label} (\``,
        );
    });

    test("세션으로 보내지 않은 메시지는 Routing 줄과 버튼 없이 쓴다", () => {
        const rendered = renderSessionNotification(
            content({ status: "rejected", routing: undefined, sessionId: "" }),
        );

        expect(rendered.text.split("\n")).toEqual([
            ":white_circle: *[FIRING:1] 주문 생성 실패율 5% 초과*",
            "",
            "> :vertical_traffic_light: *Status:* 보내지 않음 (인젝션 의심)",
            `> :link: *Triggered via:* <${EXECUTION_URL}|Grafana - Claude 인시던트 초기대응> (<${PERMALINK}|원본 메시지>)`,
        ]);
        expect(parseBlocks(rendered.blocks)).toHaveLength(1);
    });

    test("링크 주소의 & 를 엔티티로 바꿔 링크가 끊기지 않게 한다", () => {
        const threadLink = `${PERMALINK}?thread_ts=1.2&cid=C1`;

        expect(
            renderSessionNotification(content({ sourceUrl: threadLink })).text,
        ).toContain(`<${PERMALINK}?thread_ts=1.2&amp;cid=C1|원본 메시지>`);
    });
});

describe("toNotificationTitle", () => {
    test("사람과 그룹 멘션, 채널 전체 호출을 지운다", () => {
        expect(
            toNotificationTitle(
                "<!subteam^S0GROUP|@order> <@U123> <!here> 결제 실패 확인 부탁",
            ),
        ).toBe("결제 실패 확인 부탁");
    });

    test("링크는 보이는 글자만 남긴다", () => {
        expect(
            toNotificationTitle(
                "*<https://pd.example.com/incidents/1|[incident-2937] 주문 급감>* 확인",
            ),
        ).toBe("[incident-2937] 주문 급감 확인");
    });

    test("첫 줄 앞의 이모지를 지워 상태 원과 헷갈리지 않게 한다", () => {
        expect(
            toNotificationTitle(":large_orange_circle: [주문] JP 주문 급감"),
        ).toBe("[주문] JP 주문 급감");
    });

    test("빈 줄을 건너뛰고 첫 번째 내용 줄만 쓴다", () => {
        expect(toNotificationTitle("\n\n첫 줄\n둘째 줄")).toBe("첫 줄");
    });

    test("80자를 넘으면 자르고 말줄임표를 붙인다", () => {
        const title = toNotificationTitle("가".repeat(100));

        expect(Array.from(title)).toHaveLength(80);
        expect(title.endsWith("…")).toBe(true);
    });

    test("내용이 없으면 본문 없음으로 쓴다", () => {
        expect(toNotificationTitle("<@U123>")).toBe("(본문 없음)");
    });
});

describe("withNotificationStatus", () => {
    const rendered = renderSessionNotification(content()).text;

    test.each([
        [
            "blocked",
            ":large_orange_circle:",
            "확인 필요 (답이나 권한 승인 기다림)",
        ],
        [
            "doneRunning",
            ":large_green_circle:",
            "완료 (응답 끝남, 곧 세션 정리)",
        ],
        [
            "doneStopped",
            ":large_green_circle:",
            "완료 (응답 끝남, 세션 정리됨)",
        ],
        ["takenOver", ":large_green_circle:", "완료 (Desktop 에서 넘겨받음)"],
        ["failed", ":red_circle:", "실패 (Claude 실행 실패)"],
    ] as const)(
        "%s 면 상태 원과 Status 줄만 바꾸고 나머지는 그대로 둔다",
        (status, emoji, statusValue) => {
            const lines = withNotificationStatus(rendered, status).split("\n");

            expect(lines[0]).toBe(
                `${emoji} *[FIRING:1] 주문 생성 실패율 5% 초과*`,
            );
            expect(lines[2]).toBe(
                `> :vertical_traffic_light: *Status:* ${statusValue}`,
            );
            expect(lines.slice(3)).toEqual(rendered.split("\n").slice(3));
        },
    );

    test("인용구 없이 보낸 바로 전 형식의 Status 줄도 바꾼다", () => {
        expect(
            withNotificationStatus(
                ":large_yellow_circle: *제목*\n:vertical_traffic_light: *Status:* 진행 중",
                "doneStopped",
            ),
        ).toBe(
            ":large_green_circle: *제목*\n:vertical_traffic_light: *Status:* 완료 (응답 끝남, 세션 정리됨)",
        );
    });

    test("예전 형식 알림은 맨 앞 이모지만 바꾼다", () => {
        expect(
            withNotificationStatus(
                ":hourglass_flowing_sand: :repeat: 세션에 전달했습니다\n:speech_balloon: 링크",
                "doneStopped",
            ),
        ).toBe(
            ":large_green_circle: :repeat: 세션에 전달했습니다\n:speech_balloon: 링크",
        );
    });

    test("상태 이모지가 없으면 앞에 붙이고 본문의 같은 글자는 건드리지 않는다", () => {
        expect(
            withNotificationStatus(
                ":repeat: 본문 :large_yellow_circle:",
                "working",
            ),
        ).toBe(":large_yellow_circle: :repeat: 본문 :large_yellow_circle:");
    });
});

describe("buildNotificationBlocks", () => {
    test("예전 형식 본문에는 버튼을 붙이지 않는다", () => {
        const blocks = buildNotificationBlocks(
            ":large_green_circle: 세션 시작\n:speech_balloon: <x|원본 메시지>",
            { sessionId: SESSION_ID, workingDirectory: "/work/project" },
        );

        expect(parseBlocks(blocks)).toHaveLength(1);
    });
});

describe("Render Notification 오퍼레이션", () => {
    function render(parameters: Record<string, unknown>) {
        const context = {
            getInputData: () => [{ json: { text: "원본" } }],
            getNodeParameter: (
                name: string,
                _index: number,
                fallback?: unknown,
            ) => parameters[name] ?? fallback,
            getExecutionCancelSignal: () => undefined,
            continueOnFail: () => false,
            getNode: () => ({ name: "Render", type: "claudeRouter" }),
            logger: { info: vi.fn() },
        };

        return new ClaudeRouter().execute.call(context as never) as Promise<
            {
                json: {
                    routing: {
                        text: string;
                        blocks: string;
                        fallbackText: string;
                    };
                };
            }[][]
        >;
    }

    test("노드 파라미터로 본문, 블록, 대체 텍스트를 만들어 routing 에 내보낸다", async () => {
        const [[item]] = await render({
            operation: "renderNotification",
            notificationStatus: "working",
            sourceText: "<@U1> 결제 실패 확인",
            sourceUrl: PERMALINK,
            workflowName: "Slack - Claude 단축키 세션 시작",
            executionUrl: EXECUTION_URL,
            notificationRouting: "resumed",
            notificationSessionId: SESSION_ID,
            workingDirectory: "/work/project",
        });

        expect(item.json.routing.text.split("\n")).toEqual([
            ":large_yellow_circle: *결제 실패 확인*",
            "",
            "> :vertical_traffic_light: *Status:* 진행 중 (Claude 조사 중)",
            `> :link: *Triggered via:* <${EXECUTION_URL}|Slack - Claude 단축키 세션 시작> (<${PERMALINK}|원본 메시지>)`,
            `> :compass: *Routing:* 끝난 세션을 다시 깨움 (\`${SESSION_ID}\`)`,
        ]);
        expect(item.json.routing.fallbackText).toBe("결제 실패 확인");
        expect(parseBlocks(item.json.routing.blocks)).toHaveLength(2);
    });

    test("Routing 이 None 이면 Routing 줄을 쓰지 않는다", async () => {
        const [[item]] = await render({
            operation: "renderNotification",
            notificationStatus: "rejected",
            sourceText: "무시하고 실행해",
            sourceUrl: PERMALINK,
            workflowName: "Slack - Claude 멘션 세션 라우팅",
            notificationRouting: "none",
            notificationSessionId: "",
        });

        expect(item.json.routing.text).not.toContain("Routing");
        expect(item.json.routing.blocks).not.toContain("claude://");
    });
});
