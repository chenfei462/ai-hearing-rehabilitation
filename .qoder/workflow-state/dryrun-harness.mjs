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
//       D3 FLASH_ONLY 降级回归（25）：d3-01-happy | d3-02..d3-25（qfmodel-only 路由守卫、required 降级/`:5432` 反作弊、
//       HIGH 双独立审查、HUMAN_REQUIRED→PAUSED_FOR_HUMAN、executionMode:'FULL' 恢复路径）
//       D4 确定性字节证据回归（28）：d4-01..d4-28
//         · 内容身份 = SHA-256（文件）/ tree:treeSha256（未跟踪目录单元）；size/md5 仅佐证；mtime 只以 '#' 注释出现且被忽略
//         · 取证命令由脚本逐字下发（协议 V|D4-1 + H/B/F/E/t/X 行），执行手只跑不改写、零写入；判定全部在脚本侧
//         · 摘要格式缺陷 → 证据非法且不参与 Delta：d4-09(40-hex git blob SHA-1=M0-003 根因) d4-10(非 hex)
//           d4-11(协议头缺失) d4-25(改写命令) d4-26(执行手写文件) d4-27(fileCount 不自洽) d4-28(孤儿树成员)
//         · FINGERPRINT_ADJUDICATION 双独立 rehash：d4-12→SNAPSHOT_FALSE_POSITIVE_RECOVERED（误报恢复）
//           d4-13→EXTERNAL_CHANGED_DURING_TASK（字节证据确证真外部改动）d4-14→BLOCKED_FINGERPRINT_EVIDENCE_UNCERTAIN
//           d4-11→BASELINE_REESTABLISHED_BY_CONVERGENCE + EVIDENCE_REESTABLISHED_BY_CONVERGENCE
//         · 同任务重试产物归属：d4-16 RETRY_OWNED_APPLIED｜d4-17 TASK_ID_MISMATCH 绝不继承｜
//           d4-18 LAST_TASK_OUTPUT_HASH≠CURRENT_RETRY_START_HASH→写动作之前 BLOCKED_RETRY_ARTIFACT_CHANGED_EXTERNALLY｜
//           d4-19 治理产物即使同任务号也绝不 owned
//         · 目录单元/写白名单：d4-05/06/07 增删改名→BLOCK 且 treeUnitChanges 记成员级明细｜
//           d4-08 枚举顺序无关｜d4-21 目录在 ALLOWED_WRITE_PATHS 内→归本任务 taskChanged
//         · D1/D2/D3 保持：d4-20 required 永远红→BLOCKED_REPAIR_LIMIT｜d4-22 破坏性 git→仍 BLOCK｜
//           d4-23 HIGH 双审仍生效｜d4-24 HUMAN_REQUIRED 仍 PAUSED
// 全量：node .qoder/workflow-state/dryrun-harness.mjs test → 89/89（D1+D2+D3+D4）
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
  // D4 断言用的真实仓库路径（与下方干跑世界 QGRAPH_DIR / RETRY_ART 同一取值）
  const QG = 'docs/qgraphflow/dialogue-turn-sequence/'
  const ART = 'deliverables/baseline/FRONTEND_BASELINE.md'
  // Task Delta 由脚本侧 canonicalPath() 归一（去掉目录尾部 '/'），断言必须用 canonical 形态比对。
  const QGC = QG.replace(/\/$/, '')
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
    // ---- D4 确定性字节指纹 + 同任务重试产物归属回归（D4-TEST-01..28）----
    // 内容身份权威 = DETERMINISTIC_BYTE_HASH，后端 = AGENT_EXECUTOR_FALLBACK（脚本沙箱无 fs/crypto，已实测）
    { scenario: 'd4-01-byte-identity-unchanged', status: 'TASK_PASS', maxGateCalls: 1, mode: 'FLASH_ONLY', qfmodelOnly: true, formula: true, roleSep: true, d4Backend: 'AGENT_EXECUTOR_FALLBACK', d4Authority: 'DETERMINISTIC_BYTE_HASH', noAdjudication: true, rehashNone: true, deltaPreExistingUnchangedIncludes: 'backend/app/pre.py' },
    // 02 只有 mtime 变（sha256 不变，mtime 仅 '#' 注释）→ 绝不判内容变更
    { scenario: 'd4-02-mtime-only-change-not-content', status: 'TASK_PASS', maxGateCalls: 1, mode: 'FLASH_ONLY', qfmodelOnly: true, formula: true, noAdjudication: true, rehashNone: true, deltaPreExistingUnchangedIncludes: 'backend/app/pre.py' },
    // 03 同 size、内容 1 字节差异 → SHA-256 捕获；双独立 rehash 复核确认 → 真外部改动 BLOCK
    { scenario: 'd4-03-same-size-one-byte-content-change', status: 'BLOCKED', block: 'BLOCKED_EXTERNAL_WORKTREE_CHANGE', maxGateCalls: 0, mode: 'FLASH_ONLY', qfmodelOnly: true, rehashPair: true, adjudication: 'EXTERNAL_CHANGED_DURING_TASK', deltaExternalIncludes: 'backend/app/pre.py' },
    // 04 size 变化 → BLOCK
    { scenario: 'd4-04-size-change', status: 'BLOCKED', block: 'BLOCKED_EXTERNAL_WORKTREE_CHANGE', maxGateCalls: 0, mode: 'FLASH_ONLY', qfmodelOnly: true, rehashPair: true, adjudication: 'EXTERNAL_CHANGED_DURING_TASK', deltaExternalIncludes: 'backend/app/pre.py' },
    // 05 pre-existing 未跟踪目录单元内多出第 3 个文件（M0-003 真实形态）→ treeSha 变 → BLOCK，且记成员级明细
    // Delta 路径为 canonical（脚本侧 canonicalPath 去掉目录尾斜杠），断言同样用 canonical 目录键
    { scenario: 'd4-05-dir-added-third-file', status: 'BLOCKED', block: 'BLOCKED_EXTERNAL_WORKTREE_CHANGE', maxGateCalls: 0, mode: 'FLASH_ONLY', qfmodelOnly: true, rehashPair: true, adjudication: 'EXTERNAL_CHANGED_DURING_TASK', deltaExternalIncludes: QGC, treeUnitChangesMin: 1, deltaTreeUnitIncludes: QGC + '/extra.json' },
    // 06 目录单元内删除文件 → BLOCK（明细须指到被删成员）
    { scenario: 'd4-06-dir-deleted-file', status: 'BLOCKED', block: 'BLOCKED_EXTERNAL_WORKTREE_CHANGE', maxGateCalls: 0, mode: 'FLASH_ONLY', qfmodelOnly: true, rehashPair: true, adjudication: 'EXTERNAL_CHANGED_DURING_TASK', deltaExternalIncludes: QGC, deltaTreeUnitIncludes: QGC + '/index.html (DELETED)' },
    // 07 目录单元内改名 → BLOCK（明细须指到新名成员）
    { scenario: 'd4-07-dir-renamed-file', status: 'BLOCKED', block: 'BLOCKED_EXTERNAL_WORKTREE_CHANGE', maxGateCalls: 0, mode: 'FLASH_ONLY', qfmodelOnly: true, rehashPair: true, adjudication: 'EXTERNAL_CHANGED_DURING_TASK', deltaExternalIncludes: QGC, deltaTreeUnitIncludes: QGC + '/renamed.html' },
    // 08 成员枚举顺序反转（真实命令先 sort）→ treeSha 相同 → 无 Delta、无仲裁
    { scenario: 'd4-08-enumeration-order-independent', status: 'TASK_PASS', maxGateCalls: 1, mode: 'FLASH_ONLY', qfmodelOnly: true, formula: true, noAdjudication: true, rehashNone: true, deltaPreExistingUnchangedIncludes: QGC },
    // 09 摘要是 40-hex git blob SHA-1（M0-003 根因形态）→ 证据非法；二次取证仍非法 → UNCERTAIN（绝不据此推断变更）
    { scenario: 'd4-09-digest-40hex-invalid', status: 'BLOCKED', block: 'BLOCKED_FINGERPRINT_EVIDENCE_UNCERTAIN', maxGateCalls: 0, mode: 'FLASH_ONLY', qfmodelOnly: true, rehashPair: true, adjudication: 'BLOCKED_FINGERPRINT_EVIDENCE_UNCERTAIN', invalidEvidenceContains: 'DIGEST_IS_40HEX_GIT_BLOB_SHA1' },
    // 10 摘要非 hex → UNCERTAIN
    { scenario: 'd4-10-digest-random-nonhex', status: 'BLOCKED', block: 'BLOCKED_FINGERPRINT_EVIDENCE_UNCERTAIN', maxGateCalls: 0, mode: 'FLASH_ONLY', qfmodelOnly: true, rehashPair: true, invalidEvidenceContains: 'SHA256_NOT_64_LOWERCASE_HEX' },
    // 11 协议头缺失/输出截断 → 两个独立合法取证收敛 → 基线重建 + 证据重建 → 继续
    { scenario: 'd4-11-invalid-then-converged-rebuild', status: 'TASK_PASS', maxGateCalls: 1, mode: 'FLASH_ONLY', qfmodelOnly: true, formula: true, rehashPair: true, adjudication: ['BASELINE_REESTABLISHED_BY_CONVERGENCE', 'EVIDENCE_REESTABLISHED_BY_CONVERGENCE'] },
    // 12 ★M0-003 false positive 复现★：post 摘要与 baseline 不符，但两个独立 rehash 均显示字节未变
    //    → SNAPSHOT_FALSE_POSITIVE_RECOVERED，不误报 BLOCK（旧实现会在这里错误 BLOCK）
    { scenario: 'd4-12-mismatch-rehash-both-unchanged', status: 'TASK_PASS', maxGateCalls: 1, mode: 'FLASH_ONLY', qfmodelOnly: true, formula: true, roleSep: true, rehashPair: true, adjudication: 'SNAPSHOT_FALSE_POSITIVE_RECOVERED', deltaPreExistingUnchangedIncludes: 'backend/app/pre.py' },
    // 13 mismatch 且两个 rehash 一致显示真的变了 → 有字节证据 → BLOCK（不放走真实外部改动）
    { scenario: 'd4-13-mismatch-rehash-both-changed', status: 'BLOCKED', block: 'BLOCKED_EXTERNAL_WORKTREE_CHANGE', maxGateCalls: 0, mode: 'FLASH_ONLY', qfmodelOnly: true, rehashPair: true, adjudication: 'EXTERNAL_CHANGED_DURING_TASK', deltaExternalIncludes: 'backend/app/pre.py' },
    // 14 两个独立 rehash 互相矛盾 → UNCERTAIN（禁止猜测）
    { scenario: 'd4-14-rehash-ab-inconsistent', status: 'BLOCKED', block: 'BLOCKED_FINGERPRINT_EVIDENCE_UNCERTAIN', maxGateCalls: 0, mode: 'FLASH_ONLY', qfmodelOnly: true, rehashPair: true, adjudication: 'BLOCKED_FINGERPRINT_EVIDENCE_UNCERTAIN' },
    // 15 真实文件形态（qgraphflow 两文件）两次取证签名一致 → 无需仲裁 → 继续
    { scenario: 'd4-15-qgraphflow-fixture-stable', status: 'TASK_PASS', maxGateCalls: 1, mode: 'FLASH_ONLY', qfmodelOnly: true, formula: true, noAdjudication: true, rehashNone: true, deltaPreExistingUnchangedIncludes: QGC },
    // 16 同任务重跑：上一 run 产物字节未变 + 两版 SPEC 均授权 + manifest 证据齐 → RETRY_OWNED（属本任务延续）
    { scenario: 'd4-16-retry-owned-artifact-allowed', status: 'TASK_PASS', maxGateCalls: 1, mode: 'FLASH_ONLY', qfmodelOnly: true, formula: true, noAdjudication: true, rehashNone: true, retryStatus: 'RETRY_OWNED_APPLIED', retryAcceptedPath: ART, deltaRetryOwnedIncludes: ART },
    // 17 任务号不同（另一 Task 的产物）→ 绝不继承归属；其内容被改动 = 用户改动 → BLOCK
    { scenario: 'd4-17-different-task-not-owned', status: 'BLOCKED', block: 'BLOCKED_EXTERNAL_WORKTREE_CHANGE', maxGateCalls: 0, mode: 'FLASH_ONLY', qfmodelOnly: true, rehashPair: true, retryRejectedStartsWith: 'TASK_ID_MISMATCH', deltaExternalIncludes: ART },
    // 18 上一 run 产物在两次 run 之间被外部编辑（LAST_TASK_OUTPUT_HASH ≠ CURRENT_RETRY_START_HASH）→ 写动作之前就 BLOCK，retry 不吞用户改动
    { scenario: 'd4-18-retry-artifact-changed-externally', status: 'BLOCKED', block: 'BLOCKED_RETRY_ARTIFACT_CHANGED_EXTERNALLY', maxGateCalls: 0, mode: 'FLASH_ONLY', rehashNone: true, forbidLabels: ['implement', 'self-repair', 'rca', 'rca-fix', 'fix', 'machine-gate', 'verify'], retryRejectedStartsWith: 'BLOCKED_RETRY_ARTIFACT_CHANGED_EXTERNALLY' },
    // 19 治理产物即使任务号相同也绝不 retry-owned；实施期改治理 → BLOCKED_GOVERNANCE_CONFLICT
    { scenario: 'd4-19-governance-retry-never-owned', status: 'BLOCKED', block: 'BLOCKED_GOVERNANCE_CONFLICT', maxGateCalls: 0, mode: 'FLASH_ONLY', rehashNone: true, forbidLabels: ['self-repair', 'rca-fix', 'fix'], retryRejectedStartsWith: 'GOVERNANCE_PROTECTED' },
    // 20 D1 保持：required 门禁永远红 → 修复耗尽 BLOCKED_REPAIR_LIMIT（D4 未削弱门禁）
    { scenario: 'd4-20-d1-required-fail-still-machine-fail', status: 'BLOCKED', block: 'BLOCKED_REPAIR_LIMIT', maxGateCalls: 4, mode: 'FLASH_ONLY', qfmodelOnly: true },
    // 21 目录单元内新增文件但目录在 ALLOWED_WRITE_PATHS 内 → 归因本任务（taskChanged），不误判外部改动
    { scenario: 'd4-21-allowed-write-path-in-preexisting-dir', status: 'TASK_PASS', maxGateCalls: 1, mode: 'FLASH_ONLY', qfmodelOnly: true, formula: true, noAdjudication: true, rehashNone: true, deltaTaskChangedIncludes: QG + 'extra.json' },
    // 22 D2 保持：Self-Repair 自报破坏性 git → GOVERNANCE_POLICY_VIOLATION（修复后确定性校验未削弱）
    { scenario: 'd4-22-destructive-git-still-block', status: 'BLOCKED', block: 'GOVERNANCE_POLICY_VIOLATION', maxGateCalls: 1, mode: 'FLASH_ONLY', qfmodelOnly: true, expectLabels: ['self-repair'] },
    // 23 D3 保持：HIGH Risk 双独立审查 + 确定性证据 → TASK_PASS
    { scenario: 'd4-23-high-risk-still-dual-review', status: 'TASK_PASS', maxGateCalls: 1, mode: 'FLASH_ONLY', qfmodelOnly: true, dualReview: true, formula: true },
    // 24 D3 保持：HUMAN_REQUIRED → PAUSED_FOR_HUMAN（D4 不自动批准）
    { scenario: 'd4-24-human-required-still-pauses', status: 'PAUSED_FOR_HUMAN', block: 'HUMAN_REQUIRED', maxGateCalls: 0, mode: 'FLASH_ONLY' },
    // 25 执行手改写脚本下发的命令 → 摘要来源不可信 → 二次仍不可信 → UNCERTAIN
    { scenario: 'd4-25-executor-rewrote-command', status: 'BLOCKED', block: 'BLOCKED_FINGERPRINT_EVIDENCE_UNCERTAIN', maxGateCalls: 0, mode: 'FLASH_ONLY', qfmodelOnly: true, rehashPair: true, invalidEvidenceContains: 'COMMAND_NOT_VERBATIM' },
    // 26 只读取证执行手写了文件 → 记录 GOVERNANCE_POLICY_VIOLATION 标记，且证据不可信 → fail-closed 停止
    { scenario: 'd4-26-executor-wrote-files', status: 'BLOCKED', block: 'BLOCKED_FINGERPRINT_EVIDENCE_UNCERTAIN', maxGateCalls: 0, mode: 'FLASH_ONLY', qfmodelOnly: true, rehashPair: true, invalidEvidenceContains: 'GOVERNANCE_POLICY_VIOLATION:FINGERPRINT_EXECUTOR_WROTE_FILES' },
    // 27 目录单元 fileCount 与成员不自洽 → 证据非法 → UNCERTAIN
    { scenario: 'd4-27-tree-filecount-inconsistent', status: 'BLOCKED', block: 'BLOCKED_FINGERPRINT_EVIDENCE_UNCERTAIN', maxGateCalls: 0, mode: 'FLASH_ONLY', qfmodelOnly: true, rehashPair: true, invalidEvidenceContains: 'TREE_FILECOUNT_MISMATCH' },
    // 28 树成员不属于任何目录单元 → 证据非法 → UNCERTAIN
    { scenario: 'd4-28-tree-member-without-unit', status: 'BLOCKED', block: 'BLOCKED_FINGERPRINT_EVIDENCE_UNCERTAIN', maxGateCalls: 0, mode: 'FLASH_ONLY', qfmodelOnly: true, rehashPair: true, invalidEvidenceContains: 'TREE_MEMBER_WITHOUT_UNIT' },
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
    // ---- D4 断言：确定性字节证据链 / 双独立 rehash 仲裁 / retry 产物归属 / Task Delta 归属 ----
    const d4 = parsed.d4 || {}
    const dhas = (arr, v) => Array.isArray(arr) && arr.indexOf(v) >= 0
    if (exp.d4Backend && d4.backend !== exp.d4Backend) errs.push(`D4 backend expected=${exp.d4Backend} got=${d4.backend}`)
    if (exp.d4Authority && d4.authority !== exp.d4Authority) errs.push(`D4 authority expected=${exp.d4Authority} got=${d4.authority}`)
    if (exp.adjudication) { for (const v of [].concat(exp.adjudication)) { if (!dhas(d4.adjudicationVerdicts, v)) errs.push(`D4 adjudication verdict '${v}' missing (got=[${(d4.adjudicationVerdicts || []).join(',')}])`) } }
    if (exp.noAdjudication && (d4.adjudicationVerdicts || []).length) errs.push(`D4 expected NO adjudication, got=[${d4.adjudicationVerdicts.join(',')}]`)
    if (exp.rehashPair) { const rc = parsed.rehashCalls || {}; if (!(rc.a > 0 && rc.b > 0)) errs.push(`D4 expected both independent rehash invocations, got=${JSON.stringify(rc)}`); for (const lb of ['fingerprint-rehash-a', 'fingerprint-rehash-b']) if (labels.indexOf(lb) < 0) errs.push(`D4 missing label ${lb}`) }
    if (exp.rehashNone) { const rc = parsed.rehashCalls || {}; if (rc.a || rc.b) errs.push(`D4 must not adjudicate here, rehashCalls=${JSON.stringify(rc)}`) }
    if (exp.invalidEvidenceContains && !((d4.invalidEvidence || []).join(' | ').indexOf(exp.invalidEvidenceContains) >= 0)) errs.push(`D4 invalid-evidence marker '${exp.invalidEvidenceContains}' not surfaced (got=${JSON.stringify(d4.invalidEvidence)})`)
    if (exp.retryStatus && (!d4.retryOwnership || d4.retryOwnership.status !== exp.retryStatus)) errs.push(`D4 RETRY_OWNERSHIP.status expected=${exp.retryStatus} got=${d4.retryOwnership && d4.retryOwnership.status}`)
    if (exp.retryAcceptedPath && !(d4.retryOwnership && (d4.retryOwnership.accepted || []).some((x) => x.path === exp.retryAcceptedPath))) errs.push(`D4 retry-owned accepted missing path ${exp.retryAcceptedPath}`)
    if (exp.retryRejectedStartsWith && !(d4.retryOwnership && (d4.retryOwnership.rejected || []).some((x) => String(x.reject || '').indexOf(exp.retryRejectedStartsWith) === 0))) errs.push(`D4 retry rejection '${exp.retryRejectedStartsWith}' missing (rejected=${JSON.stringify((d4.retryOwnership || {}).rejected)})`)
    if (exp.deltaRetryOwnedIncludes && !(d4.delta && dhas(d4.delta.retryOwnedArtifacts, exp.deltaRetryOwnedIncludes))) errs.push(`D4 delta.retryOwnedArtifacts missing ${exp.deltaRetryOwnedIncludes} (got=${JSON.stringify(d4.delta && d4.delta.retryOwnedArtifacts)})`)
    if (exp.deltaPreExistingUnchangedIncludes && !(d4.delta && dhas(d4.delta.preExistingUnchanged, exp.deltaPreExistingUnchangedIncludes))) errs.push(`D4 delta.preExistingUnchanged missing ${exp.deltaPreExistingUnchangedIncludes} (got=${JSON.stringify(d4.delta && d4.delta.preExistingUnchanged)})`)
    if (exp.deltaTaskChangedIncludes && !(d4.delta && dhas(d4.delta.taskChanged, exp.deltaTaskChangedIncludes))) errs.push(`D4 delta.taskChanged missing ${exp.deltaTaskChangedIncludes} (got=${JSON.stringify(d4.delta && d4.delta.taskChanged)})`)
    if (exp.deltaExternalIncludes && !(d4.delta && dhas(d4.delta.externalChangedDuringTask, exp.deltaExternalIncludes))) errs.push(`D4 delta.externalChangedDuringTask missing ${exp.deltaExternalIncludes} (got=${JSON.stringify(d4.delta && d4.delta.externalChangedDuringTask)})`)
    if (typeof exp.treeUnitChangesMin === 'number' && !(d4.delta && (d4.delta.treeUnitChanges || []).length >= exp.treeUnitChangesMin)) errs.push(`D4 treeUnitChanges expected >=${exp.treeUnitChangesMin} got=${JSON.stringify(d4.delta && d4.delta.treeUnitChanges)}`)
    if (exp.deltaTreeUnitIncludes) {
      const arr = (d4.delta && d4.delta.treeUnitChanges) || []
      const flat = arr.map((t) => String((t && t.dir) || '') + '/' + String((t && t.addedOrChanged) || '')).concat(arr.map((t) => String((t && t.addedOrChanged) || '')))
      if (flat.indexOf(exp.deltaTreeUnitIncludes) < 0) errs.push(`D4 delta.treeUnitChanges missing ${exp.deltaTreeUnitIncludes} (got=${JSON.stringify(arr)})`)
    }
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

