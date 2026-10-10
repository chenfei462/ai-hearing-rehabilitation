export const meta = {
  name: 'project-feature-delivery',
  description: 'ai-hearing-rehabilitation 单任务交付流水线：Max 规划/验收，Flash 实现，机器门禁裁判；支持 task / milestone_gate / release_gate 三种模式',
  whenToUse: '完成一个 0.5~1.5 开发日的原子开发任务（task 模式），或执行 Milestone / Release 门禁检查。Mega 任务会被拒绝并返回 NEEDS_DECOMPOSITION。',
  phases: [
    { title: 'Preflight', detail: '模型可用性探针 + Git 状态守护（只读）' },
    { title: 'Classify', detail: '任务分类与敏感性判定（Max）', model: 'qmodel_38max' },
    { title: 'Explore', detail: '只读仓库探索 + 真实命令发现（Max）', model: 'qmodel_38max' },
    { title: 'Scope Check', detail: '原子性检查，过大则 NEEDS_DECOMPOSITION（Max）', model: 'qmodel_38max' },
    { title: 'Task Spec', detail: '生成不可变任务合同 TASK_SPEC（Max）', model: 'qmodel_38max' },
    { title: 'Implement', detail: '严格按 TASK_SPEC 实施（Flash）', model: 'qfmodel' },
    { title: 'Machine Gate', detail: '真实执行门禁，脚本按 kind 分层裁判：required 退出码为准，record 采集基线入 findings（Flash 执行）', model: 'qfmodel' },
    { title: 'Repair', detail: 'Self-Repair → Max RCA → FIX_SPEC，全任务合计最多 3 轮' },
    { title: 'Max Review', detail: '独立代码审查，PASS / REQUEST_CHANGES（Max）', model: 'qmodel_38max' },
    { title: 'Fix', detail: '仅修复 review blockers（Flash）', model: 'qfmodel' },
    { title: 'Verify', detail: '最终验收 TASK_PASS / TASK_FAIL（Max）', model: 'qmodel_38max' },
    { title: 'Report', detail: '组装最终报告' },
    { title: 'Gate Checks', detail: 'Milestone/Release 门禁证据收集（Flash 执行命令）', model: 'qfmodel' },
    { title: 'Gate Verdict', detail: 'Milestone/Release 判定（Max）', model: 'qmodel_38max' },
  ],
}

// ============================================================
// 模型强制策略：仅允许以下两个模型，禁止 fallback。
// 标识来源：当前 Qoder CN CLI 配置（settings.json model.name=qmodel_38max）
// 与运行日志（model_config key=qfmodel / display_name=Qwen3.8-Flash）。
// ============================================================
const MAX = 'qmodel_38max'    // Qwen3.8-Max  架构师 + 项目经理 + 验收官
const FLASH = 'qfmodel'       // Qwen3.8-Flash 程序员

const MODEL_BLOCKED_HINT = '请运行 /model 命令查看当前可用模型列表，确认 qmodel_38max (Qwen3.8-Max) 与 qfmodel (Qwen3.8-Flash) 是否仍然有效；如模型标识已变更，请更新本 Workflow 顶部的 MAX / FLASH 常量。禁止改用其他模型继续。'

// ============================================================
// 治理升级 D3 — FLASH_ONLY_DEGRADED_MODE（人工授权降级模式）＋ D5 — 恢复 FULL 为默认
// ------------------------------------------------------------
// 两种执行模式，均由 qmodel_38max / qfmodel 两个标识构成，禁止任何第三模型 / default / auto / fallback：
//   · FULL_MODE（**D5 起的默认**）：规划/探索/审查/验收/RCA/取证 = qmodel_38max(Max)；实施/门禁/修复 = qfmodel(Flash)。
//     天然模型级角色分离：决策者不实施，实施者无验收权。
//   · FLASH_ONLY_MODE（**完整保留，但只可显式启用**）：为 Max 配额不可用而设的人工授权降级模式。
//     启用方式只有两种：调用时显式传 executionMode:'FLASH_ONLY'，或人工把下方 EXECUTION_MODE 默认改为 'FLASH_ONLY'。
//     **绝不自动降级**：Max 探针/调用失败一律 BLOCKED_MODEL_UNAVAILABLE，不允许改用 Flash 蒙混。
//     降级时角色分离不靠模型、靠【独立 invocation】：Planner / Explorer / Worker / Reviewer / Verifier / RCA
//     各为独立 agent() 调用（不同 label），HIGH Risk 追加 FLASH_REVIEWER_A + FLASH_REVIEWER_B 双独立审查；
//     Worker 自报 PASS/DONE/IMPLEMENTED 一律无最终验收权；TASK_PASS 仍须
//     Machine Gate PASS ∧ 独立 Review PASS ∧ Verify PASS ∧ Task Delta PASS ∧ Governance Guard PASS。
//     为"只有 Flash"而降低任何 Gate / 把 required 降为 record / 放宽测试，一律禁止。
// D5：DEFAULT_EXECUTION_MODE = 'FULL'（2026-10-08，人工授权）。D1/D2/D3/D4 全部治理保护不因此削弱。
// ============================================================
let EXECUTION_MODE = 'FULL'              // D5 默认运行模式 = FULL（双模型）。FLASH_ONLY 为显式降级选项，见上方注释。
let D3_TEST_FORCE_MAX_ROUTE = false      // 仅测试 trip-wire：验证 FLASH_ONLY 下 qmodel_38max 运行时路由被拒（生产恒 false）

// 角色 → FULL 模式设计模型（真值）。FLASH_ONLY 下运行时统一路由到 FLASH。
const ROLE_FULL_MODEL = {
  planner: MAX, explorer: MAX, reviewer: MAX, reviewerB: MAX, verifier: MAX, rca: MAX, snapshot: MAX,
  worker: FLASH, gate: FLASH, evidence: FLASH, fixer: FLASH, probeFlash: FLASH, probeMax: MAX,
}
// FLASH_ONLY 下本应走 Max、需被路由到 FLASH 的角色；测试 trip-wire 命中这些角色时会被强制路由回 MAX 以验证拦截。
const FLASH_ONLY_ROUTED_ROLES = ['planner', 'explorer', 'reviewer', 'reviewerB', 'verifier', 'rca', 'snapshot']

function modelFor(role) {
  if (EXECUTION_MODE === 'FLASH_ONLY') {
    if (role === 'probeMax') return null                       // FLASH_ONLY 不探测 Max（Max 不可用）
    if (D3_TEST_FORCE_MAX_ROUTE && FLASH_ONLY_ROUTED_ROLES.indexOf(role) >= 0) return MAX // 测试 trip-wire：模拟违规路由，由 Preflight 路由守卫拦截
    return FLASH                                                // 正常 FLASH_ONLY：所有运行时角色 = qfmodel
  }
  return ROLE_FULL_MODEL[role]
}
function allowedRuntimeModels() {
  return EXECUTION_MODE === 'FLASH_ONLY' ? new Set([FLASH]) : new Set([MAX, FLASH])
}
// D5：每种执行模式下"角色 → 应有运行时模型"的期望表。Preflight 路由守卫据此做**逐角色**一致性校验：
// FULL 下决策角色必须是 Max、实施角色必须是 Flash（反之亦然即为违规）；FLASH_ONLY 下必须全部是 Flash。
// 这让"默认已恢复 FULL"成为机器可校验事实，而不只是文档声明。
const EXPECTED_RUNTIME_MODEL = {
  FULL: { planner: MAX, explorer: MAX, reviewer: MAX, reviewerB: MAX, verifier: MAX, rca: MAX, snapshot: MAX, worker: FLASH, gate: FLASH, evidence: FLASH, fixer: FLASH },
  FLASH_ONLY: { planner: FLASH, explorer: FLASH, reviewer: FLASH, reviewerB: FLASH, verifier: FLASH, rca: FLASH, snapshot: FLASH, worker: FLASH, gate: FLASH, evidence: FLASH, fixer: FLASH },
}
function mname(m) { return m === MAX ? MAX + ' (Qwen3.8-Max)' : (m === FLASH ? FLASH + ' (Qwen3.8-Flash)' : String(m)) }

// D3：把当前执行模式与各角色运行时模型汇总为报告字段（供审计与最终报告）。
function modeSummary() {
  return {
    ACTIVE_EXECUTION_MODE: EXECUTION_MODE,
    DEFAULT_EXECUTION_MODE: 'FULL',
    FULL_MODE_PRESERVED: true,
    FLASH_ONLY_MODE_PRESERVED: true,
    AUTO_MODEL_FALLBACK: 'FORBIDDEN — Max 不可用一律 BLOCKED_MODEL_UNAVAILABLE，绝不自动改用 qfmodel',
    DEGRADED_MODE_OPT_IN: "FLASH_ONLY 是人工授权的显式降级选项（未删除）：仅当调用方传 executionMode:'FLASH_ONLY' 或人工把顶部 EXECUTION_MODE 改为 'FLASH_ONLY' 时生效；生效时全部运行时角色模型 = qfmodel，且门禁/审查/验收判据一条不降。默认模式自 D5 起为 FULL（qmodel_38max 规划/审查/验收 + qfmodel 实施/门禁）。",
    ALLOWED_RUNTIME_MODELS: [...allowedRuntimeModels()],
    ROLE_RUNTIME_MODELS: {
      planner: mname(modelFor('planner')), explorer: mname(modelFor('explorer')), worker: mname(modelFor('worker')),
      gate: mname(modelFor('gate')), reviewer: mname(modelFor('reviewer')), reviewerB: mname(modelFor('reviewerB')),
      verifier: mname(modelFor('verifier')), rca: mname(modelFor('rca')), snapshot: mname(modelFor('snapshot')), evidence: mname(modelFor('evidence')),
    },
    ROLE_SEPARATION: EXECUTION_MODE === 'FLASH_ONLY'
      ? 'FLASH_ONLY：所有角色模型=qfmodel，独立性由【独立 agent() invocation】保证（Planner/Explorer/Worker/Reviewer/Verifier/RCA 各为不同 label 的独立调用）；HIGH Risk 追加 FLASH_REVIEWER_A+B 双独立审查。'
      : 'FULL：规划/探索/审查/验收/RCA=qmodel_38max（只读决策），实施/门禁/取证=qfmodel，天然模型级角色分离。',
    // D4：内容身份证据链（供审计 —— 谁取证、证据是否确定性、是否发生过误报与仲裁）。
    FINGERPRINT_BACKEND,
    CONTENT_IDENTITY_AUTHORITY,
    SCRIPT_SIDE_HASH_AVAILABLE,
    FINGERPRINT_EVIDENCE: {
      repoRootForEvidence: FP_REPO_ROOT || '.',
      pinnedCommandProtocol: FP_PROTOCOL,
      evidenceRuns: FP_EVIDENCE_RUNS.length,
      evidenceRunsByLabel: FP_EVIDENCE_RUNS.reduce((m, r) => { m[r.label] = (m[r.label] || 0) + 1; return m }, {}),
      invalidEvidenceDetected: FP_INVALID_DETECTED.slice(0, 10),
      falsePositivesRecovered: FP_FALSE_POSITIVES_RECOVERED.slice(),
      adjudications: ADJUDICATION_LOG.slice(),
      limitation: '脚本沙箱无 fs/crypto（已实测），字节读取只能由只读执行手代为执行【脚本逐字下发的同一条命令】；残余风险 = 执行手改写/伪造 stdout，由"命令逐字一致校验 + 格式与自洽校验 + 两个独立 invocation 收敛签名"三层拦阻，无法做到零信任本地哈希。',
    },
    RETRY_OWNERSHIP: {
      status: RETRY_OWNERSHIP.status,
      retryOf: RETRY_OWNERSHIP.retryOf,
      currentTaskIdentity: RETRY_OWNERSHIP.currentTaskIdentity,
      artifacts: RETRY_OWNERSHIP.artifacts.slice(),
      accepted: RETRY_OWNERSHIP.accepted.slice(),
      rejected: RETRY_OWNERSHIP.rejected.slice(),
    },
  }
}

const PROJECT_RULES = `
[项目] ai-hearing-rehabilitation — 人工耳蜗术后听觉康复教育与训练辅助工具。不是自动诊断系统、不是处方系统、不是人工耳蜗调机系统。
[技术栈] Frontend: React 18 + TypeScript + Vite + MUI + Tailwind CSS；Backend: Python 3.11 + FastAPI + SQLAlchemy + PostgreSQL + Redis；AI: Fun-ASR / Qwen TTS / LLM；知识库(未来): PostgreSQL + pgvector。
[架构纪律] 必须优先复用当前架构。未经 TASK_SPEC 明确批准，禁止：推倒重构、更换框架、更换前端技术栈、新增独立微服务、新增新的向量数据库、大规模升级依赖、修改现有公开 API、修改认证方式、修改用户数据模型。
[医疗安全] 禁止产生任何会直接：诊断疾病、开药、推荐停药、修改药物剂量、替代医生判断、给出人工耳蜗 programming 参数、给出设备调机具体医疗参数、宣称训练必然产生临床疗效 的功能或文案。禁止把工程指标当临床指标。
[隐私] 用户健康信息、语音数据、人工耳蜗相关个人信息一律视为敏感数据。严格区分：A 公共知识库 / B 康复训练内容库 / C 产品规则 / D 用户个人数据；D 禁止混入公共知识向量库。遵循数据最小化、授权、访问控制、日志脱敏、数据隔离、删除路径、导出路径、审计要求。
[Git 安全] 禁止：git push、git push --force、git reset --hard、git clean、git checkout -- .、git restore .、merge 到 main/master、发布 release、删除或覆盖用户已有修改。本 Workflow 只负责本地实现、本地验证、输出报告。
[Secret 安全] 禁止读取/输出真实 API Key 或 .env 中的 Secret、禁止提交 Production Secret、禁止硬编码数据库密码、禁止修改生产数据库、禁止执行生产删除操作。测试需要 secret 时使用 mock / test env / 已有安全测试配置；无法安全运行时报告 BLOCKED_MISSING_SAFE_TEST_ENV。
[Context 纪律] 先 search/grep/glob 定位，再按需读取文件；禁止一上来把整个仓库读入上下文。
`

const MAX_RULES = `
你是 Qwen3.8-Max（架构师 + 项目经理 + 验收官）。
- 只输出有明确证据的结构化结论；禁止"基本通过 / 看起来可以 / 建议以后优化 / 应该没问题"这类模糊结论。
- 程序员不能验收自己：实现质量由客观命令（退出码）与你的独立审查共同裁决。
- 你是只读决策者时，禁止 Write/Edit/创建/删除任何文件。
`

// FLASH_ONLY 降级模式下承担【规划/探索/审查/验收/RCA】决策角色的独立 invocation 行为准则。
// 关键点：角色分离靠【独立 agent() 调用】保证，而不是靠模型；绝不因为"只有 Flash"而降低任何门禁、
// 把 required 降级为 record、放宽测试或对本任务的实现自我验收。FULL 模式下 decisionRules() 返回原始 MAX_RULES。
const FLASH_ONLY_DECISION_RULES = `
你在 FLASH_ONLY_DEGRADED_MODE 下运行：当前由 qfmodel (Qwen3.8-Flash) 承担【规划/探索/审查/验收/RCA/快照】职责（原由 Qwen3.8-Max 承担）。
- 你是一次【独立 invocation】：与实施代码的 Worker 是不同的调用；你不得因为参与同一任务而放松标准，也不得替实现者背书。
- 只输出有明确证据的结构化结论；禁止"基本通过 / 看起来可以 / 建议以后优化 / 应该没问题"。
- 程序员不能验收自己：实现质量由客观命令（真实 exitCode）与独立 Review/Verify 共同裁决。
- 你处于只读决策角色时：禁止 Write/Edit/创建/删除任何文件，禁止修改 TASK_SPEC / 验收标准 / 架构 / 安全规则 / 医疗边界 / 治理文件 / Workflow 本体。
- 严禁为了"能过"而降低门禁：不得把 required 改成 record、不得删/skip/放宽测试、不得放松 lint/typecheck/build、不得无视 Scope/治理/pre-existing 边界。
- 若发现需要真实人工审批的事项（医疗专家验证 / 患者数据授权 / 伦理审查 / 版权许可 / 生产密钥 / 生产库危险操作 / 正式发布部署 / 支付 / 验证码 / 法务），必须标 humanDecisionRequired=true 交人工，绝不代为批准。
`
function decisionRules() { return EXECUTION_MODE === 'FLASH_ONLY' ? FLASH_ONLY_DECISION_RULES : MAX_RULES }

const FLASH_RULES = `
你是 Qwen3.8-Flash（程序员/实施者）。权限与禁令：
- 严格且仅按 TASK_SPEC / FIX_SPEC 实施。禁止修改 TASK_SPEC、验收标准、架构、安全规则、医疗边界、Workflow 自身、项目治理规则。
- 治理文件绝对禁区（任何情况下禁止创建/修改/删除）：AGENTS.md、.qoder/rules/**、.qoder/workflows/**、.qoder/workflow-state/**（包括 *.spec.json 任务合同文件）、.gitignore、.github/**。
- 禁止扩大 Scope、修改无关文件、顺手重构、顺手升级依赖、顺手修 unrelated warning、顺手改 UI。
- 禁止删除测试、注释测试、skip 测试、降低测试标准、catch exception 后静默忽略、硬编码 secret 或生产密码。
- 禁止调用其他 Agent、禁止调用其他模型。
- 如果 TASK_SPEC 与真实代码冲突：立即停止，返回 status=SPEC_CONFLICT，包含 conflict / evidence / affectedFiles / recommendedDecision。不要自行改变设计。
- IMPLEMENTED 不等于 PASS；验收由 Machine Gate 与 Max Review 决定，你无权宣布 PASS。
`

// ============================================================
// 治理修复 D2（Governance Fix D2）
//   D2-A：禁止 Self-Repair / RCA-Fix / Review-Fix 执行破坏性 Git（丢弃工作区/历史）。
//   D2-B：禁止 Flash 触碰治理保护文件（Write/Edit/创建/删除）。
//   D2-C：Scope / Machine Gate 基于 Task Delta（WORKTREE_BASELINE vs 当前快照）判定，
//         不把任务前已存在的授权改动误判为本任务改动（消除 M0-001 事件的根因）。
//
// 能力说明（如实披露，见最终报告 KNOWN_LIMITATIONS）：当前 Qoder CN Workflow 运行时只向脚本
//   暴露 agent / parallel / pipeline / phase / log / budget / workflow，没有 PreToolUse /
//   Bash 拦截 / 工具权限过滤 等“工具层硬阻断”钩子，脚本无法在 Flash 真正执行 shell 之前拦下单条命令。
//   因此 D2 采用多层防御（§6）：① 提示词硬禁令（FLASH_REPAIR_RULES）；② 编排器预检
//   （SELF_REPAIR_ELIGIBILITY / REPAIR_SCOPE，root cause 属 pre-existing/governance/external 时
//   绝不启动 Flash）；③ 命令 denylist（对执行手自报 gitCommandsRun[] 做 bypass 感知扫描）；
//   ④ 动作后指纹校验（Max 只读工作区快照 baseline↔post 对比，检测治理/pre-existing/HEAD/index 变动）；
//   ⑤ 任一层命中 → 立即 BLOCK（GOVERNANCE_POLICY_VIOLATION / BLOCKED_GOVERNANCE_CONFLICT /
//   BLOCKED_EXTERNAL_WORKTREE_CHANGE / BLOCKED_GIT_HISTORY_MUTATED / BLOCKED_GIT_INDEX_MUTATED /
//   BLOCKED_REPAIR_OUT_OF_SCOPE）。层④基于“效果”检测，即使某破坏性命令绕过层③的自报，
//   其对治理文件/pre-existing 文件/HEAD/index 的实际影响仍会被指纹对比捕获。
// ============================================================
const GOVERNANCE_PROTECTED_PATHS = [
  'agents.md',
  '.qoder/rules/', '.qoder/workflows/', '.qoder/workflow-state/',
  '.gitignore', '.github/',
  'docs/workflow/',
]
const SELF_WORKFLOW_PATH = '.qoder/workflows/project-feature-delivery.js'

// 破坏性“丢弃工作区/历史”类子命令（HARD DENY，§8）
const GIT_HARD_DENY_SUBCOMMANDS = ['checkout', 'restore', 'reset', 'clean', 'stash', 'revert']
// 广义变更 index/history/remote 类子命令（Flash 默认全禁，§7）
const GIT_MUTATING_SUBCOMMANDS = ['commit', 'add', 'rm', 'mv', 'apply', 'am', 'push', 'pull', 'fetch', 'merge', 'rebase', 'cherry-pick', 'switch']

