export const meta = {
    name: 'write-adapter',
    description: 'talkie 어댑터 작성: 선택적으로 애니메이션을 추가하고, 덱을 조작할 어댑터와 애니메이션 순서를 씁니다',
    whenToUse: 'produce 가 호출합니다. args: { pluginRoot, workspace, enhanceMotion? }',
    phases: [
        { title: 'Enhance', detail: 'enhanceMotion 일 때만 애니메이션을 추가합니다' },
        { title: 'Choreograph', detail: '어댑터와 motion 순서를 씁니다' },
    ],
}

const STEP_RESULT_SCHEMA = {
    type: 'object',
    properties: {
        ok: { type: 'boolean' },
        issues: { type: 'array', items: { type: 'string' } },
    },
    required: ['ok', 'issues'],
}

const { pluginRoot, workspace, enhanceMotion = false } = args

function buildSkillPrompt(skillName, resultInstruction) {
    return [
        `pluginRoot 는 ${pluginRoot}, 작업 폴더는 ${workspace} 입니다.`,
        `${pluginRoot}/skills/${skillName}/SKILL.md 를 읽고 그대로 수행합니다. 문서의 \${CLAUDE_PLUGIN_ROOT} 는 pluginRoot 로 바꿔 읽습니다.`,
        resultInstruction,
    ].join('\n')
}

if (enhanceMotion) {
    phase('Enhance')
    const enhance = await agent(buildSkillPrompt('enhance', '끝나면 ok 와 issues 를 돌려줍니다.'), {
        label: 'enhance',
        phase: 'Enhance',
        schema: STEP_RESULT_SCHEMA,
    })
    if (!enhance || !enhance.ok) return { ok: false, issues: enhance ? enhance.issues : ['enhance 결과가 없습니다.'] }
}

phase('Choreograph')
const choreograph = await agent(
    buildSkillPrompt('choreograph', 'validate.py 를 통과한 뒤 ok 와 issues 를 돌려줍니다. 정확한 탐색을 보장하지 못하는 슬라이드는 issues 에 적습니다.'),
    { label: 'choreograph', phase: 'Choreograph', schema: STEP_RESULT_SCHEMA },
)

return choreograph || { ok: false, issues: ['choreograph 결과가 없습니다.'] }