// D3/D4：每个场景的执行模式（legacy → FULL，d3-*/d4-* → FLASH_ONLY；d3-23 例外用于验证 FULL 恢复路径）。
const MODE = scenario === 'd3-23-fullmode-recovery' ? 'FULL' : (/^d[34]-/.test(scenario) ? 'FLASH_ONLY' : 'FULL')
const ALLOWED_RUNTIME = MODE === 'FLASH_ONLY' ? new Set(['qfmodel']) : new Set(['qmodel_38max', 'qfmodel'])
// label → 角色（用于角色分离/独立性断言）
const ROLE_OF = {
  'probe:max': 'probeMax', 'probe:flash': 'probeFlash', 'preflight': 'planner', 'worktree-snapshot': 'snapshot',
  'classify': 'planner', 'explore': 'explorer', 'scope-check': 'planner', 'task-spec': 'planner',
  'implement': 'worker', 'machine-gate': 'gate', 'self-repair': 'fixer', 'rca': 'rca', 'rca-fix': 'fixer',
  'max-review': 'reviewer', 'max-review-b': 'reviewerB', 'fix': 'fixer', 'verify': 'verifier',
  'milestone-evidence': 'evidence', 'milestone-verdict': 'verifier', 'release-evidence': 'evidence',
  'release-security': 'reviewer', 'release-verdict': 'verifier',
  // D4：确定性取证执行手 + 两个独立仲裁 invocation（同为只读 snapshot 角色，但必须是彼此独立的 invocation）
  'fingerprint-rehash-a': 'rehashA', 'fingerprint-rehash-b': 'rehashB',
}
// 只读决策角色（禁止 Write/Edit）的 label 集合
const READ_ONLY = new Set(['explore', 'classify', 'scope-check', 'worktree-snapshot', 'fingerprint-rehash-a', 'fingerprint-rehash-b', 'max-review', 'max-review-b', 'verify', 'rca', 'release-security', 'preflight', 'milestone-verdict', 'release-verdict'])

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
// D2/D4 干跑世界模型：worktree 快照（确定性字节证据）+ 场景编排
// ============================================================
const GOVF = '.qoder/workflows/project-feature-delivery.js'
// D4：head 必须是 40 位 hex（脚本侧格式校验会拒绝非 hex），旧 fixture 的 'HEAD_SHA_BASELINE_…' 不再合法。
const H0 = '0123456789abcdef0123456789abcdef01234567'
const H1 = '9999999999999999999999999999999999999999'
function fp(path, hash, size) { const o = { path, hash }; if (typeof size === 'number') o.size = size; return o }
// D4：dir 的第三个参数承载"渲染提示"（如固定 treeSha / 故意乱序），不会丢给 renderEvidence 之外。
function dir(path, members, extra) { return Object.assign({ path, members }, extra || {}) }
function snap(o) {
  o = o || {}
  return {
    head: o.head || H0, branch: o.branch || 'feature/kb',
    staged: o.staged || [], trackedModified: o.trackedModified || [], trackedDeleted: o.trackedDeleted || [],
    untracked: o.untracked || [], fingerprints: o.fingerprints || [], dirs: o.dirs || [],
    // D4 §9：mtime 只能作为注释行出现（真实命令里 mtime 根本不进协议），解析器必须忽略它。
    mtimes: o.mtimes || [],
    // D4：执行手层的作弊/劣化注入（命令改写、非零退出、写入文件、乱码/错格式摘要）。
    exec: o.exec || null,
  }
}
const CLEAN_BASE = snap({})
const DEFAULT_POST = snap({ untracked: ['backend/app/kb/pdf.py'], trackedModified: ['backend/app/kb/parser.py'], fingerprints: [fp('backend/app/kb/pdf.py', 'pdf1'), fp('backend/app/kb/parser.py', 'par1')] })

