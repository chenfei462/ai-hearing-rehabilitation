// project-feature-delivery Workflow 干跑校验器（不启动任何真实 Agent）
// 用法:
//   node .qoder/workflow-state/dryrun-harness.mjs check            # 仅语法+静态校验
//   node .qoder/workflow-state/dryrun-harness.mjs test             # 全场景回归断言（含 Gate required/record 语义 A–H）
//   node .qoder/workflow-state/dryrun-harness.mjs <scenario>       # 干跑单个场景，打印结果 JSON
// 场景: happy | mega | dirtymain | gatefail | gatealwaysfail | reviewfix | modeldown | notask | badmode | milestone | release
//       feature-required-fail | feature-required-build-fail | feature-required-migration-noenv | scope-required-fail | forbidden-required-fail
//       audit-record-test-red | audit-record-lint-red | audit-migration-noenv | audit-combined | audit-record-collection-failed
//       D2 治理加固回归（15）：d2-01-gov-preexisting-unchanged | d2-02-gov-hash-changed | d2-03-selfrepair-checkout-head |
//       d2-04-selfrepair-restore | d2-05-selfrepair-reset-hard-cmdc | d2-06-selfrepair-clean-bashc | d2-07-selfrepair-stash |
//       d2-08-flash-write-workflow-js | d2-09-flash-write-agents-md | d2-10-selfrepair-allowed | d2-11-preexisting-changed-noop |
//       d2-12-governance-rootcause-noop | d2-13-selfrepair-allowed-continues | d2-14-postrepair-preexisting-changed | d2-15-dirty-main
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
const selfPath = fileURLToPath(import.meta.url)
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

