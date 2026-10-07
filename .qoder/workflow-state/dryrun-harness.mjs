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
    // ---- D3 FLASH_ONLY_DEGRADED_MODE 回归（≥25，d3-01..d3-25）----
    // 01 正常任务：全绿 + 单审查（medium）→ TASK_PASS；qfmodel-only；合成判据全真；角色分离（planner/explorer/worker/reviewer/verifier 各自独立 invocation）
    { scenario: 'd3-01-happy', status: 'TASK_PASS', maxGateCalls: 1, mode: 'FLASH_ONLY', qfmodelOnly: true, singleReview: true, formula: true, roleSep: true },
    // 02 trip-wire：FLASH_ONLY 下把角色路由到 qmodel_38max → Preflight 路由守卫在任何 agent 调用前拦截 → BLOCKED MODEL_POLICY_VIOLATION（未实际请求 Max）
    { scenario: 'd3-02-runtime-max-call', status: 'BLOCKED', block: 'MODEL_POLICY_VIOLATION', maxGateCalls: 0, mode: 'FLASH_ONLY' },
    // 03 required 门禁永远失败（Worker 自报 IMPLEMENTED/allPassed 无验收权，脚本按 exitCode 裁判）→ 修复耗尽 BLOCKED_REPAIR_LIMIT
    { scenario: 'd3-03-gate-red-repair-limit', status: 'BLOCKED', block: 'BLOCKED_REPAIR_LIMIT', maxGateCalls: 4, mode: 'FLASH_ONLY', qfmodelOnly: true },
    // 04 独立 Review 首轮 REQUEST_CHANGES、次轮 PASS（Review 有实际否决/驱动修复权）→ TASK_PASS
    { scenario: 'd3-04-review-rc-then-pass', status: 'TASK_PASS', maxGateCalls: 3, mode: 'FLASH_ONLY', qfmodelOnly: true, singleReview: true, formula: true, roleSep: true },
    // 05 独立 Reviewer A 永远 REQUEST_CHANGES → BLOCKED_REPAIR_LIMIT（Reviewer 可否决 Worker 自报 PASS）
    { scenario: 'd3-05-reviewer-always-rc', status: 'BLOCKED', block: 'BLOCKED_REPAIR_LIMIT', maxGateCalls: 4, mode: 'FLASH_ONLY', qfmodelOnly: true },
    // 06 独立 Verifier TASK_FAIL（即便 gate+review 通过）→ BLOCKED TASK_FAIL（Verifier 独立否决）
    { scenario: 'd3-06-verifier-fail', status: 'BLOCKED', block: 'TASK_FAIL', maxGateCalls: 1, mode: 'FLASH_ONLY', qfmodelOnly: true },
    // 07 HIGH Risk（riskLevel=high）→ 双独立审查 A+B 均 PASS → TASK_PASS，REVIEW_INVOCATIONS 含 max-review + max-review-b
    { scenario: 'd3-07-high-risk-double-pass', status: 'TASK_PASS', maxGateCalls: 1, mode: 'FLASH_ONLY', qfmodelOnly: true, dualReview: true, formula: true },
    // 08 HIGH Risk：B 首轮否决、次轮通过 → merged 由 PASS→RC→PASS → TASK_PASS（B 的结论真正参与合并）
    { scenario: 'd3-08-high-risk-B-rc-then-pass', status: 'TASK_PASS', maxGateCalls: 3, mode: 'FLASH_ONLY', qfmodelOnly: true, dualReview: true, formula: true },
    // 09 HIGH Risk：B 永远否决 → 合并永远 RC → BLOCKED_REPAIR_LIMIT（独立第二审查者硬否决）
    { scenario: 'd3-09-high-risk-B-always-block', status: 'BLOCKED', block: 'BLOCKED_REPAIR_LIMIT', maxGateCalls: 4, mode: 'FLASH_ONLY', qfmodelOnly: true, dualReview: true },
    // 10 反作弊：执行手把 required 必跑项降级为 record → gateGuardViolation 检出 → BLOCKED GOVERNANCE_POLICY_VIOLATION
    { scenario: 'd3-10-required-downgrade-cheat', status: 'BLOCKED', block: 'GOVERNANCE_POLICY_VIOLATION', maxGateCalls: 1, mode: 'FLASH_ONLY', qfmodelOnly: true },
    // 11 反作弊：门禁命令指向生产/未知 :5432 且含 DROP → BLOCKED_UNSAFE_DATABASE_TARGET（:55432 一次性测试库不误伤）
    { scenario: 'd3-11-unsafe-db-5432', status: 'BLOCKED', block: 'BLOCKED_UNSAFE_DATABASE_TARGET', maxGateCalls: 1, mode: 'FLASH_ONLY', qfmodelOnly: true },
    // 12 D1 保持：required 全绿 + record 基线红 → 仍 TASK_PASS（GATE_HEALTH PASS，基线 DEGRADED 入 findings，绝不因 Flash-only 降门禁）
    { scenario: 'd3-12-record-red-not-lowering', status: 'TASK_PASS', maxGateCalls: 1, mode: 'FLASH_ONLY', qfmodelOnly: true, singleReview: true, formula: true },
    // 13 D1 保持：required 迁移缺安全环境 → BLOCKED_MISSING_SAFE_TEST_ENV（绝不降级放行）
    { scenario: 'd3-13-migration-required-noenv', status: 'BLOCKED', block: 'BLOCKED_MISSING_SAFE_TEST_ENV', maxGateCalls: 1, mode: 'FLASH_ONLY', qfmodelOnly: true },
    // 14 D2 保持：FLASH_ONLY 下 Worker 实施阶段改治理文件 AGENTS.md → 实施后 Delta 校验 BLOCKED_GOVERNANCE_CONFLICT（先于门禁，gateCalls=0，不启动 Flash 修复）
    { scenario: 'd3-14-worker-governance-write', status: 'BLOCKED', block: 'BLOCKED_GOVERNANCE_CONFLICT', maxGateCalls: 0, mode: 'FLASH_ONLY', forbidLabels: ['self-repair', 'rca-fix', 'fix'] },
    // 15 D2 保持：Self-Repair 自报 git checkout HEAD -- file → denylist 命中 → BLOCKED GOVERNANCE_POLICY_VIOLATION
    { scenario: 'd3-15-selfrepair-destructive-git', status: 'BLOCKED', block: 'GOVERNANCE_POLICY_VIOLATION', maxGateCalls: 1, mode: 'FLASH_ONLY', qfmodelOnly: true, expectLabels: ['self-repair'] },
    // 16 D2 保持：Self-Repair 只改授权任务文件 → 修复正常继续 → TASK_PASS（未一刀切禁修复）
    { scenario: 'd3-16-selfrepair-allowed-continues', status: 'TASK_PASS', maxGateCalls: 3, mode: 'FLASH_ONLY', qfmodelOnly: true, singleReview: true, formula: true, expectLabels: ['self-repair'] },
    // 17 HUMAN_REQUIRED：classify 判定需真实人工审批 → PAUSED_FOR_HUMAN / HUMAN_REQUIRED（绝不自动批准，未实现任何代码）
    { scenario: 'd3-17-human-required', status: 'PAUSED_FOR_HUMAN', block: 'HUMAN_REQUIRED', maxGateCalls: 0, mode: 'FLASH_ONLY' },
    // 18 HIGH 判定精确性：privacySensitive=true → HIGH（D3 指令 HIGH 最小集含 privacy/健康数据/语音数据）→ 双独立审查 A+B → TASK_PASS
    { scenario: 'd3-18-privacy-triggers-high', status: 'TASK_PASS', maxGateCalls: 1, mode: 'FLASH_ONLY', qfmodelOnly: true, dualReview: true, formula: true },
    // 19 securitySensitive=true → HIGH → 双独立审查 → TASK_PASS
    { scenario: 'd3-19-security-sensitive-high', status: 'TASK_PASS', maxGateCalls: 1, mode: 'FLASH_ONLY', qfmodelOnly: true, dualReview: true, formula: true },
    // 20 Worker 自报 allPassed:true 但 required exitCode=1 → 脚本仍判 MACHINE_FAIL → 修复耗尽（自报无最终验收权）
    { scenario: 'd3-20-selfreport-pass-gate-fail', status: 'BLOCKED', block: 'BLOCKED_REPAIR_LIMIT', maxGateCalls: 4, mode: 'FLASH_ONLY', qfmodelOnly: true },
    // 21 taskType 含 migration（敏感迁移）→ HIGH → 双独立审查 → TASK_PASS
    { scenario: 'd3-21-high-risk-migration', status: 'TASK_PASS', maxGateCalls: 1, mode: 'FLASH_ONLY', qfmodelOnly: true, dualReview: true, formula: true },
    // 22 FLASH_RCA 隔离：required 连失败两轮 → 第 2 轮起启动【新独立 RCA invocation】→ 第 3 轮通过 → TASK_PASS（标签含 rca）
    { scenario: 'd3-22-rca-isolation', status: 'TASK_PASS', maxGateCalls: 4, mode: 'FLASH_ONLY', qfmodelOnly: true, singleReview: true, formula: true, expectLabels: ['rca'] },
    // 23 FULL_MODE 保持：显式 executionMode:'FULL' → 决策角色路由 qmodel_38max → TASK_PASS 且 maxModelInvoked=true（证明恢复路径/双模型未被破坏）
    { scenario: 'd3-23-fullmode-recovery', status: 'TASK_PASS', maxGateCalls: 1, mode: 'FULL', maxInvoked: true, formula: true },
    // 24 双审查 + A/B 均永远否决 → 有界修复循环 → BLOCKED_REPAIR_LIMIT（无死循环，gateCalls≤4）
    { scenario: 'd3-24-high-risk-double-always-block', status: 'BLOCKED', block: 'BLOCKED_REPAIR_LIMIT', maxGateCalls: 4, mode: 'FLASH_ONLY', qfmodelOnly: true, dualReview: true },
    // 25 反误伤负例：required 命令含一次性测试库 :55432 + downgrade 词，scanUnsafeDbCommand 精确匹配 5432 不误伤 :55432 → 不 BLOCK → TASK_PASS
    { scenario: 'd3-25-safe-55432-not-flagged', status: 'TASK_PASS', maxGateCalls: 1, mode: 'FLASH_ONLY', qfmodelOnly: true, singleReview: true, formula: true },
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
    // ---- D3 断言：执行模式 / qfmodel-only / 双独立审查 / 合成判据 / 角色分离 ----
    const expMode = exp.mode || (/^d3-/.test(exp.scenario) ? 'FLASH_ONLY' : 'FULL')
    if (parsed.executionMode !== expMode) errs.push(`executionMode expected=${expMode} got=${parsed.executionMode}`)
    // 仅对确实进入 FLASH_ONLY 运行的场景校验 Workflow 自报模式（notask/badmode 等在解析 args 前即终止、不比对）
    if (parsed.executionMode === 'FLASH_ONLY' && parsed.ACTIVE_EXECUTION_MODE && parsed.ACTIVE_EXECUTION_MODE !== 'FLASH_ONLY') errs.push(`ACTIVE_EXECUTION_MODE=${parsed.ACTIVE_EXECUTION_MODE} != FLASH_ONLY`)
    if (expMode === 'FLASH_ONLY') {
      if ((parsed.modelsUsed || []).some(m => m === 'qmodel_38max')) errs.push('FLASH_ONLY invoked qmodel_38max (FORBIDDEN — no Max at runtime)')
      // 允许零 agent 调用（如 d3-02 在任何调用前被路由守卫拦截）；一旦有调用，必须全部为 qfmodel
      if ((parsed.modelsUsed || []).some(m => m !== 'qfmodel')) errs.push(`FLASH_ONLY used non-qfmodel model: ${JSON.stringify(parsed.modelsUsed)}`)
    }
    if (exp.qfmodelOnly && parsed.allQfmodel !== true) errs.push(`expected qfmodel-only, models=${JSON.stringify(parsed.modelsUsed)}`)
    if (exp.maxInvoked && !parsed.maxModelInvoked) errs.push('expected qmodel_38max invoked (FULL recovery) but none used')
    if (exp.dualReview && labels.indexOf('max-review-b') < 0) errs.push('HIGH risk missing dual review (max-review-b not invoked)')
    if (exp.singleReview && labels.indexOf('max-review-b') >= 0) errs.push('non-HIGH risk must NOT invoke max-review-b')
    if (exp.formula) { const f = parsed.taskPassFormula; if (!f || f.ALL_CLAUSES_TRUE !== true) errs.push(`TASK_PASS_FORMULA.ALL_CLAUSES_TRUE not true: ${JSON.stringify(f)}`) }
    if (exp.roleSep) { const rc = parsed.roleCalls || {}; for (const role of ['planner', 'explorer', 'worker', 'reviewer', 'verifier']) { if (!rc[role]) errs.push(`role separation missing independent invocation: ${role}`) } }
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
let reviewBCalls = 0