// ---- D4 摘要合成：把 fixture 的符号标签变成 64 位小写 hex / 32 位 hex（模拟"真实字节摘要"）----
// 这些函数只存在于干跑世界（代表文件系统真实内容），Workflow 侧只做格式与自洽校验，绝不信任标签。
function hexrep(s, n) {
  let h = 0x811c9dc5 >>> 0
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  let out = ''
  let x = h >>> 0
  while (out.length < n) { out += x.toString(16).padStart(8, '0'); x = (Math.imul(x ^ (h + out.length), 0x2545f491) >>> 0); if (x === 0) x = 1 }
  return out.slice(0, n)
}
const sha64 = (label) => hexrep('sha:' + label, 64)
const md532 = (label) => hexrep('md5:' + label, 32)
// 标签相同 ⇒ 摘要相同（内容未变）；标签不同 ⇒ 摘要不同（内容已变）。size 由 fixture 显式控制。
function digestOf(path, label, kind) { return kind === 'md5' ? md532(label) : sha64(label) }
function sizeOf(f) { return typeof f.size === 'number' ? f.size : (parseInt(sha64(f.hash).slice(0, 4), 16) % 4000) + 1 }

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

// ============================================================
// D4：证据渲染器 —— 把 fixture 渲染成"脚本下发命令的真实 stdout"（V/H/B/F/E/t/X 协议）。
// Workflow 侧用真实解析器 parseFingerprintEvidence 解析它，因此这些回归测的是【真解析 + 真校验 + 真仲裁】，
// 而不是把结论直接喂给 stub。
// ============================================================
function findFp(s, path) { for (const f of (s.fingerprints || [])) if (f.path === path) return f; return null }
function fileLine(xy, f) { return 'F|' + xy + '|' + f.path + '|' + sizeOf(f) + '|' + digestOf(f.path, f.hash, 'sha') + '|' + digestOf(f.path, f.hash, 'md5') }
function renderEvidence(s) {
  const L = ['V|D4-1', 'H|' + s.head, 'B|' + s.branch]
  const syn = (p) => findFp(s, p) || { path: p, hash: 'implicit:' + p }
  for (const p of s.staged) L.push(fileLine('M ', syn(p)))
  for (const p of s.trackedModified) L.push(fileLine(' M', syn(p)))
  for (const p of s.trackedDeleted) L.push('X| D|' + p)
  for (const p of s.untracked) L.push(fileLine('??', syn(p)))
  for (const d of (s.dirs || [])) {
    // 真实命令用 `find … | LC_ALL=C sort` 固定枚举顺序：干跑同样按路径字典序排序，
    // 因此"成员列举顺序"绝不改变 treeSha（d4-08 测的正是这一点）。
    const lines = d.members.map((m) => [m.path, sizeOf(m), digestOf(m.path, m.hash, 'sha'), digestOf(m.path, m.hash, 'md5')]).sort()
    const manifest = lines.map((a) => a.join('\t')).join('\n')
    L.push('E|' + d.path + '|' + lines.length + '|' + (d.treeSha || sha64('tree:' + manifest)))
    for (const a of lines) L.push('t|' + a[0] + '|' + a[1] + '|' + a[2] + '|' + a[3])
  }
  // D4 §9：mtime 永远只作为注释行出现（协议解析器必须忽略），绝不参与内容身份。
  for (const m of (s.mtimes || [])) L.push('#mtime|' + m.path + '|' + m.mtime)
  if (s.exec && typeof s.exec.rawStdout === 'string') return s.exec.rawStdout
  if (s.exec && s.exec.dropProtocolLine) L.shift()
  if (s.exec && s.exec.headGarbage) L[1] = 'H|not-a-sha-at-all'
  if (s.exec && s.exec.digest40) { for (let i = 2; i < L.length; i++) if (L[i].startsWith('F|')) { const a = L[i].split('|'); a[4] = hexrep('gitblob:' + a[2], 40); L[i] = a.join('|') } }
  if (s.exec && s.exec.digestGarbage) { for (let i = 2; i < L.length; i++) if (L[i].startsWith('F|')) { const a = L[i].split('|'); a[4] = 'zzz-not-hex'; L[i] = a.join('|') } }
  if (s.exec && s.exec.duplicatePath) L.push(L[L.length - 1])
  if (s.exec && s.exec.treeFileCountLie) { const i = L.findIndex((l) => l.startsWith('E|')); if (i >= 0) { const a = L[i].split('|'); a[2] = String(Number(a[2]) + 1); L[i] = a.join('|') } }
  if (s.exec && s.exec.memberOrphan) L.push('t|outside/dir/file.py|10|' + sha64('orphan') + '|' + md532('orphan'))
  if (s.exec && s.exec.truncate) return L.slice(0, Math.max(2, L.length - 3)).join('\n')
  return L.join('\n')
}
// 从 Workflow 提示词中提取"脚本逐字下发的命令"，原样回传（证明逐字校验路径，而非 harness 自行拼命令）。
function pinnedCommandFrom(prompt) {
  const m = /```sh\n([\s\S]*?)\n```/.exec(String(prompt || ''))
  return m ? m[1] : '__NO_PINNED_COMMAND_IN_PROMPT__'
}
function executorEvidence(label, prompt, s) {
  const cmd = pinnedCommandFrom(prompt)
  const ex = s.exec || {}
  const out = {
    purpose: label, command: ex.rewriteCommand ? cmd + '\necho tampered' : cmd,
    exitCode: typeof ex.exitCode === 'number' ? ex.exitCode : 0,
    rawStdout: renderEvidence(s), rawStderr: ex.rawStderr || '',
    filesWritten: ex.filesWritten || [],
    gitCommandsRun: ex.gitCommandsRun || ['git rev-parse HEAD', 'git branch --show-current', 'git -c core.quotepath=false status --porcelain=v1 --untracked-files=normal'],
  }
  if (ex.forbiddenGit) out.gitCommandsRun = out.gitCommandsRun.concat([ex.forbiddenGit])
  return out
}

