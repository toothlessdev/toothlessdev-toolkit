export const meta = {
  name: 'traverse',
  description: '시작 노드에서 출발해 노드를 처리하며 자식 노드를 발견하고, 새 노드가 안 나올 때까지 레벨별로 순회한다',
  whenToUse: '대상 목록을 미리 뽑을 수 없는 순회형 전수조사. args: { seeds, prompt, root?, shardSize?, maxDepth?, maxNodes?, maxRounds?, criticRounds? }',
  phases: [
    { title: 'Traverse', detail: '레벨별 샤드 처리, 자식 노드를 dedup 해 다음 레벨로' },
    { title: 'Critic', detail: '따라가지 않은 연결이 없는지 점검하고 새 시작점을 추가' },
  ],
}

const DEFAULT_SHARD_SIZE = 8
const DEFAULT_MAX_DEPTH = 5
const DEFAULT_MAX_NODES = 300
const DEFAULT_MAX_ROUNDS = 2
const DEFAULT_CRITIC_ROUNDS = 1
const CRITIC_VISITED_LIMIT = 300

const NODE_SCHEMA = {
  type: 'object',
  properties: {
    rows: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          node: { type: 'string' },
          result: { type: 'string' },
          children: { type: 'array', items: { type: 'string' } },
        },
        required: ['node', 'result', 'children'],
      },
    },
  },
  required: ['rows'],
}

const CRITIC_SCHEMA = {
  type: 'object',
  properties: {
    gaps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          newSeeds: { type: 'array', items: { type: 'string' } },
        },
        required: ['description', 'newSeeds'],
      },
    },
  },
  required: ['gaps'],
}

function chunk(list, size) {
  const chunks = []
  for (let start = 0; start < list.length; start += size) {
    chunks.push(list.slice(start, start + size))
  }
  return chunks
}

