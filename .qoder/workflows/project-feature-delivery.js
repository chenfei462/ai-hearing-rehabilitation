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
    { title: 'Machine Gate', detail: '真实执行测试/构建/迁移门禁，以退出码为准（Flash 执行）', model: 'qfmodel' },
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
    MANDATORY_TESTS: { type: 'array', items: { type: 'string' } },
    REGRESSION_TESTS: { type: 'array', items: { type: 'string' } },
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
          purpose: { type: 'string' },
          exitCode: { type: 'number' },
          stdoutSummary: { type: 'string' },
          stderrSummary: { type: 'string' },
        },
        required: ['command', 'exitCode'],
      },
    },
    allPassed: { type: 'boolean' },
    skippedGates: { type: 'array', items: { type: 'string' }, description: '被跳过的门禁项及原因（项目不支持该命令等）' },
    blockedMissingSafeTestEnv: { type: 'boolean' },
    notes: { type: 'string' },
  },
  required: ['commands', 'allPassed', 'blockedMissingSafeTestEnv'],
}

const FIXREPORT_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['FIXED', 'BLOCKED'] },
    summary: { type: 'string' },
    filesChanged: { type: 'array', items: { type: 'string' } },
    blockers: { type: 'string' },
  },
  required: ['status', 'summary'],
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
log('探测模型可用性：qmodel_38max (Qwen3.8-Max) / qfmodel (Qwen3.8-Flash)')
const probes = await parallel([
  () => agent('模型可用性探针。只回复一个词：OK', { label: 'probe:max', phase: 'Preflight', model: MAX, effort: 'low' }),
  () => agent('模型可用性探针。只回复一个词：OK', { label: 'probe:flash', phase: 'Preflight', model: FLASH, effort: 'low' }),
])
if (!probes[0]) return modelBlocked('Preflight', MAX + ' (Qwen3.8-Max)')
if (!probes[1]) return modelBlocked('Preflight', FLASH + ' (Qwen3.8-Flash)')
log('两个模型均可用。执行 Git 守护检查（只读）。')

const pre = await agent(`${PROJECT_RULES}
[任务] 只读执行以下命令并如实报告，禁止任何写操作、禁止任何破坏性 git 命令：
1. git status --porcelain
2. git branch --show-current
3. git rev-parse --show-toplevel
确认：(a) 当前确实处于 Git 仓库；(b) 该仓库是否为 ai-hearing-rehabilitation 项目（结合目录名、README.md 标题或 git remote 判断）；(c) 当前分支名；(d) working tree 是否干净（git status --porcelain 输出是否为空），dirty 时列出 dirtyFiles。
另外在 notes 中记录：仓库根目录下是否存在 AGENTS.md 与 .qoder/rules/ 目录。`,
  { label: 'preflight', phase: 'Preflight', model: MAX, effort: 'low', schema: PREFLIGHT_SCHEMA })