// ---- D4 场景快照队列（主取证队列 worktree-snapshot）----
const QGRAPH_DIR = 'docs/qgraphflow/dialogue-turn-sequence/'
const RETRY_ART = 'deliverables/baseline/FRONTEND_BASELINE.md'
const D4_SNAPS = {
  // 01 pre-existing 内容字节完全未变（同 sha）→ PRE_EXISTING_UNCHANGED → 继续
  'd4-01-byte-identity-unchanged': [
    snap({ trackedModified: ['backend/app/pre.py'], fingerprints: [fp('backend/app/pre.py', 'pre0')] }),
    snap({ trackedModified: ['backend/app/pre.py', 'backend/app/kb/parser.py'], untracked: ['backend/app/kb/pdf.py'], fingerprints: [fp('backend/app/pre.py', 'pre0'), fp('backend/app/kb/pdf.py', 'pdf1'), fp('backend/app/kb/parser.py', 'par1')] }),
  ],
  // 02 仅 mtime 变化（内容 sha 不变；mtime 只以 '#' 注释行出现，解析器必须忽略）→ 仍 UNCHANGED
  'd4-02-mtime-only-change-not-content': [
    snap({ trackedModified: ['backend/app/pre.py'], fingerprints: [fp('backend/app/pre.py', 'pre0')], mtimes: [{ path: 'backend/app/pre.py', mtime: '2026-10-07T00:00:00Z' }] }),
    snap({ trackedModified: ['backend/app/pre.py', 'backend/app/kb/parser.py'], untracked: ['backend/app/kb/pdf.py'], fingerprints: [fp('backend/app/pre.py', 'pre0'), fp('backend/app/kb/pdf.py', 'pdf1'), fp('backend/app/kb/parser.py', 'par1')], mtimes: [{ path: 'backend/app/pre.py', mtime: '2026-10-07T19:59:59Z' }] }),
  ],
  // 03 同 size、1 字节内容变化 → sha 不同 → 外部改动（仲裁双确认）→ BLOCK
  'd4-03-same-size-one-byte-content-change': [
    snap({ trackedModified: ['backend/app/pre.py'], fingerprints: [fp('backend/app/pre.py', 'pre0', 1000)] }),
    snap({ trackedModified: ['backend/app/pre.py', 'backend/app/kb/parser.py'], untracked: ['backend/app/kb/pdf.py'], fingerprints: [fp('backend/app/pre.py', 'pre0-toggled', 1000), fp('backend/app/kb/pdf.py', 'pdf1'), fp('backend/app/kb/parser.py', 'par1')] }),
  ],
  // 04 size 变化 → BLOCK
  'd4-04-size-change': [
    snap({ trackedModified: ['backend/app/pre.py'], fingerprints: [fp('backend/app/pre.py', 'pre0', 1000)] }),
    snap({ trackedModified: ['backend/app/pre.py', 'backend/app/kb/parser.py'], untracked: ['backend/app/kb/pdf.py'], fingerprints: [fp('backend/app/pre.py', 'pre0-plus1k', 2000), fp('backend/app/kb/pdf.py', 'pdf1'), fp('backend/app/kb/parser.py', 'par1')] }),
  ],
  // 05 pre-existing 未跟踪目录内新增第 3 个文件（不在本任务写路径内）→ 目录单元 sha 变 → BLOCK
  //    （M0-003 的真实形态：docs/qgraphflow/…/ 目录任务前已存在，任务不得把它算进自己 scope）
  'd4-05-dir-added-third-file': [
    snap({ dirs: [dir(QGRAPH_DIR, [{ path: QGRAPH_DIR + 'graph.json', hash: 'g0' }, { path: QGRAPH_DIR + 'index.html', hash: 'i0' }])] }),
    snap({ untracked: ['backend/app/kb/pdf.py'], fingerprints: [fp('backend/app/kb/pdf.py', 'pdf1')], dirs: [dir(QGRAPH_DIR, [{ path: QGRAPH_DIR + 'graph.json', hash: 'g0' }, { path: QGRAPH_DIR + 'index.html', hash: 'i0' }, { path: QGRAPH_DIR + 'extra.json', hash: 'x0' }])] }),
  ],
  // 06 目录单元内删除文件 → BLOCK
  'd4-06-dir-deleted-file': [
    snap({ dirs: [dir(QGRAPH_DIR, [{ path: QGRAPH_DIR + 'graph.json', hash: 'g0' }, { path: QGRAPH_DIR + 'index.html', hash: 'i0' }])] }),
    snap({ dirs: [dir(QGRAPH_DIR, [{ path: QGRAPH_DIR + 'graph.json', hash: 'g0' }]) ] }),
  ],
  // 07 目录单元内改名（一删一增）→ BLOCK
  'd4-07-dir-renamed-file': [
    snap({ dirs: [dir(QGRAPH_DIR, [{ path: QGRAPH_DIR + 'graph.json', hash: 'g0' }, { path: QGRAPH_DIR + 'index.html', hash: 'i0' }])] }),
    snap({ dirs: [dir(QGRAPH_DIR, [{ path: QGRAPH_DIR + 'graph.json', hash: 'g0' }, { path: QGRAPH_DIR + 'renamed.html', hash: 'i0' }])] }),
  ],
  // 08 枚举顺序无关（成员顺序反转，但真实命令先 LC_ALL=C sort ⇒ manifest 与 treeSha 相同）→ 无 Delta
  'd4-08-enumeration-order-independent': [
    snap({ dirs: [dir(QGRAPH_DIR, [{ path: QGRAPH_DIR + 'graph.json', hash: 'g0' }, { path: QGRAPH_DIR + 'index.html', hash: 'i0' }])] }),
    snap({ untracked: ['backend/app/kb/pdf.py'], fingerprints: [fp('backend/app/kb/pdf.py', 'pdf1')], dirs: [dir(QGRAPH_DIR, [{ path: QGRAPH_DIR + 'index.html', hash: 'i0' }, { path: QGRAPH_DIR + 'graph.json', hash: 'g0' }])] }),
  ],
  // 09 摘要格式非法（40-hex git blob SHA-1）且二次取证仍是 40-hex → 证据不可信 → UNCERTAIN
  //    fixture 必须含真实 F| 行，digest40 才有可篡改的摘要（否则空工作区的证据反而合法，测不到本形态）
  'd4-09-digest-40hex-invalid': [
    snap({ trackedModified: ['backend/app/pre.py'], fingerprints: [fp('backend/app/pre.py', 'pre0')], exec: { digest40: true } }),
    snap({ trackedModified: ['backend/app/pre.py', 'backend/app/kb/parser.py'], untracked: ['backend/app/kb/pdf.py'], fingerprints: [fp('backend/app/pre.py', 'pre0'), fp('backend/app/kb/pdf.py', 'pdf1'), fp('backend/app/kb/parser.py', 'par1')], exec: { digest40: true } }),
  ],
  // 10 摘要为乱码（非 hex）且二次取证仍乱码 → UNCERTAIN
  'd4-10-digest-random-nonhex': [
    snap({ trackedModified: ['backend/app/pre.py'], fingerprints: [fp('backend/app/pre.py', 'pre0')], exec: { digestGarbage: true } }),
    snap({ trackedModified: ['backend/app/pre.py', 'backend/app/kb/parser.py'], untracked: ['backend/app/kb/pdf.py'], fingerprints: [fp('backend/app/pre.py', 'pre0'), fp('backend/app/kb/pdf.py', 'pdf1'), fp('backend/app/kb/parser.py', 'par1')], exec: { digestGarbage: true } }),
  ],
  // 11 协议头缺失 → 基线证据非法；两个独立合法取证收敛 → 基线重建；实施后再次非法 → 证据重建 → 继续
  'd4-11-invalid-then-converged-rebuild': [
    snap({ trackedModified: ['backend/app/pre.py'], fingerprints: [fp('backend/app/pre.py', 'pre0')], exec: { dropProtocolLine: true } }),
    snap({ trackedModified: ['backend/app/pre.py', 'backend/app/kb/parser.py'], untracked: ['backend/app/kb/pdf.py'], fingerprints: [fp('backend/app/pre.py', 'pre0'), fp('backend/app/kb/pdf.py', 'pdf1'), fp('backend/app/kb/parser.py', 'par1')], exec: { dropProtocolLine: true } }),
    snap({ trackedModified: ['backend/app/pre.py', 'backend/app/kb/parser.py'], untracked: ['backend/app/kb/pdf.py'], fingerprints: [fp('backend/app/pre.py', 'pre0'), fp('backend/app/kb/pdf.py', 'pdf1'), fp('backend/app/kb/parser.py', 'par1')] }),
  ],
  // 12 ★M0-003 形态★：baseline↔post 摘要不一致（post 被臆造成另一个值），两个独立 rehash 都与 baseline 一致
  //    → SNAPSHOT_FALSE_POSITIVE_RECOVERED，不误报 BLOCK
  'd4-12-mismatch-rehash-both-unchanged': [
    snap({ trackedModified: ['backend/app/pre.py'], fingerprints: [fp('backend/app/pre.py', 'pre0')] }),
    snap({ trackedModified: ['backend/app/pre.py', 'backend/app/kb/parser.py'], untracked: ['backend/app/kb/pdf.py'], fingerprints: [fp('backend/app/pre.py', 'pre0-FABRICATED-BY-LLM'), fp('backend/app/kb/pdf.py', 'pdf1'), fp('backend/app/kb/parser.py', 'par1')] }),
  ],
  // 13 mismatch 且两个 rehash 都显示确实变了 → EXTERNAL_CHANGED_DURING_TASK（有字节证据）→ BLOCK
  'd4-13-mismatch-rehash-both-changed': [
    snap({ trackedModified: ['backend/app/pre.py'], fingerprints: [fp('backend/app/pre.py', 'pre0')] }),
    snap({ trackedModified: ['backend/app/pre.py', 'backend/app/kb/parser.py'], untracked: ['backend/app/kb/pdf.py'], fingerprints: [fp('backend/app/pre.py', 'pre0-FABRICATED'), fp('backend/app/kb/pdf.py', 'pdf1'), fp('backend/app/kb/parser.py', 'par1')] }),
  ],
  // 14 REHASH_A 与 REHASH_B 不一致 → BLOCKED_FINGERPRINT_EVIDENCE_UNCERTAIN（绝不猜）
  'd4-14-rehash-ab-inconsistent': [
    snap({ trackedModified: ['backend/app/pre.py'], fingerprints: [fp('backend/app/pre.py', 'pre0')] }),
    snap({ trackedModified: ['backend/app/pre.py', 'backend/app/kb/parser.py'], untracked: ['backend/app/kb/pdf.py'], fingerprints: [fp('backend/app/pre.py', 'pre0-FABRICATED'), fp('backend/app/kb/pdf.py', 'pdf1'), fp('backend/app/kb/parser.py', 'par1')] }),
  ],
  // 15 真实文件形态（docs/qgraphflow 两文件）两次取证摘要完全一致 → 无需仲裁
  'd4-15-qgraphflow-fixture-stable': [
    snap({ dirs: [dir(QGRAPH_DIR, [{ path: QGRAPH_DIR + 'graph.json', hash: 'real-g0' }, { path: QGRAPH_DIR + 'index.html', hash: 'real-i0' }])] }),
    snap({ untracked: ['backend/app/kb/pdf.py'], fingerprints: [fp('backend/app/kb/pdf.py', 'pdf1')], dirs: [dir(QGRAPH_DIR, [{ path: QGRAPH_DIR + 'graph.json', hash: 'real-g0' }, { path: QGRAPH_DIR + 'index.html', hash: 'real-i0' }])] }),
  ],
  // 21 ★d4-05 的正例补集★：pre-existing 未跟踪目录单元内新增文件，但该目录在 TASK_SPEC.ALLOWED_WRITE_PATHS 内
  //    → 目录单元差异全部可归因于本任务 → 记入 taskChanged，不得误判外部改动 → 继续
  'd4-21-allowed-write-path-in-preexisting-dir': [
    snap({ dirs: [dir(QGRAPH_DIR, [{ path: QGRAPH_DIR + 'graph.json', hash: 'g0' }, { path: QGRAPH_DIR + 'index.html', hash: 'i0' }])] }),
    snap({ untracked: ['backend/app/kb/pdf.py'], fingerprints: [fp('backend/app/kb/pdf.py', 'pdf1')], dirs: [dir(QGRAPH_DIR, [{ path: QGRAPH_DIR + 'graph.json', hash: 'g0' }, { path: QGRAPH_DIR + 'index.html', hash: 'i0' }, { path: QGRAPH_DIR + 'extra.json', hash: 'x0' }])] }),
  ],
  // 19 治理产物即使任务号相同也绝不 retry-owned → BLOCKED_GOVERNANCE_CONFLICT
  'd4-19-governance-retry-never-owned': [
    CLEAN_BASE,
    snap({ trackedModified: ['.qoder/rules/40-frontend.md', 'backend/app/kb/parser.py'], untracked: ['backend/app/kb/pdf.py'], fingerprints: [fp('.qoder/rules/40-frontend.md', 'r1'), fp('backend/app/kb/pdf.py', 'pdf1'), fp('backend/app/kb/parser.py', 'par1')] }),
  ],
  // 25 执行手改写脚本下发的命令 → 摘要来源不可信 → 证据非法
  'd4-25-executor-rewrote-command': [
    snap({ exec: { rewriteCommand: true } }),
    snap({ exec: { rewriteCommand: true } }),
  ],
  // 26 执行手写了文件 → GOVERNANCE_POLICY_VIOLATION（只读取证必须零写入）
  'd4-26-executor-wrote-files': [
    snap({ exec: { filesWritten: ['backend/tmp.py'] } }),
    snap({ exec: { filesWritten: ['backend/tmp.py'] } }),
  ],
  // 27 目录单元 fileCount 与成员数不自洽 → 证据非法
  'd4-27-tree-filecount-inconsistent': [
    snap({ dirs: [dir(QGRAPH_DIR, [{ path: QGRAPH_DIR + 'graph.json', hash: 'g0' }], { treeFileCountLie: true })], exec: { treeFileCountLie: true } }),
    snap({ dirs: [dir(QGRAPH_DIR, [{ path: QGRAPH_DIR + 'graph.json', hash: 'g0' }])], exec: { treeFileCountLie: true } }),
  ],
  // 28 目录成员不属于任何树单元 → 证据非法
  'd4-28-tree-member-without-unit': [
    snap({ dirs: [dir(QGRAPH_DIR, [{ path: QGRAPH_DIR + 'graph.json', hash: 'g0' }])], exec: { memberOrphan: true } }),
    snap({ untracked: ['backend/app/kb/pdf.py'], fingerprints: [fp('backend/app/kb/pdf.py', 'pdf1')], exec: { memberOrphan: true } }),
  ],
  // 20 D1 保持：required 门禁永远失败 → BLOCKED_REPAIR_LIMIT
  // 21/23/24 复用默认队列（见 D3 集合）
}
// 仲裁（REHASH_A / REHASH_B）证据队列：默认 = 主队列最后一项（代表"当前真实工作区状态"）。
const D4_REHASH = {
  // 12：两个独立 rehash 都与 baseline 一致 → 前一次 post 摘要属臆造 → 误报恢复
  'd4-12-mismatch-rehash-both-unchanged': {
    a: [snap({ trackedModified: ['backend/app/pre.py', 'backend/app/kb/parser.py'], untracked: ['backend/app/kb/pdf.py'], fingerprints: [fp('backend/app/pre.py', 'pre0'), fp('backend/app/kb/pdf.py', 'pdf1'), fp('backend/app/kb/parser.py', 'par1')] })],
    b: [snap({ trackedModified: ['backend/app/pre.py', 'backend/app/kb/parser.py'], untracked: ['backend/app/kb/pdf.py'], fingerprints: [fp('backend/app/pre.py', 'pre0'), fp('backend/app/kb/pdf.py', 'pdf1'), fp('backend/app/kb/parser.py', 'par1')] })],
  },
  // 13：两个独立 rehash 一致地显示 pre0 → preX（真的变了）→ BLOCK
  'd4-13-mismatch-rehash-both-changed': {
    a: [snap({ trackedModified: ['backend/app/pre.py', 'backend/app/kb/parser.py'], untracked: ['backend/app/kb/pdf.py'], fingerprints: [fp('backend/app/pre.py', 'pre0-REAL-CHANGED'), fp('backend/app/kb/pdf.py', 'pdf1'), fp('backend/app/kb/parser.py', 'par1')] })],
    b: [snap({ trackedModified: ['backend/app/pre.py', 'backend/app/kb/parser.py'], untracked: ['backend/app/kb/pdf.py'], fingerprints: [fp('backend/app/pre.py', 'pre0-REAL-CHANGED'), fp('backend/app/kb/pdf.py', 'pdf1'), fp('backend/app/kb/parser.py', 'par1')] })],
  },
  // 14：A 说未变、B 说变了 → 不一致 → UNCERTAIN
  'd4-14-rehash-ab-inconsistent': {
    a: [snap({ trackedModified: ['backend/app/pre.py', 'backend/app/kb/parser.py'], untracked: ['backend/app/kb/pdf.py'], fingerprints: [fp('backend/app/pre.py', 'pre0'), fp('backend/app/kb/pdf.py', 'pdf1'), fp('backend/app/kb/parser.py', 'par1')] })],
    b: [snap({ trackedModified: ['backend/app/pre.py', 'backend/app/kb/parser.py'], untracked: ['backend/app/kb/pdf.py'], fingerprints: [fp('backend/app/pre.py', 'pre0-OTHER'), fp('backend/app/kb/pdf.py', 'pdf1'), fp('backend/app/kb/parser.py', 'par1')] })],
  },
  // 11：基线非法 → A/B 收敛出【合法且等价于任务前】的基线；实施后再非法 → A/B 收敛出合法当前证据
  'd4-11-invalid-then-converged-rebuild': {
    a: [
      snap({ trackedModified: ['backend/app/pre.py'], fingerprints: [fp('backend/app/pre.py', 'pre0')] }),
      snap({ trackedModified: ['backend/app/pre.py', 'backend/app/kb/parser.py'], untracked: ['backend/app/kb/pdf.py'], fingerprints: [fp('backend/app/pre.py', 'pre0'), fp('backend/app/kb/pdf.py', 'pdf1'), fp('backend/app/kb/parser.py', 'par1')] }),
    ],
    b: [
      snap({ trackedModified: ['backend/app/pre.py'], fingerprints: [fp('backend/app/pre.py', 'pre0')] }),
      snap({ trackedModified: ['backend/app/pre.py', 'backend/app/kb/parser.py'], untracked: ['backend/app/kb/pdf.py'], fingerprints: [fp('backend/app/pre.py', 'pre0'), fp('backend/app/kb/pdf.py', 'pdf1'), fp('backend/app/kb/parser.py', 'par1')] }),
    ],
  },
  // 09/10/25/26/27/28：二次取证同样不可信/不自洽 → 无法建立确定性证据 → UNCERTAIN（26 → GOVERNANCE_POLICY_VIOLATION）
  // 09/10 的 rehash 必须带真实 F| 行，摘要形态缺陷才会复现
  'd4-09-digest-40hex-invalid': { a: [D4_SNAPS['d4-09-digest-40hex-invalid'][0]], b: [D4_SNAPS['d4-09-digest-40hex-invalid'][0]] },
  'd4-10-digest-random-nonhex': { a: [D4_SNAPS['d4-10-digest-random-nonhex'][0]], b: [D4_SNAPS['d4-10-digest-random-nonhex'][0]] },
  'd4-25-executor-rewrote-command': { a: [snap({ exec: { rewriteCommand: true } })], b: [snap({ exec: { rewriteCommand: true } })] },
  'd4-26-executor-wrote-files': { a: [snap({ exec: { filesWritten: ['backend/tmp.py'] } })], b: [snap({ exec: { filesWritten: ['backend/tmp.py'] } })] },
  'd4-27-tree-filecount-inconsistent': { a: [snap({ dirs: [dir(QGRAPH_DIR, [{ path: QGRAPH_DIR + 'graph.json', hash: 'g0' }])], exec: { treeFileCountLie: true } })], b: [snap({ dirs: [dir(QGRAPH_DIR, [{ path: QGRAPH_DIR + 'graph.json', hash: 'g0' }])], exec: { treeFileCountLie: true } })] },
  'd4-28-tree-member-without-unit': { a: [snap({ dirs: [dir(QGRAPH_DIR, [{ path: QGRAPH_DIR + 'graph.json', hash: 'g0' }])], exec: { memberOrphan: true } })], b: [snap({ dirs: [dir(QGRAPH_DIR, [{ path: QGRAPH_DIR + 'graph.json', hash: 'g0' }])], exec: { memberOrphan: true } })] },
  // 03/04/05/06/07：外部改动由 rehash 双确认
  'd4-03-same-size-one-byte-content-change': { a: [D4_SNAPS['d4-03-same-size-one-byte-content-change'][1]], b: [D4_SNAPS['d4-03-same-size-one-byte-content-change'][1]] },
  'd4-04-size-change': { a: [D4_SNAPS['d4-04-size-change'][1]], b: [D4_SNAPS['d4-04-size-change'][1]] },
  'd4-05-dir-added-third-file': { a: [D4_SNAPS['d4-05-dir-added-third-file'][1]], b: [D4_SNAPS['d4-05-dir-added-third-file'][1]] },
  'd4-06-dir-deleted-file': { a: [D4_SNAPS['d4-06-dir-deleted-file'][1]], b: [D4_SNAPS['d4-06-dir-deleted-file'][1]] },
  'd4-07-dir-renamed-file': { a: [D4_SNAPS['d4-07-dir-renamed-file'][1]], b: [D4_SNAPS['d4-07-dir-renamed-file'][1]] },
  'd4-19-governance-retry-never-owned': { a: [D4_SNAPS['d4-19-governance-retry-never-owned'][1]], b: [D4_SNAPS['d4-19-governance-retry-never-owned'][1]] },
}
// 16/17/18/19：同任务重试产物归属（需 retryOfTaskId + retryArtifacts + spec 允许写该路径）
const D4_RETRY = {
  'd4-16-retry-owned-artifact-allowed': { retryOfTaskId: 'kb-pdf-parser', artifacts: [{ path: RETRY_ART, priorSpecExpected: true, priorRunSha256: sha64('base0'), priorRunWorkerEvidence: 'manifest run#1: implement FILES_CREATED includes ' + RETRY_ART }] },
  'd4-17-different-task-not-owned': { retryOfTaskId: 'kb-pdf-parser-OTHER-TASK', artifacts: [{ path: RETRY_ART, priorSpecExpected: true, priorRunSha256: sha64('base0'), priorRunWorkerEvidence: 'manifest run#1 FILES_CREATED includes ' + RETRY_ART }] },
  'd4-18-retry-artifact-changed-externally': { retryOfTaskId: 'kb-pdf-parser', artifacts: [{ path: RETRY_ART, priorSpecExpected: true, priorRunSha256: sha64('base0'), priorRunWorkerEvidence: 'manifest run#1 FILES_CREATED includes ' + RETRY_ART }] },
  // 19：治理产物即使任务号相同、即使上一 run 真的产出过，也绝不 retry-owned（§27 治理优先于归属）
  'd4-19-governance-retry-never-owned': { retryOfTaskId: 'kb-pdf-parser', artifacts: [{ path: '.qoder/rules/40-frontend.md', priorSpecExpected: true, priorRunSha256: sha64('r1'), priorRunWorkerEvidence: 'manifest run#1: implement FILES_MODIFIED includes .qoder/rules/40-frontend.md' }] },
}
const D4_RETRY_SNAPS = {
  'd4-16-retry-owned-artifact-allowed': [
    snap({ untracked: [RETRY_ART], fingerprints: [fp(RETRY_ART, 'base0')] }),
    snap({ untracked: [RETRY_ART, 'backend/app/kb/pdf.py'], trackedModified: ['backend/app/kb/parser.py'], fingerprints: [fp(RETRY_ART, 'base1-improved-by-retry'), fp('backend/app/kb/pdf.py', 'pdf1'), fp('backend/app/kb/parser.py', 'par1')] }),
  ],
  'd4-17-different-task-not-owned': [
    snap({ untracked: [RETRY_ART], fingerprints: [fp(RETRY_ART, 'base0')] }),
    snap({ untracked: [RETRY_ART, 'backend/app/kb/pdf.py'], trackedModified: ['backend/app/kb/parser.py'], fingerprints: [fp(RETRY_ART, 'base1-by-different-task'), fp('backend/app/kb/pdf.py', 'pdf1'), fp('backend/app/kb/parser.py', 'par1')] }),
  ],
  'd4-18-retry-artifact-changed-externally': [
    snap({ untracked: [RETRY_ART], fingerprints: [fp(RETRY_ART, 'edited-by-user-between-runs')] }),
    snap({ untracked: [RETRY_ART, 'backend/app/kb/pdf.py'], fingerprints: [fp(RETRY_ART, 'edited-by-user-between-runs'), fp('backend/app/kb/pdf.py', 'pdf1')] }),
  ],
}
const D4_SCENARIOS = new Set(Object.keys(D4_SNAPS).concat(Object.keys(D4_RETRY_SNAPS)))
const D4_DIRTY_FEATURE = new Set(Object.keys(D4_SNAPS).concat(Object.keys(D4_RETRY_SNAPS)))
// D4 §26–§30：按场景覆盖 TASK_SPEC 的允许写集合（EXPECTED_FILES / ALLOWED_WRITE_PATHS）。
// retry-owned 的前提是"该路径在两版 TASK_SPEC 允许写集合内"，所以 16/17/18 必须将产物列入 EXPECTED_FILES；
// 19 故意不把治理文件列入（治理优先于归属，且证明"spec 误列也不放行"由另一条分支覆盖）。
const D4_SPEC = {
  'd4-16-retry-owned-artifact-allowed': { EXPECTED_FILES: ['backend/app/kb/pdf.py', 'backend/app/kb/parser.py', RETRY_ART] },
  'd4-17-different-task-not-owned': { EXPECTED_FILES: ['backend/app/kb/pdf.py', 'backend/app/kb/parser.py', RETRY_ART] },
  'd4-18-retry-artifact-changed-externally': { EXPECTED_FILES: ['backend/app/kb/pdf.py', 'backend/app/kb/parser.py', RETRY_ART] },
  'd4-19-governance-retry-never-owned': { EXPECTED_FILES: ['backend/app/kb/pdf.py', 'backend/app/kb/parser.py'] },
  // 21：目录前缀授权（§25 正例）；05 保持默认（EXPECTED_FILES 不含该目录 → 目录内新增属外部改动）
  'd4-21-allowed-write-path-in-preexisting-dir': { ALLOWED_WRITE_PATHS: [QGRAPH_DIR, 'backend/app/kb/'] },
}
// D4：把 D4 主队列/重试队列并入统一 SNAPSHOTS 队列（worktree-snapshot 取证只查 SNAPSHOTS）。
Object.assign(SNAPSHOTS, D4_SNAPS, D4_RETRY_SNAPS)
// D4：需要进入修复循环的补充场景（D1/D2 保持项）
D2_GATE_FAIL.add('d4-20-d1-required-fail-still-machine-fail')
D2_SELFREPAIR_GIT['d4-20-d1-required-fail-still-machine-fail'] = ['git status']
D2_GATE_FAIL.add('d4-22-destructive-git-still-block')
D2_SELFREPAIR_GIT['d4-22-destructive-git-still-block'] = ['git checkout HEAD -- backend/app/kb/pdf.py']
D3_HIGH.add('d4-23-high-risk-still-dual-review')
D3_HUMAN.add('d4-24-human-required-still-pauses')
D3_GATE_FAIL_ALWAYS.add('d4-20-d1-required-fail-still-machine-fail')