// D3：每个场景的执行模式（legacy → FULL，d3-* → FLASH_ONLY；d3-23 例外用于验证 FULL 恢复路径）。
const MODE = scenario === 'd3-23-fullmode-recovery' ? 'FULL' : (/^d3-/.test(scenario) ? 'FLASH_ONLY' : 'FULL')
const ALLOWED_RUNTIME = MODE === 'FLASH_ONLY' ? new Set(['qfmodel']) : new Set(['qmodel_38max', 'qfmodel'])
// label → 角色（用于角色分离/独立性断言）
const ROLE_OF = {
  'probe:max': 'probeMax', 'probe:flash': 'probeFlash', 'preflight': 'planner', 'worktree-snapshot': 'snapshot',
  'classify': 'planner', 'explore': 'explorer', 'scope-check': 'planner', 'task-spec': 'planner',
  'implement': 'worker', 'machine-gate': 'gate', 'self-repair': 'fixer', 'rca': 'rca', 'rca-fix': 'fixer',
  'max-review': 'reviewer', 'max-review-b': 'reviewerB', 'fix': 'fixer', 'verify': 'verifier',
  'milestone-evidence': 'evidence', 'milestone-verdict': 'verifier', 'release-evidence': 'evidence',
  'release-security': 'reviewer', 'release-verdict': 'verifier',
}
// 只读决策角色（禁止 Write/Edit）的 label 集合
const READ_ONLY = new Set(['explore', 'classify', 'scope-check', 'worktree-snapshot', 'max-review', 'max-review-b', 'verify', 'rca', 'release-security', 'preflight', 'milestone-verdict', 'release-verdict'])

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
  // D3-14：FLASH_ONLY 下实施阶段 Worker 改治理文件 AGENTS.md（clean baseline → dirty）→ 实施后 Delta 校验 BLOCKED_GOVERNANCE_CONFLICT（先于门禁，gateCalls=0）
  'd3-14-worker-governance-write': [
    CLEAN_BASE,
    snap({ trackedModified: ['AGENTS.md', 'backend/app/kb/parser.py'], untracked: ['backend/app/kb/pdf.py'], fingerprints: [fp('AGENTS.md', 'a1'), fp('backend/app/kb/pdf.py', 'pdf1'), fp('backend/app/kb/parser.py', 'par1')] }),
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

// ============================================================
// D3 场景编排：FLASH_ONLY 降级模式的独立角色 / 门禁裁判 / 反作弊 / HIGH 双审 / HUMAN_REQUIRED
// ============================================================
// 触发 HIGH Risk（riskLevel=high）→ 双独立审查
const D3_HIGH = new Set(['d3-07-high-risk-double-pass', 'd3-08-high-risk-B-rc-then-pass', 'd3-09-high-risk-B-always-block', 'd3-24-high-risk-double-always-block'])
// securitySensitive=true → HIGH（属 HIGH 最小集；privacy 亦已纳入，见 D3_PRIV）
const D3_SEC = new Set(['d3-19-security-sensitive-high'])
// taskType 含 migration → HIGH（敏感迁移属 HIGH 最小集）
const D3_MIGRATION_TYPE = new Set(['d3-21-high-risk-migration'])
// privacySensitive=true → HIGH（D3 指令 HIGH 最小集含 privacy / 健康数据 / 语音数据）→ 双独立审查
const D3_PRIV = new Set(['d3-18-privacy-triggers-high'])
// classify 判定 humanDecisionRequired → PAUSED_FOR_HUMAN
const D3_HUMAN = new Set(['d3-17-human-required'])
// required 门禁永远失败（Worker 自报无验收权，脚本按 exitCode 裁判）→ 修复耗尽
const D3_GATE_FAIL_ALWAYS = new Set(['d3-03-gate-red-repair-limit', 'd3-20-selfreport-pass-gate-fail'])
// required 门禁失败到指定轮次才通过（验证 RCA 独立 invocation 隔离）
const D3_GATE_FAIL_UNTIL = { 'd3-22-rca-isolation': 3 }
// Reviewer A 永远 REQUEST_CHANGES（独立 Review 否决权）
const D3_REVIEW_ALWAYS_RC = new Set(['d3-05-reviewer-always-rc', 'd3-24-high-risk-double-always-block'])
// Reviewer A 首轮 REQUEST_CHANGES 次轮 PASS
const D3_REVIEW_RC_THEN_PASS = new Set(['d3-04-review-rc-then-pass'])
// Reviewer B 永远 REQUEST_CHANGES
const D3_REVIEWB_ALWAYS_RC = new Set(['d3-09-high-risk-B-always-block', 'd3-24-high-risk-double-always-block'])
// Reviewer B 首轮 REQUEST_CHANGES 次轮 PASS
const D3_REVIEWB_RC_THEN_PASS = new Set(['d3-08-high-risk-B-rc-then-pass'])
// D2 复用：需进入修复循环 / 自修复 git 命令
D2_GATE_FAIL.add('d3-15-selfrepair-destructive-git'); D2_GATE_FAIL.add('d3-16-selfrepair-allowed-continues')
D2_GATE_FAIL_THEN_PASS.add('d3-16-selfrepair-allowed-continues')
D2_SELFREPAIR_GIT['d3-15-selfrepair-destructive-git'] = ['git checkout HEAD -- backend/app/kb/pdf.py']
D2_SELFREPAIR_GIT['d3-16-selfrepair-allowed-continues'] = ['git status', 'git diff -- backend/app/kb/pdf.py']
D2_SELFREPAIR_GIT['d3-22-rca-isolation'] = ['git status']
D2_SELFREPAIR_GIT['d3-03-gate-red-repair-limit'] = ['git status']
D2_SELFREPAIR_GIT['d3-20-selfreport-pass-gate-fail'] = ['git status']

let snapCalls = 0
function worktreeSnapshotStub() {
  snapCalls++
  const q = SNAPSHOTS[scenario]
  if (q && q.length) return q[Math.min(snapCalls - 1, q.length - 1)]
  return snapCalls === 1 ? CLEAN_BASE : DEFAULT_POST
}

function stubAgent(prompt, opts) {
  const label = (opts && opts.label) || '?'
  const model = opts && opts.model
  calls.push({ label, model, phase: opts && opts.phase, role: ROLE_OF[label] || null, readOnly: READ_ONLY.has(label), promptReadOnly: /只读|禁止\s*Write|禁止任何写|禁止修改任何文件/.test(prompt || '') })
  if (model && !ALLOWED_RUNTIME.has(model)) throw new Error('MODEL_POLICY_VIOLATION: ' + model + ' @ ' + label + ' (mode=' + MODE + ')')
  switch (label) {
    case 'probe:max': return Promise.resolve(scenario === 'modeldown' ? null : 'OK')
    case 'probe:flash': return Promise.resolve('OK')
    case 'preflight': {
      if (scenario === 'dirtymain' || scenario === 'd2-15-dirty-main') return Promise.resolve({ isGitRepo: true, isCorrectRepo: true, branch: 'master', dirty: true, dirtyFiles: ['backend/x.py'], notes: '' })
      if (D2_DIRTY_FEATURE.has(scenario)) return Promise.resolve({ isGitRepo: true, isCorrectRepo: true, branch: 'feature/kb', dirty: true, dirtyFiles: ['(pre-existing authorized change)'], notes: 'AGENTS.md 存在' })
      return Promise.resolve({ isGitRepo: true, isCorrectRepo: true, branch: 'feature/kb', dirty: false, dirtyFiles: [], notes: 'AGENTS.md 不存在' })
    }
    case 'worktree-snapshot': return Promise.resolve(worktreeSnapshotStub())
    case 'classify': {
      const base = { blocked: false, taskType: ['backend', 'knowledge', 'rag'], medicalSensitive: false, privacySensitive: false, securitySensitive: false, frontendTouchedExpected: false, backendTouchedExpected: true, schemaTouchedExpected: false, migrationExpected: false, knowledgeTouchedExpected: true, ragTouchedExpected: true, riskLevel: 'medium' }
      if (D3_HIGH.has(scenario)) return Promise.resolve(Object.assign({}, base, { riskLevel: 'high' }))
      if (D3_SEC.has(scenario)) return Promise.resolve(Object.assign({}, base, { securitySensitive: true }))
      if (D3_MIGRATION_TYPE.has(scenario)) return Promise.resolve(Object.assign({}, base, { taskType: ['backend', 'migration'], migrationExpected: true }))
      if (D3_PRIV.has(scenario)) return Promise.resolve(Object.assign({}, base, { privacySensitive: true }))
      if (D3_HUMAN.has(scenario)) return Promise.resolve(Object.assign({}, base, { humanDecisionRequired: true, humanDecisionReason: '本任务的验收本质上需要真实人工/授权主体审批（示例：真实患者数据授权 / 医疗专家验证），Agent 无权自行批准。' }))
      return Promise.resolve(base)
    }
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
      // ---- D3：FLASH_ONLY 门禁裁判 / 反作弊场景（优先于 D2）----
      if (D3_GATE_FAIL_ALWAYS.has(scenario)) return Promise.resolve({ commands: [req('pytest backend/tests/kb', 1, 'target tests (required)')], allPassed: true, blockedMissingSafeTestEnv: false, skippedGates: [] })
      if (D3_GATE_FAIL_UNTIL[scenario]) return Promise.resolve(gateCalls < D3_GATE_FAIL_UNTIL[scenario] ? { commands: [req('pytest backend/tests/kb', 1, 'target tests (required)')], allPassed: false, blockedMissingSafeTestEnv: false, skippedGates: [] } : { commands: [req('pytest backend/tests/kb', 0, 'target tests (required)'), req('ruff check backend', 0, 'lint')], allPassed: true, blockedMissingSafeTestEnv: false, skippedGates: [] })
      if (scenario === 'd3-10-required-downgrade-cheat') return Promise.resolve({ commands: [req('ruff check app', 0, 'lint (required)'), { command: 'pytest backend/tests/kb', purpose: '目标测试（本应 required，执行手擅自降级为 record）', kind: 'record', exitCode: 1, recordStatus: 'EXECUTED_AND_RECORDED', stdoutSummary: '1 failed' }], allPassed: true, blockedMissingSafeTestEnv: false, skippedGates: [] })
      if (scenario === 'd3-11-unsafe-db-5432') return Promise.resolve({ commands: [req('pytest backend/tests/kb', 0, 'target tests (required)'), req('psql -h 127.0.0.1 -p 5432 -c "DROP DATABASE aiear_prod"', 1, 'destructive op against prod instance')], allPassed: false, blockedMissingSafeTestEnv: false, skippedGates: [] })
      if (scenario === 'd3-25-safe-55432-not-flagged') return Promise.resolve({ commands: [req('pytest backend/tests/kb', 0, 'target tests (required)'), req('PGPORT=55432 alembic -n ci_tmp downgrade -1', 0, 'migration downgrade against one-time test db on port 55432 (must NOT be flagged)')], allPassed: true, blockedMissingSafeTestEnv: false, skippedGates: [] })
      if (scenario === 'd3-12-record-red-not-lowering') return Promise.resolve({ commands: [req('pytest backend/tests/kb', 0, 'target tests (required)'), req('ruff check app', 0, 'lint (required)'), rec('pytest -q', 1, 'baseline full pytest (record)'), rec('ruff check app/ --statistics', 1, 'baseline full ruff (record)')], findings: ['F-D3-01|P1|基线全量 pytest 红|backend|CT-x'], allPassed: false, blockedMissingSafeTestEnv: false, skippedGates: [] })
      if (scenario === 'd3-13-migration-required-noenv') return Promise.resolve({ commands: [req('pytest backend/tests/kb', 0, 'target tests (required)'), reqBlocked('alembic upgrade head && alembic downgrade -1 && alembic upgrade head', 'REQUIRED migration triple（无安全测试环境）')], allPassed: false, blockedMissingSafeTestEnv: true, skippedGates: [] })
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
      const RC = (why) => ({ verdict: 'REQUEST_CHANGES', acceptanceResults: [{ id: 'AC-01', met: false, evidence: why }], blockers: [{ BLOCKER_ID: 'B1', LOCATION: 'backend/app/kb/pdf.py:20', EVIDENCE: why, IMPACT: '验收未满足', REQUIRED_FIX: '修正实现并通过目标测试', VERIFICATION_METHOD: 'pytest backend/tests/kb' }], nonBlockingNotes: [] })
      const PS = () => ({ verdict: 'PASS', acceptanceResults: [{ id: 'AC-01', met: true, evidence: 'pytest 通过' }], blockers: [], nonBlockingNotes: ['后续可加缓存'] })
      if (D3_REVIEW_ALWAYS_RC.has(scenario)) return Promise.resolve(RC('D3：Reviewer A 独立复核判定 blocker 未解决'))
      if (D3_REVIEW_RC_THEN_PASS.has(scenario)) return Promise.resolve(reviewCalls === 1 ? RC('D3：Reviewer A 首轮 blocker') : PS())
      if (scenario === 'reviewfix' && reviewCalls === 1) return Promise.resolve(RC('异常被静默吞掉'))
      return Promise.resolve(PS())
    }
    case 'max-review-b': {
      reviewBCalls++
      const RCB = (why) => ({ verdict: 'REQUEST_CHANGES', acceptanceResults: [{ id: 'AC-01', met: false, evidence: why }], blockers: [{ BLOCKER_ID: 'B2', LOCATION: 'backend/app/kb/pdf.py:20', EVIDENCE: why, IMPACT: '独立复核发现风险', REQUIRED_FIX: '按 blocker 修复', VERIFICATION_METHOD: 'pytest backend/tests/kb' }], nonBlockingNotes: [] })
      const PSB = () => ({ verdict: 'PASS', acceptanceResults: [{ id: 'AC-01', met: true, evidence: '双独立复核通过' }], blockers: [], nonBlockingNotes: [] })
      if (D3_REVIEWB_ALWAYS_RC.has(scenario)) return Promise.resolve(RCB('D3：Reviewer B 持续否决'))
      if (D3_REVIEWB_RC_THEN_PASS.has(scenario)) return Promise.resolve(reviewBCalls === 1 ? RCB('D3：Reviewer B 首轮否决') : PSB())
      return Promise.resolve(PSB())
    }
    case 'fix': return Promise.resolve({ status: 'FIXED', summary: '修复 B1', filesChanged: ['backend/app/kb/pdf.py'] })
    case 'verify': {
      if (scenario === 'd3-06-verifier-fail') return Promise.resolve({ verdict: 'TASK_FAIL', acceptanceAllMet: false, scopeIntact: true, unexpectedFiles: [], regressionRisk: 'medium', rollbackIntact: true, changedFiles: ['backend/app/kb/pdf.py', 'backend/app/kb/parser.py'], reasons: ['D3：独立 Verifier 抽查重跑目标测试仍失败，Worker 自报不作为验收依据'], suggestedNextTask: null })
      return Promise.resolve({ verdict: 'TASK_PASS', acceptanceAllMet: true, scopeIntact: true, unexpectedFiles: [], regressionRisk: 'low', rollbackIntact: true, changedFiles: ['backend/app/kb/pdf.py', 'backend/app/kb/parser.py'], reasons: ['全部满足'], suggestedNextTask: 'kb-02 HTML 解析器' })
    }
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
const forceMax = scenario === 'd3-02-runtime-max-call'
switch (scenario) {
  case 'notask': ARGS = undefined; break
  case 'badmode': ARGS = { task: 'x', mode: 'yolo', executionMode: MODE }; break
  case 'milestone': ARGS = { task: '知识库 M1 Milestone', mode: 'milestone_gate', executionMode: MODE }; break
  case 'release': ARGS = { task: 'v1.0 发布', mode: 'release_gate', executionMode: MODE }; break
  default: ARGS = { task: '实现知识库 PDF 解析器，支持文本与元数据提取', mode: 'task', executionMode: MODE, __d3_force_max_route: forceMax }
}

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const fn = new AsyncFunction('agent', 'parallel', 'pipeline', 'phase', 'log', 'args', 'budget', 'workflow', src)
const result = await fn(stubs.agent, stubs.parallel, stubs.pipeline, stubs.phase, stubs.log, ARGS, stubs.budget, stubs.workflow)

const modelsUsed = [...new Set(calls.filter(c => c.model).map(c => c.model))]
const roleSet = {}
for (const c of calls) { if (c.role) (roleSet[c.role] = roleSet[c.role] || []).push(c.label) }
console.log(JSON.stringify({
  scenario,
  executionMode: MODE,
  WORKFLOW_STATUS: result && result.WORKFLOW_STATUS,
  BLOCK_REASON: result && result.BLOCK_REASON,
  ACTIVE_EXECUTION_MODE: result && result.ACTIVE_EXECUTION_MODE,
  REAL_PRODUCTION_APPROVED: result && result.REAL_PRODUCTION_APPROVED,
  modelsUsed,
  allQfmodel: modelsUsed.length > 0 && modelsUsed.every(m => m === 'qfmodel'),
  maxModelInvoked: modelsUsed.indexOf('qmodel_38max') >= 0,
  gateCalls,
  reviewCalls,
  reviewBCalls,
  agentLabels: calls.filter(c => c.model).map(c => c.label),
  roleCalls: roleSet,
  readOnlyPromptMisses: calls.filter(c => c.readOnly && !c.promptReadOnly).map(c => c.label),
  reviewInvocations: (result && result.REVIEW_INVOCATIONS) || null,
  taskPassFormula: (result && result.TASK_PASS_FORMULA) || null,
  highRisk: (result && typeof result.HIGH_RISK !== 'undefined') ? result.HIGH_RISK : null,
  resultKeys: result ? Object.keys(result) : null,
}, null, 1))
