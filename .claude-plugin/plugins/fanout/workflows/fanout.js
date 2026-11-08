export const meta = {
  name: 'fanout',
  description: '항목 목록을 샤드로 나눠 같은 프롬프트를 병렬 실행하고, 필요하면 누락 재투입과 표본 반증까지 한다',
  whenToUse: '목록이 이미 확정된 병렬 작업. args: { items, prompt, schema?, coverage?, shardSize?, maxRounds?, audit?, root?, readGate?, lineCountByItem?, lineBudget? }',
  phases: [
    { title: 'Run', detail: '샤드별 실행, coverage 가 켜져 있으면 누락 재투입' },
    { title: 'Audit', detail: '선택된 행을 독립 반증 (audit 지정 시)' },
  ],
}

const DEFAULT_SHARD_SIZE = 10
const DEFAULT_MAX_ROUNDS = 3
const DEFAULT_AUDIT_RATIO = 0.2
const AUDIT_SHARD_SIZE = 10
const DEFAULT_LINE_BUDGET = 3000

// hooks/hooks.json 의 Read 게이트가 이 agent_type 에만 걸립니다.
const INVESTIGATOR_AGENT_TYPE = 'fanout:investigator'

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

/**
 * 줄 수 합이 lineBudget 을 넘지 않게 묶습니다. readGate 를 켜면 에이전트가 맡은 파일을
 * 전부 읽어야 하므로 샤드의 컨텍스트 크기는 파일 개수가 아니라 줄 수가 정합니다.
 * 줄 수를 모르는 항목은 예산 하나를 통째로 쓴다고 보고 혼자 샤드를 차지하게 합니다.
 */
function chunkByLineBudget(list, lineCountOf, lineBudget, maxItemsPerShard) {
  const chunks = []
  let current = []
  let currentLines = 0

  for (const item of list) {
    const itemLines = lineCountOf(item) ?? lineBudget
    const fitsCurrent = currentLines + itemLines <= lineBudget && current.length < maxItemsPerShard
    if (current.length > 0 && !fitsCurrent) {
      chunks.push(current)
      current = []
      currentLines = 0
    }
    current.push(item)
    currentLines += itemLines
  }
  if (current.length > 0) chunks.push(current)

  return chunks
}

function isAbsolutePath(value) {
  return value.startsWith('/')
}

function normalizePath(rawPath, root) {
  let normalized = rawPath.replace(/\/{2,}/g, '/').replace(/^(\.\/)+/, '').replace(/\/$/, '')
  if (root && !isAbsolutePath(normalized)) normalized = `${root.replace(/\/$/, '')}/${normalized}`
  return normalized
}

/**
 * 프롬프트에 항목을 `- 항목` 으로 넣기 때문에 에이전트가 불릿까지 붙여 돌려주는 일이 있습니다.
 * 경로 정규화는 readGate 일 때만 합니다. 일반 항목은 경로가 아닐 수 있어 `//` 를 줄이면 URL 이 깨집니다.
 */
