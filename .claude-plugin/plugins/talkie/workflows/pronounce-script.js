export const meta = {
    name: 'pronounce-script',
    description: 'talkie 발음 변환: 값싼 모델로 영어와 숫자를 한글 발음으로 바꿉니다',
    whenToUse: 'produce 가 호출합니다. args: { pluginRoot, workspace }',
    phases: [{ title: 'Pronounce', detail: '검사를 통과할 때까지 걸린 줄을 고칩니다', model: 'haiku' }],
}

const MAX_ATTEMPTS = 3

const STEP_RESULT_SCHEMA = {
    type: 'object',
    properties: {
        ok: { type: 'boolean' },
        issues: { type: 'array', items: { type: 'string' } },
    },
    required: ['ok', 'issues'],
}

const { pluginRoot, workspace } = args

phase('Pronounce')
let previousIssues = []
for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const result = await agent(
        [
            `pluginRoot 는 ${pluginRoot}, 작업 폴더는 ${workspace} 입니다.`,
            `${pluginRoot}/skills/pronounce/SKILL.md 를 읽고 그대로 수행합니다. 문서의 \${CLAUDE_PLUGIN_ROOT} 는 pluginRoot 로 바꿔 읽습니다.`,
            attempt === 1 ? '전체 대본을 한 번에 변환합니다.' : `이전 시도가 검사에 걸렸습니다. narration.json 에서 걸린 줄만 고칩니다:\n${previousIssues.join('\n')}`,
            'validate.py 결과를 그대로 ok 와 issues 로 돌려줍니다.',
        ].join('\n'),
        { label: `pronounce:${attempt}`, phase: 'Pronounce', model: 'haiku', effort: 'low', schema: STEP_RESULT_SCHEMA },
    )
    if (result && result.ok) return result
    previousIssues = result ? result.issues : ['에이전트가 결과를 돌려주지 못했습니다.']
}

return { ok: false, issues: previousIssues }