function normalizeNode(rawNode, root) {
  let node = rawNode.trim().replace(/\/{2,}/g, '/').replace(/^\.\//, '')
  if (root && node.startsWith(`${root}/`)) node = node.slice(root.length + 1)
  return node.replace(/\/$/, '')
}

function buildNodePrompt(template, shard, root) {
  const nodeLines = shard.map((node) => `- ${node}`).join('\n')
  const filled = template.replace('{{nodes}}', nodeLines)
  const rules = [
    '',
    '공통 규칙:',
    '- 노드마다 정확히 한 행을 반환한다. 자식이 없어도 행을 남기고 children 은 빈 배열로 둔다.',
    '- children 은 이 노드에서 직접 이어지는 노드만 적는다. 추측하지 않는다.',
    root
      ? `- 노드 이름은 ${root} 기준 상대경로 같은 정규 형태로 쓴다. 같은 대상을 다른 표기로 쓰지 않는다.`
      : '- 같은 대상을 항상 같은 표기로 쓴다. 표기가 달라지면 중복 제거가 되지 않는다.',
    '- 목록에 없는 노드의 행을 추가하지 않는다.',
  ]
  return [root ? `작업 기준 경로: ${root}` : '', filled, ...rules].filter((line) => line !== '').join('\n')
}

function buildCriticPrompt(template, visitedNodes) {
  const instruction = template.replace('{{nodes}}', '(방문한 각 노드)')
  return [
    '순회 작업의 완성도를 점검한다. 아래는 이 순회에 쓴 지시와 지금까지 방문한 노드 목록이다.',
    '',
    `순회 지시: ${instruction}`,
    '',
    '방문한 노드:',
    ...visitedNodes.map((node) => `- ${node}`),
    '',
    '- 지시를 따를 때 따라가야 했지만 따라가지 않은 연결 종류가 있는지 직접 확인한다.',
    '- 방문 목록에 없지만 모집단에 속해야 하는 노드를 찾으면 newSeeds 에 넣는다.',
    '- 놓친 게 없으면 gaps 를 빈 배열로 반환한다. 억지로 만들지 않는다.',
  ].join('\n')
}

async function processLevel(frontier, depth, state) {
  let pendingNodes = frontier
  const levelRows = []

  for (let round = 1; pendingNodes.length > 0 && round <= state.maxRounds; round++) {
    const pendingSet = new Set(pendingNodes)

    const shardResults = await parallel(
      chunk(pendingNodes, state.shardSize).map((shard, index) => () =>
        agent(buildNodePrompt(state.prompt, shard, state.root), {
          label: `d${depth} r${round} #${index + 1}`,
          phase: 'Traverse',
          schema: NODE_SCHEMA,
        }),
      ),
    )

    for (const result of shardResults.filter(Boolean)) {
      for (const row of result.rows) {
        const node = normalizeNode(row.node, state.root)
        if (pendingSet.has(node) && !state.visited.has(node)) {
          const normalizedRow = { ...row, node, children: row.children.map((child) => normalizeNode(child, state.root)) }
          state.visited.set(node, normalizedRow)
          levelRows.push(normalizedRow)
        }
      }
    }

    pendingNodes = frontier.filter((node) => !state.visited.has(node))
  }

  return { levelRows, missing: pendingNodes }
}

async function exploreFrom(seeds, state) {
  let frontier = [...new Set(seeds.map((seed) => normalizeNode(seed, state.root)))].filter((node) => !state.visited.has(node))
  const missing = []
  const truncated = []

  for (let depth = 0; frontier.length > 0; depth++) {
    if (depth > state.maxDepth) {
      truncated.push(...frontier.map((node) => ({ node, reason: 'maxDepth' })))
      log(`maxDepth ${state.maxDepth} 도달: 미탐색 ${frontier.length}개`)
      break
    }

    const nodeBudget = state.maxNodes - state.visited.size
    if (frontier.length > nodeBudget) {
      truncated.push(...frontier.slice(nodeBudget).map((node) => ({ node, reason: 'maxNodes' })))
      log(`maxNodes ${state.maxNodes} 도달: 미탐색 ${frontier.length - nodeBudget}개`)
      frontier = frontier.slice(0, nodeBudget)
    }
    if (frontier.length === 0) break

    const level = await processLevel(frontier, depth, state)
    missing.push(...level.missing)

    const nextNodes = new Set()
    for (const row of level.levelRows) {
      for (const child of row.children) {
        if (child !== '' && !state.visited.has(child)) nextNodes.add(child)
      }
    }
    frontier = [...nextNodes]
    log(`depth ${depth}: 처리 ${level.levelRows.length}, 누락 ${level.missing.length}, 다음 레벨 ${frontier.length}, 누적 ${state.visited.size}`)
  }

  return { missing, truncated }
}

if (!args || !Array.isArray(args.seeds) || args.seeds.length === 0 || !args.prompt) {
  throw new Error('args 에 seeds(문자열 배열)와 prompt(문자열)가 필요합니다')
}
if (!args.prompt.includes('{{nodes}}')) {
  throw new Error('prompt 에 {{nodes}} 자리표시자가 있어야 샤드의 노드가 들어갑니다')
}

const state = {
  prompt: args.prompt,
  root: args.root,
  shardSize: args.shardSize ?? DEFAULT_SHARD_SIZE,
  maxDepth: args.maxDepth ?? DEFAULT_MAX_DEPTH,
  maxNodes: args.maxNodes ?? DEFAULT_MAX_NODES,
  maxRounds: args.maxRounds ?? DEFAULT_MAX_ROUNDS,
  visited: new Map(),
}
const criticRounds = args.criticRounds ?? DEFAULT_CRITIC_ROUNDS

phase('Traverse')
log(`시작 노드 ${args.seeds.length}개, maxDepth ${state.maxDepth}, maxNodes ${state.maxNodes}`)

const firstPass = await exploreFrom(args.seeds, state)
const missing = [...firstPass.missing]
const truncated = [...firstPass.truncated]
const gaps = []

phase('Critic')
for (let round = 1; round <= criticRounds; round++) {
  const visitedNodes = [...state.visited.keys()]
  if (visitedNodes.length > CRITIC_VISITED_LIMIT) {
    log(`critic 입력은 방문 노드 ${visitedNodes.length}개 중 앞 ${CRITIC_VISITED_LIMIT}개만 전달`)
  }

  const critique = await agent(buildCriticPrompt(state.prompt, visitedNodes.slice(0, CRITIC_VISITED_LIMIT)), {
    label: `critic #${round}`,
    phase: 'Critic',
    schema: CRITIC_SCHEMA,
  })
  if (!critique || critique.gaps.length === 0) break

  gaps.push(...critique.gaps)
  const newSeeds = critique.gaps.flatMap((gap) => gap.newSeeds)
  const extraPass = await exploreFrom(newSeeds, state)
  missing.push(...extraPass.missing)
  truncated.push(...extraPass.truncated)
  if (newSeeds.length === 0) break
}

return {
  visitedCount: state.visited.size,
  missing,
  truncated,
  criticGaps: gaps,
  rows: [...state.visited.values()],
}
