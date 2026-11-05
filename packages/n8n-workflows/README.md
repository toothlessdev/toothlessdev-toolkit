# n8n-workflows

내보낸 n8n 워크플로 JSON 을 로컬에 보관하는 폴더입니다. 빌드하거나 배포할 코드는 없습니다.

JSON 에는 채널 ID, 경로, 프롬프트가 들어 있어서 `local/` 을 Git 에서 제외합니다. 저장소를 새로 받으면 워크플로는 들어 있지 않고, 백업은 직접 해야 합니다.

아래 명령은 저장소 루트에서 실행합니다. `<workflow-id>` 는 편집기 주소의 `/workflow/` 뒤에 있는 값입니다.

## 내보내기

```bash
mkdir -p packages/n8n-workflows/local
```

```bash
pnpm n8n export:workflow --id=<workflow-id> --output=packages/n8n-workflows/local/<name>.json
```

## 되돌리기

```bash
pnpm n8n import:workflow --input=packages/n8n-workflows/local/<name>.json
```

```bash
pnpm n8n publish:workflow --id=<workflow-id>
```

적용하려면 n8n 을 재시작합니다. 자격 증명은 ID 와 이름만 들어 있어서 다른 n8n 에 넣으면 다시 만들어 연결해야 합니다. 워크플로가 쓰는 노드도 먼저 배포해 둡니다.
