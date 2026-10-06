# 60 — 知识库与 RAG 规则

## 知识体系分级（与 50-database.md 对齐）

- **A 医学教育知识库**：面向用户的听觉康复健康教育内容，走 RAG 检索 + 引用回答。
- **B 结构化训练内容**：题库/音频/场景脚本，走 item_bank 业务表，**不进向量库**。
- **C 内部规则**：System Prompt、安全策略、关键词表——不入库为可检索语料，不得泄露给用户。
- **D 用户数据**：健康信息、语音、训练记录——**绝对禁止进入公共向量库**；即使脱敏也不得写入 A 类检索语料（脱敏数据仅用于离线分析/模型优化，须单独授权 consent_flags）。

## Ingestion 管道（规划契约）

```
Source Registry（来源登记：license/copyright/provenance）
→ Documents / DocumentVersions（版本化，内容 hash）
→ Parser（PDF / HTML / Markdown / DOCX，统一 Parser Contract 接口）
→ Cleaner / Normalizer（去噪、繁简、全半角、Unicode NFC）
→ Deduplication（内容 hash + 语义近重）
→ Semantic Chunking（结构感知分段；chunk 带 doc/version/position/heading 元数据）
→ Embedding Provider（dashscope text-embedding，批量调用，维度固定并记录 model+version）
→ pgvector 写入（含 review_status，默认 pending）
```

- 每个文档 chunk 必须携带：source_id、document_version_id、provenance（出处/URL/页码）、license、review_status、embedding_model、embedding_version、valid_from/valid_until（可空）。
- Parser Contract 冻结后，多个 Parser 可并行开发（不同文件、同接口）。

## 检索与回答（Retrieval & RAG）

- 检索链：pgvector 向量检索 + PostgreSQL 全文检索 → Metadata Filter（review_status=approved、未过期、license 允许）→ Hybrid + RRF 融合 → Reranker（可选）→ Context Builder（截断/排序/引用槽位）→ RAG Orchestrator → LLM 生成。
- **硬性过滤规则**：review_status≠approved、已过期（valid_until < now）、未授权 license 的 chunk 一律不得进入上下文；必须有对应回归测试（unapproved-document exclusion、expired-document exclusion）。
- 每条回答必须携带 citations[]（source 名称 + 文档 + 定位）；Citation Validation：引用必须真实存在于检索结果，禁止 LLM 编造出处；无法给出可靠引用时明确说"知识库中未找到依据"。
- 检索无结果 / 低置信 → 不硬答；走兜底话术 + 建议咨询听力师。

## 生命周期

- Version/Expiry/Reindex：文档更新产生新 version，旧 version 的 chunk 标记 superseded 并从检索排除；reindex 任务幂等、可断点续跑。
- Expert Review：A 类内容必须经专家审查工作流（draft → in_review → approved/rejected）；审查人、时间、结论落审计日志。
- Knowledge Admin：知识管理后台负责上传、元数据、审查、发布、下架；操作全部审计。
- Evaluation：检索质量（recall@k/MRR）、回答质量（引用正确率、拒答正确率）用固定评测集回归，评测集与线上数据隔离。

## 医疗内容附加约束

- 知识库回答同样受 70-medical-safety.md 约束：涉及诊断/用药/调机的问题 → 拒答 + 转诊话术，即使知识库中存在相关文献。
- 疗效表述必须引用来源且使用"研究表明/可能有助于"级别措辞，禁止"保证/必然治愈"。
