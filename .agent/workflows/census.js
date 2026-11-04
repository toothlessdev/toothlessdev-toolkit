export const meta = {
  name: 'census',
  description: 'fanout 위에 항목별 판정(ok/issue/n/a/unknown)과 ok 반증을 얹은 전수조사 프리셋',
  whenToUse: '대상 목록이 확정된 전수조사. args: { items, criteria, root?, shardSize?, maxRounds?, auditRatio? }',
  phases: [{ title: 'Fanout', detail: 'fanout 워크플로에 판정 프롬프트와 반증 설정을 넘긴다' }],
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    rows: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          item: { type: 'string' },
          verdict: { type: 'string', enum: ['ok', 'issue', 'n/a', 'unknown'] },
          evidence: { type: 'string' },
        },
        required: ['item', 'verdict', 'evidence'],
      },
    },
  },
  required: ['rows'],
}

function buildJudgePrompt(criteria) {
  return [
    `판정 기준: ${criteria}`,
    '',
    '아래 목록이 이번 조사의 전체 모집단 중 네 몫이다. 모든 항목을 직접 열어 확인하고 판정한다.',
    '- 항목마다 정확히 한 행을 반환한다. 문제가 없어도, 해당 없어도 행을 남긴다.',
    '- verdict: ok(기준 충족), issue(기준 위반), n/a(적용 대상 아님), unknown(확인하지 못함).',
    '- evidence: 판단 근거를 한두 문장으로. issue 면 파일:줄을 포함한다.',
    '- 목록에 없는 항목을 추가하지 않는다. 항목을 묶거나 생략하지 않는다.',
    '- 반환하기 전에 반환한 행 수가 입력 항목 수와 같은지 센다.',
    '',
    'ITEMS:',
    '{{items}}',
  ].join('\n')
}

function buildAuditPrompt(criteria) {
  return [
    `판정 기준: ${criteria}`,
    '',
    '아래 항목들은 다른 조사자가 ok(기준 충족)로 판정했다. 너는 이 판정을 반증하는 역할이다.',
    '- 항목을 직접 열어 보고 기준 위반이 있는지 찾는다. 앞선 판정 근거를 믿지 않는다.',
    '- 위반을 찾으면 refuted=true 와 근거(파일:줄)를, 정말 없으면 refuted=false 를 반환한다.',
    '- 항목마다 정확히 한 행을 반환한다.',
    '',
    'ITEMS (앞선 결과 포함):',
    '{{auditItems}}',
  ].join('\n')
}

if (!args || !args.criteria) {
  throw new Error('args 에 criteria(판정 기준 문자열)가 필요합니다')
}

phase('Fanout')

const fanoutResult = await workflow('fanout', {
  items: args.items,
  root: args.root,
  shardSize: args.shardSize,
  maxRounds: args.maxRounds,
  prompt: buildJudgePrompt(args.criteria),
  schema: VERDICT_SCHEMA,
  audit: {
    prompt: buildAuditPrompt(args.criteria),
    ratio: args.auditRatio,
    where: { field: 'verdict', equals: 'ok' },
  },
})

const verdictCounts = fanoutResult.rows.reduce((counts, row) => {
  counts[row.verdict] = (counts[row.verdict] ?? 0) + 1
  return counts
}, {})

return { ...fanoutResult, verdictCounts }
