export const meta = {
    name: 'produce',
    description: 'talkie 메인 워크플로: 대본 작성(draft) 또는 음성, 어댑터, 조립, 검사(build)를 단계 워크플로에 맡겨 순서대로 실행합니다',
    whenToUse: '/talkie:talkie 가 호출합니다. 워크플로 중간에는 사용자에게 물을 수 없어서 대본 승인 전후로 나눠 부릅니다. args: { stage: "draft" | "build", pluginRoot, workspace, enhanceMotion?, skipVerify?, localScripts? }',
    phases: [
        { title: 'Draft', detail: '대본을 만듭니다' },
        { title: 'Prepare', detail: '발음 변환과 합성, 어댑터 작성을 동시에 돌립니다' },
        { title: 'Assemble', detail: '조립과 검사' },
    ],
}

const { stage, pluginRoot, workspace, enhanceMotion = false, skipVerify = false, localScripts = false } = args

/**
 * localScripts 는 플러그인을 설치하지 않은 저장소 복제본을 시험할 때만 씁니다.
 * 설치 전에는 talkie:<name> 이름이 등록되어 있지 않습니다.
 */
function runStage(name, stageArgs) {
    return workflow(localScripts ? { scriptPath: `${pluginRoot}/workflows/${name}.js` } : `talkie:${name}`, stageArgs)
}

if (stage === 'draft') {
    phase('Draft')
    const draft = await runStage('write-script', { pluginRoot, workspace })
    return { status: draft && draft.ok ? 'draft-ready' : 'failed', stage: 'draft', draft }
}

if (stage !== 'build') {
    return { status: 'failed', stage, detail: 'stage 는 draft 또는 build 여야 합니다.' }
}

/**
 * 합성에는 narration.json 만 필요하고 어댑터에는 script.json 만 필요합니다.
 * 두 줄을 동시에 돌리고, 음성 길이와 어댑터가 모두 있어야 하는 조립에서 합칩니다.
 */
async function buildVoiceTrack() {
    const pronounce = await runStage('pronounce-script', { pluginRoot, workspace })
    if (!pronounce.ok) return { ok: false, step: 'pronounce', pronounce }
    return runStage('render-audio', { pluginRoot, workspace, skipVerify })
}

phase('Prepare')
const [voice, adapter] = await parallel([
    () => buildVoiceTrack(),
    () => runStage('write-adapter', { pluginRoot, workspace, enhanceMotion }),
])
if (!voice || !voice.ok || !adapter || !adapter.ok) {
    return { status: 'failed', stage: 'prepare', voice, adapter }
}

phase('Assemble')
const assemble = await runStage('assemble-deck', { pluginRoot, workspace, skipVerify })
if (!assemble.ok) {
    return { status: 'failed', stage: 'assemble', voice, adapter, assemble }
}
return { status: skipVerify ? 'done-unverified' : 'done', stage: 'assemble', voice, adapter, assemble }
