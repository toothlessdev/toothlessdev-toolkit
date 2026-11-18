export const meta = {
    name: 'write-script',
    description: 'talkie 1단계: 덱과 브리프로 슬라이드별 대본 script.json 을 만듭니다',
    whenToUse: 'produce 가 호출합니다. args: { pluginRoot, workspace }',
    phases: [{ title: 'Script', detail: '덱을 읽어 대본을 쓰거나 기존 대본을 매핑합니다' }],
}

const STEP_RESULT_SCHEMA = {
    type: 'object',
    properties: {
        ok: { type: 'boolean' },
        slideCount: { type: 'integer' },
        lineCount: { type: 'integer' },
        issues: { type: 'array', items: { type: 'string' } },
    },
    required: ['ok', 'issues'],
}

const { pluginRoot, workspace } = args

phase('Script')
const result = await agent(
    [
        `pluginRoot 는 ${pluginRoot}, 작업 폴더는 ${workspace} 입니다.`,
        `${pluginRoot}/skills/script/SKILL.md 를 읽고 그대로 수행합니다. 문서의 \${CLAUDE_PLUGIN_ROOT} 는 pluginRoot 로 바꿔 읽습니다.`,
        'validate.py 를 통과한 뒤 끝냅니다. 덱 매핑이 어긋났거나 판단이 필요한 곳은 issues 에 적습니다.',
    ].join('\n'),
    { label: 'script', phase: 'Script', schema: STEP_RESULT_SCHEMA },
)

return result
