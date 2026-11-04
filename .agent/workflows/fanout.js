export const meta = {
  name: 'fanout',
  description: '항목 목록을 샤드로 나눠 같은 프롬프트를 병렬 실행하고, 필요하면 누락 재투입과 표본 반증까지 한다',
  whenToUse: '목록이 이미 확정된 병렬 작업. args: { items, prompt, schema?, coverage?, shardSize?, maxRounds?, audit?, root? }',
  phases: [
    { title: 'Run', detail: '샤드별 실행, coverage 가 켜져 있으면 누락 재투입' },
    { title: 'Audit', detail: '선택된 행을 독립 반증 (audit 지정 시)' },
  ],
}

const DEFAULT_SHARD_SIZE = 10
const DEFAULT_MAX_ROUNDS = 3
const DEFAULT_AUDIT_RATIO = 0.2
const AUDIT_SHARD_SIZE = 10

const DEFAULT_ROW_SCHEMA = {
  type: 'object',
  properties: {
    rows: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          item: { type: 'string' },
          result: { type: 'string' },
        },
        required: ['item', 'result'],
      },
    },
  },
  required: ['rows'],
}

const AUDIT_SCHEMA = {
  type: 'object',
  properties: {
    rows: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          item: { type: 'string' },
          refuted: { type: 'boolean' },
          reason: { type: 'string' },
        },
        required: ['item', 'refuted', 'reason'],
      },
    },
  },
  required: ['rows'],
}

function chunk(list, size) {
  const chunks = []
  for (let start = 0; start < list.length; start += size) {
    chunks.push(list.slice(start, start + size))
  }
  return chunks
}

function renderPrompt(template, placeholder, lines, root) {
  const filled = template.replace(placeholder, lines.join('\n'))
  return root ? `작업 기준 경로: ${root}\n\n${filled}` : filled
}

function toItemLine(item) {
  return `- ${item}`
}

function toAuditLine(row) {
  const { item, ...rest } = row
  return `- ${item} | 앞선 결과: ${JSON.stringify(rest)}`
}

function pickAuditSample(rows, ratio) {
  if (ratio >= 1) return rows
  const stride = Math.max(1, Math.round(1 / ratio))
  return rows.filter((_, index) => index % stride === 0)
}

function matchesAuditFilter(row, where) {
  return !where || row[where.field] === where.equals
}

async function runWithCoverage(items, args) {
  const rowByItem = new Map()
  let pendingItems = items
  let roundsUsed = 0

  while (pendingItems.length > 0 && roundsUsed < args.maxRounds) {
    roundsUsed++
    const pendingSet = new Set(pendingItems)

    const shardResults = await parallel(
      chunk(pendingItems, args.shardSize).map((shard, index) => () =>
        agent(renderPrompt(args.prompt, '{{items}}', shard.map(toItemLine), args.root), {
          label: `run r${roundsUsed} #${index + 1}`,
          phase: 'Run',
          schema: args.schema,
        }),
      ),
    )

    for (const result of shardResults.filter(Boolean)) {
      for (const row of result.rows) {
        if (pendingSet.has(row.item) && !rowByItem.has(row.item)) {
          rowByItem.set(row.item, row)
        }
      }
    }

    pendingItems = items.filter((item) => !rowByItem.has(item))
    log(`round ${roundsUsed}: 처리 ${rowByItem.size}/${items.length}, 누락 ${pendingItems.length}`)
  }

  return { rows: [...rowByItem.values()], missing: pendingItems, roundsUsed }
}

async function runWithoutCoverage(items, args) {
  const outputs = await parallel(
    chunk(items, args.shardSize).map((shard, index) => () =>
      agent(renderPrompt(args.prompt, '{{items}}', shard.map(toItemLine), args.root), {
        label: `run #${index + 1}`,
        phase: 'Run',
        ...(args.schema ? { schema: args.schema } : {}),
      }),
    ),
  )
  const failedShardCount = outputs.filter((output) => output === null).length
  if (failedShardCount > 0) log(`샤드 ${failedShardCount}개가 결과 없이 끝남`)

  return { outputs: outputs.filter(Boolean) }
}

async function runAudit(rows, args) {
  const auditRatio = args.audit.ratio ?? DEFAULT_AUDIT_RATIO
  const candidates = rows.filter((row) => matchesAuditFilter(row, args.audit.where))
  const sample = pickAuditSample(candidates, auditRatio)
  log(`반증 대상 ${candidates.length}개 중 ${sample.length}개 검사 (나머지 ${candidates.length - sample.length}개는 표본 밖)`)

  const auditResults = await parallel(
    chunk(sample, AUDIT_SHARD_SIZE).map((shard, index) => () =>
      agent(renderPrompt(args.audit.prompt, '{{auditItems}}', shard.map(toAuditLine), args.root), {
        label: `audit #${index + 1}`,
        phase: 'Audit',
        schema: AUDIT_SCHEMA,
      }),
    ),
  )

  const itemToRow = new Map(rows.map((row) => [row.item, row]))
  const disputed = auditResults
    .filter(Boolean)
    .flatMap((result) => result.rows)
    .filter((row) => row.refuted && itemToRow.has(row.item))

  return { sampledCount: sample.length, notSampledCount: candidates.length - sample.length, disputed }
}

if (!args || !Array.isArray(args.items) || args.items.length === 0 || !args.prompt) {
  throw new Error('args 에 items(문자열 배열)와 prompt(문자열)가 필요합니다')
}
if (!args.prompt.includes('{{items}}')) {
  throw new Error('prompt 에 {{items}} 자리표시자가 있어야 샤드의 항목이 들어갑니다')
}
if (args.audit && !args.audit.prompt?.includes('{{auditItems}}')) {
  throw new Error('audit.prompt 에 {{auditItems}} 자리표시자가 있어야 합니다')
}

const items = [...new Set(args.items)]
const resolvedArgs = {
  ...args,
  coverage: args.coverage ?? true,
  shardSize: args.shardSize ?? DEFAULT_SHARD_SIZE,
  maxRounds: args.maxRounds ?? DEFAULT_MAX_ROUNDS,
  schema: args.schema ?? (args.coverage === false ? undefined : DEFAULT_ROW_SCHEMA),
}

phase('Run')
log(`항목 ${items.length}개, 샤드 크기 ${resolvedArgs.shardSize}, coverage ${resolvedArgs.coverage}`)

if (!resolvedArgs.coverage) {
  return { total: items.length, ...(await runWithoutCoverage(items, resolvedArgs)) }
}

const run = await runWithCoverage(items, resolvedArgs)

phase('Audit')
const audit = resolvedArgs.audit ? await runAudit(run.rows, resolvedArgs) : null

return {
  total: items.length,
  covered: run.rows.length,
  missing: run.missing,
  roundsUsed: run.roundsUsed,
  rows: run.rows,
  audit,
}