function normPath(p) { return String(p == null ? '' : p).replace(/\\/g, '/').replace(/^\.\//, '').trim() }

function isGovernancePath(p) {
  const n = normPath(p).toLowerCase()
  if (!n) return false
  if (n === SELF_WORKFLOW_PATH) return true
  for (const g of GOVERNANCE_PROTECTED_PATHS) {
    if (g.endsWith('/')) { if (n === g.slice(0, -1) || n.startsWith(g)) return true }
    else if (n === g) return true
  }
  return false
}

// ============================================================
// 治理修复 D4（Governance Fix D4）— 确定性字节指纹 + 同任务重试产物归属
//
// 根因（M0-003 事件，人工取证 + 本轮复算）：D2-C 的 fingerprint 由 LLM agent 自行执行命令生成
//   （prompt 写的是 `git hash-object` → 40-hex 的 git blob SHA-1）。本轮实测：
//     git hash-object --no-filters graph.json  = e88c0295861951c58b55028eae611218e1f15089  ← baseline 自报值
//     git hash-object --no-filters index.html  = cde38f82a5404a2dab46dbda86aa5e070545a676  ← baseline 自报值
//   即 baseline 快照是【真实执行了 git hash-object】；而 post-Implement 快照返回 6c4d0d0e…/e4b3f8e9…，
//   既不等于 git blob SHA-1，也不等于字节的 sha1（f9660d0f…）或 md5（2fe742d8…）→ 两次快照的
//   【摘要算法/来源不一致】（一次真跑 git hash-object，一次换成别的/臆造），脚本却对字符串直接 != 比较，
//   于是字节完全未变的 pre-existing 文件被判为 EXTERNAL_CHANGED_DURING_TASK → 假阳性 BLOCK。
//   结论：LLM 生成的 fingerprint 不是确定性证据；且"40-hex 当 hash 用"从未被格式校验拦下。
//   D4 把内容身份的权威从 LLM_SNAPSHOT_REPORT 换成 DETERMINISTIC_BYTE_HASH。
//
// 运行时能力实测（2026-10-07，零 agent 探针 gov-d4-runtime-probe / run wf_bd7e692e-109）：
//   脚本沙箱 globalsList 内【没有】require / process / Buffer / crypto / TextEncoder / fs，
//   dynamic-import 被工具层直接拒绝（工具原文报错 "dynamic import is unavailable in workflow scripts"）
//   → 脚本无法自己读文件字节做哈希，SCRIPT_SIDE 方案不可用。
//   因此进入正式 DETERMINISTIC_EXECUTOR_FALLBACK（§11–§22），确定性由以下机制保证：
//     ① 命令【由脚本生成并逐字下发】，执行手无权选择哈希工具（git hash-object 被禁）；
//     ② 执行手只负责"跑命令 + 原样回传 rawStdout"，不得总结/改写/推断任何 hash；
//     ③ 脚本自己解析并校验 rawStdout：sha256 必须 64 位小写 hex、md5 32 hex、size 非负整数、
//        路径必须 canonical、命令必须逐字一致、执行手必须零写入；
//     ④ 内容身份【只认 sha256】；size/md5 仅佐证，mtime 完全不采集（结构性排除）；
//     ⑤ 首次 hash 不一致不再立即 BLOCK，先 FINGERPRINT_ADJUDICATION（两个独立 rehash invocation）；
//     ⑥ 未通过校验的证据一律不得参与 Task Delta。
//   实测可用的确定性命令：/usr/bin/sha256sum（Git Bash coreutils，输出恰为 64 位小写 hex）。
// ============================================================
// ============================================================
// FIX-GOV-008（D4-2）：取证命令与门禁命令都自带 argv 身份回显（A 行 / Q 行），脚本侧逐字符复核。
//   协议行：V 协议版本 / A 包装器 argv 自回显 / H HEAD / B 分支 / F 文件 / E 目录树单元 / t 树成员 / X 路径已消失 / '#' 注释。
//   D4-1 → D4-2 的差别只多两行自回显（V/A 与 Q），能力边界事实一字未改：脚本仍不能自读文件字节。
// ============================================================
const FP_PROTOCOL = 'D4-2'
const FP_SHA256_RE = /^[0-9a-f]{64}$/
const FP_MD5_RE = /^[0-9a-f]{32}$/
const FP_HEX40_RE = /^[0-9a-f]{40}$/
const CONTENT_IDENTITY_AUTHORITY = 'DETERMINISTIC_BYTE_HASH'
const FINGERPRINT_BACKEND = 'AGENT_EXECUTOR_FALLBACK'
const FINGERPRINT_BACKEND_EVIDENCE = 'workflow sandbox probe (wf_bd7e692e-109): typeof require/process/Buffer/crypto/TextEncoder/fs 全为 undefined，globalsList 无 fs 相关 API，dynamic-import 被工具层拒绝 → 脚本无法读文件字节；故 byte identity 由"脚本生成固定命令 + 执行手原样回传 rawStdout + 脚本侧解析校验"获得。'
const SCRIPT_SIDE_HASH_AVAILABLE = false
let FP_REPO_ROOT = ''
let FP_EVIDENCE_RUNS = []
let FP_INVALID_DETECTED = []
let FP_FALSE_POSITIVES_RECOVERED = []
let ADJUDICATION_LOG = []
let adjudicationCount = 0
let RETRY_OF_TASK_ID = ''
let RETRY_ARTIFACTS = []

// 统一路径规范（§8）：消除 Windows 分隔符/相对前缀/重复分隔符造成的假 Delta；仓库 root-relative 唯一 key。
function canonicalPath(p) {
  let s = String(p == null ? '' : p).trim().replace(/\\/g, '/').replace(/^\.\//, '')
  s = s.replace(/\/{2,}/g, '/')
  while (s.charAt(0) === '/') s = s.slice(1)
  if (s.length > 1 && s.charAt(s.length - 1) === '/') s = s.slice(0, -1)
  return s
}
// 任务身份（§27 A/B）：spec 落盘名可能带 git 短 SHA 后缀（m0-003-...-00599c1），归属比较用 catalog 身份。
function taskIdentityOf(id) {
  return String(id == null ? '' : id).trim().toLowerCase().replace(/\\/g, '/').replace(/^[./]+/, '').replace(/-[0-9a-f]{7,8}$/, '')
}
// ============================================================
// FIX-GOV-008 D1：脚本侧纯 JS RFC4648 base64 编码器/解码器（argv 自回显互证唯一依赖的计算件）。
// 事实边界：本脚本沙箱【没有】自读文件字节的能力（SCRIPT_SIDE_HASH_AVAILABLE 仍为 false），
// 这里只对"脚本自己拼出来的字符串"做纯计算：不触碰任何文件、不使用任何平台编码 API、不引入任何外部能力。
// 输入域严格限定 ASCII（每字符恰 1 字节 ⇒ 字符数 == 字节数，与 bash ${#B} 在同一取值上自洽）；
// 含非 ASCII 时编码器返回 null（fail-closed），绝不做有损近似、绝不"看起来差不多"就放行。
// 实现方式：自实现查表 + 位运算 + '=' 补位（解码侧同样自实现，用于独立复核"b64 解码逐字符等于原文"）。
// ============================================================
const B64_ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
function isAsciiText(s) {
  const t = String(s == null ? '' : s)
  for (let i = 0; i < t.length; i++) if (t.charCodeAt(i) > 127) return false
  return true
}
function base64EncodeAscii(s) {
  const t = String(s == null ? '' : s)
  if (!isAsciiText(t)) return null
  let out = ''
  for (let i = 0; i < t.length; i += 3) {
    const c0 = t.charCodeAt(i)
    const has1 = i + 1 < t.length
    const has2 = i + 2 < t.length
    const c1 = has1 ? t.charCodeAt(i + 1) : 0
    const c2 = has2 ? t.charCodeAt(i + 2) : 0
    out += B64_ALPHA.charAt(c0 >> 2)
    if (!has1) return out + B64_ALPHA.charAt((c0 & 3) << 4) + '=='
    out += B64_ALPHA.charAt(((c0 & 3) << 4) | (c1 >> 4))
    if (!has2) return out + B64_ALPHA.charAt((c1 & 15) << 2) + '='
    out += B64_ALPHA.charAt(((c1 & 15) << 2) | (c2 >> 6))
    out += B64_ALPHA.charAt(c2 & 63)
  }
  return out
}
function base64DecodeAscii(s) {
  const t = String(s == null ? '' : s)
  if (!t.length) return ''
  if (t.length % 4 !== 0) return null
  let pad = 0
  if (t.charAt(t.length - 1) === '=') { pad = 1; if (t.charAt(t.length - 2) === '=') pad = 2 }
  if (pad > 0 && t.indexOf('=') !== t.length - pad) return null // '=' 只允许出现在末尾
  let acc = 0
  let bits = 0
  let out = ''
  const lim = t.length - pad
  for (let i = 0; i < lim; i++) {
    const v = B64_ALPHA.indexOf(t.charAt(i))
    if (v < 0) return null
    acc = (acc << 6) | v
    bits += 6
    if (bits >= 8) { bits -= 8; out += String.fromCharCode((acc >> bits) & 255) }
  }
  if (out.length !== (t.length / 4) * 3 - pad) return null
  if (bits !== 0 && (acc & ((1 << bits) - 1)) !== 0) return null // 非规范的补位残值
  if (!isAsciiText(out)) return null
  return out
}
// 从"脚本自己下发的五行包装命令"里取回 argv 回显所覆盖的 payload 原文（B='…' 单引号字面量）。
// 单引号字面量内不可能出现裸 '，唯一合法出现是 '\'' 转义 ⇒ 逐字符扫描即可无歧义还原。
function argvPayloadFromCommand(cmd) {
  const all = String(cmd == null ? '' : cmd).split('\n')
  let at = -1
  for (let i = 0; i < all.length; i++) { if (all[i].indexOf("B='") === 0) { at = i; break } }
  if (at < 0) return null
  const s = all.slice(at).join('\n').slice(3)
  let out = ''
  for (let i = 0; i < s.length;) {
    const ch = s.charAt(i)
    if (ch === "'") {
      if (s.slice(i, i + 4) === "'\\''") { out += "'"; i += 4; continue }
      return out // 闭引号：payload 到此结束
    }
    out += ch
    i++
  }
  return null // 引号未闭合：包装器被改写，无法确定 payload
}
// 确定性指纹命令：脚本生成、逐字下发；git 只读 + sha256sum/md5sum/wc/find/LC_ALL=C sort。
// D4-2 五行形态：cd / B='<payload>' / printf V / printf A / eval "$B"。
// payload = body（【不含 cd 行】：本仓库根含中文，cd 行入 payload 会让所有派发立刻非 ASCII）；
// A 行由命令自身用 GNU base64 算出，脚本侧用 D1 编码器算出期望值并逐字符复核 —— 两条独立实现互证。
function fingerprintBody() {
  return [
    "printf 'V|" + FP_PROTOCOL + "\\n'",
    "printf 'H|%s\\n' \"$(git rev-parse HEAD)\"",
    "printf 'B|%s\\n' \"$(git branch --show-current)\"",
    "git -c core.quotepath=false status --porcelain=v1 --untracked-files=normal | while IFS= read -r L",
    'do',
    '  XY=${L:0:2}',
    '  P=${L:3}',
    "  case \"$P\" in *' -> ') P=${P##* -> };; esac",
    '  if [ -d \"$P\" ]',
    '  then',
    "    M=$(find \"$P\" -type f -print | LC_ALL=C sort | while IFS= read -r f; do printf '%s\\t%s\\t%s\\t%s\\n' \"$f\" \"$(wc -c <\"$f\" | tr -d ' ')\" \"$(sha256sum <\"$f\" | cut -d' ' -f1)\" \"$(md5sum <\"$f\" | cut -d' ' -f1)\"; done)",
    "    printf 'E|%s|%s|%s\\n' \"$P\" \"$(printf '%s' \"$M\" | grep -c '')\" \"$(printf '%s' \"$M\" | sha256sum | cut -d' ' -f1)\"",
    "    printf '%s\\n' \"$M\" | while IFS=$(printf '\\t') read -r a b c d; do printf 't|%s|%s|%s|%s\\n' \"$a\" \"$b\" \"$c\" \"$d\"; done",
    '  elif [ -f \"$P\" ]',
    '  then',
    "    printf 'F|%s|%s|%s|%s|%s\\n' \"$XY\" \"$P\" \"$(wc -c <\"$P\" | tr -d ' ')\" \"$(sha256sum <\"$P\" | cut -d' ' -f1)\" \"$(md5sum <\"$P\" | cut -d' ' -f1)\"",
    '  else',
    "    printf 'X|%s|%s\\n' \"$XY\" \"$P\"",
    '  fi',
    'done',
  ]
}
function fingerprintArgvPayload() { return fingerprintBody().join('\n') }
function buildFingerprintCommand(root) {
  const q = String(root == null ? '.' : root).replace(/'/g, "'\\''")
  const payload = fingerprintArgvPayload()
  return [
    "cd '" + q + "'",
    "B='" + payload.replace(/'/g, "'\\''") + "'",
    "printf 'V|" + FP_PROTOCOL + "\\n'",
    "printf 'A|%s|%s\\n' \"${#B}\" \"$(printf %s \"$B\" | base64 | tr -d '\\n')\"",
    'eval "$B"',
  ].join('\n')
}

// 脚本侧确定性证据解析 + 校验（§15/§22）。任何未通过校验的证据都不得参与 Task Delta。
function parseFingerprintEvidence(ex, pinnedCommand) {
  const problems = []
  const out = {
    evidenceKind: CONTENT_IDENTITY_AUTHORITY, backend: FINGERPRINT_BACKEND, evidenceValid: false,
    protocol: '', head: '', branch: '', files: {}, trees: {}, missing: [],
    staged: [], trackedModified: [], trackedDeleted: [], untracked: [], fingerprints: [],
    problems, rawLineCount: 0, commandVerbatim: false,
  }
  if (!ex || typeof ex !== 'object') { problems.push('FINGERPRINT_EVIDENCE_INVALID:NO_EXECUTOR_EVIDENCE'); return out }
  const norm = (s) => String(s == null ? '' : s).replace(/\r/g, '').replace(/[ \t]+$/gm, '').trim()
  out.commandVerbatim = norm(ex.command) === norm(pinnedCommand)
  if (!out.commandVerbatim) problems.push('FINGERPRINT_EVIDENCE_INVALID:COMMAND_NOT_VERBATIM（执行手改写了脚本下发的命令，摘要来源不可信）')
  if (ex.exitCode !== 0) problems.push('FINGERPRINT_EVIDENCE_INVALID:EXECUTOR_EXIT_NONZERO:' + String(ex.exitCode))
  if (Array.isArray(ex.filesWritten) && ex.filesWritten.length) problems.push('GOVERNANCE_POLICY_VIOLATION:FINGERPRINT_EXECUTOR_WROTE_FILES:' + ex.filesWritten.map(canonicalPath).join(','))
  // 执行手必须只跑脚本下发的那一条命令：任何自报的额外 git 命令按 denylist 判定（D2 保护不降级）。
  for (const c of (Array.isArray(ex.gitCommandsRun) ? ex.gitCommandsRun : [])) {
    const d = detectForbiddenGit(c)
    if (d) problems.push('GOVERNANCE_POLICY_VIOLATION:FINGERPRINT_EXECUTOR_FORBIDDEN_GIT:' + d.tier + ':' + String(c).slice(0, 80))
    const u = scanUnsafeDbCommand(c)
    if (u) problems.push(u.code + ':' + String(c).slice(0, 80))
  }
  // '#' 开头的行是注释（mtime 等诊断信息只能走注释，解析器一律忽略，绝不参与内容身份）。
  const lines = norm(ex.rawStdout).split('\n').map((l) => l.trim()).filter((l) => l.length && l.charAt(0) !== '#')
  out.rawLineCount = lines.length
  if (!lines.length) problems.push('FINGERPRINT_EVIDENCE_INVALID:EMPTY_STDOUT')
  if (lines.length && lines[0] !== 'V|' + FP_PROTOCOL) problems.push('FINGERPRINT_EVIDENCE_INVALID:PROTOCOL_MISMATCH:' + String(lines[0]).slice(0, 24))
  if (lines.length) out.protocol = String(lines[0]).slice(2)
  // ---- FIX-GOV-008 D2：argv 自回显（A 行）严格校验，独立于上面的宽松 norm ----
  // 上面 :307/:319 的 norm 会 trim 每行、剥行尾空白并 trim 整体 —— 那正是本批要堵住的盲区，
  // 故 A 行绝不从 lines 取，另起一条严格解析路径：只剥 \r，只剥整体末尾的一个换行，其余逐字符比较。
  const strictRaw = String(ex.rawStdout == null ? '' : ex.rawStdout).replace(/\r/g, '')
  const strictLines = (strictRaw.length && strictRaw.charAt(strictRaw.length - 1) === '\n' ? strictRaw.slice(0, -1) : strictRaw).split('\n')
  const aIdx = []
  for (let i = 0; i < strictLines.length; i++) { const tag = strictLines[i].split('|')[0]; if (tag === 'A') aIdx.push(i) }
  const argvPayload = argvPayloadFromCommand(pinnedCommand)
  if (argvPayload === null) {
    problems.push('FINGERPRINT_EVIDENCE_INVALID:ARGV_PAYLOAD_UNPARSEABLE（脚本下发的命令里取不到 B= 单引号 payload，argv 基准无法确定）')
  } else if (!isAsciiText(argvPayload)) {
    problems.push('FINGERPRINT_EVIDENCE_INVALID:PAYLOAD_NONASCII（argv 回显只覆盖 ASCII 字节域，非 ASCII payload 一律不可信）')
  } else {
    const expectedA = 'A|' + argvPayload.length + '|' + base64EncodeAscii(argvPayload)
    // 逐字符等于期望值，已同时蕴含"长度字段与 ${#B} 自洽"与"解码结果逐字符等于脚本持有的 payload"；
    // 命中后再独立解码复核一次（两条实现互相牵制，任一方漂移都会立刻失配），仍属 fail-closed。
    if (aIdx.length !== 1 || aIdx[0] !== 1) {
      problems.push('FINGERPRINT_EVIDENCE_INVALID:ARGV_ECHO_MISSING（A 行必须恰好一条且紧跟第一个 V 行，实测命中位置=' + JSON.stringify(aIdx.slice(0, 4)) + '）')
    } else if (strictLines[1] !== expectedA) {
      const squash = (t) => String(t).replace(/\s+/g, '')
      problems.push('FINGERPRINT_EVIDENCE_INVALID:ARGV_NOT_VERBATIM:' + (squash(strictLines[1]) === squash(expectedA) ? 'WHITESPACE' : 'CONTENT'))
    } else {
      const f = strictLines[1].split('|')
      const dec = base64DecodeAscii(f[2])
      if (f.length !== 3 || f[0] !== 'A' || !/^[0-9]+$/.test(f[1]) || Number(f[1]) !== argvPayload.length || dec !== argvPayload) problems.push('FINGERPRINT_EVIDENCE_INVALID:ARGV_NOT_VERBATIM:SELF_INCONSISTENT')
    }
  }
  const seen = {}
  const members = []
  for (const l of lines) {
    const f = l.split('|')
    const tag = f[0]
    if (tag === 'V') continue // 协议头已在上面逐字校验（V|D4-2），不参与逐行语义解析；包装器与 body 各打印一条 V，都属预期重复。
    if (tag === 'A') continue // argv 自回显走上面的严格校验路径（逐字符），绝不在此处放宽
    if (tag === 'H') {
      out.head = String(f[1] || '')
      if (!FP_HEX40_RE.test(out.head)) problems.push('FINGERPRINT_EVIDENCE_INVALID:HEAD_NOT_40HEX:' + out.head.slice(0, 12))
    } else if (tag === 'B') {
      out.branch = String(f[1] || '')
      if (!out.branch) problems.push('FINGERPRINT_EVIDENCE_INVALID:MISSING_BRANCH')
    } else if (tag === 'F' || tag === 'X') {
      const xy = String(f[1] || '')
      const raw = String(f[2] == null ? '' : f[2])
      const p = canonicalPath(raw)
      if (!p) { problems.push('FINGERPRINT_EVIDENCE_INVALID:EMPTY_PATH'); continue }
      if (/[\\%]|\.\.\/|^\//.test(raw) || raw !== p) problems.push('PATH_NOT_CANONICAL:' + raw)
      if (seen[p]) problems.push('DUPLICATE_PATH_IN_EVIDENCE:' + p)
      seen[p] = 1
      if (xy.length !== 2) problems.push('PORCELAIN_XY_INVALID:' + p + ':' + xy)
      const worktree = xy.charAt(1)
      if (xy === '??') out.untracked.push(p)
      else {
        if (xy.charAt(0) !== ' ') out.staged.push(p)
        if (worktree === 'D') out.trackedDeleted.push(p)
        else if (worktree === 'M' || worktree === 'A' || worktree === 'R' || worktree === 'T' || worktree === 'U') out.trackedModified.push(p)
      }
      if (tag === 'X') { out.missing.push(p); continue }
      const size = Number(f[3])
      const sha = String(f[4] == null ? '' : f[4]).toLowerCase()
      const md5 = String(f[5] == null ? '' : f[5]).toLowerCase()
      if (!FP_SHA256_RE.test(sha)) {
        if (FP_HEX40_RE.test(sha)) problems.push('FINGERPRINT_EVIDENCE_INVALID:DIGEST_IS_40HEX_GIT_BLOB_SHA1（M0-003 根因形态，必须 64 位 SHA-256）:' + p)
        else if (!sha) problems.push('FINGERPRINT_EVIDENCE_INVALID:EMPTY_SHA256:' + p)
        else problems.push('FINGERPRINT_EVIDENCE_INVALID:SHA256_NOT_64_LOWERCASE_HEX:' + p + ':' + sha.slice(0, 12))
      }
      if (!FP_MD5_RE.test(md5)) problems.push('FINGERPRINT_EVIDENCE_INVALID:MD5_NOT_32HEX:' + p + ':' + md5.slice(0, 12))
      if (!Number.isInteger(size) || size < 0) problems.push('FINGERPRINT_EVIDENCE_INVALID:SIZE_NOT_NONNEGATIVE_INT:' + p + ':' + String(f[3]))
      out.files[p] = { path: p, kind: xy, size, sha256: sha, md5 }
      out.fingerprints.push({ path: p, size, sha256: sha })
    } else if (tag === 'E') {
      const p = canonicalPath(f[1])
      const n = Number(f[2])
      const sha = String(f[3] == null ? '' : f[3]).toLowerCase()
      if (!p) { problems.push('FINGERPRINT_EVIDENCE_INVALID:EMPTY_DIR_PATH'); continue }
      if (seen[p]) problems.push('DUPLICATE_PATH_IN_EVIDENCE:' + p)
      seen[p] = 1
      if (!FP_SHA256_RE.test(sha)) problems.push('FINGERPRINT_EVIDENCE_INVALID:TREE_SHA256_NOT_64HEX:' + p + ':' + sha.slice(0, 12))
      if (!Number.isInteger(n) || n < 0) problems.push('FINGERPRINT_EVIDENCE_INVALID:TREE_FILECOUNT_NOT_INT:' + p + ':' + String(f[2]))
      out.trees[p] = { path: p, dir: true, fileCount: n, treeSha256: sha, files: {} }
      out.untracked.push(p)
    } else if (tag === 't') {
      const p = canonicalPath(f[1])
      const size = Number(f[2])
      const sha = String(f[3] == null ? '' : f[3]).toLowerCase()
      const md5 = String(f[4] == null ? '' : f[4]).toLowerCase()
      if (!p) { problems.push('FINGERPRINT_EVIDENCE_INVALID:EMPTY_MEMBER_PATH'); continue }
      if (!FP_SHA256_RE.test(sha)) problems.push('FINGERPRINT_EVIDENCE_INVALID:MEMBER_SHA256_NOT_64HEX:' + p + ':' + sha.slice(0, 12))
      if (!FP_MD5_RE.test(md5)) problems.push('FINGERPRINT_EVIDENCE_INVALID:MEMBER_MD5_NOT_32HEX:' + p)
      if (!Number.isInteger(size) || size < 0) problems.push('FINGERPRINT_EVIDENCE_INVALID:MEMBER_SIZE_INVALID:' + p)
      members.push({ path: p, size, sha256: sha, md5 })
    } else {
      problems.push('FINGERPRINT_EVIDENCE_INVALID:UNRECOGNISED_LINE:' + l.slice(0, 32))
    }
  }
  // 目录单元自洽性（§7/§25）：tree 成员归属 + fileCount 必须与 manifest 行数一致，否则证据不可信。
  for (const m of members) {
    let owner = ''
    for (const d of Object.keys(out.trees)) if (m.path === d || m.path.indexOf(d + '/') === 0) { if (d.length > owner.length) owner = d }
    if (!owner) { problems.push('TREE_MEMBER_WITHOUT_UNIT:' + m.path); continue }
    out.trees[owner].files[m.path] = m
    out.fingerprints.push({ path: m.path, size: m.size, sha256: m.sha256, tree: owner })
  }
  for (const d of Object.keys(out.trees)) {
    const t = out.trees[d]
    if (Object.keys(t.files).length !== t.fileCount) problems.push('TREE_FILECOUNT_MISMATCH:' + d + ':declared=' + t.fileCount + ',observed=' + Object.keys(t.files).length)
    if (!Object.keys(t.files).length) problems.push('TREE_EMPTY:' + d)
  }
  out.evidenceValid = problems.length === 0
  if (!out.evidenceValid) FP_INVALID_DETECTED = FP_INVALID_DETECTED.concat(problems.slice(0, 12))
  return out
}

function isVerifiedEvidence(s) { return !!(s && s.evidenceKind === CONTENT_IDENTITY_AUTHORITY && s.evidenceValid === true) }
function evidenceStatusOf(s) {
  if (!s) return 'MODEL_UNAVAILABLE'
  return isVerifiedEvidence(s) ? 'VALID_DETERMINISTIC' : ('INVALID:' + ((s.problems || []).slice(0, 2).join('/') || 'UNVERIFIED'))
}
// 内容身份映射（§6/§22）：文件=sha256；目录单元='tree:'+treeSha256；消失='ABSENT'。不含 mtime。
function identityMap(s) {
  const m = {}
  if (!s) return m
  for (const p of Object.keys(s.files || {})) m[p] = s.files[p].sha256
  for (const p of Object.keys(s.trees || {})) m[p] = 'tree:' + s.trees[p].treeSha256
  for (const p of (s.missing || [])) m[p] = 'ABSENT'
  return m
}
function dirtyPaths(snap) {
  const s = new Set()
  if (!snap) return s
  for (const k of ['trackedModified', 'trackedDeleted', 'untracked', 'staged']) for (const p of (snap[k] || [])) s.add(canonicalPath(p))
  for (const p of Object.keys(snap.files || {})) s.add(p)
  for (const p of Object.keys(snap.trees || {})) s.add(p)
  for (const p of (snap.missing || [])) s.add(p)
  return s
}
// §25：pre-existing 目录单元内新增/删除的文件，不得被误算成"本任务新增"，须由目录树单元判定归属。
function preExistingTreeOwning(baseline, p) {
  let owner = ''
  for (const d of Object.keys((baseline && baseline.trees) || {})) if (p.indexOf(d + '/') === 0 && d.length > owner.length) owner = d
  return owner
}

// ---------- 同任务重试产物归属（§26–§30）----------
// RETRY_OWNED[path] = { priorRunSha256, evidence } —— 只有全部满足 §27 A–F 且通过 §28 外部改动校验才登记。
let RETRY_OWNED = {}
let RETRY_OWNERSHIP = { retryOf: null, currentTaskIdentity: null, artifacts: [], accepted: [], rejected: [], status: 'NOT_A_RETRY' }
let TASK_WRITE_PREFIXES = []

function writePathAuthorized(p) {
  for (const w of TASK_WRITE_PREFIXES) { if (!w) continue; if (p === w || p.indexOf(w.replace(/\/$/, '') + '/') === 0 || (w.indexOf('*') >= 0 && p.indexOf(w.split('*')[0].replace(/\/$/, '')) === 0)) return true }
  return false
}

function applyRetryOwnership(specObj, baselineSnap) {
  const retryOf = taskIdentityOf(RETRY_OF_TASK_ID)
  const current = taskIdentityOf(specObj && specObj.TASK_ID)
  RETRY_OWNERSHIP.currentTaskIdentity = current
  RETRY_OWNERSHIP.retryOf = RETRY_OF_TASK_ID || null
  // §25：本任务授权写路径前缀在普通任务里也要生效（决定 pre-existing 目录单元内的新增文件归属任务还是归属外部）。
  const expected0 = canonicalPathList((specObj && specObj.EXPECTED_FILES) || [])
  TASK_WRITE_PREFIXES = canonicalPathList((specObj && specObj.ALLOWED_WRITE_PATHS) || expected0)
  RETRY_OWNERSHIP.status = 'NOT_A_RETRY'
  RETRY_OWNERSHIP.artifacts = []
  RETRY_OWNERSHIP.accepted = []
  RETRY_OWNERSHIP.rejected = []
  if (!retryOf) { RETRY_OWNED = {}; return RETRY_OWNERSHIP }
  RETRY_OWNERSHIP.status = 'RETRY_CONTEXT_PROVIDED'
  const expected = expected0
  RETRY_OWNED = {}
  const idB = identityMap(baselineSnap)
  for (const a of (RETRY_ARTIFACTS || [])) {
    const p = canonicalPath(a && a.path)
    const rec = { path: p, retryOf, currentTaskId: current }
    if (!p) { rec.reject = 'EMPTY_PATH'; RETRY_OWNERSHIP.rejected.push(rec); continue }
    if (retryOf !== current) { rec.reject = 'TASK_ID_MISMATCH（上一 run 任务与当前任务不同，不得继承归属）'; RETRY_OWNERSHIP.rejected.push(rec); continue }
    if (isGovernancePath(p)) { rec.reject = 'GOVERNANCE_PROTECTED（治理文件即使任务号相同也不得 retry-owned）'; RETRY_OWNERSHIP.rejected.push(rec); continue }
    const inCur = expected.indexOf(p) >= 0 || writePathAuthorized(p)
    if (!inCur) { rec.reject = 'NOT_IN_CURRENT_TASK_SPEC_ALLOWLIST'; RETRY_OWNERSHIP.rejected.push(rec); continue }
    if (a.priorSpecExpected !== true) { rec.reject = 'NO_PRIOR_SPEC_MEMBERSHIP_EVIDENCE（C 条：上一 run TASK_SPEC 归属证据缺失）'; RETRY_OWNERSHIP.rejected.push(rec); continue }
    if (!FP_SHA256_RE.test(String(a.priorRunSha256 || '').toLowerCase())) { rec.reject = 'PRIOR_RUN_SHA256_NOT_64HEX（spec.json/runtime 记录只能佐证，不能替代字节证据）'; RETRY_OWNERSHIP.rejected.push(rec); continue }
    const prov = String(a.priorRunWorkerEvidence || '').trim()
    if (prov.length < 8) { rec.reject = 'NO_PRIOR_RUN_MANIFEST_OR_JOURNAL_EVIDENCE（F 条：无该路径由上一 run Worker 创建/修改的证据）'; RETRY_OWNERSHIP.rejected.push(rec); continue }
    const now = idB[p]
    const prior = String(a.priorRunSha256).toLowerCase()
    if (!isVerifiedEvidence(baselineSnap)) { rec.reject = 'BASELINE_EVIDENCE_UNVERIFIED（无法用确定性字节证据核对上一 run 产物）'; RETRY_OWNERSHIP.rejected.push(rec); continue }
    if (now === undefined) { rec.reject = 'ARTIFACT_ABSENT_AT_RETRY_START'; RETRY_OWNERSHIP.rejected.push(rec); continue }
    if (now !== prior) { rec.reject = 'BLOCKED_RETRY_ARTIFACT_CHANGED_EXTERNALLY'; rec.detail = '上一 run 产物在两次 run 之间被外部修改：LAST_TASK_OUTPUT_HASH=' + prior + '，CURRENT_RETRY_START_HASH=' + String(now) + '（§28：retry 不得吞用户改动）'; RETRY_OWNERSHIP.rejected.push(rec); RETRY_OWNERSHIP.status = 'BLOCKED_RETRY_ARTIFACT_CHANGED_EXTERNALLY'; continue }
    rec.accepted = true
    rec.baselineSha256 = now
    RETRY_OWNED[p] = { priorRunSha256: prior, evidence: prov }
    RETRY_OWNERSHIP.accepted.push(rec)
  }
  for (const a of RETRY_OWNERSHIP.accepted) RETRY_OWNERSHIP.artifacts.push(a.path)
  if (RETRY_OWNERSHIP.accepted.length) RETRY_OWNERSHIP.status = RETRY_OWNERSHIP.status === 'BLOCKED_RETRY_ARTIFACT_CHANGED_EXTERNALLY' ? RETRY_OWNERSHIP.status : 'RETRY_OWNED_APPLIED'
  return RETRY_OWNERSHIP
}

function canonicalPathList(arr) {
  const s = []
  for (const x of (Array.isArray(arr) ? arr : [])) { const p = canonicalPath(x); if (p && s.indexOf(p) < 0) s.push(p) }
  return s
}

// 解析命令串中每个 git 调用的“子命令”，含 bypass 防御（§9）：
// 处理 git -C <path> / -c <kv> / --git-dir / --work-tree / --no-pager 等全局选项，
// 以及 cmd /c、powershell、bash -c、sh -c 包装与 && ; | 链接（按段拆分后逐段解析）。
function gitSubcommands(raw) {
  const subs = []
  const segs = String(raw == null ? '' : raw).split(/&&|\|\||[;\n|&]/)
  const unq = (t) => t.replace(/^["'`]+/, '').replace(/["'`]+$/, '')
  for (const seg of segs) {
    const toks = seg.trim().split(/\s+/).filter(Boolean).map(unq)
    for (let i = 0; i < toks.length; i++) {
      if (toks[i].toLowerCase() !== 'git') continue
      let j = i + 1, sub = null
      while (j < toks.length) {
        const xl = toks[j].toLowerCase()
        if (xl[0] === '-') {
          // 消费一个参数的全局选项
          if (xl === '-c' || xl === '--git-dir' || xl === '--work-tree' || xl === '--namespace') { j += 2; continue }
          if (/^--(git-dir|work-tree|namespace)=/.test(xl)) { j += 1; continue }
          j += 1; continue // 其余无参标志（--no-pager/-p/--paginate/--bare 等）
        }
        sub = xl.replace(/[^a-z0-9-]/g, ''); break
      }
      if (sub) subs.push(sub)
    }
  }
  return subs
}

// 保守原则：命令串含 git 且解析出任一 HARD_DENY / MUTATING 子命令即命中。
function detectForbiddenGit(cmd) {
  const s = String(cmd == null ? '' : cmd)
  if (!/(^|[^a-zA-Z0-9_])git([^a-zA-Z0-9_]|$)/i.test(s)) return null
  const subs = gitSubcommands(s)
  for (const sub of subs) if (GIT_HARD_DENY_SUBCOMMANDS.indexOf(sub) >= 0) return { tier: 'HARD_DENY', subcommand: sub }
  for (const sub of subs) if (GIT_MUTATING_SUBCOMMANDS.indexOf(sub) >= 0) return { tier: 'MUTATING', subcommand: sub }
  return null
}

// 修复阶段提示词硬约束（§17）——追加到每个 Flash 修复类 agent 提示词。
const FLASH_REPAIR_RULES = `
[修复阶段硬约束 — 违反即 GOVERNANCE/MODEL POLICY VIOLATION，编排器立即 BLOCK 并交人工]
- 绝对禁止用任何 Git 命令丢弃/还原/回退工作区或历史：git checkout（含 "-- <file>" 与 "HEAD -- <file>"）、git restore（含 --source）、git reset（含 --hard）、git clean（含 -f/-fd）、git stash、git revert、git switch；同样禁止经 cmd /c、powershell、bash -c、sh -c、git -C、&&、;、| 等包装/链接的等价命令。即使理由是"恢复被误改的禁改文件/治理文件"，也一律禁止——正确做法是返回 status=BLOCKED 交 Max/人工处理，绝不由你自行还原。
- 绝对禁止创建/修改/删除治理保护文件：AGENTS.md、.qoder/rules/**、.qoder/workflows/**、.qoder/workflow-state/**（*.spec.json 任务合同亦禁）、.gitignore、.github/**、docs/workflow/**。即便 TASK_SPEC 的 EXPECTED_FILES 误列这些路径，你仍不得修改（治理变更只能走 Max 治理模式或人工授权的治理流程）。
- 只能修改本任务创建/合法修改且属于 allowedWritePaths 的文件；"出现在 git status 里" ≠ "可修改"。禁止触碰任务前已存在的未提交改动（pre-existing）。
- 若 blocker 涉及治理文件、pre-existing 文件、或归属不明文件：不要尝试修复，直接返回 status=BLOCKED 并在 blockers 说明，由编排器判定终态。
- 如实把修复过程中运行过的所有 git 命令（含只读的 git status/git diff）列入 gitCommandsRun[]；编排器会对其做 denylist 扫描，并在修复后做工作区指纹校验。禁止遗漏、禁止改写命令原文。
`

// ---------- Worktree Task Delta 语义（D2-C；D4 起内容由确定性字节证据驱动，不再由 LLM 自报 hash 决定）----------
// 关键语义（§23–§25）：
//   · 内容身份 = sha256（文件）/ treeSha256（目录单元）；size 与 md5 只作佐证；mtime 从未被采集，结构性排除。
//   · 同 size 但 sha256 不同 → CONTENT_CHANGED（§10）；mtime 变但 sha256 不变 → UNCHANGED（§9）。
//   · 未通过确定性校验的快照【不参与】Delta（§22），由调用方进入 FINGERPRINT_ADJUDICATION（§16）。
function treeUnitDiff(baseline, current, dir) {
  const tb = (baseline.trees && baseline.trees[dir]) || null
  const tc = (current.trees && current.trees[dir]) || null
  if (!tb || !tc) return null
  const diff = []
  for (const m of Object.keys(tc.files)) { if (!tb.files[m] || tb.files[m].sha256 !== tc.files[m].sha256) diff.push(m) }
  for (const m of Object.keys(tb.files)) { if (!tc.files[m]) diff.push(m + ' (DELETED)') }
  return diff
}
// 目录单元内的变化是否全部落在本任务授权写路径内（若是则属 taskChanged，不得误判为外部改动）。
function treeUnitChangeExplainableByTask(baseline, current, dir) {
  const diff = treeUnitDiff(baseline, current, dir)
  if (!diff || !diff.length) return false
  return diff.every((m) => {
    const p = canonicalPath(String(m).replace(/ \(DELETED\)$/, ''))
    return !isGovernancePath(p) && writePathAuthorized(p)
  })
}
function classifyDelta(baseline, current, authorizedGovernanceWrites) {
  const auth = new Set((authorizedGovernanceWrites || []).map(canonicalPath).filter(Boolean))
  const res = {
    preExistingUnchanged: [], taskChanged: [], taskGovernance: [],
    externalChangedDuringTask: [], preExistingReverted: [], retryOwnedArtifacts: [],
    treeUnitChanges: [], headChanged: false, stagedAppeared: [],
    evidenceRejected: false, evidenceStatus: null,
  }
  res.evidenceStatus = { backend: FINGERPRINT_BACKEND, authority: CONTENT_IDENTITY_AUTHORITY, baseline: evidenceStatusOf(baseline), current: evidenceStatusOf(current) }
  if (!isVerifiedEvidence(baseline) || !isVerifiedEvidence(current)) { res.evidenceRejected = true; return res }
  res.headChanged = !!(baseline.head && current.head && baseline.head !== current.head)
  const bStaged = new Set(((baseline.staged || []).map(canonicalPath)))
  for (const p of ((current.staged || []).map(canonicalPath))) if (!bStaged.has(p)) res.stagedAppeared.push(p)
  const idB = identityMap(baseline), idC = identityMap(current)
  const bP = dirtyPaths(baseline), cP = dirtyPaths(current)
  const union = [...new Set([...bP, ...cP])].sort()
  for (const p of union) {
    const inB = bP.has(p), inC = cP.has(p)
    const gov = isGovernancePath(p) && !auth.has(p)
    if (inB && inC) {
      const bH = idB[p], cH = idC[p]
      if (bH && cH && bH !== cH) {
        if (RETRY_OWNED[p]) { res.retryOwnedArtifacts.push(p); if (res.taskChanged.indexOf(p) < 0) res.taskChanged.push(p) }
        else if (baseline.trees && baseline.trees[p] && treeUnitChangeExplainableByTask(baseline, current, p)) {
          for (const m of (treeUnitDiff(baseline, current, p) || [])) { const mp = canonicalPath(String(m).replace(/ \(DELETED\)$/, '')); if (res.taskChanged.indexOf(mp) < 0) res.taskChanged.push(mp) }
        } else if (gov) res.taskGovernance.push(p)
        else {
          res.externalChangedDuringTask.push(p)
          // §25：目录单元身份变化时补齐成员级明细，BLOCK 证据能指到具体新增/删除/改动的文件
          if (baseline.trees && baseline.trees[p] && current.trees && current.trees[p]) {
            for (const m of (treeUnitDiff(baseline, current, p) || [])) {
              if (!res.treeUnitChanges.some((t) => t.dir === p && t.addedOrChanged === String(m))) res.treeUnitChanges.push({ dir: p, addedOrChanged: String(m) })
            }
          }
        }
      } else if (RETRY_OWNED[p]) res.retryOwnedArtifacts.push(p)
      else res.preExistingUnchanged.push(p)
    } else if (inB && !inC) {
      res.preExistingReverted.push(p)
    } else if (!inB && inC) {
      const owner = preExistingTreeOwning(baseline, p)
      if (owner && !writePathAuthorized(p)) {
        if (isGovernancePath(p)) res.taskGovernance.push(p)
        else {
          res.treeUnitChanges.push({ dir: owner, addedOrChanged: p })
          if (res.externalChangedDuringTask.indexOf(owner) < 0) res.externalChangedDuringTask.push(owner)
        }
      } else if (gov) res.taskGovernance.push(p)
      else res.taskChanged.push(p)
    }
  }
  return res
}
function deltaViolations(delta) {
  const v = []
  if (!delta) return v
  if (delta.evidenceRejected) v.push({ code: 'FINGERPRINT_EVIDENCE_INVALID', adjudicable: true, detail: '指纹证据未通过 D4 确定性校验（命令须逐字一致、sha256 须 64 位小写 hex、md5 须 32 hex、size 须非负整数、路径须 canonical、执行手须零写入），不得参与 Task Delta：' + j(delta.evidenceStatus, 800) })
  if (delta.headChanged) v.push({ code: 'BLOCKED_GIT_HISTORY_MUTATED', detail: '任务期间 HEAD 发生变化（疑似 commit/reset/rebase/checkout 等历史改写）' })
  if (delta.stagedAppeared && delta.stagedAppeared.length) v.push({ code: 'BLOCKED_GIT_INDEX_MUTATED', detail: '任务期间出现新的 staged 改动（git add）：' + delta.stagedAppeared.join(', ') })
  if (delta.taskGovernance && delta.taskGovernance.length) v.push({ code: 'BLOCKED_GOVERNANCE_CONFLICT', detail: '治理保护文件被本任务改动：' + delta.taskGovernance.join(', ') })
  if (delta.preExistingReverted && delta.preExistingReverted.length) v.push({ code: 'BLOCKED_EXTERNAL_WORKTREE_CHANGE', adjudicable: true, detail: '任务前已存在的未提交改动被丢弃/还原（疑似 checkout/restore/reset/clean/stash）：' + delta.preExistingReverted.join(', ') })
  if (delta.externalChangedDuringTask && delta.externalChangedDuringTask.length) v.push({ code: 'BLOCKED_EXTERNAL_WORKTREE_CHANGE', adjudicable: true, detail: '任务前已存在的文件在任务期间内容被改动（sha256/treeSha256 不一致）：' + delta.externalChangedDuringTask.join(', ') })
  return v
}
// allowedRepairFiles = 本任务实际改动 ∩ EXPECTED_FILES（或 retry-owned 产物），剔除治理/forbidden（§11/§12/§26）。
function computeAllowedRepairFiles(delta, specObj) {
  const taskChanged = [...new Set((delta && delta.taskChanged || []).map(canonicalPath))]
  const retryOwned = [...new Set((delta && delta.retryOwnedArtifacts || []).map(canonicalPath))]
  const forbidden = new Set((((specObj && specObj.FILES_FORBIDDEN_TO_CHANGE) || []).map(canonicalPath)))
  const expected = canonicalPathList((specObj && specObj.EXPECTED_FILES) || [])
  const allowedWrites = canonicalPathList((specObj && specObj.ALLOWED_WRITE_PATHS) || expected)
  const inSpec = (p) => expected.length ? (expected.indexOf(p) >= 0 || writePathAuthorized(p)) : true
  let allowed = taskChanged.filter(inSpec).concat(retryOwned.filter((p) => RETRY_OWNED[p]))
  allowed = allowed.filter((p) => !isGovernancePath(p) && !forbidden.has(p))
  return [...new Set(allowed)]
}
// 修复后指纹校验（§19）：全局不得引入 governance/external/head/index 违规；
// 且 pre→post 新改动必须 ⊆ allowedRepairFiles（授权治理写 specPath 与 retry-owned 例外）。
function verifyRepairFingerprints(baseline, preSnap, postSnap, allowedRepairFiles, auth) {
  if (!isVerifiedEvidence(preSnap) || !isVerifiedEvidence(postSnap)) {
    return { ok: false, violation: { code: 'BLOCKED_FINGERPRINT_EVIDENCE_UNCERTAIN', detail: '修复前/后快照未通过确定性字节校验，无法核实修复动作的影响面：pre=' + evidenceStatusOf(preSnap) + '，post=' + evidenceStatusOf(postSnap) } }
  }
  const delta = classifyDelta(baseline, postSnap, auth)
  const viols = deltaViolations(delta)
  if (viols.length) return { ok: false, violation: viols[0] }
  const preId = identityMap(preSnap), postId = identityMap(postSnap)
  const preD = dirtyPaths(preSnap), postD = dirtyPaths(postSnap)
  const authSet = new Set((auth || []).map(canonicalPath).filter(Boolean))
  const allowed = new Set((allowedRepairFiles || []).map(canonicalPath))
  const newly = []
  for (const p of postD) {
    if (!preD.has(p)) { newly.push(p); continue }
    if (preId[p] && postId[p] && preId[p] !== postId[p]) newly.push(p)
  }
  const outside = newly.filter((p) => !allowed.has(p) && !authSet.has(p) && !RETRY_OWNED[p])
  if (outside.length) return { ok: false, violation: { code: 'BLOCKED_REPAIR_OUT_OF_SCOPE', detail: 'Self-Repair/Fix 改动了非授权文件：' + outside.join(', ') + '（allowedRepairFiles=' + (allowed.size ? [...allowed].join(', ') : '∅') + '）' } }
  return { ok: true, delta }
}

// ---------- 工具函数 ----------
function j(x, limit) {
  const s = typeof x === 'string' ? x : JSON.stringify(x, null, 1)
  const n = limit || 12000
  return s.length > n ? s.slice(0, n) + '\n...[truncated]' : s
}

function blocked(reason, failedPhase, extra) {
  const out = {
    WORKFLOW_STATUS: 'BLOCKED',
    BLOCK_REASON: reason,
    FAILED_PHASE: failedPhase,
    ACTIVE_EXECUTION_MODE: EXECUTION_MODE,
    ATTEMPTS: (extra && extra.ATTEMPTS) || 0,
    BLOCKERS: (extra && extra.BLOCKERS) || [],
    FILES_CURRENTLY_CHANGED: (extra && extra.FILES_CURRENTLY_CHANGED) || [],
    SAFE_NEXT_ACTION: (extra && extra.SAFE_NEXT_ACTION) || '人工处理后重新运行本 Workflow。',
  }
  if (extra) { for (const k of Object.keys(extra)) { if (!(k in out)) out[k] = extra[k] } }
  return out
}

function modelBlocked(failedPhase, model) {
  return blocked('BLOCKED_MODEL_UNAVAILABLE', failedPhase, {
    UNAVAILABLE_MODEL: model,
    DETECTED_AVAILABLE: '无法从 Workflow 内部枚举；当前会话模型配置见 ~/.qoder-cn/settings.json',
    USER_ACTION: MODEL_BLOCKED_HINT,
    SAFE_NEXT_ACTION: '确认模型可用后重跑；禁止自动换模型。',
  })
}

// D3：HUMAN_REQUIRED 终态——需要真实人工审批时立即停下交人工，绝不自动批准。
function pausedForHuman(reason, failedPhase, extra) {
  const out = {
    WORKFLOW_STATUS: 'PAUSED_FOR_HUMAN',
    BLOCK_REASON: 'HUMAN_REQUIRED',
    FAILED_PHASE: failedPhase,
    ACTIVE_EXECUTION_MODE: EXECUTION_MODE,
    REASON: reason,
    SAFE_NEXT_ACTION: '此任务需要真实人工/授权主体的审批或操作，Agent 不得代为批准。请人工完成相应审批（医疗专家验证 / 患者数据授权 / 伦理审查 / 版权许可 / 生产密钥 / 生产库危险操作 / 正式生产部署 / 支付 / 验证码 / 法务）后再决定后续。本 Workflow 未实现任何业务代码，也未修改任何文件。',
    REAL_PRODUCTION_APPROVED: 'NO',
  }
  if (extra) { for (const k of Object.keys(extra)) { if (!(k in out)) out[k] = extra[k] } }
  return out
}

// D3：HIGH Risk 判定——触发双独立审查（FLASH_REVIEWER_A + FLASH_REVIEWER_B）。
function isHighRisk(cls) {
  if (!cls) return false
  if (cls.riskLevel === 'high') return true
  if (cls.securitySensitive || cls.medicalSensitive || cls.privacySensitive) return true
  const t = cls.taskType || []
  for (const x of ['auth', 'security', 'medical', 'migration', 'deployment']) { if (t.indexOf(x) >= 0) return true }
  return false
}

// ============ FIX-GOV-001-R1：Machine Gate 声明合同（唯一对账键 = gateId）============
// 根因链：F-20（字符串双向包含匹配把"如实记录的红基线"误判为降级 ⇒ 诚实执行必然假红）
//        + F-24（无 SPEC↔提交覆盖率对账 ⇒ "沉默省略"是零成本作弊）
//        + F-26（旧 C3 按命令字符串对账与"共享 specObj 的既有场景语义"互斥 ⇒ 不可实施）。
// 因此 amendmentR1 把对账面严格限定为 TASK_SPEC.MACHINE_GATE_COMMANDS[].gateId：
//   I1 执行手不得把声明为 required 的门禁提交为 record（REQUIRED_DOWNGRADE —— d3-10 语义原样保留）
//   I2 执行手不得省略已声明的门禁（BLOCKED_GATE_COMMAND_NOT_EXECUTED —— 堵住 F-24 的沉默省略）
//   I3 执行手不得提交未声明的门禁/gateId，也不得在某 gateId 下换一条"会绿"的命令顶替（GATE_COMMAND_NOT_DECLARED）
//   I4 门禁 PASS/FAIL 仍由脚本按真实 exitCode 计算（gateCompute 不变）
// 禁止跨层对账：MANDATORY_TESTS / REGRESSION_TESTS 保留为语义清单（供提示词与 Max 审阅使用），
// 绝不参与与 shell 命令字节串的比较 ⇒ "声明完整性"与"实际命令字节串"不再直接耦合（A3）。
const GATE_ID_RE = /^[A-Za-z][A-Za-z0-9._:-]{1,63}$/
const GATE_KINDS = ['required', 'record']

// 命令归一化只折叠空白：绝不做子串/前缀匹配（那正是 F-20 误判与 F-24 假阳性的来源）。
function normGateCommand(s) { return String(s == null ? '' : s).trim().replace(/\s+/g, ' ') }
// 有效 kind：缺省按 required 处理（向后兼容，绝不因缺字段而放宽门禁）。
function effGateKind(c) { return c && c.kind === 'record' ? 'record' : 'required' }
function gateDecls(specObj) { return Array.isArray(specObj && specObj.MACHINE_GATE_COMMANDS) ? specObj.MACHINE_GATE_COMMANDS : [] }
function gateIndex(specObj) {
  const idx = {}
  for (const d of gateDecls(specObj)) {
    const id = normGateCommand(d && d.gateId)
    if (id && !idx[id]) idx[id] = d
  }
  return idx
}

// A4：SPEC 声明完整性在任何实施 agent 调用之前 fail-closed（0 个实施 agent）。
function validateGateSpec(specObj) {
  const defects = []
  const decls = gateDecls(specObj)
  if (!decls.length) {
    defects.push('MACHINE_GATE_COMMANDS 缺失或为空：TASK_SPEC 必须逐条声明门禁（gateId + kind + command + purpose），Machine Gate 只执行声明过的门禁')
  }
  const seen = {}
  decls.forEach((d, i) => {
    const at = 'MACHINE_GATE_COMMANDS[' + i + ']'
    const id = normGateCommand(d && d.gateId)
    if (!id) defects.push(at + '.gateId 缺失或为空')
    else if (!GATE_ID_RE.test(id)) defects.push(at + '.gateId 非法（须稳定、非空、仅含字母数字与 ._:-）：' + id)
    else if (seen[id]) defects.push('gateId 重复声明：' + id + '（首次 ' + seen[id] + '，重复于 ' + at + '）')
    else seen[id] = at
    if (GATE_KINDS.indexOf(d && d.kind) < 0) defects.push(at + '.kind 非法（只允许 required|record，实际=' + JSON.stringify(d && d.kind) + '）')
    if (!normGateCommand(d && d.command)) defects.push(at + '.command 缺失或为空')
  })
  if (defects.length) return { code: 'GATE_SPEC_MALFORMED', defects }
  return null
}

// D3 反作弊①（R1 形态）：按 gateId 对账"提交 kind ↔ 冻结声明 kind"，不做命令字符串跨层匹配。
function detectRequiredDowngrade(cmds, specObj) {
  const idx = gateIndex(specObj)
  for (const c of cmds) {
    if (!c || effGateKind(c) !== 'record') continue
    const cmd = normGateCommand(c.command)
    if (/\[GATE-REQUIRED/i.test(String(c.purpose || '')) || /\[GATE-REQUIRED/i.test(cmd)) {
      return { code: 'GOVERNANCE_POLICY_VIOLATION', tier: 'REQUIRED_DOWNGRADE', detail: `执行手把 required 门禁项降级为 record（purpose/command 仍含 [GATE-REQUIRED]）：${cmd}` }
    }
    const id = normGateCommand(c.gateId)
    const d = id ? idx[id] : null
    if (!d) continue
    if (String(d.kind) === 'required') {
      return { code: 'GOVERNANCE_POLICY_VIOLATION', tier: 'REQUIRED_DOWNGRADE', detail: `执行手把 TASK_SPEC 冻结声明为 required 的门禁 '${id}'（command=${normGateCommand(d.command)}）提交为 kind=record，属动态降级，禁止。` }
    }
  }
  return null
}

// D3 反作弊③（R1 新增，I2/I3）：提交面 ↔ 冻结声明面的完整性与一致性对账。
function detectGateDeclaration(cmds, specObj) {
  const idx = gateIndex(specObj)
  const submitted = {}
  for (const c of cmds) {
    const id = normGateCommand(c && c.gateId)
    const cmd = normGateCommand(c && c.command)
    if (!id) return { code: 'GATE_COMMAND_NOT_DECLARED', tier: 'MISSING_GATE_ID', detail: `门禁命令未引用任何 gateId：${cmd || '(空命令)'}。每条命令必须逐条回传它对应 TASK_SPEC 声明的 gateId。` }
    const d = idx[id]
    if (!d) return { code: 'GATE_COMMAND_NOT_DECLARED', tier: 'UNDECLARED_GATE_ID', detail: `执行手提交了 TASK_SPEC 未声明的门禁 '${id}'（已声明集合=[${Object.keys(idx).join(', ')}]）。未声明即非法，即便 exitCode=0。` }
    if (normGateCommand(d.command) !== cmd) {
      return { code: 'GATE_COMMAND_NOT_DECLARED', tier: 'SUBSTITUTE_COMMAND_FOR_GATE', detail: `门禁 '${id}' 的实际命令与冻结声明不一致：声明='${normGateCommand(d.command)}'，提交='${cmd}'。禁止在某条声明的门禁下换用另一条命令（尤其是一条"会绿"的命令）顶替。` }
    }
    if (effGateKind(c) !== String(d.kind)) {
      return { code: 'GOVERNANCE_POLICY_VIOLATION', tier: 'GATE_KIND_MUTATION', detail: `门禁 '${id}' 的 kind 与冻结声明不一致：声明=${d.kind}，提交=${effGateKind(c)}。实施者无权改 kind（record→required 同属擅改冻结合同）。` }
    }
    submitted[id] = true
  }
  const missing = Object.keys(idx).filter((id) => !submitted[id])
  if (missing.length) {
    return { code: 'BLOCKED_GATE_COMMAND_NOT_EXECUTED', tier: 'GATE_OMISSION', detail: `TASK_SPEC 声明的门禁未被提交（沉默省略）：${missing.join(', ')}。只提交若干条绿色命令 + 自报 allPassed:true 不构成门禁通过。` }
  }
  return null
}

// FIX-GOV-008 D4：门禁命令同构 argv 自回显 —— 每条声明的门禁都包一层，让命令自身先打印
//   Q|<gateId>|<byteLen>|<b64(该门禁声明命令原文)> 再 eval 执行原文（已实测：Q 行不影响真实退出码）。
// 这样"提交面声称跑的是哪条命令"不再靠执行手自报字符串，而由命令自身的输出来作证；脚本侧用 D1 编码器
// 独立算出期望 Q 行并逐字符复核。转义与取证侧同一形态（单引号 → '\''），payload 必须是 ASCII。
function gateArgvPayload(command) { return String(command == null ? '' : command) }
function buildGateWrappedCommand(gateId, command) {
  const payload = gateArgvPayload(command)
  return [
    "B='" + payload.replace(/'/g, "'\\''") + "'",
    "printf 'Q|" + String(gateId) + "|%s|%s\\n' \"${#B}\" \"$(printf %s \"$B\" | base64 | tr -d '\\n')\"",
    'eval "$B"',
  ].join('\n')
}
// 可安全包装（gateId 合法且声明命令为 ASCII）才下发包装形态；否则原样下发，由校验层 fail-closed。
function gateWrappedCommandForDecl(d) {
  const id = normGateCommand(d && d.gateId)
  const payload = gateArgvPayload(d && d.command)
  if (!id || !GATE_ID_RE.test(id) || !isAsciiText(payload)) return String(payload)
  return buildGateWrappedCommand(id, payload)
}

// D4 校验落点：逐条验证 Q 行的 gateId == 提交条目 gateId、b64 解码逐字符等于 TASK_SPEC 冻结声明的 command、
// 长度自洽。required 与 record 同样不得放行 —— 证据不确定即 BLOCK，绝不因 record 而静默通过。
// 未真实执行（无数字 exitCode）的条目属"安全不执行/采集失败"形态，由既有 gateCompute 分层处理；
// 未声明的 gateId 由 detectGateDeclaration 归因（本函数绝不抢占其判据，故只在它之后调用）。
function detectGateArgvEcho(cmds, specObj) {
  const idx = gateIndex(specObj)
  for (const c of cmds) {
    if (!c || typeof c.exitCode !== 'number') continue
    const id = normGateCommand(c.gateId)
    const d = id ? idx[id] : null
    if (!d) continue
    const declared = gateArgvPayload(d.command)
    const b64 = base64EncodeAscii(declared)
    if (b64 === null) return { code: 'GATE_ARGV_NOT_VERBATIM', tier: 'PAYLOAD_NONASCII', gateId: id, detail: `门禁 '${id}' 的冻结声明命令含非 ASCII 字节，argv 自回显无法逐字节成立（${declared.length} 个字符中检出非 ASCII），fail-closed。` }
    const expected = 'Q|' + id + '|' + declared.length + '|' + b64
    const raw = String(c.argvEcho == null ? '' : c.argvEcho).replace(/\r/g, '')
    const one = raw.length && raw.charAt(raw.length - 1) === '\n' ? raw.slice(0, -1) : raw
    if (!one || one.indexOf('\n') >= 0) {
      return { code: 'GATE_ARGV_NOT_VERBATIM', tier: 'ARGV_ECHO_MISSING', gateId: id, detail: `门禁 '${id}' 未回传 argvEcho（或回传了多行/空值）：Q 行必须是命令自身打印的那一行原文。声明命令='${normGateCommand(declared)}'。` }
    }
    if (one === expected) {
      const f = one.split('|')
      const dec = base64DecodeAscii(f[3])
      if (f.length !== 4 || f[0] !== 'Q' || f[1] !== id || !/^[0-9]+$/.test(f[2]) || Number(f[2]) !== declared.length || dec !== declared) {
        return { code: 'GATE_ARGV_NOT_VERBATIM', tier: 'SELF_INCONSISTENT', gateId: id, detail: `门禁 '${id}' 的 Q 行长度字段/b64 解码与 TASK_SPEC 冻结声明不自洽（期望 byteLen=${declared.length}，实测='${one.slice(0, 160)}'）。` }
      }
      continue
    }
    const squash = (t) => String(t).replace(/\s+/g, '')
    const tier = squash(one) === squash(expected) ? 'ARGV_WHITESPACE' : 'ARGV_CONTENT'
    return { code: 'GATE_ARGV_NOT_VERBATIM', tier, gateId: id, detail: `门禁 '${id}' 的 argvEcho 与脚本独立算出的期望 Q 行不逐字符相等（tier=${tier}）。期望='${expected.slice(0, 200)}'，实测='${one.slice(0, 200)}'。b64 指向的不是该 gateId 冻结声明的那条命令。` }
  }
  return null
}

// D3 反作弊②：破坏性数据库目标守卫——禁止对未知/生产 :5432 实例执行破坏性操作。
// 精确匹配 5432（前后非数字），不误伤一次性测试库 :55432。
function scanUnsafeDbCommand(cmd) {
  const s = String(cmd == null ? '' : cmd).toLowerCase()
  if (!/(?<!\d)5432(?!\d)/.test(s)) return null
  if (/(drop|truncate|delete|destroy|reset|downgrade|remove|dropdb|drop\s+database|\bgolden\b|prod(uction)?\b)/.test(s)) {
    return { code: 'BLOCKED_UNSAFE_DATABASE_TARGET', detail: `命令指向 :5432（UNKNOWN_DATABASE_INSTANCE / 可能是生产库），且含破坏性操作词，禁止执行：${cmd}` }
  }
  return null
}

// ---------- Schemas ----------
const PREFLIGHT_SCHEMA = {
  type: 'object',
  properties: {
    isGitRepo: { type: 'boolean' },
    repoRoot: { type: 'string' },
    isCorrectRepo: { type: 'boolean', description: '仓库是否为 ai-hearing-rehabilitation 项目（按目录名/README/git remote 判断）' },
    branch: { type: 'string' },
    dirty: { type: 'boolean' },
    dirtyFiles: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
  },
  required: ['isGitRepo', 'isCorrectRepo', 'branch', 'dirty', 'dirtyFiles'],
}

const CLASSIFY_SCHEMA = {
  type: 'object',
  properties: {
    blocked: { type: 'boolean', description: '无法可靠分类时为 true' },
    blockReason: { type: 'string' },
    taskType: { type: 'array', items: { type: 'string', enum: ['frontend', 'backend', 'schema', 'migration', 'medical', 'knowledge', 'rag', 'training', 'irt', 'privacy', 'auth', 'security', 'observability', 'deployment', 'evaluation', 'cross_stack', 'bugfix', 'refactor', 'documentation'] } },
    medicalSensitive: { type: 'boolean' },
    privacySensitive: { type: 'boolean' },
    securitySensitive: { type: 'boolean' },
    frontendTouchedExpected: { type: 'boolean' },
    backendTouchedExpected: { type: 'boolean' },
    schemaTouchedExpected: { type: 'boolean' },
    migrationExpected: { type: 'boolean' },
    knowledgeTouchedExpected: { type: 'boolean' },
    ragTouchedExpected: { type: 'boolean' },
    riskLevel: { type: 'string', enum: ['low', 'medium', 'high'] },
    humanDecisionRequired: { type: 'boolean', description: 'D3：任务验收本质上需要真实人工审批（医疗专家验证/患者数据授权/伦理/版权/生产密钥/生产库危险操作/正式生产部署/支付/验证码/法务）时为 true；命中则 PAUSED_FOR_HUMAN，绝不自动批准' },
    humanDecisionReason: { type: 'string', description: '需要哪一类人工审批、为何无法由 Agent 自行批准' },
  },
  required: ['blocked', 'taskType', 'medicalSensitive', 'privacySensitive', 'securitySensitive', 'frontendTouchedExpected', 'backendTouchedExpected', 'schemaTouchedExpected', 'migrationExpected', 'knowledgeTouchedExpected', 'ragTouchedExpected', 'riskLevel'],
}

const EXPLORE_SCHEMA = {
  type: 'object',
  properties: {
    CURRENT_STATE: { type: 'string' },
    RELATED_FILES: { type: 'array', items: { type: 'string' } },
    DEPENDENCIES: { type: 'string' },
    RISKS: { type: 'string' },
    EXISTING_TESTS: { type: 'string' },
    POTENTIAL_REGRESSIONS: { type: 'string' },
    TEST_COMMANDS: {
      type: 'object',
      description: '从 pyproject.toml / package.json / CI / README / docs 中真实发现的命令，不得凭空假设',
      properties: {
        backend: { type: 'array', items: { type: 'string' } },
        frontend: { type: 'array', items: { type: 'string' } },
        lint: { type: 'array', items: { type: 'string' } },
        migration: { type: 'array', items: { type: 'string' } },
        integration: { type: 'array', items: { type: 'string' } },
      },
    },
    parallelSafe: { type: 'boolean', description: '本任务是否可与无依赖任务并行（需同时满足：无数据库前置依赖、不改相同文件、API Contract 已冻结、无 Schema 依赖、合并顺序无语义依赖）' },
    parallelSafeReason: { type: 'string' },
  },
  required: ['CURRENT_STATE', 'RELATED_FILES', 'DEPENDENCIES', 'RISKS', 'EXISTING_TESTS', 'POTENTIAL_REGRESSIONS', 'TEST_COMMANDS', 'parallelSafe'],
}

const SCOPE_SCHEMA = {
  type: 'object',
  properties: {
    atomic: { type: 'boolean' },
    estimatedDevDays: { type: 'number' },
    reason: { type: 'string' },
    recommendedTasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          taskId: { type: 'string' },
          title: { type: 'string' },
          objective: { type: 'string' },
          dependencies: { type: 'array', items: { type: 'string' } },
          acceptanceSummary: { type: 'string' },
        },
        required: ['taskId', 'title', 'objective', 'dependencies', 'acceptanceSummary'],
      },
    },
  },
  required: ['atomic', 'reason'],
}

const SPEC_SCHEMA = {
  type: 'object',
  properties: {
    TASK_ID: { type: 'string' },
    TITLE: { type: 'string' },
    OBJECTIVE: { type: 'string' },
    CONTEXT: { type: 'string' },
    DEPENDENCIES: { type: 'array', items: { type: 'string' } },
    IN_SCOPE: { type: 'array', items: { type: 'string' } },
    OUT_OF_SCOPE: { type: 'array', items: { type: 'string' } },
    EXPECTED_FILES: { type: 'array', items: { type: 'string' } },
    ALLOWED_WRITE_PATHS: { type: 'array', items: { type: 'string' }, description: '可选：本任务被授权写入的目录前缀（如 "docs/qgraphflow/dialogue-turn-sequence/"）。缺省时等于 EXPECTED_FILES。用于判定 pre-existing 未跟踪目录单元内的新增文件归属本任务还是归属外部改动。' },
    FILES_FORBIDDEN_TO_CHANGE: { type: 'array', items: { type: 'string' } },
    DATABASE_IMPACT: { type: 'string' },
    API_IMPACT: { type: 'string' },
    FRONTEND_IMPACT: { type: 'string' },
    SECURITY_IMPACT: { type: 'string' },
    PRIVACY_IMPACT: { type: 'string' },
    MEDICAL_IMPACT: { type: 'string' },
    KNOWLEDGE_IMPACT: { type: 'string' },
    MIGRATION_REQUIREMENTS: { type: 'string' },
    ACCEPTANCE_CRITERIA: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '如 AC-01' },
          criterion: { type: 'string', description: '可验证、可观察，如"未认证请求必须返回 401"；禁止"功能正常"' },
          verification: { type: 'string', description: '如何通过测试/命令验证' },
        },
        required: ['id', 'criterion', 'verification'],
      },
    },
    MANDATORY_TESTS: { type: 'array', items: { type: 'string' }, description: '语义清单（人类/Max 可读）：本任务必须满足的验证意图。FIX-GOV-001-R1 起不再参与与 shell 命令字节串的机器对账。' },
    REGRESSION_TESTS: { type: 'array', items: { type: 'string' }, description: '语义清单（人类/Max 可读）：回归保护意图。不参与机器字符串对账（A3）。' },
    MACHINE_GATE_COMMANDS: {
      type: 'array',
      description: 'FIX-GOV-001-R1：Machine Gate 的冻结门禁合同（由 Max 撰写、执行手无权改动）。门禁只按 gateId 对账：每条命令必须引用其中一个 gateId；未声明的命令/门禁、改 kind、换命令一律 fail-closed。kind=record 只表示"采集基线事实"（红/缺安全环境入 findings，不阻断本 Task），绝不表示降级。',
      items: {
        type: 'object',
        properties: {
          gateId: { type: 'string', description: '稳定、非空、本 Task 内唯一的门禁标识，如 G-TARGET / G-BASE-PYTEST' },
          kind: { type: 'string', enum: ['required', 'record'], description: 'required=本 Task 必须成功；record=采集当前基线事实。kind 由 Max 在 SPEC 中冻结，执行手无权更改。' },
          command: { type: 'string', description: '真实可运行的命令原文；执行手提交的 command 必须与此逐字（折叠空白后）一致' },
          purpose: { type: 'string', description: '这条门禁验证什么（一句话）' },
        },
        required: ['gateId', 'kind', 'command'],
      },
    },
    ROLLBACK_PLAN: { type: 'string' },
    KNOWN_RISKS: { type: 'array', items: { type: 'string' } },
    DELIVERABLES: { type: 'array', items: { type: 'string' } },
    specPath: { type: 'string', description: 'TASK_SPEC 落盘路径 .qoder/workflow-state/<TASK_ID>.spec.json' },
  },
  required: ['TASK_ID', 'TITLE', 'OBJECTIVE', 'IN_SCOPE', 'OUT_OF_SCOPE', 'EXPECTED_FILES', 'ACCEPTANCE_CRITERIA', 'MANDATORY_TESTS', 'REGRESSION_TESTS', 'ROLLBACK_PLAN', 'specPath'],
}

const IMPL_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['IMPLEMENTED', 'SPEC_CONFLICT', 'BLOCKED'] },
    conflict: { type: 'string' },
    evidence: { type: 'string' },
    affectedFiles: { type: 'array', items: { type: 'string' } },
    recommendedDecision: { type: 'string' },
    TASK_ID: { type: 'string' },
    FILES_CREATED: { type: 'array', items: { type: 'string' } },
    FILES_MODIFIED: { type: 'array', items: { type: 'string' } },
    FILES_DELETED: { type: 'array', items: { type: 'string' } },
    DATABASE_CHANGES: { type: 'string' },
    API_CHANGES: { type: 'string' },
    FRONTEND_CHANGES: { type: 'string' },
    TESTS_ADDED: { type: 'array', items: { type: 'string' } },
    TESTS_MODIFIED: { type: 'array', items: { type: 'string' } },
    TESTS_RUN: { type: 'array', items: { type: 'string' } },
    TEST_RESULTS: { type: 'string' },
    DEVIATIONS_FROM_SPEC: { type: 'string' },
    KNOWN_LIMITATIONS: { type: 'string' },
    BLOCKERS: { type: 'string' },
  },
  required: ['status'],
}

const GATE_SCHEMA = {
  type: 'object',
  properties: {
    commands: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          command: { type: 'string' },
          gateId: { type: 'string', description: 'FIX-GOV-001-R1：本条命令对应 TASK_SPEC.MACHINE_GATE_COMMANDS 中哪一条门禁。每条命令必须逐条回传其声明的 gateId；引用未声明的 gateId、或提交未声明的命令，脚本判 GATE_COMMAND_NOT_DECLARED（即便 exitCode=0）。除声明的门禁外不要提交任何其他命令（预读/核实过程写入 notes）。' },
          purpose: { type: 'string' },
          kind: { type: 'string', enum: ['required', 'record'], description: 'required=本 Task 自身必须成功的验证（exitCode!==0 → MACHINE_FAIL；缺安全环境无法执行 → 顶层 blockedMissingSafeTestEnv）；record=采集当前基线事实（红/缺环境只入 findings，不阻断本 Task）。kind 由 Max 在 TASK_SPEC/Gate Schema 指定，Flash 无权把 required 降级为 record 或降低门禁。命令缺省 kind 时按 required 处理（向后兼容）。' },
          exitCode: { type: 'number', description: 'required 命令必须有数值 exitCode；record 命令安全不执行时可省略' },
          argvEcho: { type: 'string', description: 'FIX-GOV-008 D4：本条门禁【实际运行】的那条包装命令自己打印的 Q 行原文（Q|<gateId>|<byteLen>|<base64(声明命令原文)>），逐字回传，禁止改写、禁止自行拼造、禁止用声明命令字符串代替。脚本会用自实现的 base64 独立算出期望 Q 行并逐字符复核；缺失/不符/多行/空白型改动 → 终态 GATE_ARGV_NOT_VERBATIM（required 与 record 同样不得放行）。安全地未执行（无 exitCode）时也必须如实留空，绝不伪造。' },
          recordStatus: { type: 'string', enum: ['EXECUTED_AND_RECORDED', 'SAFELY_NOT_EXECUTED_AND_RECORDED', 'RECORD_COLLECTION_FAILED'], description: 'record 命令采集状态：真执行并记录 / 安全地不执行并记录原因+环境证据 / 采集本身失败。required 命令因缺安全环境无法执行时也置 SAFELY_NOT_EXECUTED_AND_RECORDED（此时触发 blockedMissingSafeTestEnv）。' },
          stdoutSummary: { type: 'string' },
          stderrSummary: { type: 'string' },
        },
        required: ['command', 'kind', 'argvEcho'],
      },
    },
    allPassed: { type: 'boolean', description: '执行手自报，脚本不采信；门禁裁判以脚本 gateCompute() 按 kind 分层计算为准' },
    findings: { type: 'array', items: { type: 'string' }, description: 'record 命令发现的基线问题（测试红/lint 债/安全缺口/性能缺口/缺安全环境），写入报告但不阻断本 Task' },
    skippedGates: { type: 'array', items: { type: 'string' }, description: '被跳过的门禁项及原因（项目不支持该命令等）' },
    blockedMissingSafeTestEnv: { type: 'boolean', description: '仅当某 REQUIRED 命令因缺安全测试环境无法执行时置 true；record 命令的安全不执行用 recordStatus=SAFELY_NOT_EXECUTED_AND_RECORDED，不得置此字段为 true' },
    notes: { type: 'string' },
  },
  required: ['commands', 'blockedMissingSafeTestEnv'],
}

