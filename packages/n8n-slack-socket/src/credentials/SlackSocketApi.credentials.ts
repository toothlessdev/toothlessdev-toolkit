import type { ICredentialType, INodeProperties } from "n8n-workflow";

/** n8n 은 파일 이름으로 클래스를 찾으므로 클래스 이름을 SlackSocketApi 로 유지해야 합니다. */
export class SlackSocketApi implements ICredentialType {
    name = "slackSocketApi";
    displayName = "Slack Socket Mode API";
    properties: INodeProperties[] = [
        {
            displayName: "App-Level Token",
            name: "appToken",
            type: "string",
            typeOptions: { password: true },
            required: true,
            default: "",
            placeholder: "xapp-...",
            description: "connections:write 스코프를 가진 Slack 앱 수준 토큰",
        },
    ];
}