if (!pre) return modelBlocked('Preflight', MAX + ' (Qwen3.8-Max)')

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
${MAX_RULES}
[Milestone Gate 判定] 目标 Milestone：${task}
证据收集结果：
${j(ev, 16000)}
请自行只读复核关键证据（可读取文件、运行只读命令、查看 git log），确认：
1. 该 Milestone 所有 Task 均已 PASS；2. 无未关闭 blocker；3. Milestone 级 Regression 与 integration tests 真实通过；4. 架构一致性、文档、安全影响、数据库状态无问题；5. Knowledge/RAG 或医疗安全 Milestone 的附加项已验证。
不得根据历史文档假设通过；必须有当前有效证据。只能返回 MILESTONE_PASS 或 MILESTONE_BLOCKED。`,
    { label: 'milestone-verdict', phase: 'Gate Verdict', model: MAX, schema: MILESTONE_SCHEMA })
  if (!mv) return modelBlocked('Gate Verdict', MAX + ' (Qwen3.8-Max)')

  return {
    WORKFLOW_STATUS: mv.verdict,
    MODE: 'milestone_gate',
    MILESTONE: task,
    MODEL_USAGE: { EVIDENCE_RUNNER: FLASH + ' (Qwen3.8-Flash)', VERDICT: MAX + ' (Qwen3.8-Max)' },
    REASONS: mv.reasons,
    OPEN_BLOCKERS: mv.openBlockers || [],
    TASK_STATUS_REVIEW: mv.taskStatusReview || '',
    CHECKS: ev.checks,
    MISSING_EVIDENCE: ev.missing,
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
${MAX_RULES}
[Release 安全审查] 只读审查当前仓库的安全状态：认证/授权实现、IDOR 风险、Secret 管理（.env 是否被 gitignore、是否存在硬编码密码——不要输出真实 Secret 值）、依赖已知风险、CORS/生产配置、日志脱敏、医疗安全边界（无诊断/处方/调机参数输出）、隐私数据隔离。
输出 findings 摘要与结论。禁止修改任何文件。`,
    { label: 'release-security', phase: 'Gate Verdict', model: MAX, effort: 'high', schema: {
      type: 'object',
      properties: {
        findings: { type: 'array', items: { type: 'string' } },
        blockingFindings: { type: 'array', items: { type: 'string' } },
        summary: { type: 'string' },
      },
      required: ['findings', 'blockingFindings', 'summary'],
    } })
  if (!sec) return modelBlocked('Gate Verdict', MAX + ' (Qwen3.8-Max)')

  const rv = await agent(`${PROJECT_RULES}
${MAX_RULES}
[Release Gate 判定] 发布目标：${task}
命令证据：
${j(ev, 16000)}
安全审查：
${j(sec, 8000)}
规则：任何必须项没有当前有效证据 → PROJECT_NOT_READY（不得根据历史文档假设通过；TODO 中的集成测试/安全审查/性能测试若未完成必须如实反映）。存在 blocking 安全发现 → PROJECT_NOT_READY。
只能返回 PROJECT_READY 或 PROJECT_NOT_READY，并列出 reasons 与 missingEvidence。`,
    { label: 'release-verdict', phase: 'Gate Verdict', model: MAX, schema: RELEASE_SCHEMA })
  if (!rv) return modelBlocked('Gate Verdict', MAX + ' (Qwen3.8-Max)')

  return {
    WORKFLOW_STATUS: rv.verdict,
    MODE: 'release_gate',
    TARGET: task,
    MODEL_USAGE: { EVIDENCE_RUNNER: FLASH + ' (Qwen3.8-Flash)', SECURITY_REVIEW: MAX + ' (Qwen3.8-Max)', VERDICT: MAX + ' (Qwen3.8-Max)' },
    REASONS: rv.reasons,
    MISSING_EVIDENCE: rv.missingEvidence.concat(ev.missing || []),
    SECURITY_REVIEW: sec.summary,
    SECURITY_BLOCKING: sec.blockingFindings,
    CHECKS: ev.checks,
    GIT: baseline,
  }
}

// ============================================================
// TASK 模式
// ============================================================

// ---------- PHASE 1 — CLASSIFY ----------
phase('Classify')
const cls = await agent(`${PROJECT_RULES}
${MAX_RULES}
[任务分类] 用户任务：
"""
${task}
"""
将任务分类（可多选）：frontend/backend/schema/migration/medical/knowledge/rag/training/irt/privacy/auth/security/observability/deployment/evaluation/cross_stack/bugfix/refactor/documentation。
判定 medicalSensitive（任务是否触及医疗内容/训练建议/疗效表达/转诊边界）、privacySensitive（是否触及用户健康信息/语音/个人数据）、securitySensitive（是否触及认证/授权/密钥/攻击面）。
判定各项 touched/expected 布尔位与 riskLevel(low/medium/high)。
如果无法可靠分类：blocked=true 并给出 blockReason。不要猜。`,
  { label: 'classify', phase: 'Classify', model: MAX, schema: CLASSIFY_SCHEMA })