const FIXREPORT_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['FIXED', 'BLOCKED'] },
    summary: { type: 'string' },
    filesChanged: { type: 'array', items: { type: 'string' } },
    gitCommandsRun: { type: 'array', items: { type: 'string' }, description: 'D2：修复过程中运行过的所有 git 命令原文（含只读命令）。编排器对其做 denylist 扫描；遗漏或改写视为 GOVERNANCE POLICY VIOLATION。' },
    blockers: { type: 'string' },
  },
  required: ['status', 'summary'],
}

// D4：工作区内容身份的取证契约（替换 D2 的"LLM 自报 hash"结构）。
// 执行手（qfmodel，只读）无权生成/总结/推断任何 hash：它只逐字执行脚本下发的确定性命令并原样回传 rawStdout。
// 内容身份的判定全部发生在脚本侧（parseFingerprintEvidence 的格式/自洽校验 + Task Delta 比较）。
const FP_EXECUTOR_SCHEMA = {
  type: 'object',
  properties: {
    purpose: { type: 'string', description: '本次取证用途（编排器注入，原样回传）' },
    command: { type: 'string', description: '逐字回传脚本下发的命令原文（禁止改写、禁止美化、禁止拆成多条）' },
    exitCode: { type: 'integer', description: '该命令的真实退出码' },
    rawStdout: { type: 'string', description: '命令 stdout 原文（逐字节，禁止总结/截断/重排/自行计算 hash）' },
    rawStderr: { type: 'string' },
    filesWritten: { type: 'array', items: { type: 'string' }, description: '必须为空数组：本取证命令不得写任何文件；非空即 GOVERNANCE_POLICY_VIOLATION' },
    gitCommandsRun: { type: 'array', items: { type: 'string' }, description: '本次实际运行过的 git 命令原文（含只读）；编排器做 denylist 扫描' },
  },
  required: ['purpose', 'command', 'exitCode', 'rawStdout', 'filesWritten', 'gitCommandsRun'],
}

