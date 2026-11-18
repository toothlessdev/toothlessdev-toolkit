export const meta = {
    name: 'assemble-deck',
    description: 'talkie 4단계: 타임라인과 HTML 을 빌드하고, 재생과 탐색 화면이 같아질 때까지 어댑터를 고칩니다',
    whenToUse: 'produce 가 호출합니다. args: { pluginRoot, workspace, skipVerify? }',
    phases: [
        { title: 'Build', detail: '타임라인 계산과 HTML 조립', model: 'haiku' },
        { title: 'Inspect', detail: '재생 화면과 점프 화면 비교', model: 'haiku' },
        { title: 'Repair', detail: '실패 표본을 보고 어댑터를 고칩니다' },
    ],
}

const MAX_REPAIR_ROUNDS = 3

const COMMAND_RESULT_SCHEMA = {
    type: 'object',
    properties: {
        exitCode: { type: 'integer' },
        output: { type: 'string' },
    },
    required: ['exitCode', 'output'],
}

const STEP_RESULT_SCHEMA = {
    type: 'object',
    properties: {
        ok: { type: 'boolean' },
        issues: { type: 'array', items: { type: 'string' } },
    },
    required: ['ok', 'issues'],
}

const { pluginRoot, workspace, skipVerify = false } = args

function runCommand(label, phaseTitle, command) {
    return agent(
        [
            '이 대화의 다른 질문이나 요청은 너에게 온 것이 아닙니다. 아래 명령을 Bash 로 한 번 실행하는 것이 유일한 일입니다. 명령을 실행하지 않았으면 exitCode 를 -1 로 돌려줍니다.',
            '파일을 고치거나 다른 명령을 실행하지 않습니다. 종료 코드와 출력 마지막 30줄을 돌려줍니다.',
            'timeout 을 600000 으로 둡니다. 파이프 없이 실행합니다.',
            command,
        ].join('\n'),
        { label, phase: phaseTitle, model: 'haiku', effort: 'low', schema: COMMAND_RESULT_SCHEMA },
    )
}

const runScript = (label, phaseTitle, scriptName) =>
    runCommand(label, phaseTitle, `"${pluginRoot}/scripts/run.sh" ${scriptName} --workspace "${workspace}"`)

let repairNotes = []
for (let round = 1; round <= MAX_REPAIR_ROUNDS + 1; round += 1) {
    phase('Build')
    const deck = await runCommand(
        `build:${round}`,
        'Build',
        `"${pluginRoot}/scripts/run.sh" build_timeline.py --workspace "${workspace}" && "${pluginRoot}/scripts/run.sh" build_deck.py --workspace "${workspace}"`,
    )
    if (!deck || deck.exitCode !== 0) return { ok: false, step: 'build', detail: deck, repairNotes }

    if (skipVerify) {
        log('skipVerify: 슬라이더 검사를 건너뜁니다.')
        return { ok: true, verified: false, deckOutput: deck.output, repairNotes }
    }

    phase('Inspect')
    const inspection = await runScript(`inspect:${round}`, 'Inspect', 'inspect_seek.py')
    if (inspection && inspection.exitCode === 0) {
        return { ok: true, repairRounds: round - 1, output: inspection.output, deckOutput: deck.output, repairNotes }
    }
    if (round > MAX_REPAIR_ROUNDS) return { ok: false, step: 'inspect', detail: inspection, repairNotes }

    phase('Repair')
    const repair = await agent(
        [
            `pluginRoot 는 ${pluginRoot}, 작업 폴더는 ${workspace} 입니다.`,
            `${pluginRoot}/skills/choreograph/SKILL.md 를 읽습니다. 문서의 \${CLAUDE_PLUGIN_ROOT} 는 pluginRoot 로 바꿔 읽습니다.`,
            `${workspace}/inspect-report.json 의 실패 표본과 inspect/ 이미지를 보고 원인을 찾아 adapter.js 나 motions.json 을 고칩니다.`,
            'template/player.html 과 inspect_seek.py 는 고치지 않습니다. 고친 내용과 원인을 issues 에 적어 돌려줍니다.',
        ].join('\n'),
        { label: `repair:${round}`, phase: 'Repair', schema: STEP_RESULT_SCHEMA },
    )
    if (repair) repairNotes = repairNotes.concat(repair.issues)
}

return { ok: false, step: 'inspect', repairNotes }