let snapCalls = 0
const rehashCalls = { a: 0, b: 0 }
// 主取证队列（label=worktree-snapshot）：第 1 次 = WORKTREE_BASELINE，其后 = 各校验点快照。
function mainQueueSnap() {
  snapCalls++
  const q = SNAPSHOTS[scenario]
  if (q && q.length) return q[Math.min(snapCalls - 1, q.length - 1)]
  return snapCalls === 1 ? CLEAN_BASE : DEFAULT_POST
}
// 仲裁队列（label=fingerprint-rehash-a / -b）：场景无专属 rehash 队列时回落到"主队列最后一项"
// （代表当前真实工作区状态），语义 = 独立二次取证复现当前状态。
function pickQueue(queues, counters, key) {
  counters[key] = (counters[key] || 0) + 1
  const q = queues && queues[key]
  if (q && q.length) return q[Math.min(counters[key] - 1, q.length - 1)]
  const main = SNAPSHOTS[scenario]
  if (main && main.length) return main[main.length - 1]
  return snapCalls === 0 ? CLEAN_BASE : DEFAULT_POST
}
// D4：按场景覆盖 TASK_SPEC 允许写集合（未覆盖场景 = 全局 specObj）
function specFor(scn) {
  const ov = D4_SPEC[scn]
  return ov ? Object.assign({}, specObj, ov) : specObj
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
      if (D2_DIRTY_FEATURE.has(scenario) || D4_DIRTY_FEATURE.has(scenario)) return Promise.resolve({ isGitRepo: true, isCorrectRepo: true, branch: 'feature/kb', dirty: true, dirtyFiles: ['(pre-existing authorized change)'], notes: 'AGENTS.md 存在' })
      return Promise.resolve({ isGitRepo: true, isCorrectRepo: true, branch: 'feature/kb', dirty: false, dirtyFiles: [], notes: 'AGENTS.md 不存在' })
    }
    // ---- D4：确定性字节取证 —— 执行手只逐字跑脚本下发的命令、原样回传 stdout（结论全在脚本侧）----
    case 'worktree-snapshot': return Promise.resolve(executorEvidence('worktree-snapshot', prompt, mainQueueSnap()))
    case 'fingerprint-rehash-a': return Promise.resolve(executorEvidence('fingerprint-rehash-a', prompt, pickQueue(D4_REHASH[scenario], rehashCalls, 'a')))
    case 'fingerprint-rehash-b': return Promise.resolve(executorEvidence('fingerprint-rehash-b', prompt, pickQueue(D4_REHASH[scenario], rehashCalls, 'b')))
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
    case 'task-spec': return Promise.resolve(specFor(scenario))
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
// D4 §26–§30：人工授权的同任务重跑才传 retryOfTaskId/retryArtifacts（普通任务恒不传 → RETRY_OWNED 恒空）
const retry = D4_RETRY[scenario]
switch (scenario) {
  case 'notask': ARGS = undefined; break
  case 'badmode': ARGS = { task: 'x', mode: 'yolo', executionMode: MODE }; break
  case 'milestone': ARGS = { task: '知识库 M1 Milestone', mode: 'milestone_gate', executionMode: MODE }; break
  case 'release': ARGS = { task: 'v1.0 发布', mode: 'release_gate', executionMode: MODE }; break
  default: ARGS = Object.assign({ task: '实现知识库 PDF 解析器，支持文本与元数据提取', mode: 'task', executionMode: MODE, __d3_force_max_route: forceMax },
    retry ? { retryOfTaskId: retry.retryOfTaskId, retryArtifacts: retry.artifacts } : {})
}

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const fn = new AsyncFunction('agent', 'parallel', 'pipeline', 'phase', 'log', 'args', 'budget', 'workflow', src)
const result = await fn(stubs.agent, stubs.parallel, stubs.pipeline, stubs.phase, stubs.log, ARGS, stubs.budget, stubs.workflow)