const RCA_SCHEMA = {
  type: 'object',
  properties: {
    ROOT_CAUSE: { type: 'string' },
    FIX_SPEC: { type: 'string', description: '只针对 blocker 的修复合同，禁止顺带其他改动' },
    affectedFiles: { type: 'array', items: { type: 'string' } },
  },
  required: ['ROOT_CAUSE', 'FIX_SPEC'],
}

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['PASS', 'REQUEST_CHANGES'] },
    acceptanceResults: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'string' }, met: { type: 'boolean' }, evidence: { type: 'string' } },
        required: ['id', 'met', 'evidence'],
      },
    },
    blockers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          BLOCKER_ID: { type: 'string' },
          LOCATION: { type: 'string' },
          EVIDENCE: { type: 'string' },
          IMPACT: { type: 'string' },
          REQUIRED_FIX: { type: 'string' },
          VERIFICATION_METHOD: { type: 'string' },
        },
        required: ['BLOCKER_ID', 'LOCATION', 'EVIDENCE', 'IMPACT', 'REQUIRED_FIX', 'VERIFICATION_METHOD'],
      },
    },
    nonBlockingNotes: { type: 'array', items: { type: 'string' } },
    medicalSafetyReview: { type: 'string' },
    privacyReview: { type: 'string' },
    knowledgeRagReview: { type: 'string' },
    reviewSummary: { type: 'string' },
  },
  required: ['verdict', 'acceptanceResults', 'blockers'],
}

const VERIFY_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['TASK_PASS', 'TASK_FAIL'] },
    acceptanceAllMet: { type: 'boolean' },
    scopeIntact: { type: 'boolean' },
    unexpectedFiles: { type: 'array', items: { type: 'string' } },
    regressionRisk: { type: 'string' },
    rollbackIntact: { type: 'boolean' },
    changedFiles: { type: 'array', items: { type: 'string' }, description: '来自 git diff/status 的实际改动文件' },
    reasons: { type: 'array', items: { type: 'string' } },
    suggestedNextTask: { type: 'string' },
  },
  required: ['verdict', 'acceptanceAllMet', 'scopeIntact', 'rollbackIntact', 'reasons'],
}

const EVIDENCE_SCHEMA = {
  type: 'object',
  properties: {
    checks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          performed: { type: 'boolean' },
          result: { type: 'string', enum: ['pass', 'fail', 'missing_evidence', 'skipped'] },
          command: { type: 'string' },
          exitCode: { type: 'number' },
          evidence: { type: 'string' },
        },
        required: ['name', 'performed', 'result', 'evidence'],
      },
    },
    summary: { type: 'string' },
    missing: { type: 'array', items: { type: 'string' } },
  },
  required: ['checks', 'summary', 'missing'],
}

const MILESTONE_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['MILESTONE_PASS', 'MILESTONE_BLOCKED'] },
    reasons: { type: 'array', items: { type: 'string' } },
    openBlockers: { type: 'array', items: { type: 'string' } },
    taskStatusReview: { type: 'string' },
  },
  required: ['verdict', 'reasons'],
}

const RELEASE_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['PROJECT_READY', 'PROJECT_NOT_READY'] },
    reasons: { type: 'array', items: { type: 'string' } },
    missingEvidence: { type: 'array', items: { type: 'string' } },
    securityReview: { type: 'string' },
  },
  required: ['verdict', 'reasons', 'missingEvidence'],
}

// ============================================================
// 输入解析
// args 支持: 字符串（task 模式）或 { task, mode }，mode ∈ task|milestone_gate|release_gate
// ============================================================
let task = ''
let mode = 'task'
if (typeof args === 'string') {
  task = args.trim()
} else if (args && typeof args === 'object') {
  task = String(args.task || '').trim()
  mode = String(args.mode || 'task')
  // D3/D5：执行模式可由调用方显式覆盖；D5 起默认 'FULL'，仅接受 'FULL' / 'FLASH_ONLY' 两个合法值。
  // D5 fail-closed：传了却无法识别的 executionMode 绝不静默回落到默认值——任何 agent 调用之前就 BLOCK，
  // 否则拼写错误（如 'flashonly'/'full_mode'）会悄悄将任务降级到另一种模型政策。
  if (args.executionMode !== undefined && args.executionMode !== 'FULL' && args.executionMode !== 'FLASH_ONLY') {
    return blocked('INVALID_EXECUTION_MODE', 'Input', {
      RECEIVED_EXECUTION_MODE: typeof args.executionMode === 'string' ? args.executionMode : JSON.stringify(args.executionMode),
      DETAIL: "executionMode 只允许 'FULL' | 'FLASH_ONLY'，或缺省（= 'FULL'）。非法值不降级、不回落默认，直接停止。",
      SAFE_NEXT_ACTION: "改为 executionMode:'FULL'（默认，双模型）或 executionMode:'FLASH_ONLY'（人工授权的显式降级）后重跑。",
    })
  }
  if (args.executionMode === 'FULL' || args.executionMode === 'FLASH_ONLY') EXECUTION_MODE = args.executionMode
  // D3 测试专用 trip-wire（生产恒不传）：验证 FLASH_ONLY 下把角色路由到 qmodel_38max 会被 Preflight 路由守卫拦截。
  if (args.__d3_force_max_route === true) D3_TEST_FORCE_MAX_ROUTE = true
  // D4 §26–§30：同任务重试产物归属。只有调用方（人工授权的重跑指令）显式声明上一 run 的身份与产物证据时才生效；
  // 缺省即普通任务，RETRY_OWNED 恒空，任何 pre-existing 改动都按用户改动保护，绝不因"看起来像上次产物"而放行。
  RETRY_OF_TASK_ID = String(args.retryOfTaskId || '').trim()
  RETRY_ARTIFACTS = Array.isArray(args.retryArtifacts) ? args.retryArtifacts : []
}
if (['task', 'milestone_gate', 'release_gate'].indexOf(mode) === -1) {
  return blocked('INVALID_MODE', 'Input', { SAFE_NEXT_ACTION: "mode 只允许 'task' | 'milestone_gate' | 'release_gate'。" })
}
if (!task) {
  return blocked('MISSING_TASK', 'Input', {
    SAFE_NEXT_ACTION: "请传入任务描述：Workflow({name:'project-feature-delivery', args:{task:'...', mode:'task'}})，或直接传字符串 args。",
  })
}

// ============================================================
// PHASE 0 — PREFLIGHT
// ============================================================
phase('Preflight')

// ============================================================
// D3 路由守卫（在任何角色 Agent 真正调用之前执行，纯脚本判定，不调用模型）：
// 当前执行模式下，任何"运行时会发起 agent() 的角色"若被路由到不在允许集合内的模型
// （FLASH_ONLY 只允许 qfmodel；任何 default/auto/fallback/第三模型都不在集合内），
// 立即返回 MODEL_POLICY_VIOLATION —— 绝不实际调用被禁模型。
// D5 追加【逐角色】矩阵校验：FULL 下决策角色必须 = qmodel_38max、实施/门禁角色必须 = qfmodel，
// 反向串位（Worker 走 Max 自验收、或 Reviewer 走 Flash）同样在任何调用之前拦截。
// ============================================================
{
  const runtimeRoles = ['planner', 'explorer', 'worker', 'gate', 'fixer', 'reviewer', 'reviewerB', 'verifier', 'rca', 'snapshot', 'evidence']
  for (const r of runtimeRoles) {
    const m = modelFor(r)
    if (!allowedRuntimeModels().has(m)) {
      return blocked('MODEL_POLICY_VIOLATION', 'Preflight', {
        DETAIL: `执行模式=${EXECUTION_MODE} 下角色 '${r}' 将被路由到模型 '${m}'，不在允许模型集合 [${[...allowedRuntimeModels()].join(', ')}] 内。已在调用前拦截，未实际请求该模型。`,
        ACTIVE_EXECUTION_MODE: EXECUTION_MODE,
        OFFENDING_ROLE: r,
        OFFENDING_MODEL: m,
        ALLOWED_RUNTIME_MODELS: [...allowedRuntimeModels()],
        SAFE_NEXT_ACTION: EXECUTION_MODE === 'FLASH_ONLY'
          ? 'FLASH_ONLY 降级模式禁止调用 qmodel_38max / 任何第三模型 / default / auto / fallback。请检查 Workflow 顶部 EXECUTION_MODE 与 modelFor()/D3_TEST_FORCE_MAX_ROUTE；确需 Max 请恢复 Max 配额后以 executionMode:"FULL" 运行。'
          : 'FULL 模式仅允许 qmodel_38max / qfmodel，请核对 MAX/FLASH 常量。',
      })
    }
    // D5：逐角色矩阵校验（FULL 下决策角色必须 Max / 实施角色必须 Flash；FLASH_ONLY 下必须全 Flash）
    const want = (EXPECTED_RUNTIME_MODEL[EXECUTION_MODE] || {})[r]
    if (want && m !== want) {
      return blocked('MODEL_POLICY_VIOLATION', 'Preflight', {
        DETAIL: `执行模式=${EXECUTION_MODE} 下角色 '${r}' 应路由到 '${want}'，实际将路由到 '${m}'。D5 角色-模型矩阵不匹配，已在任何 agent() 调用之前拦截。`,
        ACTIVE_EXECUTION_MODE: EXECUTION_MODE,
        VIOLATION_KIND: 'ROLE_MODEL_MISMATCH',
        OFFENDING_ROLE: r,
        EXPECTED_MODEL: want,
        OFFENDING_MODEL: m,
        ROLE_MODEL_MATRIX: EXPECTED_RUNTIME_MODEL[EXECUTION_MODE],
        SAFE_NEXT_ACTION: '核对顶部 EXECUTION_MODE / ROLE_FULL_MODEL / modelFor()：FULL 下决策角色=Max、实施角色=Flash；FLASH_ONLY 下全部=Flash。禁止为通过本检查而放宽角色。',
      })
    }
  }
}

// 模型可用性探针（模式感知）：FLASH_ONLY 只探测 qfmodel，绝不探测/调用 qmodel_38max。
if (EXECUTION_MODE === 'FLASH_ONLY') {
  log(`执行模式=FLASH_ONLY（Max 配额不可用）：全部运行时角色模型 = ${FLASH}，仅探测 qfmodel，禁止调用 qmodel_38max。`)
  const pf = await agent('模型可用性探针。只回复一个词：OK', { label: 'probe:flash', phase: 'Preflight', model: FLASH, effort: 'low' })
  if (!pf) return modelBlocked('Preflight', FLASH + ' (Qwen3.8-Flash)')
  log('qfmodel 可用。执行 Git 守护检查（只读）。')
} else {
  log('执行模式=FULL：探测模型可用性 qmodel_38max (Qwen3.8-Max) / qfmodel (Qwen3.8-Flash)')
  const probes = await parallel([
    () => agent('模型可用性探针。只回复一个词：OK', { label: 'probe:max', phase: 'Preflight', model: modelFor('probeMax'), effort: 'low' }),
    () => agent('模型可用性探针。只回复一个词：OK', { label: 'probe:flash', phase: 'Preflight', model: FLASH, effort: 'low' }),
  ])
  if (!probes[0]) return modelBlocked('Preflight', MAX + ' (Qwen3.8-Max)')
  if (!probes[1]) return modelBlocked('Preflight', FLASH + ' (Qwen3.8-Flash)')
  log('两个模型均可用。执行 Git 守护检查（只读）。')
}

const pre = await agent(`${PROJECT_RULES}
[任务] 只读执行以下命令并如实报告，禁止任何写操作、禁止任何破坏性 git 命令：
1. git status --porcelain
2. git branch --show-current
3. git rev-parse --show-toplevel
确认：(a) 当前确实处于 Git 仓库；(b) 该仓库是否为 ai-hearing-rehabilitation 项目（结合目录名、README.md 标题或 git remote 判断）；(c) 当前分支名；(d) working tree 是否干净（git status --porcelain 输出是否为空），dirty 时列出 dirtyFiles。
另外在 notes 中记录：仓库根目录下是否存在 AGENTS.md 与 .qoder/rules/ 目录。`,
  { label: 'preflight', phase: 'Preflight', model: modelFor('planner'), effort: 'low', schema: PREFLIGHT_SCHEMA })
if (!pre) return modelBlocked('Preflight', mname(modelFor('planner')))

if (!pre.isGitRepo) return blocked('BLOCKED_NOT_GIT_REPO', 'Preflight', { SAFE_NEXT_ACTION: '请在 ai-hearing-rehabilitation Git 仓库根目录运行。' })
if (!pre.isCorrectRepo) return blocked('BLOCKED_WRONG_REPO', 'Preflight', { repoRoot: pre.repoRoot, SAFE_NEXT_ACTION: '当前目录不是 ai-hearing-rehabilitation 仓库，请切换到正确项目。' })

const onProtectedBranch = (pre.branch === 'main' || pre.branch === 'master')
if (onProtectedBranch && pre.dirty) {
  return blocked('BLOCKED_DIRTY_MAIN', 'Preflight', {
    branch: pre.branch,
    dirtyFiles: pre.dirtyFiles,
    SAFE_NEXT_ACTION: '当前处于 main/master 且 working tree 不干净。请先提交或安全暂存（git stash -u）未提交变更，或切换到 feature 分支后重跑。本 Workflow 未修改任何文件。',
  })
}
const baseline = { branch: pre.branch, dirty: pre.dirty, dirtyFiles: pre.dirtyFiles || [], onProtectedBranch }
log(`Preflight 通过：branch=${baseline.branch}, dirty=${baseline.dirty}（已记录基线，Workflow 不会覆盖用户已有修改）`)