if (!cls) return modelBlocked('Classify', MAX + ' (Qwen3.8-Max)')
if (cls.blocked) {
  return blocked('BLOCKED_UNCLEAR_TASK', 'Classify', {
    DETAIL: cls.blockReason || '无法可靠分类',
    SAFE_NEXT_ACTION: '请澄清任务目标、涉及模块与验收边界后重跑。',
  })
}
log(`分类完成：taskType=[${cls.taskType.join(',')}], risk=${cls.riskLevel}, medical=${cls.medicalSensitive}, privacy=${cls.privacySensitive}, security=${cls.securitySensitive}`)

// ---------- PHASE 2 — EXPLORE（只读） ----------
phase('Explore')
const preNotes = (pre.notes || '')
const exp = await agent(`${PROJECT_RULES}
${MAX_RULES}
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
  { label: 'explore', phase: 'Explore', model: MAX, effort: 'high', schema: EXPLORE_SCHEMA })
if (!exp) return modelBlocked('Explore', MAX + ' (Qwen3.8-Max)')
log(`探索完成：${(exp.RELATED_FILES || []).length} 个相关文件，parallelSafe=${exp.parallelSafe}`)

// ---------- PHASE 3 — SCOPE CHECK ----------
phase('Scope Check')
const scope = await agent(`${PROJECT_RULES}
${MAX_RULES}
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
  { label: 'scope-check', phase: 'Scope Check', model: MAX, schema: SCOPE_SCHEMA })
if (!scope) return modelBlocked('Scope Check', MAX + ' (Qwen3.8-Max)')
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
    MODEL_USAGE: { DECOMPOSITION: MAX + ' (Qwen3.8-Max)' },
    GIT: baseline,
  }
}
log(`Scope 通过：约 ${scope.estimatedDevDays || '?'} 个开发日`)

// ---------- PHASE 4 — TASK_SPEC ----------
phase('Task Spec')
const spec = await agent(`${PROJECT_RULES}
${MAX_RULES}
[生成 TASK_SPEC] 任务：
"""
${task}
"""
分类：${j(cls, 2000)}
探索结果：
${j({ CURRENT_STATE: exp.CURRENT_STATE, RELATED_FILES: exp.RELATED_FILES, DEPENDENCIES: exp.DEPENDENCIES, RISKS: exp.RISKS, EXISTING_TESTS: exp.EXISTING_TESTS, POTENTIAL_REGRESSIONS: exp.POTENTIAL_REGRESSIONS, TEST_COMMANDS: exp.TEST_COMMANDS }, 14000)}
生成不可变任务合同 TASK_SPEC，包含全部字段：TASK_ID（短横线小写 slug，如 kb-pdf-parser）、TITLE、OBJECTIVE、CONTEXT、DEPENDENCIES、IN_SCOPE、OUT_OF_SCOPE、EXPECTED_FILES、FILES_FORBIDDEN_TO_CHANGE、DATABASE_IMPACT、API_IMPACT、FRONTEND_IMPACT、SECURITY_IMPACT、PRIVACY_IMPACT、MEDICAL_IMPACT、KNOWLEDGE_IMPACT、MIGRATION_REQUIREMENTS、ACCEPTANCE_CRITERIA、MANDATORY_TESTS、REGRESSION_TESTS、ROLLBACK_PLAN、KNOWN_RISKS、DELIVERABLES。
要求：
- ACCEPTANCE_CRITERIA 必须可验证、可观察、尽量可通过测试判断（示例：AC-01 未认证请求必须返回 401）。禁止"功能正常"这类模糊描述。每条含 id/criterion/verification。
- MANDATORY_TESTS 必须使用 TEST_COMMANDS 中真实存在的命令体系；medicalSensitive=true 时必须包含医疗安全回归测试（若项目暂无对应测试，则把"补齐该测试"写入 IN_SCOPE 与 MANDATORY_TESTS）。
- privacySensitive=true 时 PRIVACY_IMPACT 必须覆盖：数据最小化、授权、访问控制、日志脱敏、数据隔离、删除路径、导出路径、审计。
- 数据库结构变更必须通过 MIGRATION_REQUIREMENTS 描述（含 downgrade 要求）。
- 将完整 TASK_SPEC JSON 写入文件 .qoder/workflow-state/<TASK_ID>.spec.json（这是你唯一允许写入的文件），并在 specPath 返回该路径。若该文件已存在（历史运行留痕），禁止覆盖：改用 .qoder/workflow-state/<TASK_ID>-<git短SHA>.spec.json（短 SHA 用 git rev-parse --short HEAD 获取）。
TASK_SPEC 一旦进入 IMPLEMENT，实施者禁止修改。`,
  { label: 'task-spec', phase: 'Task Spec', model: MAX, effort: 'high', schema: SPEC_SCHEMA })
