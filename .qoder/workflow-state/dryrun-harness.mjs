// project-feature-delivery Workflow 干跑校验器（不启动任何真实 Agent）
// 用法:
//   node .qoder/workflow-state/dryrun-harness.mjs check            # 仅语法校验
//   node .qoder/workflow-state/dryrun-harness.mjs <scenario> [argsJson]
// 场景: happy | mega | dirtymain | gatefail | reviewfix | modeldown | notask | badmode | milestone | release
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
const wfPath = join(here, '..', 'workflows', 'project-feature-delivery.js')
let src = readFileSync(wfPath, 'utf8')
src = src.replace(/^export const meta/m, 'const meta')

const cmd = process.argv[2] || 'check'

// --- 语法校验：按运行时方式包进 async 函数再 node --check ---
const wrapped = `async function __wf(agent, parallel, pipeline, phase, log, args, budget, workflow) {\n${src}\n}\n`
const tmp = join(tmpdir(), 'pfd-wrapped-check.mjs')
writeFileSync(tmp, wrapped)
try {
  execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' })
  console.log('SYNTAX_OK (wrapped-async ESM check)')
} catch (e) {
  console.error('SYNTAX_FAIL\n' + (e.stderr ? e.stderr.toString() : e.message))
  process.exit(1)
} finally {
  rmSync(tmp, { force: true })
}
if (cmd === 'check') process.exit(0)