function normalizeItem(rawItem, args) {
  const trimmed = String(rawItem).trim().replace(/^- /, '')
  return args.readGate ? normalizePath(trimmed, args.root) : trimmed
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

function investigatorOptions(args) {
  return args.readGate ? { agentType: INVESTIGATOR_AGENT_TYPE } : {}
}

function planShards(items, args) {
  if (!args.lineCountByItem) return chunk(items, args.shardSize)
  return chunkByLineBudget(items, (item) => args.lineCountByItem[item], args.lineBudget, args.shardSize)
}

async function runWithCoverage(items, args) {
  const rowByItem = new Map()
  let pendingItems = items
  let roundsUsed = 0

  while (pendingItems.length > 0 && roundsUsed < args.maxRounds) {
    roundsUsed++
    const pendingSet = new Set(pendingItems)
    const shards = planShards(pendingItems, args)

    const shardResults = await parallel(
      shards.map((shard, index) => () =>
        agent(renderPrompt(args.prompt, '{{items}}', shard.map(toItemLine), args.root), {
          label: `run r${roundsUsed} #${index + 1}`,
          phase: 'Run',
          schema: args.schema,
          ...investigatorOptions(args),
        }),
      ),
    )

    const failedShardCount = shardResults.filter((result) => result === null).length
    for (const result of shardResults.filter(Boolean)) {
      for (const row of result.rows) {
        const item = normalizeItem(row.item, args)
        if (pendingSet.has(item) && !rowByItem.has(item)) {
          rowByItem.set(item, { ...row, item })
        }
      }
    }

    pendingItems = items.filter((item) => !rowByItem.has(item))
    log(`round ${roundsUsed}: 샤드 ${shards.length}개(실패 ${failedShardCount}), 처리 ${rowByItem.size}/${items.length}, 누락 ${pendingItems.length}`)
  }

  return { rows: [...rowByItem.values()], missing: pendingItems, roundsUsed }
}

async function runWithoutCoverage(items, args) {
  const outputs = await parallel(
    planShards(items, args).map((shard, index) => () =>
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
        ...investigatorOptions(args),
      }),
    ),
  )

  const failedShardCount = auditResults.filter((result) => result === null).length
  if (failedShardCount > 0) log(`반증 샤드 ${failedShardCount}개가 결과 없이 끝남`)

  const itemToRow = new Map(rows.map((row) => [row.item, row]))
  const disputed = auditResults
    .filter(Boolean)
    .flatMap((result) => result.rows)
    .map((row) => ({ ...row, item: normalizeItem(row.item, args) }))
    .filter((row) => row.refuted && itemToRow.has(row.item))

  return { sampledCount: sample.length, notSampledCount: candidates.length - sample.length, failedShardCount, disputed }
}

function normalizeLineCounts(lineCountByItem, args) {
  if (!lineCountByItem) return undefined
  return Object.fromEntries(Object.entries(lineCountByItem).map(([item, lineCount]) => [normalizeItem(item, args), lineCount]))
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
if (args.readGate && args.coverage === false) {
  throw new Error('readGate 는 rows[].item 으로 제출을 판정하므로 coverage 를 끌 수 없습니다')
}
if (args.readGate && args.schema && !args.schema.properties?.rows?.items?.properties?.item) {
  throw new Error('readGate 의 hook 은 제출의 rows[].item 으로 판정합니다. schema 에 rows[].item 이 있어야 합니다')
}
if (args.readGate && args.root && !isAbsolutePath(args.root)) {
  throw new Error('readGate 를 켜면 root 는 절대경로여야 합니다. hook 이 항목을 이 경로 기준으로 찾습니다')
}

const normalizationArgs = { readGate: Boolean(args.readGate), root: args.root }
const items = [...new Set(args.items.map((item) => normalizeItem(item, normalizationArgs)))]
const resolvedArgs = {
  ...args,
  readGate: normalizationArgs.readGate,
  coverage: args.coverage ?? true,
  shardSize: args.shardSize ?? DEFAULT_SHARD_SIZE,
  maxRounds: args.maxRounds ?? DEFAULT_MAX_ROUNDS,
  lineBudget: args.lineBudget ?? DEFAULT_LINE_BUDGET,
  lineCountByItem: normalizeLineCounts(args.lineCountByItem, normalizationArgs),
  schema: args.schema ?? (args.coverage === false ? undefined : DEFAULT_ROW_SCHEMA),
}

phase('Run')
log(`항목 ${items.length}개, 샤드 크기 ${resolvedArgs.shardSize}, coverage ${resolvedArgs.coverage}, readGate ${resolvedArgs.readGate}`)
if (resolvedArgs.lineCountByItem) {
  const unknownCount = items.filter((item) => resolvedArgs.lineCountByItem[item] === undefined).length
  log(`줄 예산 ${resolvedArgs.lineBudget}줄로 샤드를 나눔${unknownCount > 0 ? `, 줄 수를 모르는 항목 ${unknownCount}개는 혼자 샤드를 차지함` : ''}`)
}
if (resolvedArgs.readGate && !resolvedArgs.root && items.some((item) => !isAbsolutePath(item))) {
  log('readGate: 상대경로 항목은 hook 이 세션 작업 디렉터리 기준으로 찾습니다. 다르면 root 를 절대경로로 넘기세요')
}

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
  readGate: resolvedArgs.readGate,
  rows: run.rows,
  audit,
}
