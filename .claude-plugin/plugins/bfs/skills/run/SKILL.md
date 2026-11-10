---
name: run
description: "/bfs:run <조사 요청> 으로 호출하면 대상 목록을 먼저 코드로 확정하고, bfs 워크플로로 샤드별 병렬 실행합니다. 항목별 판정이 필요한 전수조사면 census 프리셋을 씁니다. 사용자가 /bfs:run 을 직접 입력했을 때만 씁니다."
argument-hint: "<무엇을 어떤 기준으로 조사할지>"
disable-model-invocation: true
---

# /bfs:run

- 목적: 대상 목록 확정, 샤딩, 누락 재투입은 코드가 하고, 에이전트는 항목 처리만 합니다.
- 이 스킬 호출이 곧 Workflow 도구 사용 승인입니다.

## 요청

`$ARGUMENTS`

## 절차

1. 인자 확인
   - 대상과 처리 내용이 모두 드러나지 않으면 부족한 것을 한 줄로 질문하고 중단합니다.

2. 모집단 확정
   - `find`, `grep -l`, `git ls-files` 같은 Bash 로 대상 목록을 직접 뽑습니다. 추측으로 만들지 않습니다.
   - 항목 수와 뽑은 명령을 사용자에게 먼저 보여 주고, 100개를 넘으면 진행 여부를 확인합니다.
   - 항목이 파일이고 에이전트가 파일 전문을 읽어야 하는 조사면 `readGate` 를 켭니다. 이때 목록은 아래 명령처럼 일반 텍스트 파일만 남기고 줄 수를 같이 뽑습니다. 바이너리, 디렉터리, 없는 경로는 게이트가 판정할 수 없어서 미리 뺍니다.

     ```bash
     git ls-files -- '<pathspec>' | while IFS= read -r f; do
       if [ -f "$f" ] && [ "${f##*.}" != ipynb ] && { [ ! -s "$f" ] || grep -Iq . "$f"; }; then printf '%s\t%s\n' "$f" "$(wc -l < "$f" | tr -d ' ')"; fi
     done
     ```

   - 뺀 항목이 있으면 개수와 이유를 사용자에게 말합니다.

3. 워크플로 선택
   - 항목마다 기준 충족 여부를 판정하는 전수조사: `name: "bfs:census"`, `args: { items, criteria, root?, shardSize?, maxRounds?, auditRatio?, readGate?, lineCountByItem?, lineBudget? }`
   - 판정이 아닌 일반 병렬 처리(요약, 추출, 변환 등): `name: "bfs:bfs"`, `args: { items, prompt, schema?, coverage?, shardSize?, maxRounds?, audit?, root?, readGate?, lineCountByItem?, lineBudget? }`
   - `readGate: true` 이면 조사 에이전트가 `bfs:investigator` 로 바뀝니다. 이 에이전트는 Bash 없이 Read, Glob, Grep 만 쓰고, 결과에 넣은 파일을 Read 로 처음부터 끝까지 읽기 전에는 hook 이 제출을 거부합니다.
     - `root` 는 절대경로로 넘깁니다. 항목은 `root` 기준 상대경로여도 됩니다.
     - `lineCountByItem` 에 위에서 뽑은 `{ 항목: 줄 수 }` 를 넘기면 샤드를 파일 개수 대신 `lineBudget`(기본 3000줄) 단위로 나눕니다. 전문을 읽히면 컨텍스트 크기는 줄 수가 정합니다.
     - 결과의 `item` 은 절대경로로 돌아옵니다.
   - `bfs` 의 `prompt` 에는 `{{items}}` 자리표시자를 반드시 넣습니다. 샤드의 항목이 거기에 들어갑니다.
   - `coverage` 를 켜 두면(기본값) 응답은 `rows[].item` 을 가져야 하고, 빠진 항목은 `maxRounds` 까지 재투입됩니다.
   - `args` 는 JSON 값으로 넘깁니다. 문자열로 직렬화하지 않습니다.

4. 결과 보고
   - `total` 대비 `covered` 를 먼저 말합니다.
   - `missing` 이 비어 있지 않으면 완료라고 말하지 않고 빠진 항목을 그대로 보여 줍니다.
   - `readGate` 를 켰다면 `missing` 에는 끝내 전문을 읽지 못한 항목도 들어 있습니다. 게이트는 Read 로 읽었는지만 보장하고, 읽은 내용을 제대로 판단했는지는 보장하지 않는다고 한 줄로 밝힙니다.
   - `audit.disputed` 는 반증에서 뒤집힌 항목이므로 따로 보여 줍니다.
   - 반증은 표본만 검사합니다. `audit.notSampledCount` 를 같이 밝힙니다.
   - `audit.unverified` 는 표본으로 뽑혔지만 `maxRounds` 까지 반증 응답을 받지 못한 항목입니다. 비어 있지 않으면 반증이 끝났다고 말하지 않고, `audit.sampledCount` 대비 `audit.verifiedCount` 와 함께 그대로 보여 줍니다.