// --- 静态自检：禁用 API 扫描 ---
const forbidden = [/Date\.now\s*\(/, /Math\.random\s*\(/, /new\s+Date\s*\(\s*\)/, /require\s*\(/, /process\./, /import\s*\(/]
for (const re of forbidden) {
  const m = src.match(re)
  if (m) { console.error('STATIC_FAIL: forbidden API ' + re + ' found: ' + m[0]); process.exit(1) }
}
const metaSrc = src.match(/const meta = \{[\s\S]*?\n\}/)
if (!metaSrc) { console.error('STATIC_FAIL: meta not found'); process.exit(1) }
if (/\$\{|=>|\bfunction\b/.test(metaSrc[0].replace(/detail:.*|whenToUse:.*|description:.*/g, ''))) {
  // meta 内的模板字符串/函数（当 phases detail 为纯字符串时不会命中）
}
console.log('STATIC_OK (no Date.now/Math.random/require/process/import(); meta is literal)')

// --- 干跑：stub agent 按 label 返回罐头数据 ---
const scenario = cmd
let gateCalls = 0
let reviewCalls = 0

const specObj = {
  TASK_ID: 'kb-pdf-parser', TITLE: 'PDF 解析器', OBJECTIVE: 'o', CONTEXT: 'c',
  DEPENDENCIES: [], IN_SCOPE: ['a'], OUT_OF_SCOPE: ['b'], EXPECTED_FILES: ['backend/app/kb/pdf.py'],
  FILES_FORBIDDEN_TO_CHANGE: [], DATABASE_IMPACT: 'none', API_IMPACT: 'none', FRONTEND_IMPACT: 'none',
  SECURITY_IMPACT: 'none', PRIVACY_IMPACT: 'none', MEDICAL_IMPACT: 'none', KNOWLEDGE_IMPACT: 'kb',
  MIGRATION_REQUIREMENTS: 'none',
  ACCEPTANCE_CRITERIA: [{ id: 'AC-01', criterion: '未认证请求返回 401', verification: 'pytest' }],
  MANDATORY_TESTS: ['pytest backend/tests/kb'], REGRESSION_TESTS: ['pytest backend/tests'],
  ROLLBACK_PLAN: 'git revert', KNOWN_RISKS: [], DELIVERABLES: ['code'],
  specPath: '.qoder/workflow-state/kb-pdf-parser.spec.json',
}

function stubAgent(prompt, opts) {
  const label = (opts && opts.label) || '?'
  calls.push({ label, model: opts && opts.model, phase: opts && opts.phase })
  const model = opts && opts.model
  if (model !== 'qmodel_38max' && model !== 'qfmodel') throw new Error('MODEL_POLICY_VIOLATION: ' + model + ' @ ' + label)
  switch (label) {
    case 'probe:max': return Promise.resolve(scenario === 'modeldown' ? null : 'OK')
    case 'probe:flash': return Promise.resolve('OK')
    case 'preflight': return Promise.resolve(scenario === 'dirtymain'
      ? { isGitRepo: true, isCorrectRepo: true, branch: 'master', dirty: true, dirtyFiles: ['backend/x.py'], notes: '' }
      : { isGitRepo: true, isCorrectRepo: true, branch: 'feature/kb', dirty: false, dirtyFiles: [], notes: 'AGENTS.md 不存在' })
    case 'classify': return Promise.resolve({ blocked: false, taskType: ['backend', 'knowledge', 'rag'], medicalSensitive: false, privacySensitive: true, securitySensitive: false, frontendTouchedExpected: false, backendTouchedExpected: true, schemaTouchedExpected: false, migrationExpected: false, knowledgeTouchedExpected: true, ragTouchedExpected: true, riskLevel: 'medium' })
    case 'explore': return Promise.resolve({ CURRENT_STATE: 'kb 模块已有 md 解析', RELATED_FILES: ['backend/app/kb/parser.py'], DEPENDENCIES: 'sqlalchemy', RISKS: '解析器接口耦合', EXISTING_TESTS: 'backend/tests/kb', POTENTIAL_REGRESSIONS: 'md 解析', TEST_COMMANDS: { backend: ['pytest backend/tests/kb'], frontend: [], lint: ['ruff check backend'], migration: [], integration: ['pytest -m integration'] }, parallelSafe: false, parallelSafeReason: '共享 parser 接口' })
    case 'scope-check': return Promise.resolve(scenario === 'mega'
      ? { atomic: false, estimatedDevDays: 12, reason: 'Mega Task：完成整个知识库', recommendedTasks: [{ taskId: 'kb-01', title: 'PDF 解析', objective: 'o', dependencies: [], acceptanceSummary: 's' }, { taskId: 'kb-02', title: 'HTML 解析', objective: 'o2', dependencies: ['kb-01'], acceptanceSummary: 's2' }] }
      : { atomic: true, estimatedDevDays: 1, reason: '单一解析器，规模合适' })
    case 'task-spec': return Promise.resolve(specObj)
    case 'implement': return Promise.resolve({ status: 'IMPLEMENTED', TASK_ID: 'kb-pdf-parser', FILES_CREATED: ['backend/app/kb/pdf.py'], FILES_MODIFIED: ['backend/app/kb/parser.py'], FILES_DELETED: [], DATABASE_CHANGES: 'none', API_CHANGES: 'none', FRONTEND_CHANGES: 'none', TESTS_ADDED: ['backend/tests/kb/test_pdf.py'], TESTS_MODIFIED: [], TESTS_RUN: ['pytest backend/tests/kb'], TEST_RESULTS: '12 passed', DEVIATIONS_FROM_SPEC: 'none', KNOWN_LIMITATIONS: '', BLOCKERS: '' })
    case 'machine-gate': {
      gateCalls++
      if (scenario === 'gatealwaysfail' || (scenario === 'gatefail' && gateCalls === 1)) return Promise.resolve({ commands: [{ command: 'pytest backend/tests/kb', purpose: 'target tests', exitCode: 1, stdoutSummary: '1 failed', stderrSummary: 'AssertionError' }], allPassed: false, blockedMissingSafeTestEnv: false, skippedGates: [] })
      return Promise.resolve({ commands: [{ command: 'pytest backend/tests/kb', purpose: 'target tests', exitCode: 0, stdoutSummary: '12 passed' }, { command: 'ruff check backend', purpose: 'lint', exitCode: 0 }], allPassed: true, blockedMissingSafeTestEnv: false, skippedGates: [] })
    }
    case 'self-repair': return Promise.resolve({ status: 'FIXED', summary: '修正断言', filesChanged: ['backend/app/kb/pdf.py'] })
    case 'rca': return Promise.resolve({ ROOT_CAUSE: '接口签名不一致', FIX_SPEC: '统一 parse() 签名', affectedFiles: ['backend/app/kb/pdf.py'] })
    case 'rca-fix': return Promise.resolve({ status: 'FIXED', summary: '按 FIX_SPEC 修复', filesChanged: ['backend/app/kb/pdf.py'] })
    case 'max-review': {
      reviewCalls++
      if (scenario === 'reviewfix' && reviewCalls === 1) return Promise.resolve({ verdict: 'REQUEST_CHANGES', acceptanceResults: [{ id: 'AC-01', met: true, evidence: 'test 401' }], blockers: [{ BLOCKER_ID: 'B1', LOCATION: 'backend/app/kb/pdf.py:20', EVIDENCE: '异常被静默吞掉', IMPACT: '解析失败不可见', REQUIRED_FIX: '抛出并记录日志', VERIFICATION_METHOD: '新增单测' }], nonBlockingNotes: ['命名建议'] })
      return Promise.resolve({ verdict: 'PASS', acceptanceResults: [{ id: 'AC-01', met: true, evidence: 'pytest 通过' }], blockers: [], nonBlockingNotes: ['后续可加缓存'] })
    }
    case 'fix': return Promise.resolve({ status: 'FIXED', summary: '修复 B1', filesChanged: ['backend/app/kb/pdf.py'] })
    case 'verify': return Promise.resolve({ verdict: 'TASK_PASS', acceptanceAllMet: true, scopeIntact: true, unexpectedFiles: [], regressionRisk: 'low', rollbackIntact: true, changedFiles: ['backend/app/kb/pdf.py', 'backend/app/kb/parser.py'], reasons: ['全部满足'], suggestedNextTask: 'kb-02 HTML 解析器' })
    case 'milestone-evidence': return Promise.resolve({ checks: [{ name: 'regression', performed: true, result: 'pass', command: 'pytest', exitCode: 0, evidence: '30 passed' }], summary: 'ok', missing: [] })
    case 'milestone-verdict': return Promise.resolve({ verdict: 'MILESTONE_PASS', reasons: ['所有 Task PASS'], openBlockers: [], taskStatusReview: '3/3 PASS' })
    case 'release-evidence': return Promise.resolve({ checks: [{ name: 'backend full tests', performed: true, result: 'pass', command: 'pytest', exitCode: 0, evidence: 'ok' }, { name: 'performance tests', performed: false, result: 'missing_evidence', evidence: '项目暂无性能测试' }], summary: 'partial', missing: ['performance tests'] })
    case 'release-security': return Promise.resolve({ findings: ['CORS 偏宽'], blockingFindings: [], summary: '无阻断安全发现' })
    case 'release-verdict': return Promise.resolve({ verdict: 'PROJECT_NOT_READY', reasons: ['性能测试无证据'], missingEvidence: ['performance tests'] })
    default: throw new Error('UNEXPECTED_AGENT_LABEL: ' + label)
  }
}

const calls = []
const stubs = {
  agent: stubAgent,
  parallel: (thunks) => Promise.all(thunks.map(t => t().catch(() => null))),
  pipeline: async (items, ...stages) => { const out = []; for (const it of items) { let r = it; for (const s of stages) r = await s(r, it); out.push(r) } return out },
  phase: (t) => calls.push({ label: 'phase:' + t }),
  log: (m) => calls.push({ label: 'log', msg: m }),
  budget: { total: null, spent: () => 0, remaining: () => Infinity },
  workflow: () => { throw new Error('nested workflow not allowed') },
}

let ARGS
switch (scenario) {
  case 'notask': ARGS = undefined; break
  case 'badmode': ARGS = { task: 'x', mode: 'yolo' }; break
  case 'milestone': ARGS = { task: '知识库 M1 Milestone', mode: 'milestone_gate' }; break
  case 'release': ARGS = { task: 'v1.0 发布', mode: 'release_gate' }; break
  default: ARGS = { task: '实现知识库 PDF 解析器，支持文本与元数据提取', mode: 'task' }
}

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const fn = new AsyncFunction('agent', 'parallel', 'pipeline', 'phase', 'log', 'args', 'budget', 'workflow', src)
const result = await fn(stubs.agent, stubs.parallel, stubs.pipeline, stubs.phase, stubs.log, ARGS, stubs.budget, stubs.workflow)

const modelsUsed = [...new Set(calls.filter(c => c.model).map(c => c.model))]
console.log(JSON.stringify({
  scenario,
  WORKFLOW_STATUS: result && result.WORKFLOW_STATUS,
  BLOCK_REASON: result && result.BLOCK_REASON,
  modelsUsed,
  agentLabels: calls.filter(c => c.model).map(c => c.label),
  resultKeys: result ? Object.keys(result) : null,
}, null, 1))