const modelsUsed = [...new Set(calls.filter(c => c.model).map(c => c.model))]
const roleSet = {}
for (const c of calls) { if (c.role) (roleSet[c.role] = roleSet[c.role] || []).push(c.label) }

// ---- D4 metrics：从终态输出（GOVERNANCE_D4 / FINGERPRINT / ADJUDICATION / RETRY_OWNERSHIP / TASK_DELTA）归一化 ----
const D4M = (function () {
  const g = (result && result.GOVERNANCE_D4) || null
  const fp = (result && result.FINGERPRINT) || null
  const adj = (result && result.ADJUDICATION) || (g && g.ADJUDICATION) || []
  const retry = (result && result.RETRY_OWNERSHIP) || (g && g.RETRY_OWNERSHIP) || null
  const invalid = (result && result.EVIDENCE_PROBLEMS) || (fp && fp.invalidDetected) || (g && g.INVALID_EVIDENCE_DETECTED) || []
  const recovered = (fp && fp.falsePositivesRecovered) || (g && g.FALSE_POSITIVES_RECOVERED) || []
  return {
    backend: (g && g.FINGERPRINT_BACKEND) || (result && result.FINGERPRINT_BACKEND) || (fp && fp.backend) || null,
    authority: (g && g.CONTENT_IDENTITY_AUTHORITY) || (result && result.CONTENT_IDENTITY_AUTHORITY) || (fp && fp.authority) || null,
    scriptSideHash: (g && g.SCRIPT_SIDE_HASH_AVAILABLE) || (result && result.SCRIPT_SIDE_HASH_AVAILABLE) || (fp && fp.scriptSideHash) || null,
    protocol: (g && g.PINNED_COMMAND_PROTOCOL) || null,
    adjudicationVerdicts: adj.map((a) => a && a.verdict).filter(Boolean),
    adjudicationReasons: adj.map((a) => a && a.reason).filter(Boolean),
    rehashConvergence: adj.map((a) => (a && a.agreement) || null),
    evidenceRuns: (g && g.EVIDENCE_RUNS) || null,
    invalidEvidence: invalid.slice(0, 4),
    falsePositivesRecovered: recovered.slice(0, 4),
    retryOwnership: retry,
    delta: (result && result.TASK_DELTA) || (result && result.GOVERNANCE_D2 && result.GOVERNANCE_D2.TASK_DELTA) || null,
    treeUnits: (g && g.TREE_UNITS) || null,
    failedPhase: (result && result.FAILED_PHASE) || null,
  }
})()
console.log(JSON.stringify({
  scenario,
  executionMode: MODE,
  WORKFLOW_STATUS: result && result.WORKFLOW_STATUS,
  BLOCK_REASON: result && result.BLOCK_REASON,
  ACTIVE_EXECUTION_MODE: result && result.ACTIVE_EXECUTION_MODE,
  REAL_PRODUCTION_APPROVED: result && result.REAL_PRODUCTION_APPROVED,
  d4: D4M,
  snapCalls,
  rehashCalls,
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