if (!spec) return modelBlocked('Task Spec', MAX + ' (Qwen3.8-Max)')
log(`TASK_SPEC 生成：${spec.TASK_ID} — ${spec.TITLE}（AC ${spec.ACCEPTANCE_CRITERIA.length} 条，落盘 ${spec.specPath}）`)

// ---------- PHASE 5 — IMPLEMENT ----------
phase('Implement')
const impl = await agent(`${PROJECT_RULES}
${FLASH_RULES}
[实施 TASK_SPEC] 第一步：读取 ${spec.specPath}（TASK_SPEC 全文），然后严格实施。
TASK_SPEC 摘要（以文件为准）：
${j(spec, 14000)}
探索线索（相关文件）：${j(exp.RELATED_FILES, 2000)}
要求：
- 只改 EXPECTED_FILES 范围内的文件；FILES_FORBIDDEN_TO_CHANGE 绝对不动；不得触碰用户在 Preflight 时已有的未提交修改。
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

async function runMachineGate(round) {
  return await agent(`${PROJECT_RULES}
${FLASH_RULES}
[Machine Gate 执行器 · 第 ${round} 轮] 你是客观裁判的执行手：只真实运行命令并如实记录退出码。禁止修改任何文件（测试运行自身产生的临时产物除外）、禁止修改任何业务代码或测试、禁止凭感觉判断、禁止虚报退出码（Max 会在 Verify 阶段抽查重跑）。
必跑门禁项（按分类与 TASK_SPEC 计算）：
${gateRequirements().map((r, i) => `${i + 1}. ${r}`).join('\n')}
规则：
- 首先核对 pyproject.toml / package.json / README / docs / CI，确认命令真实存在；只运行项目真实支持的命令；项目不支持的门禁项记入 skippedGates 并说明原因，不得凭空假设 npm test / ruff / mypy 存在。
- 每条命令记录 command / purpose / exitCode / stdoutSummary / stderrSummary（摘要即可，禁止贴超长输出，禁止输出任何 Secret）。
- 任何 exitCode != 0 → allPassed=false。
- 数据库相关测试优先使用项目已有的安全测试配置/mock；无法安全运行（缺安全测试环境且无法 mock）→ blockedMissingSafeTestEnv=true。
- 禁止为了通过而删除/跳过/修改测试。`,
    { label: 'machine-gate', phase: 'Machine Gate', model: FLASH, effort: 'low', schema: GATE_SCHEMA })
}

function gatePass(g) {
  return !!g && Array.isArray(g.commands) && g.commands.length > 0 && !g.blockedMissingSafeTestEnv && g.commands.every(c => c.exitCode === 0)
}
function gateFailSummary(g) {
  const fails = (g.commands || []).filter(c => c.exitCode !== 0)
  return fails.map(c => `命令: ${c.command}\nexitCode: ${c.exitCode}\nstdout: ${c.stdoutSummary || '-'}\nstderr: ${c.stderrSummary || '-'}`).join('\n---\n')
}

let cycles = 0            // 全任务 Repair Cycle 计数，硬上限 3
const attemptHistory = []
phase('Machine Gate')
let gate = await runMachineGate(1)
if (!gate) return modelBlocked('Machine Gate', FLASH + ' (Qwen3.8-Flash)')
if (gate.blockedMissingSafeTestEnv) {
  return blocked('BLOCKED_MISSING_SAFE_TEST_ENV', 'Machine Gate', {
    TASK_ID: spec.TASK_ID,
    DETAIL: gate.notes || '缺少可安全运行的测试环境',
    FILES_CURRENTLY_CHANGED: (impl.FILES_MODIFIED || []).concat(impl.FILES_CREATED || []),
    SAFE_NEXT_ACTION: '准备安全的本地测试环境（测试数据库/Redis/mock）后重跑；禁止对生产环境运行测试。',
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
  if (cycles === 1) {
    // 第一次：Flash 针对性自修复（只修失败项）
    const sr = await agent(`${PROJECT_RULES}
${FLASH_RULES}
[Self-Repair] TASK_SPEC 见 ${spec.specPath}。Machine Gate 失败如下：
${failText}
只做一次针对性修复：仅修复上述失败，禁止顺便改其他问题、禁止扩大 scope、禁止删除/跳过测试。修复后返回 status 与 summary、filesChanged。`,
      { label: 'self-repair', phase: 'Repair', model: FLASH, schema: FIXREPORT_SCHEMA })
    if (!sr) return modelBlocked('Repair', FLASH + ' (Qwen3.8-Flash)')
    attemptHistory.push({ cycle: 1, kind: 'FLASH_SELF_REPAIR', status: sr.status, summary: sr.summary })
  } else {
    // 同一根因第二次失败起：停止 Flash 猜测，Max 只读 RCA → FIX_SPEC → Flash 实施
    const rca = await agent(`${PROJECT_RULES}
${MAX_RULES}
[Root Cause Analysis] 只读分析（禁止 Write/Edit）。Flash 自修复后 Machine Gate 仍失败。
TASK_SPEC：${spec.specPath}
失败输出：
${failText}
修复历史：${j(attemptHistory, 2000)}
请阅读 git diff、相关源码与测试，输出 ROOT_CAUSE 与只针对 blocker 的 FIX_SPEC（禁止顺带其他改动）。`,
      { label: 'rca', phase: 'Repair', model: MAX, effort: 'high', schema: RCA_SCHEMA })
    if (!rca) return modelBlocked('Repair', MAX + ' (Qwen3.8-Max)')
    const rf = await agent(`${PROJECT_RULES}
${FLASH_RULES}
[执行 FIX_SPEC] 严格按以下 FIX_SPEC 修复，禁止任何顺带改动：
ROOT_CAUSE: ${rca.ROOT_CAUSE}
FIX_SPEC:
${j(rca.FIX_SPEC, 8000)}
完成后返回 status/summary/filesChanged。`,
      { label: 'rca-fix', phase: 'Repair', model: FLASH, schema: FIXREPORT_SCHEMA })
    if (!rf) return modelBlocked('Repair', FLASH + ' (Qwen3.8-Flash)')
    attemptHistory.push({ cycle: cycles, kind: 'MAX_RCA+FLASH_FIX', rootCause: rca.ROOT_CAUSE, status: rf.status, summary: rf.summary })
  }
  phase('Machine Gate')
  gate = await runMachineGate(cycles + 1)
  if (!gate) return modelBlocked('Machine Gate', FLASH + ' (Qwen3.8-Flash)')
  if (gate.blockedMissingSafeTestEnv) {
    return blocked('BLOCKED_MISSING_SAFE_TEST_ENV', 'Machine Gate', {
      TASK_ID: spec.TASK_ID, ATTEMPTS: cycles, attemptHistory,
      SAFE_NEXT_ACTION: '准备安全测试环境后重跑。',
    })
  }
}
log('MACHINE_PASS：全部必跑命令 exitCode=0')

// ---------- PHASE 8/9 — MAX REVIEW + FIX ----------
phase('Max Review')
function reviewPrompt(round) {
  const extra = []
  if (cls.medicalSensitive) extra.push('Medical Safety（诊断性表达/暗示医疗结论/无证据疗效声明/转诊边界/工程指标冒充临床指标）')
  if (cls.knowledgeTouchedExpected || cls.ragTouchedExpected) extra.push('Citation / Provenance / Data Isolation / Review Status Enforcement')
  if (cls.privacySensitive) extra.push('Privacy（数据最小化/授权/访问控制/日志脱敏/数据隔离/删除与导出路径/审计）')
  return `${PROJECT_RULES}
${MAX_RULES}
[独立 Code Review · 第 ${round} 轮] 禁止只看 Implementation Report。必须真实读取：
- TASK_SPEC：${spec.specPath}
- git diff（全部改动）与 changed files
- 相关 tests
- Machine Gate 结果：${j({ commands: gate.commands, skippedGates: gate.skippedGates || [] }, 6000)}
- Implementation Report：${j(impl, 4000)}
逐条检查 ACCEPTANCE_CRITERIA（每条给出 met 与 evidence）。
至少 Review：Correctness / Scope Compliance / Regression Risk / Architecture Compliance / Database Safety / API Compatibility / Error Handling / Logging / Security / Privacy / Test Quality / Maintainability${extra.length ? ' / ' + extra.join(' / ') : ''}。
最终只能返回 PASS 或 REQUEST_CHANGES。禁止"基本通过/看起来可以/建议以后优化/应该没问题"。
REQUEST_CHANGES 时每个 blocker 必须含 BLOCKER_ID/LOCATION/EVIDENCE/IMPACT/REQUIRED_FIX/VERIFICATION_METHOD；另可给 nonBlockingNotes（不阻止 PASS）。`
}

let review = await agent(reviewPrompt(1), { label: 'max-review', phase: 'Max Review', model: MAX, effort: 'high', schema: REVIEW_SCHEMA })
if (!review) return modelBlocked('Max Review', MAX + ' (Qwen3.8-Max)')
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
  const fx = await agent(`${PROJECT_RULES}
${FLASH_RULES}
[FIX] 只修复以下 review blockers，禁止顺便重构/升级依赖/改 UI/修 unrelated warning/修改任务合同：
${fixSpecText}
TASK_SPEC 见 ${spec.specPath}。完成后返回 status/summary/filesChanged。`,
    { label: 'fix', phase: 'Fix', model: FLASH, schema: FIXREPORT_SCHEMA })
  if (!fx) return modelBlocked('Fix', FLASH + ' (Qwen3.8-Flash)')
  attemptHistory.push({ cycle: cycles, kind: 'REVIEW_FIX', blockers: review.blockers.map(b => b.BLOCKER_ID), status: fx.status, summary: fx.summary })

  phase('Machine Gate')
  gate = await runMachineGate(cycles + 1)
  if (!gate) return modelBlocked('Machine Gate', FLASH + ' (Qwen3.8-Flash)')
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
${MAX_RULES}
[Root Cause Analysis] 只读分析。Review FIX 后 Machine Gate 失败：
${gateFailSummary(gate)}
输出 ROOT_CAUSE 与只针对 blocker 的 FIX_SPEC。`,
      { label: 'rca', phase: 'Repair', model: MAX, effort: 'high', schema: RCA_SCHEMA })
    if (!rca2) return modelBlocked('Repair', MAX + ' (Qwen3.8-Max)')
    const rf2 = await agent(`${PROJECT_RULES}
${FLASH_RULES}
[执行 FIX_SPEC] 严格按 FIX_SPEC 修复，禁止顺带改动：
ROOT_CAUSE: ${rca2.ROOT_CAUSE}
FIX_SPEC: ${j(rca2.FIX_SPEC, 8000)}`,
      { label: 'rca-fix', phase: 'Repair', model: FLASH, schema: FIXREPORT_SCHEMA })
    if (!rf2) return modelBlocked('Repair', FLASH + ' (Qwen3.8-Flash)')
    attemptHistory.push({ cycle: cycles, kind: 'MAX_RCA+FLASH_FIX(post-review)', rootCause: rca2.ROOT_CAUSE, status: rf2.status })
    gate = await runMachineGate(cycles + 1)
    if (!gate) return modelBlocked('Machine Gate', FLASH + ' (Qwen3.8-Flash)')
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
  review = await agent(reviewPrompt(reviewRounds), { label: 'max-review', phase: 'Max Review', model: MAX, effort: 'high', schema: REVIEW_SCHEMA })
  if (!review) return modelBlocked('Max Review', MAX + ' (Qwen3.8-Max)')
}
log('MAX REVIEW：PASS')