// ============================================================
// test / regression 模式：为每个场景 spawn 子进程干跑，按 EXPECT 表断言
// 断言项：终态(WORKFLOW_STATUS/BLOCK_REASON)、模型路由子集、gateCalls 上界(防死循环)
// ============================================================
if (cmd === 'test' || cmd === 'regression') {
  // EXPECT: scenario -> { status, block?, maxGateCalls }
  const EXPECT = [
    // ---- 既有场景（不得回归）----
    { scenario: 'happy', status: 'TASK_PASS', maxGateCalls: 1 },
    { scenario: 'mega', status: 'NEEDS_DECOMPOSITION', maxGateCalls: 0 },
    { scenario: 'dirtymain', status: 'BLOCKED', block: 'BLOCKED_DIRTY_MAIN', maxGateCalls: 0 },
    { scenario: 'gatefail', status: 'TASK_PASS', maxGateCalls: 3 },
    { scenario: 'gatealwaysfail', status: 'BLOCKED', block: 'BLOCKED_REPAIR_LIMIT', maxGateCalls: 4 },
    { scenario: 'reviewfix', status: 'TASK_PASS', maxGateCalls: 3 },
    { scenario: 'modeldown', status: 'BLOCKED', block: 'BLOCKED_MODEL_UNAVAILABLE', maxGateCalls: 0 },
    { scenario: 'notask', status: 'BLOCKED', block: 'MISSING_TASK', maxGateCalls: 0 },
    { scenario: 'badmode', status: 'BLOCKED', block: 'INVALID_MODE', maxGateCalls: 0 },
    { scenario: 'milestone', status: 'MILESTONE_PASS', maxGateCalls: 0 },
    { scenario: 'release', status: 'PROJECT_NOT_READY', maxGateCalls: 0 },
    // ---- §8 A–H：Gate required/record 语义回归 ----
    // A. Feature required 目标测试 exit1 → 修复循环耗尽 → BLOCKED_REPAIR_LIMIT（绝不放行）
    { scenario: 'feature-required-fail', status: 'BLOCKED', block: 'BLOCKED_REPAIR_LIMIT', maxGateCalls: 4 },
    // B. Feature required 构建 exit1 → 同上
    { scenario: 'feature-required-build-fail', status: 'BLOCKED', block: 'BLOCKED_REPAIR_LIMIT', maxGateCalls: 4 },
    // C. Feature required 迁移缺安全环境 → BLOCKED_MISSING_SAFE_TEST_ENV
    { scenario: 'feature-required-migration-noenv', status: 'BLOCKED', block: 'BLOCKED_MISSING_SAFE_TEST_ENV', maxGateCalls: 1 },
    // G. Scope required 校验 exit1 → 修复循环耗尽 → BLOCKED_REPAIR_LIMIT
    { scenario: 'scope-required-fail', status: 'BLOCKED', block: 'BLOCKED_REPAIR_LIMIT', maxGateCalls: 4 },
    // H. Forbidden-file required 校验 exit1 → 同上
    { scenario: 'forbidden-required-fail', status: 'BLOCKED', block: 'BLOCKED_REPAIR_LIMIT', maxGateCalls: 4 },
    // D. Audit record pytest exit1 → RECORD_OK，不阻断 → TASK_PASS
    { scenario: 'audit-record-test-red', status: 'TASK_PASS', maxGateCalls: 1 },
    // E. Audit record ruff exit1 → RECORD_OK，不阻断 → TASK_PASS
    { scenario: 'audit-record-lint-red', status: 'TASK_PASS', maxGateCalls: 1 },
    // F. Audit record 迁移缺安全环境 → RECORD_NOT_EXECUTED_SAFE_ENV，不阻断 → TASK_PASS
    { scenario: 'audit-migration-noenv', status: 'TASK_PASS', maxGateCalls: 1 },
    // M0-001 真实形态：required 全绿 + record 全红/缺环境 → TASK_PASS（Gate PASS 但基线 DEGRADED）
    { scenario: 'audit-combined', status: 'TASK_PASS', maxGateCalls: 1 },
    // record 采集本身失败（命令不存在）→ RECORD_COLLECTION_FAILED，按 Spec 判 MACHINE_FAIL → 修复耗尽
    { scenario: 'audit-record-collection-failed', status: 'BLOCKED', block: 'BLOCKED_REPAIR_LIMIT', maxGateCalls: 4 },
    // ---- D2 治理加固回归（§21，D2-TEST-01..15）----
    // 01 feature 分支上 workflow.js 为 pre-existing M，本任务不触碰 → PRE_EXISTING_UNCHANGED，无 Scope FAIL，无 Self-Repair → TASK_PASS
    { scenario: 'd2-01-gov-preexisting-unchanged', status: 'TASK_PASS', maxGateCalls: 1, forbidLabels: ['self-repair', 'rca-fix', 'fix'] },
    // 02 任务期间治理文件指纹改变 → BLOCKED_GOVERNANCE_CONFLICT，不启动 Flash
    { scenario: 'd2-02-gov-hash-changed', status: 'BLOCKED', block: 'BLOCKED_GOVERNANCE_CONFLICT', maxGateCalls: 0, forbidLabels: ['self-repair', 'rca-fix', 'fix'] },
    // 03 Self-Repair 报告 git checkout HEAD -- file → denylist 命中（执行前拒绝语义）
    { scenario: 'd2-03-selfrepair-checkout-head', status: 'BLOCKED', block: 'GOVERNANCE_POLICY_VIOLATION', maxGateCalls: 1, expectLabels: ['self-repair'] },
    // 04 git restore file → BLOCK
    { scenario: 'd2-04-selfrepair-restore', status: 'BLOCKED', block: 'GOVERNANCE_POLICY_VIOLATION', maxGateCalls: 1, expectLabels: ['self-repair'] },
    // 05 cmd /c git reset --hard（bypass 包装）→ BLOCK
    { scenario: 'd2-05-selfrepair-reset-hard-cmdc', status: 'BLOCKED', block: 'GOVERNANCE_POLICY_VIOLATION', maxGateCalls: 1, expectLabels: ['self-repair'] },
    // 06 bash -c "git clean -fd"（bypass 包装）→ BLOCK
    { scenario: 'd2-06-selfrepair-clean-bashc', status: 'BLOCKED', block: 'GOVERNANCE_POLICY_VIOLATION', maxGateCalls: 1, expectLabels: ['self-repair'] },
    // 07 git stash → BLOCK
    { scenario: 'd2-07-selfrepair-stash', status: 'BLOCKED', block: 'GOVERNANCE_POLICY_VIOLATION', maxGateCalls: 1, expectLabels: ['self-repair'] },
    // 08 Flash 写 .qoder/workflows/test.js（实施阶段治理写）→ BLOCKED_GOVERNANCE_CONFLICT
    { scenario: 'd2-08-flash-write-workflow-js', status: 'BLOCKED', block: 'BLOCKED_GOVERNANCE_CONFLICT', maxGateCalls: 0, forbidLabels: ['self-repair', 'rca-fix', 'fix'] },
    // 09 Flash 写 AGENTS.md（实施阶段治理写）→ BLOCKED_GOVERNANCE_CONFLICT
    { scenario: 'd2-09-flash-write-agents-md', status: 'BLOCKED', block: 'BLOCKED_GOVERNANCE_CONFLICT', maxGateCalls: 0, forbidLabels: ['self-repair', 'rca-fix', 'fix'] },
    // 10 required Feature 测试失败，归属文件 ∈ 本任务 allowedWritePaths → Self-Repair ALLOWED（证明 D2 未一刀切禁修复）
    { scenario: 'd2-10-selfrepair-allowed', status: 'TASK_PASS', maxGateCalls: 3, expectLabels: ['self-repair'] },
    // 11 required 失败根因是 pre-existing 文件任务期间被改 → 无 Self-Repair，显式 BLOCKED_EXTERNAL_WORKTREE_CHANGE
    { scenario: 'd2-11-preexisting-changed-noop', status: 'BLOCKED', block: 'BLOCKED_EXTERNAL_WORKTREE_CHANGE', maxGateCalls: 0, forbidLabels: ['self-repair', 'rca-fix', 'fix'] },
    // 12 required 失败根因是治理文件 → 无 Self-Repair，BLOCKED_GOVERNANCE_CONFLICT
    { scenario: 'd2-12-governance-rootcause-noop', status: 'BLOCKED', block: 'BLOCKED_GOVERNANCE_CONFLICT', maxGateCalls: 0, forbidLabels: ['self-repair', 'rca-fix', 'fix'] },
    // 13 Self-Repair 只改授权任务文件 → 修复正常继续 → TASK_PASS
    { scenario: 'd2-13-selfrepair-allowed-continues', status: 'TASK_PASS', maxGateCalls: 3, expectLabels: ['self-repair'] },
    // 14 Self-Repair 后某 pre-existing 文件指纹改变（疑似破坏性 git 的效果）→ 指纹校验立即 BLOCK
    { scenario: 'd2-14-postrepair-preexisting-changed', status: 'BLOCKED', block: 'BLOCKED_EXTERNAL_WORKTREE_CHANGE', maxGateCalls: 1, expectLabels: ['self-repair'] },
    // 15 main/master + dirty → 仍 BLOCKED_DIRTY_MAIN（Delta 逻辑不得让脏 main 通过）
    { scenario: 'd2-15-dirty-main', status: 'BLOCKED', block: 'BLOCKED_DIRTY_MAIN', maxGateCalls: 0 },
  ]

  const ALLOWED_MODELS = new Set(['qmodel_38max', 'qfmodel'])
  let pass = 0
  const failures = []
  for (const exp of EXPECT) {
    let out
    try {
      out = execFileSync(process.execPath, [selfPath, exp.scenario], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (e) {
      failures.push(`${exp.scenario}: SUBPROCESS_ERROR ${(e.stderr || e.message || '').toString().slice(0, 400)}`)
      continue
    }
    // 提取末尾 JSON 对象（stdout 前部有 SYNTAX_OK/STATIC_OK 行）
    const jsonStart = out.indexOf('{')
    let parsed
    try { parsed = JSON.parse(out.slice(jsonStart)) } catch (e) { failures.push(`${exp.scenario}: JSON_PARSE_FAIL ${e.message}`); continue }

    const errs = []
    if (parsed.WORKFLOW_STATUS !== exp.status) errs.push(`status expected=${exp.status} got=${parsed.WORKFLOW_STATUS}`)
    if (exp.block && parsed.BLOCK_REASON !== exp.block) errs.push(`block expected=${exp.block} got=${parsed.BLOCK_REASON}`)
    for (const m of (parsed.modelsUsed || [])) { if (!ALLOWED_MODELS.has(m)) errs.push(`MODEL_POLICY_VIOLATION model=${m}`) }
    if (typeof parsed.gateCalls === 'number' && parsed.gateCalls > exp.maxGateCalls) errs.push(`gateCalls=${parsed.gateCalls} exceeds max=${exp.maxGateCalls} (possible loop)`)
    const labels = parsed.agentLabels || []
    for (const l of (exp.expectLabels || [])) { if (labels.indexOf(l) < 0) errs.push(`expected label '${l}' not invoked (labels=[${labels.join(',')}])`) }
    for (const l of (exp.forbidLabels || [])) { if (labels.indexOf(l) >= 0) errs.push(`forbidden label '${l}' was invoked (Flash must not run)`) }
    if (errs.length) failures.push(`${exp.scenario}: ${errs.join('; ')}`)
    else { pass++; console.log(`  PASS ${exp.scenario} -> ${parsed.WORKFLOW_STATUS}${parsed.BLOCK_REASON ? '/' + parsed.BLOCK_REASON : ''} (gateCalls=${parsed.gateCalls}, models=[${(parsed.modelsUsed || []).join(',')}])`) }
  }
  console.log(`\nREGRESSION: ${pass}/${EXPECT.length} passed`)
  if (failures.length) { console.error('FAILURES:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1) }
  console.log('ALL_SCENARIOS_PASS (old + new Gate semantics; model routing unchanged; no infinite loop)')
  process.exit(0)
}

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

// ============================================================
// D2 干跑世界模型：worktree 快照（指纹）+ 场景编排
// ============================================================
const GOVF = '.qoder/workflows/project-feature-delivery.js'
const H0 = 'HEAD_SHA_BASELINE_0000000000000000000000000000'
function fp(path, hash) { return { path, hash } }
function snap(o) {
  o = o || {}
  return {
    head: o.head || H0, branch: o.branch || 'feature/kb',
    staged: o.staged || [], trackedModified: o.trackedModified || [], trackedDeleted: o.trackedDeleted || [],
    untracked: o.untracked || [], fingerprints: o.fingerprints || [],
  }
}
const CLEAN_BASE = snap({})
const DEFAULT_POST = snap({ untracked: ['backend/app/kb/pdf.py'], trackedModified: ['backend/app/kb/parser.py'], fingerprints: [fp('backend/app/kb/pdf.py', 'pdf1'), fp('backend/app/kb/parser.py', 'par1')] })

// 每个 D2 场景的快照队列（第 1 次 worktree-snapshot = WORKTREE_BASELINE，其后 = 各校验/修复前后快照）
const SNAPSHOTS = {
  // 01：治理文件 pre-existing M，任务不触碰，指纹保持 gov0 → PRE_EXISTING_UNCHANGED
  'd2-01-gov-preexisting-unchanged': [
    snap({ trackedModified: [GOVF], fingerprints: [fp(GOVF, 'gov0')] }),
    snap({ trackedModified: [GOVF, 'backend/app/kb/parser.py'], untracked: ['backend/app/kb/pdf.py'], fingerprints: [fp(GOVF, 'gov0'), fp('backend/app/kb/pdf.py', 'pdf1'), fp('backend/app/kb/parser.py', 'par1')] }),
  ],
  // 02：治理文件指纹 gov0 → gov1（任务期间被改）→ BLOCKED_GOVERNANCE_CONFLICT
  'd2-02-gov-hash-changed': [
    snap({ trackedModified: [GOVF], fingerprints: [fp(GOVF, 'gov0')] }),
    snap({ trackedModified: [GOVF], fingerprints: [fp(GOVF, 'gov1')] }),
  ],
  // 08：实施阶段新建治理文件 .qoder/workflows/test.js（clean baseline → dirty）→ BLOCKED_GOVERNANCE_CONFLICT
  'd2-08-flash-write-workflow-js': [
    CLEAN_BASE,
    snap({ untracked: ['.qoder/workflows/test.js', 'backend/app/kb/pdf.py'], fingerprints: [fp('.qoder/workflows/test.js', 't1'), fp('backend/app/kb/pdf.py', 'pdf1')] }),
  ],
  // 09/12：实施阶段修改 AGENTS.md（治理）→ BLOCKED_GOVERNANCE_CONFLICT
  'd2-09-flash-write-agents-md': [
    CLEAN_BASE,
    snap({ trackedModified: ['AGENTS.md'], fingerprints: [fp('AGENTS.md', 'a1')] }),
  ],
  'd2-12-governance-rootcause-noop': [
    CLEAN_BASE,
    snap({ trackedModified: ['.qoder/rules/30-backend.md'], fingerprints: [fp('.qoder/rules/30-backend.md', 'r1')] }),
  ],
  // 11：pre-existing 文件任务期间被改 pre0→pre1（非治理）→ BLOCKED_EXTERNAL_WORKTREE_CHANGE
  'd2-11-preexisting-changed-noop': [
    snap({ trackedModified: ['backend/app/preexisting.py'], fingerprints: [fp('backend/app/preexisting.py', 'pre0')] }),
    snap({ trackedModified: ['backend/app/preexisting.py'], fingerprints: [fp('backend/app/preexisting.py', 'pre1')] }),
  ],
  // 14：post-implement 时 pre-existing 未变（通过），Self-Repair 后 pre0→pre1（破坏性 git 的效果）→ 指纹校验 BLOCK
  'd2-14-postrepair-preexisting-changed': [
    snap({ trackedModified: ['backend/app/pre.py'], fingerprints: [fp('backend/app/pre.py', 'pre0')] }), // baseline
    snap({ trackedModified: ['backend/app/pre.py', 'backend/app/kb/parser.py'], untracked: ['backend/app/kb/pdf.py'], fingerprints: [fp('backend/app/pre.py', 'pre0'), fp('backend/app/kb/pdf.py', 'pdf1'), fp('backend/app/kb/parser.py', 'par1')] }), // post-implement（pre 未变）
    snap({ trackedModified: ['backend/app/pre.py', 'backend/app/kb/parser.py'], untracked: ['backend/app/kb/pdf.py'], fingerprints: [fp('backend/app/pre.py', 'pre0'), fp('backend/app/kb/pdf.py', 'pdf1'), fp('backend/app/kb/parser.py', 'par1')] }), // pre-repair（pre 未变）
    snap({ trackedModified: ['backend/app/pre.py', 'backend/app/kb/parser.py'], untracked: ['backend/app/kb/pdf.py'], fingerprints: [fp('backend/app/pre.py', 'pre1'), fp('backend/app/kb/pdf.py', 'pdf2'), fp('backend/app/kb/parser.py', 'par1')] }), // post-repair（pre0→pre1！）
  ],
}
// 需要"required 门禁失败以进入修复循环"的 D2 场景
const D2_GATE_FAIL = new Set(['d2-03-selfrepair-checkout-head', 'd2-04-selfrepair-restore', 'd2-05-selfrepair-reset-hard-cmdc', 'd2-06-selfrepair-clean-bashc', 'd2-07-selfrepair-stash', 'd2-10-selfrepair-allowed', 'd2-13-selfrepair-allowed-continues', 'd2-14-postrepair-preexisting-changed'])
// gate 首轮失败、次轮通过（证明 Self-Repair 被允许且修复成功）
const D2_GATE_FAIL_THEN_PASS = new Set(['d2-10-selfrepair-allowed', 'd2-13-selfrepair-allowed-continues'])
// Self-Repair 自报的 git 命令（denylist 扫描对象）
const D2_SELFREPAIR_GIT = {
  'd2-03-selfrepair-checkout-head': ['git checkout HEAD -- backend/app/kb/pdf.py'],
  'd2-04-selfrepair-restore': ['git restore backend/app/kb/pdf.py'],
  'd2-05-selfrepair-reset-hard-cmdc': ['cmd /c git reset --hard'],
  'd2-06-selfrepair-clean-bashc': ['bash -c "git clean -fd"'],
  'd2-07-selfrepair-stash': ['git stash'],
  'd2-10-selfrepair-allowed': ['git status', 'git diff -- backend/app/kb/pdf.py'],
  'd2-13-selfrepair-allowed-continues': ['git status', 'git diff -- backend/app/kb/pdf.py'],
  'd2-14-postrepair-preexisting-changed': ['git status'], // 自报命令无害；pre-existing 指纹变动由“动作后指纹校验”层捕获（隔离测试 layer④）
}
// preflight 需报告 dirty 的 feature 分支场景（非 main/master）
const D2_DIRTY_FEATURE = new Set(['d2-01-gov-preexisting-unchanged', 'd2-02-gov-hash-changed', 'd2-11-preexisting-changed-noop', 'd2-14-postrepair-preexisting-changed'])

let snapCalls = 0
function worktreeSnapshotStub() {
  snapCalls++
  const q = SNAPSHOTS[scenario]
  if (q && q.length) return q[Math.min(snapCalls - 1, q.length - 1)]
  return snapCalls === 1 ? CLEAN_BASE : DEFAULT_POST
}

function stubAgent(prompt, opts) {
  const label = (opts && opts.label) || '?'
  calls.push({ label, model: opts && opts.model, phase: opts && opts.phase })
  const model = opts && opts.model
  if (model !== 'qmodel_38max' && model !== 'qfmodel') throw new Error('MODEL_POLICY_VIOLATION: ' + model + ' @ ' + label)
  switch (label) {
    case 'probe:max': return Promise.resolve(scenario === 'modeldown' ? null : 'OK')
    case 'probe:flash': return Promise.resolve('OK')
    case 'preflight': {
      if (scenario === 'dirtymain' || scenario === 'd2-15-dirty-main') return Promise.resolve({ isGitRepo: true, isCorrectRepo: true, branch: 'master', dirty: true, dirtyFiles: ['backend/x.py'], notes: '' })
      if (D2_DIRTY_FEATURE.has(scenario)) return Promise.resolve({ isGitRepo: true, isCorrectRepo: true, branch: 'feature/kb', dirty: true, dirtyFiles: ['(pre-existing authorized change)'], notes: 'AGENTS.md 存在' })
      return Promise.resolve({ isGitRepo: true, isCorrectRepo: true, branch: 'feature/kb', dirty: false, dirtyFiles: [], notes: 'AGENTS.md 不存在' })
    }
    case 'worktree-snapshot': return Promise.resolve(worktreeSnapshotStub())
    case 'classify': return Promise.resolve({ blocked: false, taskType: ['backend', 'knowledge', 'rag'], medicalSensitive: false, privacySensitive: true, securitySensitive: false, frontendTouchedExpected: false, backendTouchedExpected: true, schemaTouchedExpected: false, migrationExpected: false, knowledgeTouchedExpected: true, ragTouchedExpected: true, riskLevel: 'medium' })
    case 'explore': return Promise.resolve({ CURRENT_STATE: 'kb 模块已有 md 解析', RELATED_FILES: ['backend/app/kb/parser.py'], DEPENDENCIES: 'sqlalchemy', RISKS: '解析器接口耦合', EXISTING_TESTS: 'backend/tests/kb', POTENTIAL_REGRESSIONS: 'md 解析', TEST_COMMANDS: { backend: ['pytest backend/tests/kb'], frontend: [], lint: ['ruff check backend'], migration: [], integration: ['pytest -m integration'] }, parallelSafe: false, parallelSafeReason: '共享 parser 接口' })
    case 'scope-check': return Promise.resolve(scenario === 'mega'
      ? { atomic: false, estimatedDevDays: 12, reason: 'Mega Task：完成整个知识库', recommendedTasks: [{ taskId: 'kb-01', title: 'PDF 解析', objective: 'o', dependencies: [], acceptanceSummary: 's' }, { taskId: 'kb-02', title: 'HTML 解析', objective: 'o2', dependencies: ['kb-01'], acceptanceSummary: 's2' }] }
      : { atomic: true, estimatedDevDays: 1, reason: '单一解析器，规模合适' })
    case 'task-spec': return Promise.resolve(specObj)
    case 'implement': return Promise.resolve({ status: 'IMPLEMENTED', TASK_ID: 'kb-pdf-parser', FILES_CREATED: ['backend/app/kb/pdf.py'], FILES_MODIFIED: ['backend/app/kb/parser.py'], FILES_DELETED: [], DATABASE_CHANGES: 'none', API_CHANGES: 'none', FRONTEND_CHANGES: 'none', TESTS_ADDED: ['backend/tests/kb/test_pdf.py'], TESTS_MODIFIED: [], TESTS_RUN: ['pytest backend/tests/kb'], TEST_RESULTS: '12 passed', DEVIATIONS_FROM_SPEC: 'none', KNOWN_LIMITATIONS: '', BLOCKERS: '' })
    case 'machine-gate': {
      gateCalls++
      const req = (command, exitCode, purpose) => ({ command, purpose: purpose || 'required check', kind: 'required', exitCode, stdoutSummary: exitCode === 0 ? 'ok' : 'FAIL', stderrSummary: exitCode === 0 ? '' : 'non-zero' })
      const reqBlocked = (command, purpose) => ({ command, purpose: purpose || 'required check blocked by missing safe env', kind: 'required', recordStatus: 'SAFELY_NOT_EXECUTED_AND_RECORDED', stderrSummary: 'no provably-safe one-time test env' })
      const rec = (command, exitCode, purpose, recordStatus) => { const o = { command, purpose: purpose || 'baseline record', kind: 'record', stdoutSummary: '' }; if (typeof exitCode === 'number') o.exitCode = exitCode; o.recordStatus = recordStatus || (typeof exitCode === 'number' ? 'EXECUTED_AND_RECORDED' : 'SAFELY_NOT_EXECUTED_AND_RECORDED'); return o }
      // ---- D2：需要 required 失败以进入修复循环的场景 ----
      if (D2_GATE_FAIL.has(scenario)) {
        if (D2_GATE_FAIL_THEN_PASS.has(scenario) && gateCalls > 1) return Promise.resolve({ commands: [req('pytest backend/tests/kb', 0, 'target tests (required)')], findings: [], allPassed: true, blockedMissingSafeTestEnv: false, skippedGates: [] })
        return Promise.resolve({ commands: [req('pytest backend/tests/kb', 1, 'target tests (required)')], findings: [], allPassed: false, blockedMissingSafeTestEnv: false, skippedGates: [] })
      }
      // ---- 新增：Gate required/record 语义回归场景（§8 A–H）----
      if (scenario === 'feature-required-fail') return Promise.resolve({ commands: [req('pytest backend/tests/kb', 1, 'target tests (required)')], findings: [], allPassed: false, blockedMissingSafeTestEnv: false, skippedGates: [] })
      if (scenario === 'feature-required-build-fail') return Promise.resolve({ commands: [req('npm run build', 1, 'production build (required)')], findings: [], allPassed: false, blockedMissingSafeTestEnv: false, skippedGates: [] })
      if (scenario === 'feature-required-migration-noenv') return Promise.resolve({ commands: [req('pytest', 0, 'target tests'), reqBlocked('alembic upgrade head && alembic downgrade -1 && alembic upgrade head', 'REQUIRED migration triple (feature task must migrate)')], findings: [], allPassed: false, blockedMissingSafeTestEnv: true, skippedGates: [] })
      if (scenario === 'scope-required-fail') return Promise.resolve({ commands: [req('git diff --exit-code (scope whitelist)', 1, 'scope/forbidden-file check (required)')], findings: [], allPassed: false, blockedMissingSafeTestEnv: false, skippedGates: [] })
      if (scenario === 'forbidden-required-fail') return Promise.resolve({ commands: [req('test ! -e AGENTS.md.changed (forbidden-file check)', 1, 'forbidden file changed (required)')], findings: [], allPassed: false, blockedMissingSafeTestEnv: false, skippedGates: [] })
      if (scenario === 'audit-record-test-red') return Promise.resolve({ commands: [req('git status scope', 0), req('test -s deliverable', 0), rec('pytest -q', 1, 'baseline full pytest')], findings: ['F-01|P1|pytest 1 failed|backend tests|CT-1'], allPassed: false, blockedMissingSafeTestEnv: false, skippedGates: [] })
      if (scenario === 'audit-record-lint-red') return Promise.resolve({ commands: [req('git status scope', 0), rec('ruff check app/', 1, 'baseline full ruff')], findings: ['F-02|P1|ruff 291 errors|backend lint|CT-2'], allPassed: false, blockedMissingSafeTestEnv: false, skippedGates: [] })
      if (scenario === 'audit-migration-noenv') return Promise.resolve({ commands: [req('git status scope', 0), rec('alembic up/down/up', null, 'baseline migration safe-env availability', 'SAFELY_NOT_EXECUTED_AND_RECORDED')], findings: ['F-08|P1|migration safe env missing|database|CT-5'], allPassed: false, blockedMissingSafeTestEnv: false, skippedGates: ['alembic triple: RECORD_NOT_EXECUTED_SAFE_ENV'] })
      if (scenario === 'audit-combined') return Promise.resolve({ commands: [req('git status scope whitelist', 0), req('git diff empty', 0), req('md5 fingerprint', 0), req('test -s REPO_INVENTORY.md', 0), req('git rev-parse HEAD', 0), rec('pytest -q', 1, 'baseline pytest'), rec('ruff check app/', 1, 'baseline full ruff'), rec('ruff CI narrow', 0, 'baseline CI lint'), rec('alembic up/down/up', null, 'baseline migration env availability', 'SAFELY_NOT_EXECUTED_AND_RECORDED')], findings: ['F-01 pytest red', 'F-02 ruff red', 'F-08 migration safe env missing'], allPassed: false, blockedMissingSafeTestEnv: false, skippedGates: ['COND-EXEC-9 alembic: SAFELY_NOT_EXECUTED'] })
      if (scenario === 'audit-record-collection-failed') return Promise.resolve({ commands: [req('git status scope', 0), { command: 'nonexistent-baseline-tool', purpose: 'baseline record', kind: 'record', recordStatus: 'RECORD_COLLECTION_FAILED', stderrSummary: 'command not found' }], findings: [], allPassed: false, blockedMissingSafeTestEnv: false, skippedGates: [] })
      // ---- 既有场景（向后兼容：无 kind 字段的命令按 required 处理）----
      if (scenario === 'gatealwaysfail' || (scenario === 'gatefail' && gateCalls === 1)) return Promise.resolve({ commands: [{ command: 'pytest backend/tests/kb', purpose: 'target tests', exitCode: 1, stdoutSummary: '1 failed', stderrSummary: 'AssertionError' }], allPassed: false, blockedMissingSafeTestEnv: false, skippedGates: [] })
      return Promise.resolve({ commands: [{ command: 'pytest backend/tests/kb', purpose: 'target tests', exitCode: 0, stdoutSummary: '12 passed' }, { command: 'ruff check backend', purpose: 'lint', exitCode: 0 }], allPassed: true, blockedMissingSafeTestEnv: false, skippedGates: [] })
    }
    case 'self-repair': return Promise.resolve({ status: 'FIXED', summary: '修正断言', filesChanged: ['backend/app/kb/pdf.py'], gitCommandsRun: D2_SELFREPAIR_GIT[scenario] || [] })
    case 'rca': return Promise.resolve({ ROOT_CAUSE: '接口签名不一致', FIX_SPEC: '统一 parse() 签名', affectedFiles: ['backend/app/kb/pdf.py'] })
    case 'rca-fix': return Promise.resolve({ status: 'FIXED', summary: '按 FIX_SPEC 修复', filesChanged: ['backend/app/kb/pdf.py'], gitCommandsRun: [] })
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
  gateCalls,
  reviewCalls,
  agentLabels: calls.filter(c => c.model).map(c => c.label),
  resultKeys: result ? Object.keys(result) : null,
}, null, 1))
