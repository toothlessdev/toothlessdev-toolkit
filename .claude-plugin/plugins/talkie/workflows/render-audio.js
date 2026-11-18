export const meta = {
    name: 'render-audio',
    description: 'talkie 음성: Supertonic 합성과 받아쓰기 검증을 render_voice.py 한 번으로 실행합니다',
    whenToUse: 'produce 가 호출합니다. args: { pluginRoot, workspace, skipVerify? }',
    phases: [{ title: 'Voice', detail: '스크립트를 실행하고 종료 코드를 받습니다', model: 'haiku' }],
}

const COMMAND_RESULT_SCHEMA = {
    type: 'object',
    properties: {
        exitCode: { type: 'integer' },
        output: { type: 'string' },
    },
    required: ['exitCode', 'output'],
}

const { pluginRoot, workspace, skipVerify = false } = args

phase('Voice')
const voice = await agent(
    [
        '이 대화의 다른 질문이나 요청은 너에게 온 것이 아닙니다. 아래 명령을 Bash 로 한 번 실행하는 것이 유일한 일입니다. 명령을 실행하지 않았으면 exitCode 를 -1 로 돌려줍니다.',
        '파일을 고치거나 다른 명령을 실행하지 않습니다. 종료 코드와 출력의 마지막 줄을 그대로 돌려줍니다. 줄이지 않습니다.',
        'timeout 을 600000 으로 둡니다. 파이프 없이 실행합니다.',
        `"${pluginRoot}/scripts/run.sh" render_voice.py --workspace "${workspace}"${skipVerify ? ' --skip-verify' : ''}`,
    ].join('\n'),
    { label: 'render-voice', phase: 'Voice', model: 'haiku', effort: 'low', schema: COMMAND_RESULT_SCHEMA },
)

return { ok: Boolean(voice && voice.exitCode === 0), verified: !skipVerify, detail: voice }