// ---------- PHASE 10 — VERIFY ----------
phase('Verify')
const ver = await agent(`${PROJECT_RULES}
${MAX_RULES}
[最终验收 VERIFY] TASK_SPEC：${spec.specPath}
Review 结论：${j({ verdict: review.verdict, acceptanceResults: review.acceptanceResults, nonBlockingNotes: review.nonBlockingNotes || [] }, 6000)}
Machine Gate：${j({ commands: gate.commands, skippedGates: gate.skippedGates || [] }, 5000)}
修复历史：${j(attemptHistory, 2000)}
基线（Preflight 时用户已有状态）：${j(baseline, 800)}
请只读复核（git status/git diff + 读取文件；允许重跑命令做抽查，但禁止修改任何文件）：
1. 所有 ACCEPTANCE_CRITERIA 均满足；
2. Machine Gate 全部通过；并抽查重跑其中最关键的 1~2 条命令（如目标测试），核实退出码与 Machine Gate 记录一致（防止执行手虚报）；
3. Review blockers 均已解决；
4. git diff 是否仍在 TASK_SPEC Scope 内（对照 IN_SCOPE / EXPECTED_FILES / FILES_FORBIDDEN_TO_CHANGE）；
5. 是否存在意外文件修改（注意区分用户在 Preflight 前已有的 dirty 文件，那些不算本任务改动）；特别检查治理文件禁区（AGENTS.md、.qoder/rules/**、.qoder/workflows/**、.qoder/workflow-state/*.spec.json 除本次新生成的 spec 外）是否被改动，被改动则必须 TASK_FAIL；
6. 是否引入明显回归风险；
7. ROLLBACK_PLAN 是否仍成立。
全部满足 → TASK_PASS；否则 → TASK_FAIL（列出 reasons）。
changedFiles 填 git diff/status 中本任务实际改动的文件。最后给出 suggestedNextTask（下一个最有价值的原子任务建议）。`,
  { label: 'verify', phase: 'Verify', model: MAX, effort: 'high', schema: VERIFY_SCHEMA })
if (!ver) return modelBlocked('Verify', MAX + ' (Qwen3.8-Max)')

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
    MODEL_USAGE: { PLAN: MAX + ' (Qwen3.8-Max)', IMPLEMENT: FLASH + ' (Qwen3.8-Flash)', REVIEW: MAX + ' (Qwen3.8-Max)' },
    SAFE_NEXT_ACTION: '审查 Verify reasons 与 git diff；人工决定回滚或重定义任务后重跑。',
  })
}

return {
  WORKFLOW_STATUS: 'TASK_PASS',
  MODE: 'task',
  TASK_ID: spec.TASK_ID,
  TASK_TITLE: spec.TITLE,
  MODEL_USAGE: {
    PLAN: MAX + ' (Qwen3.8-Max)',
    IMPLEMENT: FLASH + ' (Qwen3.8-Flash)',
    REVIEW: MAX + ' (Qwen3.8-Max)',
  },
  FILES_CHANGED: ver.changedFiles || (impl.FILES_MODIFIED || []).concat(impl.FILES_CREATED || []),
  TESTS_RUN: (gate.commands || []).map(c => c.command),
  MACHINE_GATE: 'MACHINE_PASS',
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
  GIT: baseline,
}