// D2 §4 / D4 §5–§15：捕获 WORKTREE_BASELINE（确定性字节证据），作为 Task Delta 判定的基准。
// §8：取证命令在仓库根执行，路径统一 canonical，避免 Windows 分隔符造成假 Delta。
FP_REPO_ROOT = (function () {
  const r = String(pre.repoRoot || '').trim().replace(/\\/g, '/').replace(/\/+$/, '')
  if (/^[A-Za-z]:\//.test(r) || r.charAt(0) === '/') return r
  return '.'
})()
// FIX-GOV-008 D2：argv 自回显只覆盖 ASCII 字节域（bash 单引号字面量 + ${#B} 字符数须等于字节数）。
// 本仓库根含中文，故 cd 行【刻意排在 payload 之外】；若 payload 自身出现非 ASCII 字节，
// 回显互证就失去确定性基准 —— 这是实施前就能静态判定的事实，因此在这里 fail-closed 停止，
// 绝不带着无法核验的证据进入后续任何阶段（终态经 blocked() 产出，不作为 problems 弱口径）。
if (!isAsciiText(fingerprintArgvPayload())) {
  return blocked('BLOCKED_FINGERPRINT_PAYLOAD_NONASCII', 'Preflight', {
    FINGERPRINT_BACKEND, CONTENT_IDENTITY_AUTHORITY, SCRIPT_SIDE_HASH_AVAILABLE,
    PINNED_COMMAND_PROTOCOL: FP_PROTOCOL,
    DETAIL: '确定性取证命令的 argv 回显 payload 含非 ASCII 字节：A 行的 byteLen/base64 与脚本侧纯 JS 编码器的逐字符比较失去确定性基准，证据不可核验。',
    SAFE_NEXT_ACTION: '请把取证命令 payload 恢复为 ASCII-only（cd 行不入 payload 是本仓库的强制约束），再重跑本 Workflow。本 Workflow 未修改任何文件。',
  })
}
let _baselineRes = await establishWorktreeBaseline('Preflight')
if (!_baselineRes) return modelBlocked('Preflight', mname(modelFor('snapshot')))
if (_baselineRes.blocked) return blocked(_baselineRes.blocked.code, 'Preflight', {
  DETAIL: _baselineRes.blocked.detail,
  FINGERPRINT_BACKEND, CONTENT_IDENTITY_AUTHORITY, SCRIPT_SIDE_HASH_AVAILABLE,
  EVIDENCE_PROBLEMS: FP_INVALID_DETECTED.slice(0, 8),
  ADJUDICATION: _baselineRes.adjudications || [],
  SAFE_NEXT_ACTION: '任务前基线无法用确定性字节证据建立。Workflow 未修改任何文件，请人工核查取证链路（shell 可用性、sha256sum/md5sum/find 是否存在）后重跑。',
})
let WORKTREE_BASELINE = _baselineRes.baseline
if (_baselineRes.adjudications && _baselineRes.adjudications.length) log(`WORKTREE_BASELINE 由两个独立收敛 invocation 重建（首次取证证据非法：${FP_INVALID_DETECTED.slice(0, 2).join(' / ')}）`)
baseline.head = WORKTREE_BASELINE.head
const _bPre = (WORKTREE_BASELINE.trackedModified || []).length + (WORKTREE_BASELINE.untracked || []).length + (WORKTREE_BASELINE.trackedDeleted || []).length + (WORKTREE_BASELINE.staged || []).length
log(`WORKTREE_BASELINE 已建立：HEAD=${(WORKTREE_BASELINE.head || '').slice(0, 12)}，pre-existing 改动 ${_bPre} 项（含指纹）。Scope/forbidden 判定将基于 Task Delta（baseline↔当前），不再基于裸 git status。`)

// ============================================================
// Milestone Gate 模式
// ============================================================
if (mode === 'milestone_gate') {
  phase('Gate Checks')
  log('Milestone Gate：禁止任何 Feature 实现，只收集证据。')
  const ev = await agent(`${PROJECT_RULES}
${FLASH_RULES}
[Milestone Gate 证据收集] 目标 Milestone 描述：${task}
禁止实现任何新功能、禁止修改业务代码。只允许读取文件与运行验证命令。
执行：
1. 读取 TODO.md、docs/、deliverables/、git log，找出该 Milestone 包含的所有 Task 及其 PASS/完成记录。
2. 运行 Milestone 级 regression 与相关 integration tests —— 只运行从 pyproject.toml / package.json / CI / README / docs 中真实发现的命令，禁止假设命令存在。
3. 检查架构一致性、文档、安全影响、数据库状态（迁移链是否干净）。
4. 如果是 Knowledge/RAG Milestone：额外验证 retrieval、citation、provenance、data isolation。
5. 如果是医疗安全 Milestone：额外验证 unsafe answer regression、high-risk routing、emergency escalation。
6. 检查是否存在未关闭 blocker。
每一项 check 记录 name/performed/result/command/exitCode/evidence；没有证据的项标 missing_evidence 并写入 missing[]。`,
    { label: 'milestone-evidence', phase: 'Gate Checks', model: FLASH, schema: EVIDENCE_SCHEMA })
  if (!ev) return modelBlocked('Gate Checks', FLASH + ' (Qwen3.8-Flash)')

  phase('Gate Verdict')
  const mv = await agent(`${PROJECT_RULES}
${decisionRules()}
[Milestone Gate 判定] 目标 Milestone：${task}
证据收集结果：
${j(ev, 16000)}
请自行只读复核关键证据（可读取文件、运行只读命令、查看 git log），确认：
1. 该 Milestone 所有 Task 均已 PASS；2. 无未关闭 blocker；3. Milestone 级 Regression 与 integration tests 真实通过；4. 架构一致性、文档、安全影响、数据库状态无问题；5. Knowledge/RAG 或医疗安全 Milestone 的附加项已验证。
不得根据历史文档假设通过；必须有当前有效证据。只能返回 MILESTONE_PASS 或 MILESTONE_BLOCKED。`,
    { label: 'milestone-verdict', phase: 'Gate Verdict', model: modelFor('verifier'), schema: MILESTONE_SCHEMA })
  if (!mv) return modelBlocked('Gate Verdict', mname(modelFor('verifier')))

  return {
    WORKFLOW_STATUS: mv.verdict,
    MODE: 'milestone_gate',
    MILESTONE: task,
    MODEL_USAGE: { EVIDENCE_RUNNER: mname(modelFor('evidence')), VERDICT: mname(modelFor('verifier')) },
    REASONS: mv.reasons,
    OPEN_BLOCKERS: mv.openBlockers || [],
    TASK_STATUS_REVIEW: mv.taskStatusReview || '',
    CHECKS: ev.checks,
    MISSING_EVIDENCE: ev.missing,
    ...modeSummary(),
    GIT: baseline,
  }
}

// ============================================================
// Release Gate 模式
// ============================================================
if (mode === 'release_gate') {
  phase('Gate Checks')
  log('Release Gate：禁止新增 Feature，只收集当前有效证据。')
  const ev = await agent(`${PROJECT_RULES}
${FLASH_RULES}
[Release Gate 证据收集] 发布目标描述：${task}
禁止新增 Feature、禁止修改业务代码（运行构建/测试产生的产物除外）。只运行项目真实支持的命令（从 pyproject.toml / package.json / CI / Dockerfile / docs 中发现），逐项收集证据：
1. backend full tests
2. frontend production build
3. frontend/backend type check
4. clean database migration（全新库 upgrade）
5. migration rollback validation（downgrade 后 re-upgrade）
6. integration tests
7. performance tests（如项目存在；历史 TODO 中集成测试/安全审查/性能测试可能未完成，不得假设通过）
8. RAG regression（如适用）
9. medical safety regression（如适用）
10. Docker build（docker compose build 或 docker build，按项目实际配置）
11. deployment configuration 检查（deploy/、docker-compose.yml、环境变量引用完整性——不要输出任何真实 Secret 值）
12. smoke test（如项目支持本地启动冒烟；无法安全运行时标 missing_evidence）
13. rollback readiness（回滚路径是否存在且文档化）
每项 check 记录 name/performed/result/command/exitCode/evidence；无证据项标 missing_evidence 并列入 missing[]。`,
    { label: 'release-evidence', phase: 'Gate Checks', model: FLASH, schema: EVIDENCE_SCHEMA })
  if (!ev) return modelBlocked('Gate Checks', FLASH + ' (Qwen3.8-Flash)')

  phase('Gate Verdict')
  const sec = await agent(`${PROJECT_RULES}
${decisionRules()}
[Release 安全审查] 只读审查当前仓库的安全状态：认证/授权实现、IDOR 风险、Secret 管理（.env 是否被 gitignore、是否存在硬编码密码——不要输出真实 Secret 值）、依赖已知风险、CORS/生产配置、日志脱敏、医疗安全边界（无诊断/处方/调机参数输出）、隐私数据隔离。
输出 findings 摘要与结论。禁止修改任何文件。`,
    { label: 'release-security', phase: 'Gate Verdict', model: modelFor('reviewer'), effort: 'high', schema: {
      type: 'object',
      properties: {
        findings: { type: 'array', items: { type: 'string' } },
        blockingFindings: { type: 'array', items: { type: 'string' } },
        summary: { type: 'string' },
      },
      required: ['findings', 'blockingFindings', 'summary'],
    } })
  if (!sec) return modelBlocked('Gate Verdict', mname(modelFor('reviewer')))

  const rv = await agent(`${PROJECT_RULES}
${decisionRules()}
[Release Gate 判定] 发布目标：${task}
命令证据：
${j(ev, 16000)}
安全审查：
${j(sec, 8000)}
规则：任何必须项没有当前有效证据 → PROJECT_NOT_READY（不得根据历史文档假设通过；TODO 中的集成测试/安全审查/性能测试若未完成必须如实反映）。存在 blocking 安全发现 → PROJECT_NOT_READY。
只能返回 PROJECT_READY 或 PROJECT_NOT_READY，并列出 reasons 与 missingEvidence。`,
    { label: 'release-verdict', phase: 'Gate Verdict', model: modelFor('verifier'), schema: RELEASE_SCHEMA })
  if (!rv) return modelBlocked('Gate Verdict', mname(modelFor('verifier')))

  return {
    WORKFLOW_STATUS: rv.verdict,
    MODE: 'release_gate',
    TARGET: task,
    MODEL_USAGE: { EVIDENCE_RUNNER: mname(modelFor('evidence')), SECURITY_REVIEW: mname(modelFor('reviewer')), VERDICT: mname(modelFor('verifier')) },
    REASONS: rv.reasons,
    MISSING_EVIDENCE: rv.missingEvidence.concat(ev.missing || []),
    SECURITY_REVIEW: sec.summary,
    SECURITY_BLOCKING: sec.blockingFindings,
    CHECKS: ev.checks,
    // D3 终态二分：工程就绪 vs 真实生产批准。二者相互独立，绝不混为一谈。
    ENGINEERING_RELEASE_READY: rv.verdict === 'PROJECT_READY' ? 'YES' : 'NO',
    REAL_PRODUCTION_APPROVED: 'NO',
    REAL_PRODUCTION_APPROVAL_NOTE: '正式生产上线（formal production deployment）、生产库危险操作、生产密钥、支付、验证码、法务与医疗审批、真实患者数据授权均属 HUMAN_REQUIRED，必须由真实人工/授权主体批准。本 Workflow 仅给出【工程就绪】结论，绝不自动批准或假装生产已获批。ENGINEERING_RELEASE_READY=YES 也不等于可以上线——仍需人工完成 HUMAN_REQUIRED 审批链。',
    ...modeSummary(),
    GIT: baseline,
  }
}

// ============================================================
// TASK 模式
// ============================================================

// ---------- PHASE 1 — CLASSIFY ----------
phase('Classify')
const cls = await agent(`${PROJECT_RULES}
${decisionRules()}
[任务分类] 用户任务：
"""
${task}
"""
将任务分类（可多选）：frontend/backend/schema/migration/medical/knowledge/rag/training/irt/privacy/auth/security/observability/deployment/evaluation/cross_stack/bugfix/refactor/documentation。
判定 medicalSensitive（任务是否触及医疗内容/训练建议/疗效表达/转诊边界）、privacySensitive（是否触及用户健康信息/语音/个人数据）、securitySensitive（是否触及认证/授权/密钥/攻击面）。
判定各项 touched/expected 布尔位与 riskLevel(low/medium/high)。
【D3 HIGH Risk 判定】凡属以下任一类别，riskLevel 必须为 high（触发双独立审查）：安全关键、认证关键、RBAC、IDOR、隐私、健康数据、语音数据、医疗安全、敏感迁移、发布配置（deployment）。
【D3 HUMAN_REQUIRED 判定】若该任务的【完成验收】本质上需要真实人工审批——真实医疗专家验证、真实患者数据授权、伦理审查、版权/许可、生产密钥、生产数据库危险操作、正式生产部署、支付、真实短信验证码、法务审批——则 humanDecisionRequired=true 并在 humanDecisionReason 说明是哪一类、为什么无法由 Agent 自行批准。宁可标 true 交人工，绝不为推进任务而假装可自动批准。
如果无法可靠分类：blocked=true 并给出 blockReason。不要猜。`,
  { label: 'classify', phase: 'Classify', model: modelFor('planner'), schema: CLASSIFY_SCHEMA })
if (!cls) return modelBlocked('Classify', mname(modelFor('planner')))
if (cls.blocked) {
  return blocked('BLOCKED_UNCLEAR_TASK', 'Classify', {
    DETAIL: cls.blockReason || '无法可靠分类',
    SAFE_NEXT_ACTION: '请澄清任务目标、涉及模块与验收边界后重跑。',
  })
}
if (cls.humanDecisionRequired) {
  return pausedForHuman(cls.humanDecisionReason || '任务验收本质上需要真实人工审批（医疗专家验证 / 患者数据授权 / 伦理审查 / 版权许可 / 生产密钥 / 生产库危险操作 / 正式生产部署 / 支付 / 验证码 / 法务）。', 'Classify', { taskType: cls.taskType, riskLevel: cls.riskLevel })
}
log(`分类完成：taskType=[${cls.taskType.join(',')}], risk=${cls.riskLevel}, medical=${cls.medicalSensitive}, privacy=${cls.privacySensitive}, security=${cls.securitySensitive}, humanDecisionRequired=${!!cls.humanDecisionRequired}`)

// ---------- PHASE 2 — EXPLORE（只读） ----------
phase('Explore')
const preNotes = (pre.notes || '')
const exp = await agent(`${PROJECT_RULES}
${decisionRules()}
[只读探索] 任务：
"""
${task}
"""
分类结果：${j(cls, 3000)}
Preflight 备注（AGENTS.md / .qoder/rules 是否存在）：${preNotes}
要求：
1. 你处于只读模式：禁止 Write/Edit/创建/删除任何文件。
2. 先读取（如存在）：AGENTS.md、.qoder/rules/**；再读 README.md、PRD_技术规格.md、TODO.md、architecture-debt-assessment.md、code-review-report.md、system_design.md 中与任务相关的部分。
3. 先 search/grep/glob 定位，再按需读取与任务相关的代码；禁止把整个仓库读入上下文。
4. 至少分析：当前实现在哪里、相关 API、相关数据库模型、相关 Service、相关前端、相关测试、调用链、数据流、已有约束、可能影响的模块。
5. 从 pyproject.toml、package.json、CI 配置、README、docs 中发现项目真实支持的测试/构建/lint/迁移/集成命令（TEST_COMMANDS）。禁止假设 npm test / ruff / mypy 一定存在。
6. 判定 parallelSafe：仅当同时满足「无数据库前置依赖、不修改相同文件、API Contract 已冻结、无 Schema 依赖、合并顺序无语义依赖」才可为 true，并给出 parallelSafeReason。
输出：CURRENT_STATE / RELATED_FILES / DEPENDENCIES / RISKS / EXISTING_TESTS / POTENTIAL_REGRESSIONS / TEST_COMMANDS / parallelSafe。`,
  { label: 'explore', phase: 'Explore', model: modelFor('explorer'), effort: 'high', schema: EXPLORE_SCHEMA })
if (!exp) return modelBlocked('Explore', mname(modelFor('explorer')))
log(`探索完成：${(exp.RELATED_FILES || []).length} 个相关文件，parallelSafe=${exp.parallelSafe}`)

// ---------- PHASE 3 — SCOPE CHECK ----------
phase('Scope Check')
const scope = await agent(`${PROJECT_RULES}
${decisionRules()}
[Scope 检查] 任务：
"""
${task}
"""
探索结果摘要：
CURRENT_STATE: ${j(exp.CURRENT_STATE, 4000)}
RELATED_FILES: ${j(exp.RELATED_FILES, 2000)}
RISKS: ${j(exp.RISKS, 2000)}
判断该任务是否足够原子：原则上能在 0.5 ~ 1.5 个开发日内完成。
- 如果任务过大（例如"完成整个知识库/整个后台/整个项目/重构所有代码"这类 Mega Task）：atomic=false，并把它拆成多个原子子任务 recommendedTasks[]（每个含 taskId/title/objective/dependencies/acceptanceSummary），每个子任务都应在 0.5~1.5 开发日规模。
- 如果原子：atomic=true，给出 estimatedDevDays。
如实判断，不要为了继续执行而放宽标准。`,
  { label: 'scope-check', phase: 'Scope Check', model: modelFor('planner'), schema: SCOPE_SCHEMA })
if (!scope) return modelBlocked('Scope Check', mname(modelFor('planner')))
if (!scope.atomic) {
  log('任务过大：返回 NEEDS_DECOMPOSITION，本 Workflow 停止，不会实施任何代码。')
  return {
    WORKFLOW_STATUS: 'NEEDS_DECOMPOSITION',
    MODE: 'task',
    TASK: task,
    REASON: scope.reason,
    ESTIMATED_DEV_DAYS: scope.estimatedDevDays || null,
    RECOMMENDED_TASKS: scope.recommendedTasks || [],
    SAFE_NEXT_ACTION: '按 recommendedTasks 逐个调用本 Workflow（每次一个原子任务），Task 1 → Gate → Task 2 → Gate …',
    MODEL_USAGE: { DECOMPOSITION: mname(modelFor('planner')) },
    ...modeSummary(),
    GIT: baseline,
  }
}
log(`Scope 通过：约 ${scope.estimatedDevDays || '?'} 个开发日`)

// ---------- PHASE 4 — TASK_SPEC ----------
phase('Task Spec')
const spec = await agent(`${PROJECT_RULES}
${decisionRules()}
[生成 TASK_SPEC] 任务：
"""
${task}
"""
分类：${j(cls, 2000)}
探索结果：
${j({ CURRENT_STATE: exp.CURRENT_STATE, RELATED_FILES: exp.RELATED_FILES, DEPENDENCIES: exp.DEPENDENCIES, RISKS: exp.RISKS, EXISTING_TESTS: exp.EXISTING_TESTS, POTENTIAL_REGRESSIONS: exp.POTENTIAL_REGRESSIONS, TEST_COMMANDS: exp.TEST_COMMANDS }, 14000)}
生成不可变任务合同 TASK_SPEC，包含全部字段：TASK_ID（短横线小写 slug，如 kb-pdf-parser）、TITLE、OBJECTIVE、CONTEXT、DEPENDENCIES、IN_SCOPE、OUT_OF_SCOPE、EXPECTED_FILES、FILES_FORBIDDEN_TO_CHANGE、DATABASE_IMPACT、API_IMPACT、FRONTEND_IMPACT、SECURITY_IMPACT、PRIVACY_IMPACT、MEDICAL_IMPACT、KNOWLEDGE_IMPACT、MIGRATION_REQUIREMENTS、ACCEPTANCE_CRITERIA、MANDATORY_TESTS、REGRESSION_TESTS、MACHINE_GATE_COMMANDS、ROLLBACK_PLAN、KNOWN_RISKS、DELIVERABLES（可选 ALLOWED_WRITE_PATHS：授权写入的目录前缀）。
要求：
- ACCEPTANCE_CRITERIA 必须可验证、可观察，尽量可通过测试判断（示例：AC-01 未认证请求必须返回 401）。禁止"功能正常"这类模糊描述。每条含 id/criterion/verification。
- EXPECTED_FILES 必须逐条列出本任务允许创建/修改的确切路径（含写入 pre-existing 未跟踪目录内的文件）；如任务确需在整个目录内写入，另填 ALLOWED_WRITE_PATHS 目录前缀。二者都不含治理文件。
- MANDATORY_TESTS 必须使用 TEST_COMMANDS 中真实存在的命令体系；medicalSensitive=true 时必须包含医疗安全回归测试（若项目暂无对应测试，则把"补齐该测试"写入 IN_SCOPE 与 MANDATORY_TESTS）。
- MACHINE_GATE_COMMANDS 是 Machine Gate 的**冻结门禁合同**（FIX-GOV-001-R1），必须逐条声明本任务真正要运行的命令，每条含 gateId + kind + command + purpose：
  · gateId：稳定、非空、本 Task 内唯一（如 G-TARGET / G-BASE-PYTEST / G-MIGRATION），执行手无权新增/删除/改名。
  · kind：'required' = 本 Task 自身必须成功（目标测试、Scope/forbidden-file/HEAD/指纹校验、build、迁移 up/down/up、安全与医疗回归）；'record' = 采集当前基线事实（全量 pytest/ruff 等**本任务并不负责修红**的存量检查），其红色只入 findings、不阻断本 Task（D1 双真相），"缺安全环境"记 SAFELY_NOT_EXECUTED_AND_RECORDED。
  · 把 MANDATORY_TESTS 的每一项都落成 kind=required 的门禁；把 REGRESSION_TESTS 落成 required 或 record 并在 purpose 说明理由。**禁止**把本应 required 的目标测试声明为 record 来规避失败——Review/Verify 会把"目标测试被声明为 record"视为 blocker。
  · command 必须是项目真实支持的命令原文（执行手提交时会逐字比对，改写即 GATE_COMMAND_NOT_DECLARED）。
- privacySensitive=true 时 PRIVACY_IMPACT 必须覆盖：数据最小化、授权、访问控制、日志脱敏、数据隔离、删除路径、导出路径、审计。
- 数据库结构变更必须通过 MIGRATION_REQUIREMENTS 描述（含 downgrade 要求）。
- 将完整 TASK_SPEC JSON 写入文件 .qoder/workflow-state/<TASK_ID>.spec.json（这是你唯一允许写入的文件），并在 specPath 返回该路径。若该文件已存在（历史运行留痕），禁止覆盖：改用 .qoder/workflow-state/<TASK_ID>-<git短SHA>.spec.json（短 SHA 用 git rev-parse --short HEAD 获取）。
TASK_SPEC 一旦进入 IMPLEMENT，实施者禁止修改。`,
  { label: 'task-spec', phase: 'Task Spec', model: modelFor('planner'), effort: 'high', schema: SPEC_SCHEMA })
if (!spec) return modelBlocked('Task Spec', mname(modelFor('planner')))
log(`TASK_SPEC 生成：${spec.TASK_ID} — ${spec.TITLE}（AC ${spec.ACCEPTANCE_CRITERIA.length} 条，落盘 ${spec.specPath}）`)

// FIX-GOV-001-R1 A4：SPEC 门禁声明完整性 = 实施之前的 fail-closed 前置条件（0 个实施 agent）。
// 声明缺失/为空、gateId 空或非法或重复、kind 非法、command 为空 → GATE_SPEC_MALFORMED，
// 不启动 Worker、不跑门禁、不进入修复循环（"合同本身不完整"不允许靠实施者来回试错蒙混）。
{
  const gs = validateGateSpec(spec)
  if (gs) {
    return blocked(gs.code, 'Task Spec', {
      TASK_ID: spec.TASK_ID,
      SPEC_PATH: spec.specPath,
      DEFECTS: gs.defects,
      DETAIL: 'TASK_SPEC 的 MACHINE_GATE_COMMANDS 无法作为冻结门禁合同执行：' + gs.defects.join('；'),
      MANDATORY_TESTS: spec.MANDATORY_TESTS || [],
      REGRESSION_TESTS: spec.REGRESSION_TESTS || [],
      FILES_CURRENTLY_CHANGED: [],
      SAFE_NEXT_ACTION: '由 Max（治理阶段）补全/修正 MACHINE_GATE_COMMANDS（每条 = gateId + kind + command + purpose，gateId 稳定唯一，kind 只允许 required|record）后重跑本任务。本 Workflow 未启动任何实施 Agent，未修改任何文件。禁止由执行手在运行时补声明或改 kind。',
    })
  }
}
log(`GATE_SPEC 校验通过：声明 ${gateDecls(spec).length} 条门禁（required ${gateDecls(spec).filter(d => d.kind === 'required').length} / record ${gateDecls(spec).filter(d => d.kind === 'record').length}），gateId 全部唯一合法，对账键 = gateId`)

// ---------- D4 §26–§30：同任务重试产物归属（在任何写动作之前判定）----------
// 只有 retryOfTaskId == 本任务 且路径在两版 TASK_SPEC 允许写集合内 且非治理 且
// 上一 run manifest/journal 证据齐全 且 字节证据显示"上一 run 产物自上次结束以来未被外部改动"，
// 才把该 pre-existing 产物标为 RETRY_OWNED（属本任务延续，不算用户改动）。
// §28：一旦 LAST_TASK_OUTPUT_HASH ≠ CURRENT_RETRY_START_HASH → 立即 BLOCK，retry 绝不吞用户改动。
applyRetryOwnership(spec, WORKTREE_BASELINE)
if (RETRY_OWNERSHIP.status === 'BLOCKED_RETRY_ARTIFACT_CHANGED_EXTERNALLY') {
  const r = RETRY_OWNERSHIP.rejected.find((x) => x.reject === 'BLOCKED_RETRY_ARTIFACT_CHANGED_EXTERNALLY') || {}
  return blocked('BLOCKED_RETRY_ARTIFACT_CHANGED_EXTERNALLY', 'Task Spec', {
    TASK_ID: spec.TASK_ID,
    RETRY_OF: RETRY_OWNERSHIP.retryOf,
    PATH: r.path,
    LAST_TASK_OUTPUT_HASH: (r.detail || '').match(/LAST_TASK_OUTPUT_HASH=(\S+)/) ? RegExp.$1 : '',
    DETAIL: r.detail,
    RETRY_OWNERSHIP: { status: RETRY_OWNERSHIP.status, accepted: RETRY_OWNERSHIP.accepted.slice(), rejected: RETRY_OWNERSHIP.rejected.slice() },
    SAFE_NEXT_ACTION: '上一 run 的任务产物在两次 run 之间被外部（人工或其他进程）修改。Workflow 未修改任何文件。请人工确认该修改是否应保留：保留则把本任务改为"基于当前内容的新任务"（去掉 retryOfTaskId），否则由人工决定如何处置。',
  })
}
if (RETRY_OWNED && Object.keys(RETRY_OWNED).length) log(`RETRY_OWNED 生效：${Object.keys(RETRY_OWNED).join(', ')}（同一 Task 的上一 run 合法未提交产物，不当作用户 pre-existing 改动）`)

// ---------- PHASE 5 — IMPLEMENT ----------
phase('Implement')
const _retryNote = Object.keys(RETRY_OWNED).length
  ? `\n- 同任务重试产物（RETRY_OWNED，允许你在 TASK_SPEC 范围内继续完善）：${Object.keys(RETRY_OWNED).join(', ')}。除此之外，任何任务前已存在的未提交内容都是用户改动，禁止触碰。`
  : ''
const impl = await agent(`${PROJECT_RULES}
${FLASH_RULES}
[实施 TASK_SPEC] 第一步：读取 ${spec.specPath}（TASK_SPEC 全文），然后严格实施。
TASK_SPEC 摘要（以文件为准）：
${j(spec, 14000)}
探索线索（相关文件）：${j(exp.RELATED_FILES, 2000)}
要求：
- 只改 EXPECTED_FILES 范围内的文件；FILES_FORBIDDEN_TO_CHANGE 绝对不动；不得触碰用户在 Preflight 时已有的未提交修改。${_retryNote}
- 按 MANDATORY_TESTS 补齐/更新测试并本地运行；如实报告 TESTS_RUN 与 TEST_RESULTS。
- 完成后返回 IMPLEMENTATION_REPORT：status=IMPLEMENTED + FILES_CREATED/FILES_MODIFIED/FILES_DELETED/DATABASE_CHANGES/API_CHANGES/FRONTEND_CHANGES/TESTS_ADDED/TESTS_MODIFIED/TESTS_RUN/TEST_RESULTS/DEVIATIONS_FROM_SPEC/KNOWN_LIMITATIONS/BLOCKERS。
- 发现 TASK_SPEC 与真实代码冲突时：停止并返回 status=SPEC_CONFLICT（conflict/evidence/affectedFiles/recommendedDecision）。
- 记住：IMPLEMENTED ≠ PASS。`,
  { label: 'implement', phase: 'Implement', model: FLASH, schema: IMPL_SCHEMA })
if (!impl) return modelBlocked('Implement', FLASH + ' (Qwen3.8-Flash)')
if (impl.status === 'SPEC_CONFLICT') {
  return blocked('SPEC_CONFLICT', 'Implement', {
    TASK_ID: spec.TASK_ID,
    CONFLICT: impl.conflict,
    EVIDENCE: impl.evidence,
    AFFECTED_FILES: impl.affectedFiles || [],
    RECOMMENDED_DECISION: impl.recommendedDecision,
    FILES_CURRENTLY_CHANGED: (impl.FILES_MODIFIED || []).concat(impl.FILES_CREATED || []),
    SAFE_NEXT_ACTION: '由人工或 Max 重新评估并更新 TASK_SPEC 后重跑；Flash 无权自行改变设计。',
  })
}
if (impl.status !== 'IMPLEMENTED') {
  return blocked('IMPLEMENTATION_BLOCKED', 'Implement', {
    TASK_ID: spec.TASK_ID,
    DETAIL: impl.BLOCKERS || impl.KNOWN_LIMITATIONS || '实施者报告 BLOCKED',
    FILES_CURRENTLY_CHANGED: (impl.FILES_MODIFIED || []).concat(impl.FILES_CREATED || []),
    SAFE_NEXT_ACTION: '查看 BLOCKERS 详情，人工处理后重跑。',
  })
}
log(`实施完成（IMPLEMENTED ≠ PASS）：修改 ${(impl.FILES_MODIFIED || []).length} 个、新建 ${(impl.FILES_CREATED || []).length} 个文件`)

// ---------- D2-C / D4：实施后工作区 Delta 校验（脚本是权威裁判，先于 Machine Gate）----------
// 内容差异只在【确定性字节证据收敛】后才下结论：首次 hash 不一致 → FINGERPRINT_ADJUDICATION（§16–§20），
// 不误报 BLOCK，也绝不放走真实外部改动。治理/HEAD/index 违规不仲裁、不降级，立即 BLOCK。
let currentSnap = await snapshotWorktree('Implement 后 Task Delta 校验', 'Implement')
if (!currentSnap) return modelBlocked('Implement', mname(modelFor('snapshot')))
let _postEval = await evaluateTaskDelta(WORKTREE_BASELINE, currentSnap, [spec.specPath], 'Implement', 'post_implement')
if (_postEval.baseline && _postEval.baseline !== WORKTREE_BASELINE) WORKTREE_BASELINE = _postEval.baseline
let currentDelta = _postEval.delta
let currentEvidence = _postEval.current || currentSnap
let allowedRepairFiles = computeAllowedRepairFiles(currentDelta, spec)
{
  const v = _postEval.blocked || _postEval.viols[0]
  if (v) {
    return blocked(v.code, 'Implement', {
      TASK_ID: spec.TASK_ID,
      DETAIL: v.detail,
      FINGERPRINT: { backend: FINGERPRINT_BACKEND, authority: CONTENT_IDENTITY_AUTHORITY, scriptSideHash: SCRIPT_SIDE_HASH_AVAILABLE, baselineEvidence: evidenceStatusOf(WORKTREE_BASELINE), currentEvidence: evidenceStatusOf(currentEvidence), invalidDetected: FP_INVALID_DETECTED.slice(0, 8), falsePositivesRecovered: FP_FALSE_POSITIVES_RECOVERED.slice() },
      ADJUDICATION: (_postEval.adjudications || []).slice(),
      RETRY_OWNERSHIP: { status: RETRY_OWNERSHIP.status, retryOf: RETRY_OWNERSHIP.retryOf, artifacts: RETRY_OWNERSHIP.artifacts.slice(), accepted: RETRY_OWNERSHIP.accepted.slice(), rejected: RETRY_OWNERSHIP.rejected.slice() },
      TASK_DELTA: { taskChanged: currentDelta.taskChanged, taskGovernance: currentDelta.taskGovernance, preExistingUnchanged: currentDelta.preExistingUnchanged, externalChangedDuringTask: currentDelta.externalChangedDuringTask, preExistingReverted: currentDelta.preExistingReverted, treeUnitChanges: currentDelta.treeUnitChanges, headChanged: currentDelta.headChanged, stagedAppeared: currentDelta.stagedAppeared },
      GOVERNANCE_PROTECTED_PATHS: GOVERNANCE_PROTECTED_PATHS.concat([SELF_WORKFLOW_PATH]),
      FILES_CURRENTLY_CHANGED: currentDelta.taskChanged,
      SAFE_NEXT_ACTION: '本任务触碰了治理/pre-existing/HEAD/index 保护边界，编排器已停止且未启动任何 Flash 修复（不会 checkout/restore/reset/clean/stash）。请人工核查工作区：治理变更须走 Max 治理模式或人工授权治理流程；pre-existing 改动被误动须人工恢复。',
    })
  }
}
log(`Task Delta 校验通过（证据=${evidenceStatusOf(currentEvidence)}）：本任务改动 ${currentDelta.taskChanged.length} 项；pre-existing 未变 ${currentDelta.preExistingUnchanged.length} 项（不计入本任务）；retry-owned ${currentDelta.retryOwnedArtifacts.length} 项；目录单元变化 ${currentDelta.treeUnitChanges.length} 项；治理/HEAD/index 无违规。allowedRepairFiles=[${allowedRepairFiles.join(', ')}]`)

// ---------- PHASE 6/7 — MACHINE GATE + REPAIR LOOP ----------
function gateRequirements() {
  const req = []
  const tc = exp.TEST_COMMANDS || {}
  if (cls.backendTouchedExpected) req.push(`BACKEND：运行本次任务目标测试、与修改区域相关的测试、项目真实支持的 lint/typecheck。候选命令：${j(tc.backend || [], 800)} ${j(tc.lint || [], 400)}`)
  if (cls.frontendTouchedExpected) req.push(`FRONTEND：运行项目实际支持的 typecheck、相关测试、production build。候选命令：${j(tc.frontend || [], 800)}`)
  if (cls.schemaTouchedExpected || cls.migrationExpected) req.push(`SCHEMA/MIGRATION：验证 clean upgrade → downgrade → re-upgrade（如项目 Alembic 体系允许）；不得只验证 upgrade。候选命令：${j(tc.migration || [], 600)}`)
  if (cls.taskType.indexOf('auth') >= 0 || cls.taskType.indexOf('security') >= 0 || cls.securitySensitive) req.push('AUTH/SECURITY：运行相关 permission tests、IDOR tests、authentication tests、authorization tests。')
  if (cls.knowledgeTouchedExpected || cls.ragTouchedExpected) req.push('KNOWLEDGE/RAG：运行适用的 retrieval tests、metadata filter tests、citation tests、provenance tests、unapproved-document exclusion tests、expired-document exclusion tests。')
  if (cls.medicalSensitive) req.push('MEDICAL：运行已有 medical/safety regression。如果项目尚无对应测试且本次也未能补齐，不得以"没有测试"为由视为通过——记为 skippedGates 并说明。')
  if (spec.MANDATORY_TESTS && spec.MANDATORY_TESTS.length) req.push(`TASK_SPEC MANDATORY_TESTS：${j(spec.MANDATORY_TESTS, 800)}`)
  if (spec.REGRESSION_TESTS && spec.REGRESSION_TESTS.length) req.push(`TASK_SPEC REGRESSION_TESTS：${j(spec.REGRESSION_TESTS, 800)}`)
  if (!req.length) req.push('至少运行与本次改动相关、项目真实支持的检查（相关测试子集 / lint / build）。')
  return req
}

// FIX-GOV-001-R1：把冻结门禁合同渲染成执行手必须逐条回传 gateId 的表格（对账键 = gateId，不是命令字符串）。
// FIX-GOV-008 D4：每条门禁同时给出【必须逐字运行的包装形态】（B='声明原文' / printf Q / eval），
// 命令自身先打印 Q|<gateId>|<byteLen>|<b64(声明命令原文)> 再执行原文 ⇒ argv 身份由输出来作证。
function gateContractTable() {
  const decls = gateDecls(spec)
  return decls.map(d => {
    const head = `· gateId=${d.gateId} | kind=${d.kind} | command=${normGateCommand(d.command)} | purpose=${d.purpose || '-'}`
    return head + `\n  逐字运行这一条（不得改写其中任何字节；argvEcho 回传它打印的 Q 行原文）：\n${gateWrappedCommandForDecl(d)}`
  }).join('\n')
}

// D4：确定性字节取证执行器（替换 D2 的"LLM 自报 hash"快照）。
// 命令由脚本生成并逐字下发；执行手（modelFor('snapshot')）只负责"跑这一条命令、原样回传 stdout"，
// 对内容的任何判定都在脚本侧完成（parseFingerprintEvidence + classifyDelta）。
function fingerprintExecutorPrompt(purpose, cmd, extraConstraint) {
  return `${PROJECT_RULES}
${decisionRules()}
[确定性字节取证 · ${purpose}] 你处于只读模式：禁止 Write/Edit/创建/删除任何文件，禁止任何写操作，禁止任何破坏性 git 命令。
你只做一件事：把下面这条命令【逐字】交给 shell 执行一次，然后原样回传输出。
禁止：改写命令、增删参数、拆分或合并命令、总结输出、截断输出、重排行序、自行计算或补写任何 hash、凭记忆或猜测填数字。
${extraConstraint || ''}
命令（逐字执行，工作目录 = 仓库根）：
\`\`\`sh
${cmd}
\`\`\`
回传要求：command = 上述命令原文；exitCode = 真实退出码；rawStdout = stdout 原文（含每一行，保持行序；命令自带的 V/A 两行同样必须原样回传，删除或改写它们都会让本次证据被判不可信）；rawStderr = stderr 原文；filesWritten 恒为 []；gitCommandsRun = 实际运行过的 git 命令。
若命令无法执行（shell 不可用/命令不存在/仓库根无法进入）→ 如实报告 exitCode 与 rawStderr，并在 rawStdout 留空，禁止编造输出。`
}

async function runFingerprintExecutor(purpose, phaseName, label) {
  const cmd = buildFingerprintCommand(FP_REPO_ROOT || '.')
  const ex = await agent(fingerprintExecutorPrompt(purpose, cmd), {
    label: label || 'worktree-snapshot', phase: phaseName, model: modelFor('snapshot'), effort: 'low', schema: FP_EXECUTOR_SCHEMA,
  })
  if (!ex) return null
  const snap = parseFingerprintEvidence(ex, cmd)
  snap.purpose = purpose
  snap.runLabel = label || 'worktree-snapshot'
  FP_EVIDENCE_RUNS.push({
    run: FP_EVIDENCE_RUNS.length + 1, label: snap.runLabel, purpose, phase: phaseName,
    evidenceValid: snap.evidenceValid, problems: snap.problems.slice(0, 6),
    head: snap.head, branch: snap.branch, dirtyPaths: dirtyPaths(snap).size,
    commandVerbatim: snap.commandVerbatim, rawLineCount: snap.rawLineCount,
  })
  return snap
}

async function snapshotWorktree(purpose, phaseName) {
  return await runFingerprintExecutor(purpose, phaseName, 'worktree-snapshot')
}

// 内容身份签名（§13/§16）：两次独立取证若真为确定性，签名必须逐字符相同；不同则说明证据源不可信。
function identitySignature(s) {
  const m = identityMap(s)
  return JSON.stringify({
    head: (s && s.head) || '', branch: (s && s.branch) || '',
    staged: [...new Set(((s && s.staged) || []).map(canonicalPath))].sort(),
    paths: Object.keys(m).sort().map((p) => p + '=' + m[p]),
  })
}

// ---------- FINGERPRINT_ADJUDICATION（§16–§20）----------
// 首次 baseline↔post 不一致不再直接 BLOCK：先由两个彼此不可见的独立只读 invocation 重新取证，
// 脚本按确定性签名收敛。两者一致且与基准相同 → SNAPSHOT_FALSE_POSITIVE_RECOVERED（继续）；
// 两者一致且确实不同 → EXTERNAL_CHANGED_DURING_TASK（有字节证据，BLOCK）；
// 两者不一致 / 任一非法 / 模型不可用 → BLOCKED_FINGERPRINT_EVIDENCE_UNCERTAIN（停止，交人工，绝不猜）。
async function adjudicateFingerprints(ctx) {
  const entry = {
    n: ++adjudicationCount, stage: ctx.stage, phase: ctx.phase,
    reason: ctx.violation ? ctx.violation.code : 'FINGERPRINT_EVIDENCE_INVALID',
    disputedPaths: (ctx.disputed || []).slice(0, 20),
    rejectedEvidence: ctx.evidenceRejected === true,
    baselineWasInvalid: !isVerifiedEvidence(ctx.baseline),
  }
  if (entry.baselineWasInvalid && ctx.stage !== 'baseline') {
    entry.verdict = 'BLOCKED_FINGERPRINT_EVIDENCE_UNCERTAIN'
    entry.detail = 'WORKTREE_BASELINE 本身未通过确定性校验，且当前已非任务前时刻：任务前的字节状态无法事后重建，任何"未变/已变"结论都缺乏证据基础。停止并交人工核查工作区。'
    ADJUDICATION_LOG.push(entry)
    return { blocked: { code: entry.verdict, detail: entry.detail, adjudication: entry } }
  }
  const pair = await parallel([
    () => runFingerprintExecutor('FINGERPRINT_ADJUDICATION REHASH_A（独立重新取证，不复用上一次 hash）', ctx.phase, 'fingerprint-rehash-a'),
    () => runFingerprintExecutor('FINGERPRINT_ADJUDICATION REHASH_B（独立重新取证，与 A 互不可见）', ctx.phase, 'fingerprint-rehash-b'),
  ])
  entry.rehashA = pair[0] ? evidenceStatusOf(pair[0]) : 'MODEL_UNAVAILABLE'
  entry.rehashB = pair[1] ? evidenceStatusOf(pair[1]) : 'MODEL_UNAVAILABLE'
  if (!pair[0] || !pair[1]) {
    entry.verdict = 'BLOCKED_FINGERPRINT_EVIDENCE_UNCERTAIN'
    entry.detail = 'REHASH invocation 不可用（模型不可用或被跳过），无法完成独立二次取证。'
    ADJUDICATION_LOG.push(entry)
    return { blocked: { code: entry.verdict, detail: entry.detail, adjudication: entry } }
  }
  if (!isVerifiedEvidence(pair[0]) || !isVerifiedEvidence(pair[1])) {
    entry.verdict = 'BLOCKED_FINGERPRINT_EVIDENCE_UNCERTAIN'
    entry.detail = '两次独立取证均未通过确定性校验（sha256 必须 64 位小写 hex、命令须逐字一致、执行手须零写入）：A=' + entry.rehashA + '，B=' + entry.rehashB
    ADJUDICATION_LOG.push(entry)
    return { blocked: { code: entry.verdict, detail: entry.detail, adjudication: entry } }
  }
  const sigA = identitySignature(pair[0]), sigB = identitySignature(pair[1])
  if (sigA !== sigB) {
    entry.verdict = 'BLOCKED_FINGERPRINT_EVIDENCE_UNCERTAIN'
    entry.inconsistency = { a: JSON.parse(sigA).paths.length, b: JSON.parse(sigB).paths.length }
    const mA = identityMap(pair[0]), mB = identityMap(pair[1])
    const keys = [...new Set(Object.keys(mA).concat(Object.keys(mB)))].sort()
    entry.diverged = keys.filter((k) => mA[k] !== mB[k]).slice(0, 10).map((k) => k + ': A=' + String(mA[k]).slice(0, 16) + ' B=' + String(mB[k]).slice(0, 16))
    entry.detail = 'REHASH_A 与 REHASH_B 的确定性签名不一致：同一命令在两次独立只读取证中产出了不同结果，说明取证链路本身不可信（文件或枚举不确定）。禁止在此情况下推断任何变更归属。'
    ADJUDICATION_LOG.push(entry)
    return { blocked: { code: entry.verdict, detail: entry.detail, adjudication: entry } }
  }
  entry.agreement = 'CONVERGED'
  if (ctx.stage === 'baseline') {
    entry.verdict = 'BASELINE_REESTABLISHED_BY_CONVERGENCE'
    entry.detail = '任务前基线由两个独立 invocation 的收敛证据重建。'
    ADJUDICATION_LOG.push(entry)
    return { baseline: pair[0], current: ctx.current, adjudication: entry }
  }
  // 采信两个独立 invocation 收敛后的证据作为"当前工作区状态"，用同一套确定性逻辑重算 Task Delta。
  const nextDelta = classifyDelta(ctx.baseline, pair[0], ctx.auth)
  const nextViols = deltaViolations(nextDelta)
  entry.recomputedViolations = nextViols.map((v) => v.code)
  if (!nextViols.length) {
    entry.verdict = ctx.evidenceRejected ? 'EVIDENCE_REESTABLISHED_BY_CONVERGENCE' : 'SNAPSHOT_FALSE_POSITIVE_RECOVERED'
    entry.recoveredPaths = (ctx.disputed || []).slice()
    entry.detail = ctx.evidenceRejected
      ? '前一次取证未通过确定性校验（不可信证据源），两个独立 invocation 的收敛证据已替代它；替换后 Task Delta 干净，无内容变更事实。恢复推进。'
      : '前一次快照的 hash 差异未被独立二次取证复现：确定性 SHA-256 显示相关路径内容与 WORKTREE_BASELINE 一致（未变），原差异属不可信 fingerprint 造成的误报。恢复推进，不因误报 BLOCK。'
    FP_FALSE_POSITIVES_RECOVERED.push({ stage: ctx.stage, kind: entry.verdict, paths: entry.recoveredPaths, adjudication: entry.n })
    ADJUDICATION_LOG.push(entry)
    return { current: pair[0], delta: nextDelta, viols: [], recovered: true, adjudication: entry }
  }
  const persists = nextViols.find((v) => v.adjudicable)
  if (persists) {
    entry.verdict = 'EXTERNAL_CHANGED_DURING_TASK'
    entry.detail = '两个独立 invocation 的确定性 SHA-256 一致地显示：pre-existing 内容在任务期间确实发生变化（与 WORKTREE_BASELINE 字节不同）。本次为有字节证据的真实外部改动，BLOCK 成立。'
    ADJUDICATION_LOG.push(entry)
    return { blocked: { code: persists.code, detail: persists.detail + '｜仲裁结论：' + entry.detail, adjudication: entry, evidence: 'CONFIRMED_BY_DOUBLE_REHASH' } }
  }
  entry.verdict = 'ADJUDICATION_REVEALED_OTHER_VIOLATION'
  entry.detail = '内容差异未复现，但收敛证据暴露出其它治理/HEAD/index 违规，按原规则 BLOCK（不降级）。'
  ADJUDICATION_LOG.push(entry)
  return { blocked: nextViols[0], adjudication: entry }
}

// Task Delta 评估 + 自动仲裁（唯一入口）。返回 { delta, viols, current, baseline, adjudications }。
async function evaluateTaskDelta(baseline, current, auth, phaseName, stage) {
  let b = baseline, c = current, rounds = 0
  const adjudications = []
  for (;;) {
    const delta = classifyDelta(b, c, auth)
    const viols = deltaViolations(delta)
    const ad = viols.find((v) => v.adjudicable)
    if (!ad) return { baseline: b, current: c, delta, viols, adjudications }
    if (rounds >= 1) {
      return { blocked: { code: 'BLOCKED_FINGERPRINT_EVIDENCE_UNCERTAIN', detail: '确定性证据在仲裁后仍未收敛（超出 1 轮仲裁预算），停止并交人工。' }, delta, viols, adjudications }
    }
    rounds++
    const disputed = delta.evidenceRejected ? [] : [...new Set((delta.externalChangedDuringTask || []).concat(delta.preExistingReverted || []))].sort()
    const res = await adjudicateFingerprints({ baseline: b, current: c, auth, phase: phaseName, stage, violation: ad, evidenceRejected: delta.evidenceRejected === true, disputed })
    if (!res) return { blocked: { code: 'BLOCKED_MODEL_UNAVAILABLE', detail: '仲裁执行器不可用' }, delta, viols, adjudications }
    // 仲裁记录必须进入终态报告的 ADJUDICATION 链（含"确认型 BLOCK"：blocked.adjudication 形式），否则证据链断在报告里。
    if (res.adjudication) adjudications.push(res.adjudication)
    else if (res.blocked && res.blocked.adjudication) adjudications.push(res.blocked.adjudication)
    if (res.blocked) return { blocked: res.blocked, delta, viols, adjudications }
    if (res.baseline) b = res.baseline
    if (res.current) c = res.current
    if (!res.current && !res.baseline) return { blocked: { code: 'BLOCKED_FINGERPRINT_EVIDENCE_UNCERTAIN', detail: '仲裁未产出可用证据' }, delta, viols, adjudications }
  }
}

// 任务前基线建立：证据非法时用两个独立收敛 invocation 重建（此时"现在"仍等于"任务前"）。
async function establishWorktreeBaseline(phaseName) {
  const first = await snapshotWorktree('Preflight baseline（Task Delta 基准）', phaseName || 'Preflight')
  if (!first) return null
  if (isVerifiedEvidence(first)) return { baseline: first }
  const res = await adjudicateFingerprints({
    baseline: first, current: first, auth: [], phase: phaseName || 'Preflight', stage: 'baseline',
    violation: { code: 'FINGERPRINT_EVIDENCE_INVALID' }, evidenceRejected: true, disputed: [],
  })
  if (res.blocked) {
    const ad = res.adjudication || (res.blocked && res.blocked.adjudication) || null
    return { blocked: res.blocked, adjudications: (res.adjudications || []).concat(ad ? [ad] : []) }
  }
  return { baseline: res.baseline, adjudications: res.adjudications || [] }
}

// D2 §12/§13/§17/§18/§19 + D4 §16–§20：受守卫的 Flash 修复调用。
// 启动前：Task Delta（经确定性证据 + 必要时仲裁）若仍有 governance/external/head/index 违规，或 allowedRepairFiles 为空 → 不启动 Flash。
// 启动后：扫描自报 gitCommandsRun（denylist）+ 修复后确定性指纹校验；任一层命中 → 返回 violation 交编排器 BLOCK。
async function guardedFlashRepair(prompt, label, allowedRepairFiles, phaseName) {
  const auth = [spec.specPath]
  const preSnap = await snapshotWorktree(`${label} 修复前快照`, phaseName || 'Repair')
  if (!preSnap) return { modelBlocked: mname(modelFor('snapshot')) }
  const preEval = await evaluateTaskDelta(WORKTREE_BASELINE, preSnap, auth, phaseName || 'Repair', 'pre_repair')
  if (preEval.baseline && preEval.baseline !== WORKTREE_BASELINE) WORKTREE_BASELINE = preEval.baseline
  const preDelta = preEval.delta
  const preViol = preEval.blocked || preEval.viols[0]
  if (preViol) return { violation: preViol, stage: 'PRE_REPAIR_DELTA', preSnap, adjudications: preEval.adjudications }
  const preVerified = preEval.current || preSnap
  const allowedNow = computeAllowedRepairFiles(preDelta, spec)
  const allowed = (allowedNow && allowedNow.length) ? allowedNow : (allowedRepairFiles || [])
  if (!allowed.length) return { violation: { code: 'BLOCKED_REPAIR_OUT_OF_SCOPE', detail: 'REPAIR_SCOPE.allowedRepairFiles 为空：required 门禁失败的归属文件不在本任务 allowedWritePaths 内（可能属 pre-existing / governance / 归属不明），不得由 Flash 修复。' }, stage: 'REPAIR_SCOPE_EMPTY', preSnap, REPAIR_SCOPE: buildRepairScope(preDelta, allowed) }
  const res = await agent(prompt, { label, phase: phaseName || 'Repair', model: FLASH, schema: FIXREPORT_SCHEMA })
  if (!res) return { modelBlocked: FLASH + ' (Qwen3.8-Flash)' }
  const reported = Array.isArray(res.gitCommandsRun) ? res.gitCommandsRun : []
  for (const c of reported) {
    const d = detectForbiddenGit(c)
    if (d) return { violation: { code: 'GOVERNANCE_POLICY_VIOLATION', tier: d.tier, subcommand: d.subcommand, command: c, detail: `Flash 在 ${label} 阶段报告执行了被禁止的 git 命令（${d.tier}: git ${d.subcommand}）：${c}。破坏性/变更类 git 一律 HARD DENY，正确做法是返回 BLOCKED。` }, stage: 'GIT_DENYLIST', result: res, preSnap }
    const u = scanUnsafeDbCommand(c)
    if (u) return { violation: { code: u.code, command: c, detail: u.detail }, stage: 'UNSAFE_DB_TARGET', result: res, preSnap }
  }
  // D3：修复Worker 也可能自报它跑过的 shell/DB 命令；顺带扫描命令文本里的破坏性 :5432 目标。
  for (const c of (Array.isArray(res.commandsRun) ? res.commandsRun : [])) {
    const u = scanUnsafeDbCommand(c)
    if (u) return { violation: { code: u.code, command: c, detail: u.detail }, stage: 'UNSAFE_DB_TARGET', result: res, preSnap }
  }
  const postSnap = await snapshotWorktree(`${label} 修复后确定性指纹校验快照`, phaseName || 'Repair')
  if (!postSnap) return { modelBlocked: mname(modelFor('snapshot')) }
  const postEval = await evaluateTaskDelta(WORKTREE_BASELINE, postSnap, auth, phaseName || 'Repair', 'post_repair')
  if (postEval.baseline && postEval.baseline !== WORKTREE_BASELINE) WORKTREE_BASELINE = postEval.baseline
  const postViol = postEval.blocked || postEval.viols[0]
  if (postViol) return { violation: postViol, stage: 'POST_REPAIR_DELTA', result: res, preSnap, postSnap, adjudications: postEval.adjudications }
  const postVerified = postEval.current || postSnap
  const v = verifyRepairFingerprints(WORKTREE_BASELINE, preVerified, postVerified, allowed, auth)
  if (!v.ok) return { violation: v.violation, stage: 'POST_REPAIR_FINGERPRINT', result: res, preSnap, postSnap }
  return { result: res, preSnap: preVerified, postSnap: postVerified, delta: v.delta || postEval.delta, allowedRepairFiles: allowed, adjudications: (preEval.adjudications || []).concat(postEval.adjudications || []) }
}

// D2 §18：构造 REPAIR_SCOPE（供日志/报告与 eligibility 判定）。
function buildRepairScope(delta, allowedRepairFiles) {
  return {
    taskOwnedFiles: (delta && delta.taskChanged || []),
    preExistingFiles: (delta && delta.preExistingUnchanged || []),
    protectedFiles: (delta && delta.taskGovernance || []),
    externalFiles: (delta && delta.externalChangedDuringTask || []).concat((delta && delta.preExistingReverted) || []),
    allowedRepairFiles: allowedRepairFiles || [],
    governanceProtectedPaths: GOVERNANCE_PROTECTED_PATHS.concat([SELF_WORKFLOW_PATH]),
  }
}

async function runMachineGate(round) {
  return await agent(`${PROJECT_RULES}
${FLASH_RULES}
[Machine Gate 执行器 · 第 ${round} 轮] 你是客观裁判的执行手：只真实运行命令并如实记录退出码。禁止修改任何文件（测试运行自身产生的临时产物除外）、禁止修改任何业务代码或测试、禁止凭感觉判断、禁止虚报退出码（Max 会在 Verify 阶段抽查重跑）。
[验证意图（语义清单，来自任务分类与 TASK_SPEC 的 MANDATORY/REGRESSION）—— 不直接提交，其机器化形态就是下方冻结合同：合同必须逐条覆盖本清单的每一项 required 意图，缺项由 Review/Verify 出 blocker]
${gateRequirements().map((r, i) => `${i + 1}. ${r}`).join('\n')}
[冻结门禁合同（TASK_SPEC.MACHINE_GATE_COMMANDS）—— 本轮唯一命令集合，逐条执行、逐条回传 gateId 与该条命令自带的 Q 行回显]
${gateContractTable()}
硬约束（违反即终态阻塞，不进入修复循环，脚本侧按 gateId 对账）：
· 上面每一条门禁都必须真实运行并在 commands[] 中以同一 gateId 回传；command 原文须与声明逐字一致（只允许空白折叠差异）。
· argvEcho 必填：逐字回传该条门禁【包装命令自己打印】的那一行 Q|<gateId>|<byteLen>|<base64(声明命令原文)>。禁止自行拼造、禁止改写空白、禁止把 command 字段抄进 Q 行、禁止回传另一条门禁的 Q 行。脚本会用自实现的 base64 独立重算期望值并逐字符比对 —— 不符即终态 GATE_ARGV_NOT_VERBATIM（required 与 record 同样不得放行）。
· 安全地无法执行某条门禁（缺安全测试环境）时，如实省略 exitCode 并如实留空 argvEcho，绝不为凑字段而伪造执行痕迹。
· 禁止提交合同之外的任何命令（预读 pyproject/package.json、核实命令是否存在等过程写入 notes，不进 commands[]）；引用未声明的 gateId 或提交未声明的命令 → GATE_COMMAND_NOT_DECLARED，即便 exitCode=0。
· 禁止省略合同中的任何一条 → BLOCKED_GATE_COMMAND_NOT_EXECUTED。"只交几条绿色命令 + 自报 allPassed:true" 从不构成门禁通过。
· 禁止改 kind（声明 required 就按 required 回传，声明 record 就按 record 回传）。
[命令分类 kind —— 由 TASK_SPEC 指定，你无权更改]
· kind=required —— 本 Task 自身必须成功的验证（产物存在、Scope/forbidden-file 校验、Git HEAD/branch 校验、pre-existing untracked 指纹校验、Feature/Bugfix 的目标测试/build/migration 等）。required 命令 exitCode!==0 → 本 Task MACHINE_FAIL；required 命令因缺安全测试环境无法执行 → 置顶层 blockedMissingSafeTestEnv=true。
· kind=record —— 采集当前基线事实（全量 pytest、全量 ruff、安全扫描、性能探针、迁移安全环境可用性等）。record 命令 exitCode!==0 属正常基线发现，写入 findings，绝不使本 Task MACHINE_FAIL，也绝不触发修复。record 命令必须"真执行并记录"（recordStatus=EXECUTED_AND_RECORDED）或"安全地不执行并记录原因+环境证据"（recordStatus=SAFELY_NOT_EXECUTED_AND_RECORDED）。
· 约定：命令名/purpose 前缀 [GATE-REQUIRED-*] → required；[AUDIT-EXEC-*]/[COND-EXEC-*] → record（以 TASK_SPEC 明示的 kind 为准）。
· 防滥用（MODEL/GOVERNANCE POLICY）：你（Flash）无权把 required 降级为 record、无权删除/跳过/降低任何门禁、无权因测试失败就把它改记为 record。普通 Feature Task 的目标测试默认 required。
· record 命令采集本身失败（命令不存在 / 输出无法解析 / 报告无法落盘）→ recordStatus=RECORD_COLLECTION_FAILED，并在 stderrSummary 说明。
规则：
- 首先核对 pyproject.toml / package.json / README / docs / CI，确认命令真实存在；只运行项目真实支持的命令；项目不支持的门禁项记入 skippedGates 并说明原因，不得凭空假设 npm test / ruff / mypy 存在。
- 每条命令记录 gateId / command / kind / purpose / argvEcho（该门禁包装命令打印的 Q 行原文，必填）/ exitCode / recordStatus / stdoutSummary / stderrSummary（摘要即可，禁止贴超长输出，禁止输出任何 Secret）。
- 数据库相关测试优先使用项目已有的安全测试配置/mock；required 命令无法安全运行（缺安全测试环境且无法 mock）→ blockedMissingSafeTestEnv=true；record 命令无法安全运行 → recordStatus=SAFELY_NOT_EXECUTED_AND_RECORDED + finding，不置 blockedMissingSafeTestEnv。
- record 命令发现的基线问题（测试红/lint 债/安全缺口/性能缺口/缺安全环境）逐条写入 findings（Finding ID|Severity|Evidence|Affected Area|Follow-up），不得静默丢弃。
- [D2-C Scope 判定归属] Scope / forbidden-file / 治理文件 / pre-existing / HEAD / index 的权威判定由**编排器脚本**基于 Task Delta（WORKTREE_BASELINE↔当前工作区指纹快照）完成，不由你按裸 git status 判定。你若运行 scope 类 required 命令，必须对照 Preflight 基线：**任务前已存在且指纹未变的改动（PRE_EXISTING_UNCHANGED）不算本任务越界**，不得据此判失败；只有本任务新建/新改的文件才计入 Scope。禁止用 git checkout/restore/reset/clean/stash 去"消除"任何 diff。
- 禁止为了通过而删除/跳过/修改测试。allPassed 由你自报但脚本不采信，最终以脚本按 kind 分层计算为准。`,
    { label: 'machine-gate', phase: 'Machine Gate', model: FLASH, effort: 'low', schema: GATE_SCHEMA })
}

// ---------- Gate 裁判（脚本是唯一裁判：按 kind 分层计算，忽略执行手自报 allPassed / blockedMissingSafeTestEnv） ----------
function gateSplit(g) {
  const cmds = (g && Array.isArray(g.commands)) ? g.commands : []
  const required = cmds.filter(c => (c.kind || 'required') !== 'record')
  const record = cmds.filter(c => c.kind === 'record')
  return { cmds, required, record }
}
function gateCompute(g) {
  const { cmds, required, record } = gateSplit(g)
  // required：必须有数值 exitCode 且 ===0；无法安全执行或采集失败视为任务级阻塞
  const requiredFailed = required.filter(c => typeof c.exitCode === 'number' && c.exitCode !== 0)
  const requiredBlocked = required.filter(c =>
    c.recordStatus === 'SAFELY_NOT_EXECUTED_AND_RECORDED' ||
    c.recordStatus === 'RECORD_COLLECTION_FAILED' ||
    typeof c.exitCode !== 'number')
  const requiredPassed = requiredFailed.length === 0 && requiredBlocked.length === 0
  // record：红色（exitCode!==0）或安全不执行均属正常采集；只有"采集失败"才算未完成
  const recordFailed = record.filter(c => c.recordStatus === 'RECORD_COLLECTION_FAILED')
  const recordCollectionComplete = record.every(c =>
    c.recordStatus === 'EXECUTED_AND_RECORDED' ||
    c.recordStatus === 'SAFELY_NOT_EXECUTED_AND_RECORDED' ||
    (typeof c.exitCode === 'number' && c.recordStatus !== 'RECORD_COLLECTION_FAILED'))
  // 任务级 BLOCKED_MISSING_SAFE_TEST_ENV 只由 required 命令触发（record 缺安全环境不阻塞本 Task）
  const blockedMissingSafeTestEnv = requiredBlocked.length > 0
  const machinePass = cmds.length > 0 && requiredPassed && recordCollectionComplete && !blockedMissingSafeTestEnv
  const recordRed = record.filter(c => (typeof c.exitCode === 'number' && c.exitCode !== 0) || c.recordStatus === 'SAFELY_NOT_EXECUTED_AND_RECORDED')
  const baselineHealth = recordRed.length === 0 ? 'HEALTHY' : 'DEGRADED'
  return {
    cmds, required, record, requiredFailed, requiredBlocked, requiredPassed,
    recordFailed, recordCollectionComplete, blockedMissingSafeTestEnv,
    machinePass, recordRed, baselineHealth,
    findings: (g && Array.isArray(g.findings)) ? g.findings : [],
  }
}
function gatePass(g) { return gateCompute(g).machinePass }
function gateFailSummary(g) {
  const gc = gateCompute(g)
  const parts = []
  for (const c of gc.requiredFailed) parts.push(`[REQUIRED-FAIL] 命令: ${c.command}\nexitCode: ${c.exitCode}\nstdout: ${c.stdoutSummary || '-'}\nstderr: ${c.stderrSummary || '-'}`)
  for (const c of gc.requiredBlocked) parts.push(`[REQUIRED-BLOCKED-SAFE-ENV] 命令: ${c.command}\nrecordStatus: ${c.recordStatus || '-'}\nstderr: ${c.stderrSummary || '-'}`)
  for (const c of gc.recordFailed) parts.push(`[RECORD-COLLECTION-FAILED] 命令: ${c.command}\nstderr: ${c.stderrSummary || '-'}`)
  return parts.join('\n---\n')
}

// D3/FIX-GOV-001-R1 反作弊门禁守卫：在任何修复之前，对执行手返回的每条命令做扫描——
// ① 是否指向 :5432 破坏性数据库目标；② 是否把声明为 required 的门禁降级为 record（I1）；
// ③ 提交面与冻结声明面的对账（I2 省略 / I3 未声明或顶替 / kind 擅改）。命中即返回终态 blocked()，绝不进入修复循环。
function gateGuardViolation(g) {
  const cmds = (g && Array.isArray(g.commands)) ? g.commands : []
  for (const c of cmds) {
    const u = scanUnsafeDbCommand(String((c && c.command) || ''))
    if (u) return blocked(u.code, 'Machine Gate', {
      TASK_ID: spec.TASK_ID,
      DETAIL: u.detail,
      OFFENDING_COMMAND: c.command,
      FILES_CURRENTLY_CHANGED: (impl.FILES_MODIFIED || []).concat(impl.FILES_CREATED || []),
      SAFE_NEXT_ACTION: '禁止对未知/生产 :5432 数据库实例执行任何破坏性操作（drop/truncate/delete/downgrade 等）。一次性测试库 :55432 不在此列。请改用可证明安全的一次性测试库或 mock 后重跑；本 Workflow 未连接、未改动任何数据库。',
    })
  }
  const dg = detectRequiredDowngrade(cmds, spec)
  if (dg) return blocked(dg.code, 'Machine Gate', {
    TASK_ID: spec.TASK_ID,
    GIT_TIER: dg.tier,
    DETAIL: dg.detail,
    GATE_CONTRACT_DECLARED: gateDecls(spec).map(d => `${d.gateId}:${d.kind}`),
    GATE_CONTRACT_SUBMITTED: cmds.map(c => `${(c && c.gateId) || '(无 gateId)'}:${effGateKind(c)}`),
    GOVERNANCE_PROTECTED_PATHS: GOVERNANCE_PROTECTED_PATHS.concat([SELF_WORKFLOW_PATH]),
    FILES_CURRENTLY_CHANGED: (impl.FILES_MODIFIED || []).concat(impl.FILES_CREATED || []),
    SAFE_NEXT_ACTION: '执行手无权把 TASK_SPEC 冻结声明为 required 的门禁降级为 record（GOVERNANCE/MODEL POLICY VIOLATION）。required 失败必须进入修复或 BLOCKED，绝不能改记为 record 蒙混过关。普通 Feature Task 的目标测试/build/migration 默认全部 required；若 Max 认为该门禁应属 record（采集基线事实），那是 SPEC 层决策，须由 Max 治理阶段修订合同，而非由执行手改标。',
  })
  const dc = detectGateDeclaration(cmds, spec)
  if (dc) return blocked(dc.code, 'Machine Gate', {
    TASK_ID: spec.TASK_ID,
    GIT_TIER: dc.tier,
    DETAIL: dc.detail,
    GATE_CONTRACT_DECLARED: gateDecls(spec).map(d => `${d.gateId}:${d.kind} = ${normGateCommand(d.command)}`),
    GATE_CONTRACT_SUBMITTED: cmds.map(c => `${(c && c.gateId) || '(无 gateId)'}:${effGateKind(c)} = ${normGateCommand(c && c.command)}`),
    FILES_CURRENTLY_CHANGED: (impl.FILES_MODIFIED || []).concat(impl.FILES_CREATED || []),
    SAFE_NEXT_ACTION: 'Machine Gate 只执行 TASK_SPEC.MACHINE_GATE_COMMANDS 冻结声明过的门禁：每条命令必须逐条回传其 gateId、命令原文须与声明一致、kind 不得改动、声明过的门禁一条都不能少。沉默省略（只提交若干条绿色命令 + 自报 allPassed:true）与"换一条会绿的命令顶替红门禁"同样构成终态阻塞。若确需增删门禁，由 Max 在治理阶段修订合同后重跑，执行手无权改动。',
  })
  const ae = detectGateArgvEcho(cmds, spec)
  if (ae) return blocked(ae.code, 'Machine Gate', {
    TASK_ID: spec.TASK_ID,
    GIT_TIER: ae.tier,
    GATE_ID: ae.gateId,
    DETAIL: ae.detail,
    GATE_CONTRACT_DECLARED: gateDecls(spec).map(d => `${d.gateId}:${d.kind} = ${normGateCommand(d.command)}`),
    GATE_CONTRACT_SUBMITTED: cmds.map(c => `${(c && c.gateId) || '(无 gateId)'}:${effGateKind(c)} argvEcho=${String((c && c.argvEcho) == null ? '(缺失)' : c.argvEcho).slice(0, 160)}`),
    FILES_CURRENTLY_CHANGED: (impl.FILES_MODIFIED || []).concat(impl.FILES_CREATED || []),
    SAFE_NEXT_ACTION: '门禁的 argv 身份由命令自身回显（Q 行）作证，脚本用自实现的 base64 独立重算期望值并逐字符复核。缺失、空白型改动、或 b64 指向另一条命令，都属证据不确定 → 一律 BLOCK，绝不降级为警告：required 与 record 同样不得放行。执行手无权改写 Q 行；如某条声明命令确实无法安全执行，请如实省略 exitCode 并说明原因，而不是伪造 argvEcho。若确需调整门禁命令，由 Max 在治理阶段修订 TASK_SPEC 合同后重跑。',
  })
  return null
}

let cycles = 0            // 全任务 Repair Cycle 计数，硬上限 3
const attemptHistory = []
phase('Machine Gate')
let gate = await runMachineGate(1)
if (!gate) return modelBlocked('Machine Gate', FLASH + ' (Qwen3.8-Flash)')
{ const term = gateGuardViolation(gate); if (term) return term }
let gc = gateCompute(gate)
if (gc.blockedMissingSafeTestEnv) {
  return blocked('BLOCKED_MISSING_SAFE_TEST_ENV', 'Machine Gate', {
    TASK_ID: spec.TASK_ID,
    DETAIL: '某 REQUIRED 门禁命令因缺安全测试环境无法执行：' + gc.requiredBlocked.map(c => c.command).join(' | '),
    FILES_CURRENTLY_CHANGED: (impl.FILES_MODIFIED || []).concat(impl.FILES_CREATED || []),
    SAFE_NEXT_ACTION: '为 required 命令准备安全的本地测试环境（测试数据库/Redis/mock）后重跑；record 型基线命令缺安全环境不阻塞本 Task（应记 SAFELY_NOT_EXECUTED_AND_RECORDED + finding）。禁止对生产环境运行测试。',
  })
}

while (!gatePass(gate)) {
  if (cycles >= 3) {
    return blocked('BLOCKED_REPAIR_LIMIT', 'Machine Gate', {
      TASK_ID: spec.TASK_ID,
      ATTEMPTS: cycles,
      rootCause: '连续修复未解决，详见 attemptHistory',
      attemptHistory,
      remainingBlockers: [gateFailSummary(gate)],
      recommendedHumanDecision: '人工介入：审查失败输出与 git diff，决定回滚（git checkout 由人工执行）或重新定义任务。',
      FILES_CURRENTLY_CHANGED: (impl.FILES_MODIFIED || []).concat(impl.FILES_CREATED || []),
    })
  }
  cycles++
  phase('Repair')
  const failText = gateFailSummary(gate)
  log(`MACHINE_FAIL（第 ${cycles}/3 轮修复）`)
  // D2 §12/§18：REPAIR_SCOPE 预检（基于当前 Task Delta）；allowedRepairFiles 为空时 guardedFlashRepair 不启动 Flash。
  const repairScope = buildRepairScope(currentDelta, allowedRepairFiles)
  let rcaRootCause = null
  let guard
  if (cycles === 1) {
    guard = await guardedFlashRepair(`${PROJECT_RULES}
${FLASH_RULES}
${FLASH_REPAIR_RULES}
[Self-Repair] TASK_SPEC 见 ${spec.specPath}。Machine Gate 失败如下：
${failText}
[REPAIR_SCOPE] 你**只能**修改以下本任务授权文件 allowedRepairFiles：${allowedRepairFiles.join(', ') || '（空）'}。
治理保护文件（绝对禁区，任何情况不可创建/修改/删除）：${repairScope.governanceProtectedPaths.join(', ')}。
pre-existing（任务前已存在、指纹须保持不变、绝不可动/还原）：${(repairScope.preExistingFiles || []).join(', ') || '（无）'}。
只做一次针对性修复：仅修复上述失败，禁止顺便改其他问题、禁止扩大 scope、禁止删除/跳过测试、禁止任何破坏性或变更类 git 命令。修复后返回 status/summary/filesChanged/gitCommandsRun。若 blocker 归属治理文件 / pre-existing 文件 / 归属不明文件 → 不要修复，直接返回 status=BLOCKED 并说明。`,
      'self-repair', allowedRepairFiles, 'Repair')
  } else {
    const rca = await agent(`${PROJECT_RULES}
${decisionRules()}
[Root Cause Analysis] 只读分析（禁止 Write/Edit）。Flash 自修复后 Machine Gate 仍失败。
TASK_SPEC：${spec.specPath}
失败输出：
${failText}
修复历史：${j(attemptHistory, 2000)}
[REPAIR_SCOPE 约束] 修复只能落在 allowedRepairFiles=${allowedRepairFiles.join(', ') || '（空）'}；禁止把修复方案指向治理文件或 pre-existing 文件（那属 BLOCKED_EXTERNAL_WORKTREE_CHANGE / BLOCKED_GOVERNANCE_CONFLICT，须交人工）。
请阅读 git diff、相关源码与测试，输出 ROOT_CAUSE 与只针对 blocker 的 FIX_SPEC（禁止顺带其他改动）。`,
      { label: 'rca', phase: 'Repair', model: modelFor('rca'), effort: 'high', schema: RCA_SCHEMA })
    if (!rca) return modelBlocked('Repair', mname(modelFor('rca')))
    rcaRootCause = rca.ROOT_CAUSE
    guard = await guardedFlashRepair(`${PROJECT_RULES}
${FLASH_RULES}
${FLASH_REPAIR_RULES}
[执行 FIX_SPEC] 严格按以下 FIX_SPEC 修复，禁止任何顺带改动：
ROOT_CAUSE: ${rca.ROOT_CAUSE}
FIX_SPEC:
${j(rca.FIX_SPEC, 8000)}
[REPAIR_SCOPE] 只能修改 allowedRepairFiles：${allowedRepairFiles.join(', ') || '（空）'}；治理/pre-existing 文件绝对禁动；禁止任何破坏性或变更类 git 命令。完成后返回 status/summary/filesChanged/gitCommandsRun。`,
      'rca-fix', allowedRepairFiles, 'Repair')
  }
  if (guard.modelBlocked) return modelBlocked('Repair', guard.modelBlocked)
  if (guard.violation) {
    const v = guard.violation
    attemptHistory.push({ cycle: cycles, kind: 'REPAIR_GUARD_BLOCK', stage: guard.stage, code: v.code, detail: v.detail, command: v.command || null, tier: v.tier || null })
    return blocked(v.code, 'Repair', {
      TASK_ID: spec.TASK_ID, ATTEMPTS: cycles, attemptHistory,
      DETAIL: v.detail, STAGE: guard.stage,
      OFFENDING_COMMAND: v.command || null, GIT_TIER: v.tier || null,
      REPAIR_SCOPE: repairScope,
      GOVERNANCE_PROTECTED_PATHS: repairScope.governanceProtectedPaths,
      FILES_CURRENTLY_CHANGED: currentDelta.taskChanged,
      SAFE_NEXT_ACTION: '修复触发 D2 守卫（破坏性 git / 治理文件 / pre-existing 被改或被还原 / HEAD / index / 越界）。编排器已停止且未执行任何还原命令。请人工核查工作区并决定后续；禁止由 Flash 自行 checkout/restore/reset/clean/stash 还原。',
    })
  }
  if (guard.result) attemptHistory.push({ cycle: cycles, kind: cycles === 1 ? 'FLASH_SELF_REPAIR' : 'MAX_RCA+FLASH_FIX', rootCause: rcaRootCause, status: guard.result.status, summary: guard.result.summary, filesChanged: guard.result.filesChanged || [], gitCommandsRun: guard.result.gitCommandsRun || [] })
  // D2：修复后刷新 Task Delta / allowedRepairFiles（供下一轮预检、Review、Verify）
  if (guard.postSnap) { currentSnap = guard.postSnap; currentDelta = classifyDelta(WORKTREE_BASELINE, currentSnap, [spec.specPath]); allowedRepairFiles = computeAllowedRepairFiles(currentDelta, spec) }
  phase('Machine Gate')
  gate = await runMachineGate(cycles + 1)
  if (!gate) return modelBlocked('Machine Gate', FLASH + ' (Qwen3.8-Flash)')
  { const term = gateGuardViolation(gate); if (term) return term }
  gc = gateCompute(gate)
  if (gc.blockedMissingSafeTestEnv) {
    return blocked('BLOCKED_MISSING_SAFE_TEST_ENV', 'Machine Gate', {
      TASK_ID: spec.TASK_ID, ATTEMPTS: cycles, attemptHistory,
      DETAIL: '某 REQUIRED 门禁命令因缺安全测试环境无法执行：' + gc.requiredBlocked.map(c => c.command).join(' | '),
      SAFE_NEXT_ACTION: '为 required 命令准备安全测试环境后重跑；record 型基线缺安全环境不阻塞本 Task。',
    })
  }
}
log(`MACHINE_PASS：required 门禁全部通过（${gc.required.length} 条 required，0 失败）；record 基线采集完整（${gc.record.length} 条 record，其中红/安全不执行 ${gc.recordRed.length} 条已入 findings，不阻断本 Task）；门禁合同对账通过（声明 ${Object.keys(gateIndex(spec)).length} 条 = 提交 ${gc.cmds.length} 条，逐条 gateId 一致、kind 未被改动、无未声明命令、无省略）。GATE_HEALTH=PASS｜PROJECT_BASELINE_HEALTH=${gc.baselineHealth}`)

// ---------- PHASE 8/9 — MAX REVIEW + FIX ----------
phase('Max Review')
function reviewPrompt(round) {
  const extra = []
  if (cls.medicalSensitive) extra.push('Medical Safety（诊断性表达/暗示医疗结论/无证据疗效声明/转诊边界/工程指标冒充临床指标）')
  if (cls.knowledgeTouchedExpected || cls.ragTouchedExpected) extra.push('Citation / Provenance / Data Isolation / Review Status Enforcement')
  if (cls.privacySensitive) extra.push('Privacy（数据最小化/授权/访问控制/日志脱敏/数据隔离/删除与导出路径/审计）')
  return `${PROJECT_RULES}
${decisionRules()}
[独立 Code Review · 第 ${round} 轮] 禁止只看 Implementation Report。必须真实读取：
- TASK_SPEC：${spec.specPath}
- git diff（全部改动）与 changed files
- 相关 tests
- Machine Gate 结果（区分 required/record）：${j({ COMPUTED: { requiredPassed: gc.requiredPassed, recordCollectionComplete: gc.recordCollectionComplete, blockedMissingSafeTestEnv: gc.blockedMissingSafeTestEnv, requiredFailures: gc.requiredFailed.length, baselineHealth: gc.baselineHealth }, GATE_CONTRACT_DECLARED: gateDecls(spec).map(d => ({ gateId: d.gateId, kind: d.kind, command: normGateCommand(d.command), purpose: d.purpose || '-' })), commands: gate.commands, findings: gc.findings, skippedGates: gate.skippedGates || [] }, 7000)}
- Implementation Report：${j(impl, 4000)}
逐条检查 ACCEPTANCE_CRITERIA（每条给出 met 与 evidence）。
判读约定：record 型命令红色（exitCode!==0）或缺安全环境属"基线发现"，应核对是否已如实落入 findings，不得据此判 REQUEST_CHANGES（基线红 ≠ 实现缺陷）；只有 required 命令失败、Scope 越界、 forbidden 文件被改、验收标准未满足、虚报 exitCode 才构成 blocker。
门禁合同审查（FIX-GOV-001-R1：机器只按 gateId 对账"执行手 ↔ 冻结合同"，合同本身的定性错误只有你能发现）：逐条核对 MANDATORY_TESTS 是否都落成了 kind=required 的门禁。若本任务自己的目标测试/构建/迁移被声明为 kind=record（借"基线"之名规避失败），或 CONTRACT_DECLARED 与实际改动面明显不匹配（漏声明关键校验），必须出 blocker（REQUIRED_GATE_MISDECLARED_AS_RECORD / GATE_CONTRACT_UNDER_DECLARED），并在 REQUIRED_FIX 里写明应改的 SPEC 条目。反之，把与本次改动无关的存量全量检查声明为 record 是正确做法，不得因它红而判 REQUEST_CHANGES。
至少 Review：Correctness / Scope Compliance / Regression Risk / Architecture Compliance / Database Safety / API Compatibility / Error Handling / Logging / Security / Privacy / Test Quality / Maintainability${extra.length ? ' / ' + extra.join(' / ') : ''}。
最终只能返回 PASS 或 REQUEST_CHANGES。禁止"基本通过/看起来可以/建议以后优化/应该没问题"。
REQUEST_CHANGES 时每个 blocker 必须含 BLOCKER_ID/LOCATION/EVIDENCE/IMPACT/REQUIRED_FIX/VERIFICATION_METHOD；另可给 nonBlockingNotes（不阻止 PASS）。`
}

const HIGH_RISK = isHighRisk(cls)
let reviewInvocations = []

// D3：独立审查。始终运行 Reviewer A（label 'max-review'）；HIGH Risk 追加 Reviewer B（label 'max-review-b'）
// —— 二者是【相互独立的 qfmodel invocation】（FLASH_ONLY 下模型同为 qfmodel，但彼此不可见对方结论）。
// 合并裁决：A 或 B 任一 REQUEST_CHANGES → 合并 REQUEST_CHANGES；全部 PASS 才算独立 Review 通过。
async function runReviewRound(round) {
  const A = await agent(reviewPrompt(round), { label: 'max-review', phase: 'Max Review', model: modelFor('reviewer'), effort: 'high', schema: REVIEW_SCHEMA })
  if (!A) return { __modelBlocked: mname(modelFor('reviewer')) }
  reviewInvocations = ['max-review']
  if (!HIGH_RISK) return A
  const B = await agent(`${reviewPrompt(round)}

[双独立审查 · 第二审查者 FLASH_REVIEWER_B] 你是与第一审查者【相互独立】的第二次独立审查（同为 qfmodel，但是不同 invocation，看不到对方结论）。请以对抗视角复核：实现者自报的 PASS/DONE 一律不采信；重点核对安全/隐私/医疗边界、Scope 与 Task Delta、治理/pre-existing 边界、exitCode 是否真实、ACCEPTANCE_CRITERIA 是否被真实满足。你处于只读角色，禁止 Write/Edit/创建/删除文件，禁止修改任何门禁标准。`,
    { label: 'max-review-b', phase: 'Max Review', model: modelFor('reviewerB'), effort: 'high', schema: REVIEW_SCHEMA })
  if (!B) return { __modelBlocked: mname(modelFor('reviewerB')) }
  reviewInvocations = ['max-review', 'max-review-b']
  const merged = Object.assign({}, A)
  merged.verdict = (A.verdict === 'REQUEST_CHANGES' || B.verdict === 'REQUEST_CHANGES') ? 'REQUEST_CHANGES' : 'PASS'
  merged.blockers = (A.blockers || []).concat(B.blockers || [])
  merged.nonBlockingNotes = (A.nonBlockingNotes || []).concat(B.nonBlockingNotes || [])
  merged.acceptanceResults = A.acceptanceResults
  merged.changedFilesHint = A.changedFilesHint || B.changedFilesHint
  merged._reviewerBVerdict = B.verdict
  return merged
}

let review = await runReviewRound(1)
if (review && review.__modelBlocked) return modelBlocked('Max Review', review.__modelBlocked)
let reviewRounds = 1

while (review.verdict === 'REQUEST_CHANGES') {
  if (cycles >= 3) {
    return blocked('BLOCKED_REPAIR_LIMIT', 'Max Review', {
      TASK_ID: spec.TASK_ID,
      ATTEMPTS: cycles,
      attemptHistory,
      BLOCKERS: review.blockers,
      remainingBlockers: review.blockers.map(b => b.BLOCKER_ID + ': ' + b.REQUIRED_FIX),
      recommendedHumanDecision: '修复预算（3 轮）耗尽，人工决定：继续修复、缩小任务范围或回滚。',
      FILES_CURRENTLY_CHANGED: review.changedFilesHint || (impl.FILES_MODIFIED || []).concat(impl.FILES_CREATED || []),
    })
  }
  cycles++
  phase('Fix')
  log(`REQUEST_CHANGES：${review.blockers.length} 个 blocker，进入 FIX（第 ${cycles}/3 轮）`)
  const fixSpecText = review.blockers.map(b => `${b.BLOCKER_ID} @ ${b.LOCATION}\n  证据: ${b.EVIDENCE}\n  影响: ${b.IMPACT}\n  要求修复: ${b.REQUIRED_FIX}\n  验证方式: ${b.VERIFICATION_METHOD}`).join('\n')
  const reviewScope = buildRepairScope(currentDelta, allowedRepairFiles)
  const fxg = await guardedFlashRepair(`${PROJECT_RULES}
${FLASH_RULES}
${FLASH_REPAIR_RULES}
[FIX] 只修复以下 review blockers，禁止顺便重构/升级依赖/改 UI/修 unrelated warning/修改任务合同：
${fixSpecText}
TASK_SPEC 见 ${spec.specPath}。
[REPAIR_SCOPE] 只能修改 allowedRepairFiles：${allowedRepairFiles.join(', ') || '（空）'}；治理/pre-existing 文件绝对禁动；禁止任何破坏性或变更类 git 命令。完成后返回 status/summary/filesChanged/gitCommandsRun。`,
    'fix', allowedRepairFiles, 'Fix')
  if (fxg.modelBlocked) return modelBlocked('Fix', fxg.modelBlocked)
  if (fxg.violation) {
    const v = fxg.violation
    attemptHistory.push({ cycle: cycles, kind: 'REPAIR_GUARD_BLOCK(review-fix)', stage: fxg.stage, code: v.code, detail: v.detail, command: v.command || null, tier: v.tier || null })
    return blocked(v.code, 'Fix', {
      TASK_ID: spec.TASK_ID, ATTEMPTS: cycles, attemptHistory,
      DETAIL: v.detail, STAGE: fxg.stage, OFFENDING_COMMAND: v.command || null, GIT_TIER: v.tier || null,
      REPAIR_SCOPE: reviewScope, GOVERNANCE_PROTECTED_PATHS: reviewScope.governanceProtectedPaths,
      FILES_CURRENTLY_CHANGED: currentDelta.taskChanged,
      SAFE_NEXT_ACTION: 'Review FIX 触发 D2 守卫。编排器已停止且未执行任何还原命令；请人工核查。',
    })
  }
  const fx = fxg.result
  attemptHistory.push({ cycle: cycles, kind: 'REVIEW_FIX', blockers: review.blockers.map(b => b.BLOCKER_ID), status: fx.status, summary: fx.summary, gitCommandsRun: fx.gitCommandsRun || [] })
  if (fxg.postSnap) { currentSnap = fxg.postSnap; currentDelta = classifyDelta(WORKTREE_BASELINE, currentSnap, [spec.specPath]); allowedRepairFiles = computeAllowedRepairFiles(currentDelta, spec) }

  phase('Machine Gate')
  gate = await runMachineGate(cycles + 1)
  if (!gate) return modelBlocked('Machine Gate', FLASH + ' (Qwen3.8-Flash)')
  { const term = gateGuardViolation(gate); if (term) return term }
  gc = gateCompute(gate)
  if (!gatePass(gate)) {
    if (cycles >= 3) {
      return blocked('BLOCKED_REPAIR_LIMIT', 'Machine Gate (post-fix)', {
        TASK_ID: spec.TASK_ID, ATTEMPTS: cycles, attemptHistory,
        remainingBlockers: [gateFailSummary(gate)],
        recommendedHumanDecision: '修复预算耗尽，人工介入。',
      })
    }
    cycles++
    const rca2 = await agent(`${PROJECT_RULES}
${decisionRules()}
[Root Cause Analysis] 只读分析。Review FIX 后 Machine Gate 失败：
${gateFailSummary(gate)}
输出 ROOT_CAUSE 与只针对 blocker 的 FIX_SPEC。`,
      { label: 'rca', phase: 'Repair', model: modelFor('rca'), effort: 'high', schema: RCA_SCHEMA })
    if (!rca2) return modelBlocked('Repair', mname(modelFor('rca')))
    const rf2g = await guardedFlashRepair(`${PROJECT_RULES}
${FLASH_RULES}
${FLASH_REPAIR_RULES}
[执行 FIX_SPEC] 严格按 FIX_SPEC 修复，禁止顺带改动：
ROOT_CAUSE: ${rca2.ROOT_CAUSE}
FIX_SPEC: ${j(rca2.FIX_SPEC, 8000)}
[REPAIR_SCOPE] 只能修改 allowedRepairFiles：${allowedRepairFiles.join(', ') || '（空）'}；治理/pre-existing 文件绝对禁动；禁止任何破坏性或变更类 git 命令。完成后返回 status/summary/filesChanged/gitCommandsRun。`,
      'rca-fix', allowedRepairFiles, 'Repair')
    if (rf2g.modelBlocked) return modelBlocked('Repair', rf2g.modelBlocked)
    if (rf2g.violation) {
      const v = rf2g.violation
      attemptHistory.push({ cycle: cycles, kind: 'REPAIR_GUARD_BLOCK(post-review-rca-fix)', stage: rf2g.stage, code: v.code, detail: v.detail, command: v.command || null, tier: v.tier || null })
      return blocked(v.code, 'Repair', {
        TASK_ID: spec.TASK_ID, ATTEMPTS: cycles, attemptHistory,
        DETAIL: v.detail, STAGE: rf2g.stage, OFFENDING_COMMAND: v.command || null, GIT_TIER: v.tier || null,
        REPAIR_SCOPE: buildRepairScope(currentDelta, allowedRepairFiles),
        SAFE_NEXT_ACTION: 'post-review FIX 触发 D2 守卫。编排器已停止且未执行任何还原命令；请人工核查。',
      })
    }
    const rf2 = rf2g.result
    attemptHistory.push({ cycle: cycles, kind: 'MAX_RCA+FLASH_FIX(post-review)', rootCause: rca2.ROOT_CAUSE, status: rf2.status, gitCommandsRun: rf2.gitCommandsRun || [] })
    if (rf2g.postSnap) { currentSnap = rf2g.postSnap; currentDelta = classifyDelta(WORKTREE_BASELINE, currentSnap, [spec.specPath]); allowedRepairFiles = computeAllowedRepairFiles(currentDelta, spec) }
    gate = await runMachineGate(cycles + 1)
    if (!gate) return modelBlocked('Machine Gate', FLASH + ' (Qwen3.8-Flash)')
    { const term = gateGuardViolation(gate); if (term) return term }
    gc = gateCompute(gate)
    if (!gatePass(gate)) {
      return blocked('BLOCKED_REPAIR_LIMIT', 'Machine Gate (post-fix)', {
        TASK_ID: spec.TASK_ID, ATTEMPTS: cycles, attemptHistory,
        remainingBlockers: [gateFailSummary(gate)],
        recommendedHumanDecision: '修复预算耗尽，人工介入。',
      })
    }
  }
  phase('Max Review')
  reviewRounds++
  review = await runReviewRound(reviewRounds)
  if (review && review.__modelBlocked) return modelBlocked('Max Review', review.__modelBlocked)
}
log('MAX REVIEW：PASS')

// ---------- PHASE 10 — VERIFY ----------
phase('Verify')
const ver = await agent(`${PROJECT_RULES}
${decisionRules()}
[最终验收 VERIFY] TASK_SPEC：${spec.specPath}
Review 结论：${j({ verdict: review.verdict, acceptanceResults: review.acceptanceResults, nonBlockingNotes: review.nonBlockingNotes || [] }, 6000)}
Machine Gate（区分 required/record）：${j({ COMPUTED: { requiredPassed: gc.requiredPassed, recordCollectionComplete: gc.recordCollectionComplete, blockedMissingSafeTestEnv: gc.blockedMissingSafeTestEnv, baselineHealth: gc.baselineHealth }, commands: gate.commands, findings: gc.findings, skippedGates: gate.skippedGates || [] }, 6000)}
修复历史：${j(attemptHistory, 2000)}
基线（Preflight 时用户已有状态）：${j(baseline, 800)}
[D2-C 脚本已算好的 Task Delta（WORKTREE_BASELINE↔当前指纹快照，权威 Scope 依据）]：${j({ taskChanged: currentDelta.taskChanged, taskGovernance: currentDelta.taskGovernance, preExistingUnchanged: currentDelta.preExistingUnchanged, externalChangedDuringTask: currentDelta.externalChangedDuringTask, preExistingReverted: currentDelta.preExistingReverted, headChanged: currentDelta.headChanged, stagedAppeared: currentDelta.stagedAppeared, allowedRepairFiles }, 3000)}
请只读复核（git status/git diff + 读取文件；允许重跑命令做抽查，但禁止修改任何文件）：
1. 所有 ACCEPTANCE_CRITERIA 均满足；
2. Machine Gate 的 required 命令全部通过、record 采集完整；抽查重跑其中最关键的 1~2 条命令核实退出码与记录一致（防虚报）。注意：record 型基线命令本就可能是红的（如全量 pytest/ruff），抽查重跑应"复现其红色 exitCode"才算记录属实；required 命令则应 exit 0。record 红属基线发现（已入 findings），不得据此判 TASK_FAIL；
3. Review blockers 均已解决；
4. Scope 以上方 Task Delta 为准：taskChanged 是否仍在 IN_SCOPE / EXPECTED_FILES 内、是否触碰 FILES_FORBIDDEN_TO_CHANGE；
5. 治理与边界（对照 Task Delta）：taskGovernance 必须为空（治理文件 AGENTS.md/.qoder/rules/**/.qoder/workflows/**/.qoder/workflow-state/**（本次新生成 spec 除外）/.gitignore/.github/**/docs/workflow/** 不得被本任务改动）；preExistingUnchanged 中的文件属任务前已存在且【确定性 SHA-256 证据显示内容未变】，**不算本任务改动、不判越界**；externalChangedDuringTask / preExistingReverted 必须为空（pre-existing 被改或被还原）；headChanged 必须为 false、stagedAppeared 必须为空。任一不满足 → 必须 TASK_FAIL；
5b. 【D4 身份证据抽查（防虚报，与 exitCode 抽查同级）】上述 Delta 的内容身份来自"脚本逐字下发命令 + 只读执行手原样回传 rawStdout + 脚本侧格式校验"，模型本身不得自报 hash。请从 preExistingUnchanged / taskChanged 中挑 1~2 个路径【自己逐字执行】脚本的确定性取证命令（${buildFingerprintCommand(FP_REPO_ROOT || '.').split('\n').length} 行；至少对单个文件执行 wc -c 与 sha256sum），核对你得到的 64 位小写 SHA-256 与 Delta 记录的 identity 是否一致；不一致或无法验证 → 记入 reasons 并判 TASK_FAIL（或 BLOCKED_FINGERPRINT_EVIDENCE_UNCERTAIN 语义）。mtime 一律不作为内容变更依据。
5c. 【D4 retry-owned 核验】若 RETRY_OWNERSHIP.accepted 非空（本任务是同一 Task 的重试，产物来自上一 run），核对：①retryOfTaskId 与本任务 TASK_ID 同一 Task；②路径在两版 TASK_SPEC 允许写集合内；③非治理文件；④上一 run manifest/journal 有该路径由该 Task Worker 产出之证据。缺任一证据却仍被放行 → blocker（归属过宽，可能吞用户改动）。
6. 是否引入明显回归风险；
7. ROLLBACK_PLAN 是否仍成立。
全部满足 → TASK_PASS；否则 → TASK_FAIL（列出 reasons）。
8. 【D3 TASK_PASS 合成判据，缺一即 TASK_FAIL】TASK_PASS = Machine Gate PASS ∧ 独立 Review PASS ∧ Verify 通过 ∧ Task Delta PASS ∧ Governance Guard PASS。独立 Review：HIGH Risk 必须 Reviewer A 与 Reviewer B【双独立 invocation】均 PASS（本轮 review 来自 ${JSON.stringify(reviewInvocations)}，_reviewerBVerdict=${review._reviewerBVerdict || 'N/A'}）；实施者（Worker）自报的 PASS/DONE/IMPLEMENTED【一律无最终验收权】，不得据此判 PASS。
changedFiles 填 Task Delta 中本任务实际改动的文件（taskChanged）。最后给出 suggestedNextTask（下一个最有价值的原子任务建议）。`,
  { label: 'verify', phase: 'Verify', model: modelFor('verifier'), effort: 'high', schema: VERIFY_SCHEMA })
if (!ver) return modelBlocked('Verify', mname(modelFor('verifier')))

// ---------- PHASE 11 — FINAL REPORT ----------
phase('Report')
if (ver.verdict !== 'TASK_PASS') {
  return blocked('TASK_FAIL', 'Verify', {
    TASK_ID: spec.TASK_ID,
    TASK_TITLE: spec.TITLE,
    ATTEMPTS: cycles,
    attemptHistory,
    BLOCKERS: ver.reasons,
    FILES_CURRENTLY_CHANGED: ver.changedFiles || (impl.FILES_MODIFIED || []).concat(impl.FILES_CREATED || []),
    MODEL_USAGE: { PLAN: mname(modelFor('planner')), IMPLEMENT: mname(modelFor('worker')), REVIEW: mname(modelFor('reviewer')) + (HIGH_RISK ? ' + FLASH_REVIEWER_B(' + mname(modelFor('reviewerB')) + ')' : '') },
    SAFE_NEXT_ACTION: '审查 Verify reasons 与 git diff；人工决定回滚或重定义任务后重跑。',
    ...modeSummary(),
  })
}

// D3/D4：最终 Governance Guard 复核（Task Delta 权威判定）——治理/pre-existing/HEAD/index 任一越界即 TASK_FAIL。
// D4：复核基于【重新取证 + 必要时仲裁】的确定性证据，而不是复用实施期快照，也不把不可信 hash 当作 BLOCK 依据。
{
  const guardSnap = await snapshotWorktree('Verify 后最终 Governance Guard 取证', 'Verify')
  if (!guardSnap) return modelBlocked('Verify', mname(modelFor('snapshot')))
  const guardEval = await evaluateTaskDelta(WORKTREE_BASELINE, guardSnap, [spec.specPath], 'Verify', 'final_guard')
  if (guardEval.baseline && guardEval.baseline !== WORKTREE_BASELINE) WORKTREE_BASELINE = guardEval.baseline
  currentDelta = guardEval.delta
  currentSnap = guardEval.current || guardSnap
  allowedRepairFiles = computeAllowedRepairFiles(currentDelta, spec)
  const gv = guardEval.blocked || guardEval.viols[0]
  if (gv) {
    return blocked(gv.code, 'Verify', {
      TASK_ID: spec.TASK_ID,
      DETAIL: gv.detail + '（Verify 阶段最终 Governance Guard 复核，先于 TASK_PASS）',
      FINGERPRINT: { backend: FINGERPRINT_BACKEND, authority: CONTENT_IDENTITY_AUTHORITY, scriptSideHash: SCRIPT_SIDE_HASH_AVAILABLE, baselineEvidence: evidenceStatusOf(WORKTREE_BASELINE), currentEvidence: evidenceStatusOf(currentSnap), invalidDetected: FP_INVALID_DETECTED.slice(0, 8), falsePositivesRecovered: FP_FALSE_POSITIVES_RECOVERED.slice() },
      ADJUDICATION: (guardEval.adjudications || []).slice(),
      GOVERNANCE_PROTECTED_PATHS: GOVERNANCE_PROTECTED_PATHS.concat([SELF_WORKFLOW_PATH]),
      FILES_CURRENTLY_CHANGED: currentDelta.taskChanged,
      SAFE_NEXT_ACTION: '最终验收发现治理/pre-existing/HEAD/index 边界被破坏，判 TASK_FAIL。编排器未执行任何还原命令；请人工核查工作区，治理变更须走人工授权的治理流程。',
    })
  }
}

return {
  WORKFLOW_STATUS: 'TASK_PASS',
  MODE: 'task',
  TASK_ID: spec.TASK_ID,
  TASK_TITLE: spec.TITLE,
  MODEL_USAGE: {
    PLAN: mname(modelFor('planner')),
    EXPLORER: mname(modelFor('explorer')),
    IMPLEMENT: mname(modelFor('worker')),
    MACHINE_GATE: mname(modelFor('gate')),
    REVIEW: mname(modelFor('reviewer')) + (HIGH_RISK ? ' + FLASH_REVIEWER_B(' + mname(modelFor('reviewerB')) + ')' : '（single，非 HIGH Risk）'),
    VERIFY: mname(modelFor('verifier')),
    RCA: mname(modelFor('rca')),
    SNAPSHOT: mname(modelFor('snapshot')),
  },
  FILES_CHANGED: ver.changedFiles || (impl.FILES_MODIFIED || []).concat(impl.FILES_CREATED || []),
  TESTS_RUN: (gate.commands || []).map(c => `[${effGateKind(c)}][${c.gateId || '-'}] ${c.command}`),
  MACHINE_GATE: 'MACHINE_PASS',
  GATE_HEALTH: {
    status: 'PASS',
    requiredTotal: gc.required.length,
    requiredPassed: gc.requiredPassed,
    requiredFailures: gc.requiredFailed.length,
    requiredBlockedSafeEnv: gc.requiredBlocked.length,
    recordTotal: gc.record.length,
    recordCollectionComplete: gc.recordCollectionComplete,
    recordCollectionFailed: gc.recordFailed.length,
    blockedMissingSafeTestEnv: gc.blockedMissingSafeTestEnv,
  },
  GATE_CONTRACT: {
    AUTHORITY: 'TASK_SPEC.MACHINE_GATE_COMMANDS（冻结合同）—— 对账键 = gateId，不与 shell 命令字节串跨层比对（A3）',
    DECLARED_COUNT: Object.keys(gateIndex(spec)).length,
    SUBMITTED_COUNT: gc.cmds.length,
    DECLARED: gateDecls(spec).map(d => ({ gateId: d.gateId, kind: d.kind, command: normGateCommand(d.command) })),
    SUBMITTED: gc.cmds.map(c => ({ gateId: c.gateId || null, kind: effGateKind(c), command: normGateCommand(c.command), exitCode: (typeof c.exitCode === 'number' ? c.exitCode : null) })),
    RECONCILED: (function () {
      const idx = gateIndex(spec)
      const seen = {}
      for (const c of gc.cmds) {
        const id = normGateCommand(c.gateId)
        if (!id || !idx[id]) return false
        if (normGateCommand(idx[id].command) !== normGateCommand(c.command)) return false
        if (effGateKind(c) !== String(idx[id].kind)) return false
        seen[id] = true
      }
      return Object.keys(idx).every(id => seen[id])
    })(),
    SPEC_VALIDATION: 'GATE_SPEC_MALFORMED_NOT_RAISED (pre-Implement fail-closed passed)',
    SEMANTIC_LISTS_NOT_MACHINE_RECONCILED: ['MANDATORY_TESTS', 'REGRESSION_TESTS'],
  },
  PROJECT_BASELINE_HEALTH: gc.baselineHealth,
  BASELINE_RECORD_RESULTS: gc.record.map(c => ({ command: c.command, exitCode: (typeof c.exitCode === 'number' ? c.exitCode : null), recordStatus: c.recordStatus || (typeof c.exitCode === 'number' ? 'EXECUTED_AND_RECORDED' : 'SAFELY_NOT_EXECUTED_AND_RECORDED') })),
  BASELINE_FINDINGS: gc.findings,
  MAX_REVIEW: { verdict: review.verdict, rounds: reviewRounds },
  ACCEPTANCE_CRITERIA_RESULTS: review.acceptanceResults,
  KNOWN_NON_BLOCKING_RISKS: review.nonBlockingNotes || [],
  REPAIR_CYCLES_USED: cycles,
  ATTEMPT_HISTORY: attemptHistory,
  ROLLBACK: spec.ROLLBACK_PLAN,
  SUGGESTED_NEXT_TASK: ver.suggestedNextTask || null,
  PARALLEL_SAFE: exp.parallelSafe,
  PARALLEL_SAFE_REASON: exp.parallelSafeReason || '',
  SPEC_PATH: spec.specPath,
  IMPLEMENTATION_REPORT: impl,
  // ---- D3 FLASH_ONLY 交付证明（角色分离 + 独立验收公式 + 反自验收）----
  HIGH_RISK: HIGH_RISK,
  REVIEW_INVOCATIONS: reviewInvocations,
  WORKER_SELF_REPORT: {
    workerReportedStatus: impl.status,
    finalAuthority: 'NONE —— 实施者(FLASH_WORKER)自报 IMPLEMENTED/PASS/DONE 一律无最终验收权；PASS 由下列合成判据决定。',
  },
  TASK_PASS_FORMULA: {
    MACHINE_GATE_PASS: gc.machinePass,
    INDEPENDENT_FLASH_REVIEW_PASS: review.verdict === 'PASS',
    INDEPENDENT_REVIEW_INVOCATIONS: reviewInvocations,
    DOUBLE_REVIEW_REQUIRED: HIGH_RISK,
    FLASH_VERIFY_PASS: ver.verdict === 'TASK_PASS',
    TASK_DELTA_PASS: deltaViolations(currentDelta).length === 0,
    GOVERNANCE_GUARD_PASS: deltaViolations(currentDelta).length === 0 && !currentDelta.headChanged && (currentDelta.stagedAppeared || []).length === 0,
    ALL_CLAUSES_TRUE: gc.machinePass && review.verdict === 'PASS' && ver.verdict === 'TASK_PASS' && deltaViolations(currentDelta).length === 0,
  },
  ...modeSummary(),
  GOVERNANCE_D2: {
    WORKTREE_BASELINE_HEAD: WORKTREE_BASELINE.head,
    TASK_DELTA: { taskChanged: currentDelta.taskChanged, taskGovernance: currentDelta.taskGovernance, preExistingUnchanged: currentDelta.preExistingUnchanged, externalChangedDuringTask: currentDelta.externalChangedDuringTask, preExistingReverted: currentDelta.preExistingReverted, retryOwnedArtifacts: currentDelta.retryOwnedArtifacts, treeUnitChanges: currentDelta.treeUnitChanges, headChanged: currentDelta.headChanged, stagedAppeared: currentDelta.stagedAppeared },
    ALLOWED_REPAIR_FILES: allowedRepairFiles,
    GOVERNANCE_PROTECTED_PATHS: GOVERNANCE_PROTECTED_PATHS.concat([SELF_WORKFLOW_PATH]),
    DESTRUCTIVE_GIT_HARD_DENY: GIT_HARD_DENY_SUBCOMMANDS,
    FLASH_FORBIDDEN_GIT_MUTATING: GIT_MUTATING_SUBCOMMANDS,
    SCOPE_JUDGE: 'SCRIPT_TASK_DELTA (baseline↔deterministic byte evidence), not raw git status, not LLM self-reported hash',
    DEFENSE_LAYERS: ['prompt(FLASH_REPAIR_RULES)', 'orchestrator-precheck(SELF_REPAIR_ELIGIBILITY/REPAIR_SCOPE)', 'command-denylist(gitCommandsRun scan, bypass-aware)', 'post-repair-fingerprint-verify', 'D3-gate-anti-cheat(unsafe-:5432 scan + required-downgrade by gateId)', 'FIX-GOV-001-R1-gate-contract(pre-Implement GATE_SPEC_MALFORMED fail-closed + gateId reconciliation: GATE_COMMAND_NOT_DECLARED / GATE_OMISSION / GATE_KIND_MUTATION)', 'D4-deterministic-byte-evidence(script-pinned command + verbatim rawStdout + format/self-consistency validation + dual-independent-rehash adjudication)', 'D4-2-argv-self-echo(fingerprint A line + per-gate Q line printed by the dispatched command itself, re-computed script-side with a self-implemented base64 and compared char-for-char; uncertain or missing echo → BLOCKED_FINGERPRINT_EVIDENCE_UNCERTAIN / GATE_ARGV_NOT_VERBATIM, record gates blocked the same as required)', 'immediate-BLOCK-on-violation'],
    TOOL_LEVEL_HARD_BLOCK_AVAILABLE: false,
  },
  // ---- D4：内容身份证据链 + 同任务重试产物归属 ----
  GOVERNANCE_D4: {
    FINGERPRINT_BACKEND,
    CONTENT_IDENTITY_AUTHORITY,
    SCRIPT_SIDE_HASH_AVAILABLE,
    PINNED_COMMAND_PROTOCOL: FP_PROTOCOL,
    EVIDENCE_RUNS: FP_EVIDENCE_RUNS.slice(),
    INVALID_EVIDENCE_DETECTED: FP_INVALID_DETECTED.slice(0, 12),
    FALSE_POSITIVES_RECOVERED: FP_FALSE_POSITIVES_RECOVERED.slice(),
    ADJUDICATION: ADJUDICATION_LOG.slice(),
    ADJUDICATION_COUNT: adjudicationCount,
    TASK_IDENTITIES: { baseline: identityMap(WORKTREE_BASELINE), current: identityMap(currentSnap) },
    TREE_UNITS: Object.keys(WORKTREE_BASELINE.trees || {}).concat(Object.keys(currentSnap.trees || {})),
    RETRY_OWNERSHIP: { status: RETRY_OWNERSHIP.status, retryOf: RETRY_OWNERSHIP.retryOf, artifacts: RETRY_OWNERSHIP.artifacts.slice(), accepted: RETRY_OWNERSHIP.accepted.slice(), rejected: RETRY_OWNERSHIP.rejected.slice() },
    REMAINING_LIMITATION: 'byte identity 依赖只读执行手原样回传（脚本沙箱无自读字节能力，已实测，SCRIPT_SIDE_HASH_AVAILABLE 仍为 false）；以"命令逐字一致 + 严格格式/自洽校验 + 双独立 invocation 签名收敛 + Verifier 抽查重跑"把不可信证据降为可检出风险，而非彻底消除。D4-2 的 argv 自回显互证同样有三条残余弱点，如实披露：(a) 取证五行包装里 cd \'<root>\' 行位于回显 payload 之外（本仓库根含中文，cd 行入 payload 会让所有派发立刻非 ASCII），故"只改 cd 行的空白型改写"不在 A 行互证覆盖内，仍只由 :308 的命令逐字比较与 Verifier 抽查兜住；(b) A/Q 行由执行手回传，脚本只能对自己下发的命令重算期望值并逐字符比对 —— 脚本自读字节的能力没有被虚构，回传面若整体缺失则判 UNCERTAIN/GATE_ARGV_NOT_VERBATIM，但"证据是否来自真实一次执行"仍不能由脚本自身证明；未真实执行的门禁条目（无数字 exitCode）不进入 Q 行核验，由 required/record 分层与 blockedMissingSafeTestEnv 口径处理；(c) FLASH_ONLY 降级模式下审查者与被审查的这套机器同为 qfmodel，argv 互证只是将"改令成本"提高到"必须同时改写命令与自实现的 base64 输出"，独立性只剩 invocation 隔离一层（人工已知情承担，HD-N-13 乙）。',
    ARGV_SELF_ECHO: { protocol: FP_PROTOCOL, covers: ['fingerprint A line (payload = body without cd line)', 'per-gate Q line (payload = 该门禁冻结声明命令原文)'], verifyMode: '脚本侧自实现 base64 重算期望行 + 逐字符比较（不复用宽松 norm）', newTerminals: ['BLOCKED_FINGERPRINT_PAYLOAD_NONASCII', 'GATE_ARGV_NOT_VERBATIM'], newEvidenceCodes: ['FINGERPRINT_EVIDENCE_INVALID:ARGV_ECHO_MISSING', 'FINGERPRINT_EVIDENCE_INVALID:ARGV_NOT_VERBATIM:WHITESPACE', 'FINGERPRINT_EVIDENCE_INVALID:ARGV_NOT_VERBATIM:CONTENT'], recordGatesBlockedToo: true, hashCapabilityFabricated: false },
  },
  GIT: baseline,
}
