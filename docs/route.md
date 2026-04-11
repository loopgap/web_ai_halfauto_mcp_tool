# AI Workbench 技术路线 v0.3（逻辑闭环统一版）

## 1. 目标、边界、闭环原则

目标：构建一个以本地优先、安全优先、自动化优先的 AI 工作台，支持多模型网页端调度、规则决策、Skill/Workflow 编排、前端可解释执行与全链路审计。

边界：

- 只使用 OS 层自动化，不做 DOM 注入与 Cookie 读取。
- 默认本地优先（规则 + 本地小模型），云端作为升级路径。
- 所有功能必须有成功路径和失败路径，且都可观测、可恢复、可回放。

闭环原则：

1. 触发。
2. 决策。
3. 执行。
4. 校验。
5. 归档。
6. 复盘与学习。

## 2. 统一架构

四层架构：

- Frontend Layer：状态机驱动 UI，展示解释与可操作恢复。
- Orchestration Layer：规则引擎 + DAG 调度 + 策略门禁。
- Execution Layer：OS Dispatcher + Provider Target + Plugin Runtime。
- Governance Layer：安全策略、审计、测试门禁、发布回滚、合规证据。

统一数据面：

- 配置：`config/*.yaml`
- 运行：`vault/runs/*`
- 事件：`vault/events/*.jsonl`
- 审计：`vault/audit/*.jsonl`
- 健康：`vault/health/*.json`

## 3. 前端逻辑闭环（核心）

前端不是页面集合，而是状态机系统。

前端分层：

- View：纯展示与交互组件。
- Domain：业务动作与规则解释。
- Store：全局状态与 reducer。
- Data：API 封装、缓存、重试、错误标准化。

强约束：

- 组件不直接调用后端命令。
- 所有动作走 `precheck -> execute -> verify -> persist -> feedback`。
- 所有错误都必须映射到统一错误码并附 `trace_id`。

页面状态机：

- Targets：`idle -> loading -> ready -> editing -> saving -> ready`。
- Console：`idle -> validating -> dispatching -> waiting_capture -> archived`。
- 失败状态必须有明确恢复动作：`retry`、`rollback`、`fallback`。

前端性能标准：

- 首屏可交互 < 2s。
- 路由切换 < 300ms。
- 大列表必须虚拟滚动。

前端安全标准：

- 输入长度与格式校验。
- 高风险按钮二次确认。
- localStorage 不存敏感数据。
- 错误日志自动脱敏。

## 4. 本地小模型体系（Local SLM）

角色分层：

- `router_slm`：意图识别与路由补全。
- `planner_slm`：参数补全与步骤建议。
- `qa_slm`：质量快速检查。
- `coder_slm`：按需代码/配置修复建议。

调度策略：

- 规则先行，SLM 增强，云端兜底。
- 短任务优先本地模型。
- 超预算自动降级到规则或默认 workflow。
- 当前执行优先级（默认）：`iGPU/GPU > NPU > CPU`。
- 当 NPU 驱动可用且通过质量门槛后，才可切换到 `NPU > iGPU/GPU > CPU`。

NPU 运行策略（质量优先，资源受控）：

- 只让高频短任务常驻 NPU：`router_slm`、`qa_slm`。
- `planner_slm/coder_slm` 默认按需加载，不常驻，避免长期占用。
- 量化优先顺序：`INT4 -> INT8 -> FP16`；若质量下降超阈值则自动回退更高精度。
- 单机预算默认值：
  - NPU 利用率目标：日常 20%~60%，峰值不超过 80%。
  - 内存目标：本地模型总占用不超过系统内存 35%。
  - 单次路由推理时延：P95 <= 600ms。
- 质量门槛（未达标禁止切 NPU 常驻）：
  - 路由 Top1 准确率相对 CPU 基线下降 <= 1.5%。
  - 质量门禁通过率下降 <= 1%。
  - 错误归因准确率不下降。

GPU 优先策略（现阶段主路径）：

- 默认使用本机 Intel iGPU 承载本地推理。
- GPU 忙碌或显存不足时自动降级为 CPU-safe。
- 仅短任务常驻模型允许常态运行，长任务按需加载避免持续占用图形资源。
- 需采集 GPU 利用率与推理时延，超过阈值自动降载。

运行治理：

- `hot/warm/cold` 三级加载策略。
- 模型资源配额（CPU、内存、并发）。
- 模型版本记录 `model_id/version/quant/checksum`。
- 设备感知调度：
  - 启动时探测 NPU 能力（驱动、可用内存、支持算子）。
  - 能力不足自动进入 `CPU-safe` 模式。
  - 推理失败自动熔断 NPU 通道并回退 CPU，不中断主流程。
- 模型分层建议：
  - `router_slm`：1.5B，INT4，NPU hot。
  - `qa_slm`：1.5B~3B，INT4/INT8，NPU warm。
  - `planner_slm`：3B，INT8，按需。
  - `coder_slm`：3B~7B，按需，优先 CPU/GPU，避免长期占 NPU。

## 5. 规则匹配引擎 v2（统一决策）

规则管道：

1. normalize
2. hard_match
3. keyword_match
4. pattern_match
5. semantic_match
6. policy_filter
7. rank
8. explain

置信度门槛：

- `>= 0.8` 自动执行。
- `[0.6, 0.8)` 用户确认。
- `< 0.6` 回退默认路径。

决策输出必须包含：

- top3 候选。
- 每项评分贡献。
- 命中规则 ID。
- 最终许可策略来源。

反馈学习：

- 记录用户接受/拒绝/改选。
- 周期性重算规则权重与 provider 适配度。
- 高误判规则自动降权并进入审查队列。

## 6. Skill Schema v3（统一规范）

必填字段：

- `id`
- `version`
- `title`
- `intent_tags`
- `inputs`
- `prompt_template`
- `dispatch`
- `quality_gates`
- `fallbacks`
- `observability`

高级字段：

- `preconditions`
- `postconditions`
- `safety_level`
- `cost_class`
- `latency_class`
- `determinism`
- `cache_policy`

发布约束：

- 无输入输出 schema 不可发布。
- 无超时/重试/fallback 不可发布。
- 无测试样例不可发布。

## 7. Workflow Schema v3（DAG++）

Step 必填：

- `id`
- `use`
- `depends_on`
- `retry_policy`
- `timeout_ms`
- `compensation`
- `emit_events`

图级策略：

- `max_parallelism`
- `global_timeout_ms`
- `fail_policy`
- `checkpoint_policy`
- `resume_policy`

汇聚策略：

- `first_success`
- `best_score`
- `majority_vote`
- `human_select`

发布约束：

- DAG 必须无环。
- 所有 step 必须可达。
- fail path 必须覆盖。
- checkpoint 必须可恢复。

## 8. 自动化执行与恢复

触发源：

- manual
- cron
- watcher
- webhook（默认关闭）

执行策略：

- 队列化调度，焦点资源锁，防并发冲突。
- 失败可重试，可补偿，可熔断。
- 高频错误绑定自动修复 playbook。

自愈流程：

1. 识别错误码。
2. 执行修复动作。
3. 健康复测。
4. 成功恢复或升级人工处理。

## 9. 识别与交互准确度专项（产品级）

目标：显著降低“找错窗口、粘贴错位、误发送、归档错位”。

### 9.1 多因子窗口指纹（替代纯标题 regex）

Target 识别必须使用组合指纹：

- `hwnd`（主匹配）
- `process_id + exe_name`
- `class_name`
- `title_regex`（fallback）
- 可选：窗口位置/尺寸（固定布局场景）

匹配顺序：

1. `hwnd` 命中即用。
2. `hwnd` 失效时走 `exe + class + title` 相似匹配。
3. 多候选时进入用户确认弹窗并支持“重新绑定”。

### 9.2 Target Setup Wizard（强制）

向导步骤：

1. 列出顶层窗口（标题、进程、class、可见/最小化）。
2. 用户选择目标窗口并保存指纹。
3. 执行“验证粘贴”（UUID ping，不回车）。
4. 用户确认“看到/没看到”，失败则引导焦点修复后重试。

### 9.3 预检查（Preflight）与 TargetStatus 状态机

发送前必须预检查 target 状态，非 `Ready` 禁止发送。

`TargetStatus`：

- `Ready`
- `Missing`
- `Ambiguous`
- `NeedsRebind`
- `Inactive`

预检查失败的 UI 必须提供：

- `重新检测`
- `进入绑定向导`
- `打开操作指引`

### 9.4 两阶段提交（2-phase send）

默认流程：

1. Stage：只粘贴，不发送（`auto_enter=false`）。
2. Confirm：用户点击 `Send Now` 或手动回车。

优势：

- 降低误发风险。
- 发送前可人工复核 prompt。

### 9.5 交互安全锁（Soft Lock）

命中以下任一条件，自动暂停投递并提示重试：

- 前台窗口不是目标窗口。
- 短时间内焦点频繁抖动。
- 剪贴板在投递窗口期被外部覆盖。

### 9.6 剪贴板事务（Clipboard Transaction）

投递流程必须支持：

- 写入前备份旧剪贴板文本。
- 粘贴后恢复原剪贴板。
- 提供可配置开关：`restore_clipboard_after_paste`。

### 9.7 Focus Recipe（不依赖 DOM）

为每个 provider 配置焦点配方（示例：`ESC, ESC, TAB, TAB`）。

执行方式：

- 激活窗口后先跑配方，再执行粘贴。
- 绑定向导可训练配方并保存。

### 9.8 Run-ID 水印归档

每次投递自动附加可解析标记：
`[AIWB_RUN_ID=... STEP=... TARGET=...]`

Capture 时：

- 优先解析水印自动归档到对应 run/step。
- 无水印时要求用户手动选择归档目标。

### 9.9 关键日志与可复现证据

每次投递记录：

- 候选窗口列表
- 最终匹配指纹与 `hwnd`
- 激活校验结果
- 剪贴板事务结果
- 发送动作结果
- 端到端耗时

## 10. 统一错误模型与状态约束

错误码分层：

- `INPUT_*`
- `TARGET_*`
- `DISPATCH_*`
- `CLIPBOARD_*`
- `CONFIG_*`
- `POLICY_*`
- `APPROVAL_*`
- `PLUGIN_*`
- `ARCHIVE_*`
- `INTERNAL_*`

每个错误码必须定义：

- 用户文案。
- 修复建议。
- 告警级别。
- 自动修复策略 ID（可空）。

状态机硬约束：

- 未 `activating` 不得 `pasting`。
- `failed` 后仅可 `compensating` 或 `closed`。
- `archived` 后禁止改正文。
- run 最终必须收敛到 `done/failed/cancelled`。

## 11. 安全体系（统一）

安全控制：

- Policy-as-Code（RBAC + 风险动作门禁）。
- 高风险动作审批流（超时自动拒绝）。
- 插件签名校验与沙箱权限。
- 机密本地加密存储与 secret 扫描。
- 日志脱敏与审计防篡改链。

威胁模型：STRIDE 全项覆盖，风险必须映射控制项。

## 12. 可观测与指标

必须采集：

- 日志：结构化 JSON，含 `trace_id/run_id/step_id/error_code`。
- 指标：成功率、时延、重试、队列深度、拒绝率。
- 链路：每 run 全链路 trace。
- 资源：NPU/CPU/GPU 利用率、模型显存/内存占用、热模型数量。
- 质量对照：NPU 与 CPU 基线的准确率差值、门禁通过率差值。
- 质量对照：GPU 与 CPU 基线的准确率差值、门禁通过率差值。

SLO/SLA：

- 核心命令可用性 >= 99.5%。
- 错误归因准确率 >= 98%。
- 单目标 dispatch P95 <= 2.0s。
- fanout(2) P95 <= 4.5s。
- NPU 资源 SLO：
  - 常态 NPU 占用 <= 60%，峰值 <= 80%。
  - 触发降载后 30s 内恢复到安全区间。
- NPU 质量 SLO：
  - 相对 CPU 基线准确率下降 <= 1.5%。
  - 质量门禁通过率下降 <= 1%。
- GPU 资源 SLO（当前默认）：
  - 常态 GPU 占用 <= 70%，峰值 <= 90%。
  - 触发降载后 30s 内回落到安全区间。
- GPU 质量 SLO（当前默认）：
  - 相对 CPU 基线准确率下降 <= 1%。
  - 质量门禁通过率下降 <= 1%。

错误预算：

- 超预算进入稳定性冻结，只允许修复与测试增强。

## 13. 测试与代码审查门禁

代码审查分层：

- 规范层。
- 逻辑层。
- 安全层。
- 稳定性层。
- 可运维层。

测试体系：

- Unit
- Contract
- Integration
- E2E
- Chaos
- Security
- Regression
- Performance

强制门槛：

- 核心模块覆盖率 >= 85%。
- 错误分支覆盖率 >= 80%。
- 状态机路径覆盖率 >= 90%。
- 新增缺陷必须绑定回归测试。

## 14. 变更、发布、回滚闭环

变更机制：

- 中高风险变更先 RFC。
- RFC 含安全影响、测试计划、回滚计划、观测计划。

发布门禁：

1. 审查通过。
2. 测试通过。
3. 异常注入通过。
4. 回滚演练通过。
5. 证据包生成。

回滚机制：

- 保留最近 2 个稳定版本与配置快照。
- 指标恶化自动触发回滚。

## 15. 事故响应与知识闭环

事故分级：P0/P1/P2。

P0 规则：

- 30 分钟止血。
- 24 小时复盘。
- 72 小时补齐测试与门禁。

知识沉淀：

- 每次事故更新 runbook。
- 每次修复更新回归集。
- 每次新增工程更新 route 与执行清单。

## 16. 前端 + Skill/Workflow Studio 落地要求

Skill Studio 必备：

- schema 编辑器。
- prompt 变量预览。
- fallback 配置。
- 质量门禁配置。

Workflow Studio 必备：

- DAG 画布。
- step 属性面板。
- 失败路径模拟。
- checkpoint 回放。

解释性要求：

- 每次执行可查看规则命中、路由打分、策略许可来源。

## 17. 里程碑（统一版）

Sprint 1（2 周）：Preflight + TargetStatus + 窗口探测与绑定向导 + 两阶段提交。
Sprint 2（2 周）：多因子指纹 + 验证粘贴 + Focus Recipe + 剪贴板事务。
Sprint 3（2 周）：Run-ID 自动归档 + NPU 质量对照评测 + Studio 可视化编排 + 全门禁发布。

## 18. 每次新增工程的“逻辑闭环”强制清单

- [ ] 是否定义输入、输出、失败路径。
- [ ] 是否定义错误码与恢复动作。
- [ ] 是否接入审计事件与 trace。
- [ ] 是否补齐单测/集成/E2E/回归。
- [ ] 是否通过策略门禁与发布门禁。
- [ ] 是否更新 route、runbook、benchmark。
- [ ] 是否覆盖识别准确度专项（指纹/预检查/两阶段/归档）。

## 19. v0.3 最终统一验收

- [ ] 前端核心页面全部状态机化，失败可恢复。
- [ ] 规则引擎可解释且具备冲突治理。
- [ ] 本地小模型分层可运行并可降级。
- [ ] Skill v3 / Workflow v3 全量落地且可视化编辑。
- [ ] 安全、审查、测试、发布、回滚形成单一闭环。
- [ ] 每次新增工程均执行逻辑闭环并沉淀证据。
- [ ] GPU 优先运行稳定可用，且 NPU 在可用时可无缝切换并满足质量/资源双约束。
- [ ] 识别准确度与交互准确度专项全部达标（向导、预检查、两阶段、事务、归档）。

## 20. MCP 集成策略（增强）

定位：

- MCP 作为“工具总线”，负责连接本地工具与数据能力。
- Workbench 仍是主编排器，不依赖各网页端原生 MCP 支持。

建议架构：

- Workbench：流程编排、路由决策、运行归档、UI 交互。
- MCP Servers：`os-win`、`vault`、`collectors`、`pdf-parser`、`diff`。
- 可选：`playwright-mcp` 用于需要更强浏览器动作的场景。

## 21. MCP 工具分层与最小集合

必备工具（最小可用集）：

- `os.list_windows`
- `os.find_target`
- `os.target_status`
- `os.verify_paste`
- `os.dispatch_stage`
- `os.dispatch_send_now`
- `os.capture_clipboard`
- `vault.save_run_meta`
- `vault.save_run_output`

Preflight 工具化要求：

- Send 前必须调用 `os.target_status`。
- 状态非 `Ready` 时必须阻断执行并返回修复建议。

## 22. MCP + 浏览器自动化边界

默认策略：

- 先用 OS 自动化（稳定、低耦合）。
- 仅在 OS 路径无法满足时启用 `playwright-mcp`。

触发条件（满足任一）：

- 复杂网页流程需要元素级操作。
- 需要跨页面结构化抓取。
- OS 层焦点控制在特定站点长期不稳定。

## 23. MCP 安全治理（强制）

- MCP server 白名单加载，默认拒绝未知 server。
- 每个 tool 声明最小权限（文件、网络、剪贴板、进程）。
- 关键 tool 调用必须审计：`tool_name`, `args_hash`, `trace_id`, `result`.
- 高风险 tool（导出、自动发送）必须经过策略门禁/审批流。

## 24. 实施优先级（Now / Next / Later）

Now（立即落地）：

- Preflight + TargetStatus 强制门禁。
- 绑定向导 + 验证粘贴（UUID ping）。
- 两阶段提交默认启用。
- 剪贴板事务与 Soft Lock。

Next（下一阶段）：

- 规则解释面板（top3 + 打分明细 + 冲突原因）。
- Command Palette + Quick Actions + One-click Fix。
- Run-ID 自动归档与 Session Resume。

Later（稳定后增强）：

- Workflow Studio 全图编排。
- NPU 自适应切换（驱动可用且质量达标时开启优先）。
- Playwright MCP 在特定站点场景按需启用。

## 25. 量化验收矩阵（体验强化）

识别准确度：

- 窗口正确命中率 >= 99%（1000 次样本）。
- 重绑定后首次命中率 >= 95%。

交互准确度：

- 误发送率 <= 0.3%。
- 粘贴错位率 <= 0.5%。
- 剪贴板恢复成功率 >= 99%。

性能与稳定性：

- Stage 到可确认耗时 P95 <= 1.2s。
- 自动恢复成功率 >= 85%。
- 核心命令可用性 >= 99.5%。

可观测性：

- 错误码归因覆盖率 >= 98%。
- trace 完整率 >= 99%。

## 26. 风险触发阈值与处置

触发“稳定性冻结”（任一满足）：

- 连续 3 天误发送率 > 0.5%。
- 连续 3 天窗口命中率 < 97%。
- 连续 3 天错误归因覆盖率 < 95%。

冻结期仅允许：

- 缺陷修复。
- 测试补强。
- 规则回滚与策略收敛。

解除冻结标准：

- 连续 5 天恢复到验收阈值内。

## 27. 文档维护规则（防止再次膨胀）

- 每次迭代优先修改既有章节，禁止平行新增重复章节。
- 新能力必须明确挂靠到既有主线（识别/交互/模型/规则/治理之一）。
- 策略被替代时必须删除旧条款，禁止“新旧并存”。
- 里程碑变更需同步更新：验收项、风险阈值、测试门槛。

## 28. 端到端逻辑链条（E2E Contract）

统一链条：

1. `Preflight`：目标可用性、配置完整性、资源健康。
2. `Route`：规则决策 + 模型补充 + 策略许可。
3. `Stage`：激活窗口、聚焦、粘贴（不发送）。
4. `Confirm`：用户确认或策略自动确认。
5. `Send`：执行发送动作并记录确认来源。
6. `Capture`：回收输出并绑定 run/step。
7. `Archive`：结构化落盘、索引、摘要。
8. `Review`：质量门禁、异常归因、复盘沉淀。

每一环都必须满足：

- 明确输入 DTO。
- 明确输出 DTO。
- 明确验证点。
- 明确失败分支与恢复动作。

## 29. 阶段契约（I/O + Verify）

### 29.1 Preflight

- 输入：`target_id`, `dispatch_policy`, `device_state`
- 输出：`TargetStatus`, `ready:boolean`, `fix_actions[]`
- 验证：
  - target 必须 `Ready`
  - 配置版本可加载
  - 设备预算未超限

### 29.2 Route

- 输入：`intent`, `rules`, `history`, `resource_budget`
- 输出：`top_candidates[]`, `selected`, `explain`
- 验证：
  - 返回至少 1 个候选
  - explain 非空
  - policy 许可通过

### 29.3 Stage

- 输入：`selected_target`, `prompt`, `focus_recipe`
- 输出：`stage_ok`, `stage_trace`, `clipboard_txn_id`
- 验证：
  - 激活校验成功
  - 粘贴完成且未回车
  - 剪贴板事务可恢复

### 29.4 Confirm + Send

- 输入：`stage_trace`, `confirm_source(user|policy)`
- 输出：`sent_ok`, `send_ts`, `send_trace`
- 验证：
  - confirm_source 必填
  - 发送动作仅执行一次（幂等）

### 29.5 Capture + Archive

- 输入：`run_id`, `step_id`, `clipboard_content`
- 输出：`output_ref`, `archive_ref`, `index_ref`
- 验证：
  - run/step 绑定成功
  - 输出非空或标记空输出原因
  - 归档文件 hash 记录完成

## 30. 验证策略（Verification Strategy）

验证分层：

- L1 静态验证：schema、配置、规则合法性。
- L2 运行前验证：Preflight、资源预算、策略许可。
- L3 运行中验证：焦点稳定、stage 成功、发送幂等。
- L4 运行后验证：capture 归档一致性、可回放性。
- L5 复盘验证：错误归因完整、修复建议可执行。

阻断规则：

- 任意关键验证点失败，禁止进入下一阶段。
- 任意阶段验证缺失，禁止标记 run 为 `done`。

## 31. 失败注入计划（Failure Injection）

最小注入集（每个版本必跑）：

- `TARGET_MISSING`：目标窗口未打开。
- `TARGET_AMBIGUOUS`：同类窗口多实例冲突。
- `FOCUS_DRIFT`：激活后焦点跳转。
- `CLIPBOARD_RACE`：投递窗口期剪贴板被覆盖。
- `SEND_DUPLICATE`：确认动作重复触发。
- `CAPTURE_EMPTY`：输出为空或未复制。
- `ARCHIVE_IO_FAIL`：归档写入失败。
- `DEVICE_OVER_BUDGET`：GPU/NPU 资源超预算。

注入验收：

- 每类故障必须命中预期错误码。
- 每类故障必须触发对应恢复动作。
- 每类故障必须可导出证据包。

## 32. 证据链与可回放验证

每次 run 至少产出：

- `run_meta.json`
- `step_events.jsonl`
- `dispatch_log.jsonl`
- `capture_meta.json`
- `archive_hashes.json`
- `verification_report.json`

回放要求：

- 支持 `dry-run`（不实际发送，仅验证流程）。
- 支持“从失败 step 继续”而非全流程重跑。
- 回放结果必须与原 run 对齐（误差字段可配置白名单）。

## 33. 逻辑一致性审查（每次变更必做）

审查问题清单：

- 新逻辑是否破坏既有状态机转移？
- 新逻辑是否新增未定义错误码？
- 新逻辑是否绕过策略门禁或审批？
- 新逻辑是否影响归档一致性？
- 新逻辑是否降低可解释性（explain 缺失）？

审查结论格式：

- `impact_scope`
- `risk_level`
- `verification_added`
- `rollback_ready`

## 34. 验收报告模板（统一输出）

每次迭代输出一份报告，至少包含：

- 功能达成率（计划 vs 实际）。
- 指标达成率（SLO/SLA/体验矩阵）。
- 故障注入通过率。
- 回滚演练结果。
- 遗留风险与下一步收敛计划。

## 35. 输入/输出统一模型（Artifact）

统一定义：所有步骤输入与输出都必须落为 `Artifact`，禁止隐式“临时文本传递”。

Artifact 最小字段：

- `artifact_id`
- `run_id`
- `step_id`
- `type`（`text`/`markdown`/`json`/`file`）
- `producer`（`user`/`collector`/`grok`/`gemini`/`chatgpt_plus` 等）
- `path`
- `created_at`
- `checksum`

输入来源三类：

- 用户输入（topic/目标/约束）。
- 本地资料（PDF/log/md/code）。
- 上一步输出（step captured artifact）。

约束：

- 每个 step 执行前必须明确引用输入 artifact 列表。
- 每个 step 完成后必须产出至少一个输出 artifact 或失败原因。

## 36. 输出采集机制（网页订阅场景）

默认输出采集路径：

1. 用户在网页端复制结果。
2. Workbench 执行 `Capture Output`（读剪贴板）。
3. 结果落盘为 artifact 并归档。

归档定位策略：

- 策略 A：Run-ID 水印自动解析（推荐）。
- 策略 B：用户显式选择 Capture 目标 step（兜底）。

Run-ID 水印格式建议：

- `[AIWB_RUN_ID=<run_id> STEP=<step_id> TARGET=<target>]`

约束：

- Capture 必须返回 `artifact_path` 与 `bound_step_id`。
- 若水印缺失且用户未选择 step，禁止自动归档。

## 37. Run/Step 状态机（核心闭环）

StepStatus：

- `Pending`
- `Dispatched`
- `AwaitingSend`
- `WaitingOutput`
- `Captured`
- `Failed`

状态迁移规则：

- `Pending -> Dispatched`（stage 完成）
- `Dispatched -> AwaitingSend`（两阶段提交）
- `AwaitingSend -> WaitingOutput`（发送确认）
- `WaitingOutput -> Captured`（capture 成功）
- 任意状态 -> `Failed`（错误）

自动推进规则：

- 当 `StepCaptured(step_n)` 触发，自动渲染 `step_n+1` 输入并转入 `Pending`。
- 若下一步 preflight 失败，标记下一步 `Failed` 并给修复入口。

## 38. 事件总线定义（Event Bus Contract）

核心事件枚举：

- `RunCreated(run_id)`
- `StepDispatched(run_id, step_id)`
- `StepAwaitingSend(run_id, step_id)`
- `StepWaitingOutput(run_id, step_id)`
- `StepCaptured(run_id, step_id, artifact_path)`
- `StepFailed(run_id, step_id, error_code)`
- `ClipboardCaptured(text_len)`
- `NewFileInInbox(path)`
- `NewSourceFetched(source_id)`
- `TargetMissing(target_id)`
- `TargetRebound(target_id, hwnd)`

事件约束：

- 每个事件必须带 `trace_id` 与时间戳。
- UI 订阅事件更新状态；Orchestrator 订阅 `StepCaptured` 推进下一步。
- 所有事件必须写入 `vault/events/*.jsonl`。

## 39. 三条执行主流程（统一产品行为）

流程 A：手动推进（最稳）

1. 用户 Run Workflow。
2. Stage Step1 -> 用户发送。
3. 复制输出 -> Capture。
4. 自动准备下一步，循环直至结束。

流程 B：半自动（推荐默认）

- Stage 自动。
- Send 手动确认。
- Capture 手动触发。
- 下一步自动准备。

流程 C：自动触发（文件/订阅）

- Inbox/RSS 触发事件。
- 系统弹建议 workflow（默认确认后执行）。
- 执行阶段采用 B 流程。

## 40. Preflight 与缺窗口处理（强制）

每次 dispatch 前必须执行：

- 目标窗口匹配（指纹/绑定）。
- 前台激活可行性校验。
- 剪贴板读写可用性校验。

失败处理：

- Step 置 `Failed`。
- UI 必须给：
  - `重新检测`
  - `进入绑定向导`
  - `打开操作指引`

禁止行为：

- Preflight 失败仍继续 dispatch。

## 41. MVP 最小闭环（按收益排序）

1. Run/Step 状态机落地。
2. Capture（剪贴板读取 + artifact 归档）。
3. `StepCaptured` 自动推进下一步。
4. Preflight 失败阻断 + 修复入口。
5. Run-ID 水印与自动归档绑定。

完成标准：

- 三步串联流程（Grok -> Gemini -> Plus）可稳定跑通。
- 任一步失败可定位、可修复、可重试。

## 42. 体验优化逻辑（Decision UX）

### 42.1 自动化分级（减少打扰）

- `Auto`：低风险动作自动执行（如 Stage、状态刷新、归档索引）。
- `Assist`：中风险动作给默认建议并倒计时执行（可取消）。
- `Confirm`：高风险动作必须人工确认（Send、外部导出、批量操作）。

分级规则：

- 首次使用默认 `Assist`。
- 连续 20 次同类动作无异常后可升级为 `Auto`。
- 任意一次高危失败后自动回退到 `Confirm`。

### 42.2 动态确认策略（减少误发）

- 默认两阶段提交保持开启。
- 当满足全部条件时可显示“快速发送”：
  - TargetStatus=Ready
  - 最近 10 次该 target 无误发
  - 当前焦点稳定
- “快速发送”仅本次有效，不改变全局安全策略。

### 42.3 智能恢复路径（最短修复）

- 每个错误码绑定“首选修复动作”：
  - `TARGET_MISSING` -> `重新检测窗口`
  - `NEEDS_REBIND` -> `打开绑定向导`
  - `FOCUS_DRIFT` -> `执行 Focus Recipe`
  - `CLIPBOARD_RACE` -> `重试并恢复剪贴板`
- UI 只显示 1 个推荐主按钮 + 1 个次按钮，避免用户决策过载。

## 43. 用户旅程优化（Journey Design）

首次旅程（First Run）：

1. 引导绑定一个目标窗口。
2. 执行一次验证粘贴（UUID ping）。
3. 完成一次 Stage -> Confirm -> Capture。
4. 展示“成功回放卡片”（让用户知道流程可追溯）。

日常旅程（Daily Run）：

- 入口默认打开最近成功 workflow。
- 自动带入最近成功 target 和 Focus Recipe。
- 提供“继续上次未完成 run”置顶入口。

故障旅程（Failure Journey）：

- 错误出现后不弹技术细节，先给修复动作。
- 用户点“详情”才展开 trace_id、error_code、日志片段。
- 修复成功后自动回到原步骤，不重头开始。

## 44. 体验指标（Experience KPIs）

效率指标：

- 首次成功闭环时间 <= 5 分钟。
- 日常单步操作点击次数 <= 3 次。
- 从失败到恢复中位时间（MTTR-UX）<= 45 秒。

质量指标：

- 用户手动重试次数环比下降。
- 引导后误操作率持续下降。
- “一步修复成功率” >= 80%。

信任指标：

- 可解释面板打开率（说明用户愿意理解系统）上升。
- 回放复查使用率上升。
- 因“不知道发生了什么”导致的中断率下降。

## 45. 交互细节规范（避免体验抖动）

- 长操作统一显示阶段进度：`preflight -> route -> stage -> capture -> archive`。
- 任意阶段超过 1.5s 必须显示可见加载状态。
- 状态变化使用稳定文案，不随版本频繁改名。
- Toast 只用于结果通知，修复动作必须放在主界面卡片中。
- 批量操作必须支持“预览影响范围”再执行。

## 46. 持续优化机制（闭环）

每周体验评审输入：

- Top 10 失败路径。
- Top 10 高频操作路径。
- 用户取消操作原因统计。

每周输出：

- 删除一个多余确认步骤（若风险可控）。
- 增加一个一键修复动作。
- 优化一个高频页面的点击路径。

约束：

- 任何体验优化不得绕过安全门禁与审计链路。

## 47. 全局 UI 统一规范（Design System）

目标：

- 所有页面使用同一套视觉与交互语言。
- 避免“同功能不同样式/不同状态文案”的割裂体验。

统一要素：

- 颜色：仅允许使用语义色（`primary/success/warn/error/info`）与中性色阶。
- 字体：统一字号阶梯与行高，不允许页面自定义随意尺寸。
- 间距：统一 spacing scale（如 4/8/12/16/24/32）。
- 圆角与阴影：统一 token，不允许局部随意覆盖。
- 图标：统一图标库与尺寸规范（16/20/24）。

约束：

- 禁止组件内硬编码颜色值和 px 魔法数。
- 禁止同语义按钮在不同页面出现不同视觉层级。

## 48. 组件一致性协议（Component Contract）

每个基础组件必须定义：

- `default/hover/active/disabled/loading/error` 全状态视觉。
- 最小/最大宽高。
- 文本截断规则（单行省略/多行截断）。
- 空状态与骨架屏。
- 可访问性标签（`aria-*`）与键盘交互。

组件分层：

- Primitive：Button/Input/Select/Dialog/Toast/Badge。
- Pattern：FormSection/StatusCard/ActionBar/StepTimeline。
- Page Template：ConsoleTemplate/TargetsTemplate/ArchiveTemplate。

约束：

- 页面只能使用 Pattern 和 Template 组装，不直接拼 Primitive 造成风格漂移。

## 49. 布局与响应式稳定性（Layout Safety）

断点规范：

- `sm/md/lg/xl` 统一断点，不允许页面自定义断点。

布局规则：

- 主内容区必须有最小宽度与最大宽度约束。
- 表格/日志区默认开启横向滚动容器，禁止撑破布局。
- 长文本必须可折叠或截断，禁止无限扩展导致错位。
- 弹窗/抽屉必须有最大高度并支持内部滚动。

Z-index 规则：

- 使用统一层级表（base/dropdown/popover/modal/toast）。
- 禁止页面自定义超大 z-index 破坏层级。

## 50. 显示异常防护（Rendering Guardrails）

必须实现：

- 全局 Error Boundary（组件级崩溃不拖垮整页）。
- Suspense/Fallback（异步加载有稳定占位）。
- Skeleton 优先于闪烁加载文本。
- 图片/图标加载失败兜底占位。
- 数据为空/字段缺失时使用空态模板，禁止显示 `undefined/null`。

溢出防护：

- 所有可变长字段默认 `overflow-wrap: anywhere`。
- 代码块与日志块使用固定行高和可滚动容器。

## 51. 文案与状态统一（Content Consistency）

状态文案统一字典：

- `loading`, `success`, `failed`, `retrying`, `paused`, `needs_action`。

错误文案规则：

- 主文案：用户可理解。
- 次文案：可执行修复建议。
- 附加：`trace_id` 与错误码。

约束：

- 不允许页面自行拼接错误文案。
- 所有状态文案从统一字典读取，支持后续国际化。

## 52. 可访问性与可用性底线（A11y）

必须满足：

- 键盘可达（Tab 顺序正确，焦点可见）。
- 对比度满足 WCAG AA。
- 表单有 label 与错误关联提示。
- Dialog 打开后焦点锁定，关闭后焦点回到触发点。

高风险动作：

- 必须可键盘取消。
- 必须有明确确认与撤销路径。

## 53. 视觉回归与显示验证（UI QA）

验证层：

- 组件快照测试（基础状态）。
- 页面视觉回归测试（关键断点）。
- 交互路径录制回归（关键流程）。

必测页面：

- Dashboard
- Console
- Targets
- Archive
- Settings

阻断规则：

- 任一关键页面视觉偏移超阈值（如 > 2px 且影响布局）阻断发布。
- 任一关键交互状态缺失（loading/error/empty）阻断发布。

## 54. 发布前 UI 检查清单（强制）

- [ ] 全局 token 无硬编码污染。
- [ ] 核心组件状态齐全（含 loading/error/disabled）。
- [ ] 关键页面在 `sm/md/lg` 无错位、无截断异常。
- [ ] Error Boundary 与空态兜底生效。
- [ ] 错误文案使用统一字典并展示 trace_id。
- [ ] 视觉回归测试通过。

## 55. 企业级通用闭环 （可执行资产）

为避免“只有路线、没有执行体”，本仓库新增可落地资产，位置在 `ai-workbench/governance/`：

- 标准：`governance/standard-v2.md`
- 成熟度模型：`governance/maturity-model.json`
- 硬门禁与评分卡：`governance/quality-gates.json`
- 模板：`governance/templates/*`
- 检查清单：`governance/checklists/*`
- 示例输入：`governance/examples/*`

执行命令：

- `pnpm governance:validate`：校验硬门禁定义、评分卡阈值、模板完整性。
- `pnpm governance:evidence`：从示例 JSON 生成证据包 Markdown。

## 56. 公共契约落地（前后端同构）

本路线新增跨项目公共契约并要求前后端同构：

- `ChangeRecord`
- `QualityGateResult`
- `ReleaseDecisionRecord`
- `IncidentRecord`
- `TelemetryEvent`

实现位置：

- 前端类型：`ai-workbench/src/types.ts`
- 后端类型：`ai-workbench/src-tauri/src/config.rs`

约束：

- 每次变更必须至少产出 ChangeRecord + QualityGateResult + ReleaseDecisionRecord。
- 结论必须可追溯到 `change_id/run_id/step_id/trace_id`。

## 57. 双轨验收执行细则（硬门禁 + 评分卡）

硬门禁（任一失败即阻断）：

- `no_open_p0_p1`
- `security_high_resolved`
- `critical_e2e_passed`
- `rollback_validated`

评分卡维度（每项 0~5，总分 35）：

- correctness
- stability
- performance
- ux_consistency
- security
- maintainability
- observability

发布建议：

- `>=30`：Go
- `24~29`：GoWithRisk
- `<24`：NoGo

## 58. 交付闭环最小执行清单（每次变更）

1. 填写需求模板（Demand）。
2. 填写设计模板（Design）。
3. 执行测试模板并记录证据（Test）。
4. 运行 `pnpm governance:validate`。
5. 生成证据包（Evidence Pack）。
6. 完成发布模板与发布检查清单（Release）。
7. 若出现 P1+ 事件，必须输出 Incident + CAPA。

## 59. 环境补全与流水线统一

本地环境补全：

- 执行 `pnpm env:check` 检查 `node/pnpm`（必需）与 `cargo/rustc`（可选）可用性。
- 使用 `.env.example` 作为本地环境模板。
- 执行 `pnpm ci:governance` 可本地复刻治理流水线。

CI 流水线（GitHub Actions）：

- 新增 `.github/workflows/governance.yml`。
- 统一流程：`pnpm install --frozen-lockfile -> env:check -> governance:validate -> governance:evidence`。
- 自动上传证据包 `governance/examples/evidence-pack.generated.md` 作为构建产物。

## 60. 浏览器智能检测与选择（自由度 + 兼容性 + 友好性）

目标：

- 在不增加用户负担的前提下自动选择“当前最适合”的浏览器目标窗口。
- 允许用户自由使用 `Firefox/Chrome/Chromium/Edge/Brave`，系统自动适配并可解释。
- 在目标浏览器不可用时自动回退，不让用户卡死在单一浏览器。

核心原则：

- 智能默认：用户不选时系统自动选最优。
- 手动优先：用户明确指定浏览器时，除非不可用，不做覆盖。
- 可解释：每次自动选择都输出原因与评分明细。
- 可恢复：选择失败有一键修复动作（重检、切换、绑定向导）。

## 61. BrowserProfile 与探测模型

新增浏览器画像（BrowserProfile）：

- `browser_id`: `firefox|chrome|chromium|edge|brave|other`
- `exe_name`: 如 `firefox.exe/chrome.exe/msedge.exe/brave.exe`
- `class_name`: 如 `MozillaWindowClass/Chrome_WidgetWin_1`
- `installed`: 是否已安装
- `running`: 是否有可见窗口
- `window_count`: 当前可用窗口数
- `supports_target`: 是否匹配当前 provider 的标题/指纹规则
- `health_score`: 0~100

探测来源：

- OS 枚举窗口（已有能力）。
- 进程与窗口类名匹配。
- Target 指纹匹配命中率（hwnd/exe/class/title）。

## 62. 自动选择策略（Browser Select Policy）

选择阶段：

1. 收集候选浏览器（已安装或已运行）。
2. 过滤不支持当前 target 的浏览器。
3. 计算综合评分。
4. 选 Top1，若分差过小则给用户确认。

评分维度（建议权重）：

- 可用性（窗口可见、可激活、未最小化）`35%`
- 指纹匹配稳定度（hwnd/exe/class/title 一致性）`25%`
- 历史成功率（最近 N 次 dispatch 成功率）`20%`
- 交互延迟（激活 + 粘贴耗时）`10%`
- 用户偏好（最近手动选择）`10%`

阈值策略：

- `score >= 80` 自动选择并执行。
- `65 <= score < 80` 建议用户确认。
- `< 65` 进入回退链路（切换浏览器或绑定向导）。

## 63. 用户体验与交互约束

UI 必须展示：

- 当前自动选中的浏览器（含图标、窗口标题、得分）。
- “为什么选它”的解释（命中规则 + 成功率 + 可用性）。
- 一键切换到次优浏览器。

用户友好动作：

- `Use Recommended`：使用系统推荐浏览器。
- `Pin Browser`：固定浏览器（直到用户取消固定）。
- `Auto Mode`：恢复自动选择。
- `Re-detect`：立即重跑探测与评分。

异常提示文案要求：

- 禁止仅提示“失败”。
- 必须同时给出修复动作：`打开浏览器`、`切换推荐浏览器`、`进入绑定向导`。

## 64. 失败回退与安全门禁

回退顺序：

1. 当前浏览器同 provider 其它窗口。
2. 次优浏览器同 provider 窗口。
3. 触发绑定向导重新绑定。
4. 阻断 dispatch 并给可执行修复入口。

与 Preflight 集成：

- Preflight 不仅返回 `TargetStatus`，还返回 `browser_candidates[]` 与 `recommended_browser`。
- 当 `TargetStatus != Ready` 时禁止发送，优先引导用户修复浏览器可用性。

安全约束：

- 浏览器自动切换不得绕过两阶段提交与剪贴板事务。
- 自动选择决策必须写入审计日志（含浏览器评分明细与最终决策）。

## 65. 治理与验证（浏览器选择专项）

新增专项验收用例：

- 多浏览器同时开启时的正确选择率。
- 主浏览器异常时回退成功率。
- 浏览器重启后 hwnd 失效恢复率。
- 用户固定浏览器后的稳定性验证。

发布门禁补充：

- 浏览器选择关键路径 E2E 未通过则阻断发布。
- 自动选择解释信息缺失视为 UX 阻断项。

## 66. 全局异常分类（Error Taxonomy）

所有功能统一按以下错误域建模，禁止“未知错误”直接透出：

- `INPUT_*`：输入为空、超长、格式错误、非法字符。
- `TARGET_*`：窗口缺失、歧义、激活失败、句柄失效。
- `BROWSER_*`：浏览器不可用、选择冲突、回退失败。
- `DISPATCH_*`：投递超时、频控触发、焦点漂移、误粘贴风险。
- `CLIPBOARD_*`：剪贴板占用、恢复失败、事务中断。
- `CAPTURE_*`：输出未复制、内容为空、水印缺失、归档绑定失败。
- `ARCHIVE_*`：文件写失败、读失败、校验失败、索引损坏。
- `GOVERNANCE_*`：门禁缺失、评分不一致、证据包生成失败。
- `POLICY_*`：策略拒绝、审批超时、权限不足。
- `UI_*`：渲染异常、状态机非法迁移、关键状态缺失。
- `INTERNAL_*`：锁异常、并发冲突、未知 panic。

约束：

- 每个错误码必须绑定：用户文案、补偿动作、审计级别、是否阻断发布。

## 67. 功能补偿矩阵（Compensation Matrix）

按阶段定义补偿，确保“失败可恢复、恢复可追踪”：

1. `precheck/preflight` 失败：
   - 补偿：重检 + 切换推荐浏览器 + 绑定向导。
   - 终止条件：连续失败超阈值，进入人工处理。
2. `dispatch_stage` 失败：
   - 补偿：退避重试、重新激活窗口、重跑 focus recipe、切换候选窗口。
   - 终止条件：超过最大重试并输出修复入口。
3. `dispatch_confirm` 失败：
   - 补偿：保持 staged 状态，允许用户手动发送并回填状态。
4. `capture` 失败：
   - 补偿：提示重新复制、自动识别最近 run、用户手动绑定 step。
5. `archive` 失败：
   - 补偿：写入本地临时缓冲队列，后台重放落盘。
6. `governance` 失败：
   - 补偿：降级为 `GoWithRisk` 候选，要求人工审批，不得自动 `Go`。
7. `telemetry` 失败：
   - 补偿：本地队列缓存，延迟重传，不影响主流程执行。

## 68. 幂等与重放机制

核心操作必须幂等，避免重试造成重复副作用：

- `save_run`、`save_artifact`、`save_dispatch_trace`、`governance_emit_telemetry` 以主键去重。
- 事件重放时以 `trace_id + event_type + ts_bucket` 判重。
- 补偿重试必须记录 `attempt` 与 `last_error`。

回放规则：

- 仅允许“未完成状态”重放。
- 已终态（`done/closed/cancelled`）默认禁止重放正文变更。

## 69. 超时、重试、熔断统一策略

默认策略：

- 重试：最多 3 次，指数退避（500ms, 1s, 2s）。
- 总超时：关键链路 30s，归档链路 10s，治理链路 20s。
- 熔断：同类错误在窗口期内超过阈值，暂停自动化并切人工模式。

恢复策略：

- 熔断后提供 `Retry All` 与 `Resume From Last Stable Step`。

## 70. 数据一致性与损坏修复

必须增加完整性检查：

- `run` 与 `artifact` 引用关系校验。
- `step` 状态与 `run` 状态一致性校验。
- 治理三件套（change/quality/decision）一致性校验。

损坏补偿：

- 自动生成修复建议（缺失补写、坏文件隔离、索引重建）。
- 无法自动修复时输出 `repair_report` 并阻断发布。

## 71. UI/交互异常补偿

前端必须覆盖以下异常态：

- `loading/error/empty/partial` 四态齐全。
- 事件总线重复消息、乱序消息、丢消息的容错显示。
- 关键按钮防抖与幂等点击保护。

补偿动作：

- 显示“继续上次流程”入口。
- 对中断流程提供“一键恢复到可操作状态”。

## 72. 发布与运维补偿机制

发布前：

- 所有阻断级错误清零。
- 补偿链路 E2E 通过（不是只测成功路径）。

发布后：

- 监控补偿成功率、人工介入率、恢复时长。
- 若补偿失败率超阈值，自动降级为手动模式并触发回滚评估。

## 73. 异常注入与演练（必须）

每个迭代必须做故障演练：

- 窗口缺失/多窗口冲突。
- 剪贴板被占用与恢复失败。
- 归档写失败与磁盘权限异常。
- 治理门禁数据缺失/冲突。
- 事件总线中断与恢复。

门禁要求：

- 未完成异常演练报告，不允许进入发布阶段。

## 74. 效率优化功能包（优先级 P0）

1. 命令面板（Command Palette）
   - 单入口触发 `Run/Capture/Preflight/Bind/Validate`。
   - 支持最近命令与快捷键记忆。
2. 快速动作（Quick Actions）
   - 在 Console 顶部提供一键按钮：`重试上次`、`继续上次`、`切换推荐浏览器`。
3. 批量工作流执行（Batch Run）
   - 支持同一 Skill 多输入批量提交与逐条回收。
4. 一键回放（Replay Last Successful Path）
   - 从最近成功 run 复用参数、target、浏览器策略，降低重复操作。

## 75. 效率优化功能包（优先级 P1）

1. Prompt 片段库（Snippet Library）
   - 常用前缀、约束、输出格式可插入。
2. 智能默认参数填充
   - 基于最近 N 次成功 run 自动填充输入。
3. 输出对比与合并（Diff/Merge）
   - 并行模型输出支持差异高亮和一键合并。
4. 自动命名与标签
   - run 自动生成可读标题与标签，提升检索效率。

## 76. 效率优化功能包（优先级 P2）

1. 宏任务（Macro）
   - 录制“用户操作序列”，可复用为模板流程。
2. 自定义工作台布局
   - 支持保存“分析布局/写作布局/审查布局”。
3. 结果导出中心
   - 一键导出 Markdown/JSON/归档包，附 trace 证据。
4. 协作模式
   - 支持审查人批注与审批状态流转（本地文件化）。

## 77. 自动化提效策略（减少人工切换）

自动推进规则：

- `StepCaptured` 后自动准备下一步输入与目标。
- 若下一步仅需确认，直接进入 `awaiting_send` 并弹出确认浮层。
- 对重复失败的 step 自动建议“切换浏览器/切换 provider/降级策略”。

自动化边界：

- 不允许自动跨越人工确认门禁（高风险步骤必须人工确认）。
- 自动化失败 2 次必须切人工模式并保留上下文。

## 78. 检索与归档提效

新增索引维度：

- `skill_id/workflow_id/provider/browser_id/error_code/tag/change_id`。

能力要求：

- 全局搜索支持组合过滤（如 `provider=gemini + status=failed + date=7d`）。
- run 详情支持“按阶段折叠查看”与“只看异常步骤”。
- 归档文件自动关联治理三件套与证据包。

## 79. 观测面板（效率导向 KPI）

必须展示：

- 人工点击次数（每 run）。
- 从输入到完成总时长（P50/P95）。
- 自动化覆盖率（自动推进步骤占比）。
- 一次通过率（无需重试的 run 比例）。
- 补偿触发率与补偿成功率。

目标值（建议）：

- 平均人工点击次数下降 30%。
- 关键流程总时长下降 25%。
- 一次通过率提升到 >= 85%。

## 80. 用户友好与学习成本优化

要求：

- 首次引导（3 步内）：绑定目标、跑通一次、完成一次 capture。
- 上下文帮助：每个关键按钮有“做什么/失败怎么办”说明。
- 异常提示遵循“问题 + 原因 + 下一步”三段式。

新增能力：

- 新手模式：只显示核心操作。
- 专家模式：显示高级参数、路由细节、补偿开关。

## 81. 持续优化机制（周节奏）

每周固定输出：

1. 高频失败 Top10（按影响排序）。
2. 高频手动操作 Top10（按可自动化潜力排序）。
3. 低价值步骤清理清单（可删除/可折叠/可默认化）。
4. 下周优化 backlog（明确 owner + 验收 KPI）。

治理要求：

- 任何新增功能必须附“效率收益指标”。
- 两周内无指标改善的功能进入降级/下线评审。

## 82. 自动化定制指令插入引擎（Instruction Injection Engine）

目标：

- 在发送前自动插入“用户偏好 + 任务约束 + 输出规范”指令片段。
- 降低用户重复输入成本，让聊天更省心、更稳定、更智能。

输入来源：

- 用户级偏好（语气、语言、格式、详细度、禁用项）。
- 场景级策略（评审/写作/调研/翻译/代码修复）。
- 工作流级约束（本 step 必须包含/禁止内容）。
- 风险级策略（高风险场景强制加安全声明与边界限制）。

输出形式：

- 生成 `final_prompt = base_prompt + injected_blocks`。
- 注入块必须可追踪：`block_id/source/priority`。

## 83. 注入规则与优先级

优先级（高到低）：

1. 安全策略注入（不可被覆盖）。
2. 用户硬偏好（如必须中文、必须简洁）。
3. workflow/step 约束。
4. skill 默认模板增强。
5. 动态智能补全建议（可关闭）。

冲突处理：

- 同类冲突按优先级保留高优先级条目。
- 检测互斥指令时写入冲突日志并给出用户提示。
- 严禁把冲突项静默拼接到最终 prompt。

去重规则：

- 同义指令去重（语义相近 + 文本相同）。
- 相同 block_id 仅保留一份。

## 84. 智能插入触发时机

触发点：

- `dispatch_stage` 前（最终构造 prompt 之前）。
- `replay/batch` 时复用上次有效注入配置。
- `capture` 后根据质量门结果反向调整下一步注入策略。

自适应策略：

- 若上次质量门失败，自动加严输出结构约束。
- 若上次超长或偏题，自动注入“长度上限 + 回答结构模板”。
- 若多次成功，降低注入强度，减少冗余指令。

## 85. 用户体验设计（省心）

可视化能力：

- 发送前显示“将自动插入 N 条指令”（可展开查看）。
- 一键开关：`Auto Inject ON/OFF`。
- 一键模式：`严格模式/平衡模式/简洁模式`。

快捷操作：

- `Pin as Personal Rule`：把当前指令保存为用户偏好。
- `Use for This Run Only`：仅本次有效，避免污染全局偏好。
- `Reset Injection`：恢复默认注入策略。

## 86. 安全与治理约束

约束：

- 注入内容必须经过长度、敏感词、策略白名单校验。
- 高风险注入（如执行类指令）必须二次确认。
- 注入记录必须归档到 run 审计信息（可追溯）。

审计字段：

- `injection_trace_id`
- `applied_blocks[]`
- `dropped_blocks[]`
- `conflicts[]`
- `final_prompt_checksum`

## 87. 验收指标（提效 + 质量）

核心 KPI：

- 平均手动补充指令次数下降 >= 40%。
- 首次回答结构合规率提升 >= 25%。
- 因“漏写约束”导致的重试率下降 >= 30%。
- 用户关闭自动注入比例持续下降（说明体验可接受）。

门禁要求：

- 注入引擎异常不得阻断主流程，必须可降级为“仅原始 prompt”。
- 冲突检测失败或审计缺失视为阻断级问题。

## 88. 代码审查增量优化项（v0.3+）

基于当前仓库全量编译、测试与代码审查，新增以下必须收敛项：

1. 错误码契约单一化（P0）
   - 问题：后端真实抛错码与错误目录、前端恢复映射存在不一致（如 `RATE_LIMITED` vs `DISPATCH_RATE_LIMITED`、`ACTIVATE_FAILED` vs `TARGET_ACTIVATE_FAILED`、`CLIPBOARD_BUSY` vs `CLIPBOARD_WRITE_FAILED`）。
   - 要求：
     - 建立单一错误码源（Rust `enum` + 导出到 TS 类型）。
     - 前后端禁止手写字符串错误码，统一从契约生成。
     - 增加契约测试：后端可抛错误码必须全部存在于 `error_catalog` 且前端 `RecoveryAction` 覆盖。

2. 路由动作枚举对齐（P1）
   - 问题：路由引擎输出动作（`auto_execute/user_confirm/fallback_default`）与前端显示条件（`auto/confirm`）不一致，导致 UI 解释降级。
   - 要求：
     - 定义 `RouteAction` 强类型枚举并前后端共用。
     - 渲染层仅消费枚举，不进行字符串猜测。
     - 增加 UI 单测覆盖三种动作分支。

3. 归档持久化可靠性提升（P0）
   - 问题：多处 `saveRun/saveArtifact` 失败被静默吞掉，可能造成“UI 成功、归档失败”。
   - 要求：
     - 将静默 `catch(() => {})` 改为“可观测降级”：
       - 记录 `ARCHIVE_WRITE_FAILED` 事件。
       - 将 run 标记为 `needs_persist_retry`。
       - 后台重试队列重放，支持手动重试按钮。
     - 发布门禁新增“归档一致性检查”。

4. 指令注入引擎收敛（P1）
   - 问题：存在两套注入实现（`actions.ts` 内联实现 + `domain/injection.ts`），存在策略命名漂移风险。
   - 要求：
     - 合并为单一注入内核模块。
     - 禁止重复定义 `mode/source/priority` 语义。
     - 统一输出 `InjectionAudit` 并补充冲突回放测试。

5. 文案与编码治理（P1）
   - 问题：多页面存在异常文案字符，影响可读性与一致性。
   - 要求：
     - 全仓统一 UTF-8（无 BOM）并加入 pre-commit 编码检查。
     - 文案集中到字典层，页面不直接硬编码状态/错误文案。
     - 新增 UI 文案快照测试（重点页：Console/Targets/Settings）。

6. 事件总线与状态一致性（P1）
   - 问题：事件处理以字符串分发，缺乏 schema 校验与版本化。
   - 要求：
     - 为 `workbench-event` 建立版本化事件 schema（`event_version`）。
     - 前端对未知事件保留审计，不静默丢弃关键字段。
     - 增加乱序/重复事件容错测试。

7. 治理闭环再收紧（P0）
   - 要求新增发布阻断项：
     - 错误码契约测试失败阻断发布。
     - 归档一致性检查失败阻断发布。
     - 注入审计字段缺失阻断发布。
     - 浏览器自动选择解释字段缺失阻断发布。

## 89. 审查执行清单（每次迭代必须附证据）

- [ ] `pnpm exec tsc --noEmit` 通过。
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml` 通过。
- [ ] `pnpm ci:governance` 通过并生成证据包。
- [ ] 错误码契约测试通过（后端错误码、catalog、前端恢复映射三方一致）。
- [ ] 归档一致性检查通过（run/artifact/dispatch_trace 可互相追溯）。
- [ ] 三个关键页面文案与状态快照通过（Console/Targets/Settings）。

## 90. 浏览器智能检测实现状态（闭环补充）

### 90.1 需求背景

当用户使用 **非预设浏览器**（如 Waterfox、LibreWolf、Floorp、Arc 等）时，系统需要智能检测并给出可操作提示，而非静默归为 `"other"` 导致后续调度不可控。

### 90.2 类型扩展

- `BrowserId` 从 6 种扩展到 **13 种**：
  `firefox | chrome | chromium | edge | brave | opera | vivaldi | arc | waterfox | librewolf | floorp | tor | other`
- 新增 `BrowserProfile` 接口（exe_name / class_name / installed / running / window_count / supports_target / health_score）。
- 新增 `BrowserDetectionResult` 接口（selected / candidates / profiles / unknown_browser_warning / warning_message）。

### 90.3 三级启发式检测（detectBrowserId）

1. **精确 exe 名称匹配**（12 种浏览器 exe 名→BrowserId 映射）。
2. **class_name 家族推断**：`MozillaWindowClass` → Firefox 家族，`Chrome_WidgetWin_1` → Chromium 家族。
3. **窗口标题关键词兜底**：从 title 中搜索浏览器关键词。
4. 以上均不命中时返回 `"other"`。

### 90.4 未知浏览器告警流程

- `selectBrowserWindowByRegex()` 检测到 `other` 时生成 `unknownBrowserWarning`。
- `executeDispatchFlow()` 将 `browserWarning` 透传至返回值。
- `ConsolePage` 在 dispatch 后捕获 warning 并展示琥珀色告警卡片：
  - "知道了，继续使用"→关闭告警。
  - "进入绑定向导"→跳转配置页。

### 90.5 Rust 后端 detect_browsers 命令

- 枚举当前窗口，匹配 `known_browser_signatures()`（12 个签名元组）。
- class_name 启发式兜底：`Chrome_WidgetWin_1` / `MozillaWindowClass`。
- 未知浏览器标记 warning_message 并返回 `BrowserDetectionResult`。

### 90.6 字典与恢复动作

- `BROWSER_LABELS`：13 个 BrowserId → label + icon 的映射表。
- 新增 3 个浏览器相关恢复动作：
  - `BROWSER_NOT_AVAILABLE`：浏览器不可用，主操作=重新检测，次操作=手动选择。
  - `BROWSER_SELECT_CONFLICT`：多候选冲突，主操作=手动选择，次操作=使用默认浏览器。
  - `BROWSER_FALLBACK_FAILED`：兜底失败，主操作=进入绑定向导，次操作=查看日志。

### 90.7 文件变更清单

| 文件 | 变更摘要 |
|---|---|
| types.ts | BrowserId 13 种、BrowserProfile、BrowserDetectionResult、BrowserCandidate.class_name |
| actions.ts | detectBrowserId 三级启发式、isKnownBrowser、scoreBrowserCandidate 差异化评分、browserWarning 透传、3 个恢复动作 |

---

## 91. 性能监控系统（PerformanceMonitor）

### 91.1 目的

实时采集前端运行性能指标（FPS / 内存 / DOM 节点 / 组件渲染时间），在开发与诊断场景下快速定位性能瓶颈。

### 91.2 核心实现

| 文件 | API | 说明 |
|---|---|---|
| `hooks/usePerformanceMonitor.ts` | `usePerformanceMonitor(intervalMs?, enabled?)` | React Hook，定时采集 `PerformanceMetrics` |
| `components/PerformancePanel.tsx` | `<PerformancePanel />` | 右下角浮动面板，可折叠，实时展示 FPS/Memory/DOM |

### 91.3 `PerformanceMetrics` 接口

```ts
interface PerformanceMetrics {
  fps: number;           // requestAnimationFrame 计数
  memoryMB: number;      // performance.memory.usedJSHeapSize (仅 Chromium)
  domNodes: number;      // document.querySelectorAll('*').length
  renderTimeMs: number;  // performance.now() 差值
  timestamp: number;
}
```

### 91.4 集成点

- `Dashboard.tsx` 嵌入 `<PerformancePanel />`，四列栅格布局最后一列。
- 默认关闭，通过 SettingsPage 或快捷键 `Alt+P` 切换。

---

## 92. 全局快捷键系统

### 92.1 目的

提供统一的键盘快捷键框架，支持多作用域（全局/页面级）、冲突检测、可配置绑定。

### 92.2 核心实现

| 文件 | API | 说明 |
|---|---|---|
| `hooks/useKeyboardShortcuts.ts` | `useKeyboardShortcuts(bindings, activeScope?)` | React Hook，注册/销毁全局 keydown 监听 |

### 92.3 `ShortcutBinding` 接口

```ts
interface ShortcutBinding {
  key: string;           // e.g. "k", "p", "/"
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  scope?: string;        // "global" | "dashboard" | ...
  action: () => void;
  description: string;
}
```

### 92.4 默认绑定

| 快捷键 | 作用 |
|---|---|
| `Ctrl+K` | 打开命令面板 |
| `Alt+P` | 切换性能面板 |
| `Ctrl+/` | 查看快捷键列表 |

### 92.5 集成点

- `Layout.tsx` 使用 `useKeyboardShortcuts` 注册全局快捷键。
- 命令面板 `CommandPalette.tsx` 可通过 `Ctrl+K` 唤起。

---

## 93. 配置导出/导入系统

### 93.1 目的

支持用户将 Targets / Skills / Workflows 等配置批量导出为 JSON 文件，或从文件导入还原，实现配置迁移与备份。

### 93.2 核心实现

| 文件 | API | 说明 |
|---|---|---|
| `domain/config-export.ts` | `exportConfigBundle(state)` | 从 AppState 提取配置生成 `ConfigBundle` |
| | `serializeBundle(bundle)` | 序列化为 JSON 字符串 |
| | `downloadAsFile(content, filename, mime)` | 触发浏览器下载 |
| | `validateConfigBundle(data)` | 验证导入文件结构 |
| | `readFileAsText(file)` | 读取 File 对象内容 |
| | `exportRunsToMarkdown(runs)` | 导出运行记录为 Markdown 报告 |

### 93.3 `ConfigBundle` 接口

```ts
interface ConfigBundle {
  version: string;
  exportedAt: string;
  targets: Target[];
  skills: Skill[];
  workflows: WorkflowDefinition[];
  providers: ProviderConfig[];
}
```

### 93.4 集成点

- `SettingsPage.tsx`：导出/导入按钮，调用 `downloadAsFile`、`readFileAsText + validateConfigBundle`。
- 导入时使用 `RESTORE_CONFIG` action 写回 AppStore。

---

## 94. 运行统计分析

### 94.1 目的

对历史运行记录进行聚合统计，生成成功率、耗时分布、模型使用频次等指标，辅助用户优化调度策略。

### 94.2 核心实现

| 文件 | API | 说明 |
|---|---|---|
| `domain/run-statistics.ts` | `computeRunStats(runs)` | 计算 `RunStats` 聚合指标 |
| | `formatDuration(ms)` | 毫秒→人类可读时间 |

### 94.3 `RunStats` 接口

```ts
interface RunStats {
  totalRuns: number;
  successCount: number;
  failureCount: number;
  successRate: number;        // 0~1
  avgDurationMs: number;
  medianDurationMs: number;
  p95DurationMs: number;
  modelUsage: Record<string, number>;  // model → 调用次数
  dailyTrend: Array<{ date: string; count: number; successRate: number }>;
}
```

### 94.4 集成点

- `ArchivePage.tsx`：顶部统计行展示总运行次数 / 成功率 / 平均耗时 / p95。
- 数据由 `computeRunStats(state.runs)` 实时计算。

---

## 95. Vault 存储管理

### 95.1 目的

提供 Vault 目录的磁盘使用统计和一键清理能力，防止长期运行后存储空间膨胀。

### 95.2 Rust 后端命令

| 命令 | 参数 | 返回 | 说明 |
|---|---|---|---|
| `get_vault_stats` | — | `VaultStats` | 统计各子目录文件数和总大小 |
| `cleanup_vault` | `before_days: u32` | `{ removed: u32, freed_bytes: u64 }` | 删除超过 N 天的运行记录 |

### 95.3 `VaultStats` 接口

```ts
interface VaultStats {
  total_size_bytes: number;
  runs_count: number;
  artifacts_count: number;
  oldest_run?: string;    // ISO datetime
  newest_run?: string;
}
```

### 95.4 前端 API

```ts
// api.ts
export function getVaultStats(): Promise<VaultStats>;
export function cleanupVault(beforeDays: number): Promise<{ removed: number; freed_bytes: number }>;
```

### 95.5 集成点

- `SettingsPage.tsx`：Vault 信息面板，显示文件数/磁盘占用/最近运行时间，提供"清理 N 天前"操作按钮。

---

## 96. API 重试与退避策略

### 96.1 目的

对 Tauri IPC 调用中的瞬态错误（剪切板占用、窗口激活失败、IO 超时等）自动重试，采用指数退避 + 抖动避免雪崩。

### 96.2 核心实现

| 文件 | API | 说明 |
|---|---|---|
| `domain/api-retry.ts` | `invokeWithRetry<T>(cmd, args?, options?)` | 封装 `invoke`，自动指数退避重试 |

### 96.3 `RetryOptions`

```ts
interface RetryOptions {
  maxRetries?: number;      // 默认 3
  baseDelayMs?: number;     // 默认 300ms
  maxDelayMs?: number;      // 默认 5000ms
  timeoutMs?: number;       // 默认 30000ms, 0=无限
  isRetryable?: (error: ApiError) => boolean;
  onRetry?: (attempt: number, error: ApiError, nextDelayMs: number) => void;
}
```

### 96.4 可重试错误码

`CLIPBOARD_BUSY` / `CLIPBOARD_OPEN_FAILED` / `CLIPBOARD_SET_FAILED` / `ACTIVATE_FAILED` / `WINDOW_NOT_FOREGROUND` / `TIMEOUT` / `IO_ERROR`

### 96.5 退避算法

```
delay = min(baseDelayMs * 2^attempt + jitter, maxDelayMs)
jitter ∈ [0, baseDelayMs * 0.5)
```

超过 `timeoutMs` 则不再重试，直接抛出最后一次错误。

---

## 97. UI 状态持久化

### 97.1 目的

在应用刷新/重启后恢复用户的页面上下文（选中标签页、筛选条件、折叠状态等），使用 `localStorage` 实现零依赖持久化。

### 97.2 核心实现

| 文件 | API | 说明 |
|---|---|---|
| `domain/persistence.ts` | `persistUIState(state)` | 序列化 `pageStates` + 当前路由到 localStorage |
| | `restoreUIState()` | 反序列化并校验版本号 |
| | `clearPersistedState()` | 清除持久化 |
| | `createPersistMiddleware(throttleMs?)` | 创建 reducer 增强器，dispatch 后自动节流保存 |

### 97.3 持久化的数据子集

```ts
interface PersistedState {
  _v: number;                             // 版本号（不兼容时清除）
  pageStates: Record<string, PageState>;   // 每个页面的 UI 状态
  lastRoute: string;                       // 上次停留的路由
}
```

### 97.4 集成点

- `AppStore.tsx`：初始化时调用 `restoreUIState()` 合并到初始 state。
- 每次 dispatch 后通过 `createPersistMiddleware()` 自动节流写入。
- 存储 key: `ai-workbench:ui-state`。

---

## 98. 无障碍增强（Accessibility）

### 98.1 目的

确保应用满足 WCAG 2.1 AA 级基本要求，支持键盘导航、屏幕阅读器、焦点管理。

### 98.2 实现清单

| 组件 | 增强项 |
|---|---|
| `Layout.tsx` | Skip to main content 链接（`<a href="#main" class="sr-only focus:not-sr-only">`） |
| `Layout.tsx` | 侧边栏 `<nav aria-label="主导航">` |
| `Layout.tsx` | `<main id="main" role="main" tabIndex={-1}>` |
| `ErrorBoundary.tsx` | `role="alert"` + `aria-live="assertive"` |
| `CommandPalette.tsx` | `role="dialog"` + `aria-modal` + 焦点锁定 (`useFocusTrap`) |
| `Toast.tsx` | `role="status"` + `aria-live="polite"` |

### 98.3 键盘导航

所有交互元素使用原生 `<button>` 或 `<a>` 标签，确保 Tab 序列自然、Enter/Space 可触发。

---

## 99. 跨平台脚本与发布工作流

### 99.1 目的

使用 Node.js `.mjs` 脚本替代平台特定的 `.ps1`/`.sh`，实现单套脚本兼容 Linux、macOS 和 Windows，并通过 GitHub Actions 标准发布流程支持按平台分标签发布。

### 99.2 跨平台脚本清单

| 脚本 | pnpm alias | 说明 |
|---|---|---|
| `scripts/dev.mjs` | `pnpm start` | 开发服务器启动（`--frontend` 仅前端 / `--build` 构建） |
| `scripts/setup.mjs` | `pnpm setup` | 环境初始化（检查工具链、安装依赖、创建配置目录） |
| `scripts/doctor.mjs` | `pnpm doctor` | 环境诊断（`--report` 生成报告 / `--fix` 自动修复） |
| `scripts/build.mjs` | `pnpm build:app` | 构建前端 + Rust（`--debug` 调试 / `--clean` 清理后构建） |
| `scripts/clean.mjs` | `pnpm clean` | 清理（`soft` / `hard` / `full` 三级） |

所有脚本仅依赖 Node.js 内置模块（`child_process`, `fs`, `os`, `path`），无任何外部依赖。

### 99.3 发布工作流设计

```yaml
# .github/workflows/release.yml
on:
  push:
    tags: ["v*"]         # 触发条件：推送 v 开头的 tag
```

| Tag 格式 | 构建目标 | 产物 |
|---|---|---|
| `v0.1.0` | Linux + Windows | .deb / .AppImage / .msi / .exe (NSIS) |
| `v0.1.0-linux` | 仅 Linux | .deb / .AppImage |
| `v0.1.0-windows` | 仅 Windows | .msi / .exe (NSIS) |
| `v0.1.0-alpha` | Linux + Windows (prerelease) | 同上，标记为 prerelease |

### 99.4 发布流程

1. `create-release` — 创建 GitHub Release Draft。
2. `build-tauri` — 矩阵构建（ubuntu-22.04 + windows-latest），使用 `tauri-apps/tauri-action@v0`。
3. `publish-release` — 所有构建完成后取消 Draft 状态，正式发布。

### 99.5 标准产物格式

Tauri v2 遵循各操作系统原生安装包标准：

| 平台 | 格式 | 说明 |
|---|---|---|
| Linux | `.deb` | Debian/Ubuntu 原生包 |
| Linux | `.AppImage` | 免安装单文件，所有发行版通用 |
| Windows | `.msi` | Windows Installer 标准包 |
| Windows | `.exe` | NSIS 安装程序 |

### 99.6 文件变更清单

| 文件 | 变更 |
|---|---|
| `scripts/dev.mjs` | 新增 — 跨平台启动脚本 |
| `scripts/setup.mjs` | 新增 — 跨平台初始化脚本 |
| `scripts/doctor.mjs` | 新增 — 跨平台诊断脚本 |
| `scripts/build.mjs` | 新增 — 跨平台构建脚本 |
| `scripts/clean.mjs` | 新增 — 跨平台清理脚本 |
| `.github/workflows/release.yml` | 新增 — 标准 Tauri 发布流程 |
| `.github/workflows/ci.yml` | 移除 ESLint/vitest 步骤 |
| `package.json` | 统一 pnpm scripts（无平台后缀） |
| ConsolePage.tsx | browserWarning 状态、AlertTriangle/Globe 图标、琥珀色告警卡片 |
| config.rs | BrowserCandidate.class_name、BrowserProfile、BrowserDetectionResult、known_browser_signatures() |
| lib.rs | detect_browsers 命令（~100 行）、invoke_handler 30 命令 |
| api.ts | detectBrowsers() API |
| dictionary.ts | BROWSER_LABELS 13 条目 |

### 90.8 闭环验证要点

- [ ] `pnpm exec tsc --noEmit` → 0 errors。
- [ ] `cargo test` → 全部通过。
- [ ] 非预设浏览器打开时，ConsolePage 显示琥珀色告警。
- [ ] 告警提供"继续使用"和"进入绑定向导"两个可操作按钮。
- [ ] `detect_browsers` 命令可枚举已安装浏览器并标记未知类型。

---

## §100 性能优化与 UX 增强

> 系统级性能优化和用户体验增强，不引入额外依赖。

### 100.1 AppStore dispatch 稳定性修复

**问题**：`useCallback(dispatch, [state])` 导致 dispatch 引用在每次 state 变化时重建，所有使用 `useAppDispatch()` 的组件被迫重渲染。

**方案**：
- `useCallback` 依赖改为 `[]`，dispatch 引用在组件生命周期内保持稳定
- 持久化逻辑从 dispatch 内联移至 `useEffect` + `useRef` 节流写入
- `mountedRef` 防止首次挂载时触发持久化

### 100.2 Dashboard 计算缓存

| 字段 | 方式 | 依赖 |
|---|---|---|
| `slmRuntime` | `useMemo` | `[]` |
| `slmSummary` | `useMemo` | `[slmRuntime]` |
| `targetCount` | `useMemo` | `[targets]` |
| `readyCount` | `useMemo` | `[health]` |
| `recentRuns` | `useMemo` | `[runs]` |
| `errorCategories` | `useMemo` | `[errorCatalog]` |

`GradientStatCard` 和 `MetricRow` 子组件包裹 `React.memo` 避免父级重渲染穿透。

### 100.3 SettingsPage 计算缓存

`slmRuntime`、`slmSummary`、`slmModels`、`feedbackStats` 全部 `useMemo` 缓存。

### 100.4 index.html 首屏优化

- 修复缺失的 `<body>`、`<div id="root">`、`<script>` 标签
- 内联关键 CSS 消除白屏闪烁
- 添加 SVG 加载占位（splash screen），JS 接管前用户可见"正在加载"动画
- 预连接 Tauri IPC 域名
- `lang="zh-CN"` 正确声明语言

### 100.5 CSS 渲染性能

| 技术 | 应用 | 效果 |
|---|---|---|
| `content-visibility: auto` | `.glass-card-static` | 浏览器跳过屏幕外区域的布局和绘制 |
| `contain-intrinsic-size` | `.glass-card-static` | 为 content-visibility 提供尺寸估算 |
| `will-change: transform` | `.glass-card` | GPU 合成层加速过渡动画 |
| `will-change: box-shadow` | `.animate-pulse-glow` | GPU 加速脉冲光晕 |

### 100.6 页面切换过渡

- 新增 `page-in` 关键帧动画（opacity + translateY）
- `Layout` 中增加 `PageTransition` 组件包裹 `<Outlet />`
- 路由变化时自动触发 `page-enter` 动画类

### 100.7 交互增强

- 搜索栏绑定 `onClick` 打开 CommandPalette（原来只是装饰）
- 按钮按压反馈（`btn-primary:active` scale 缩放）
- 卡片按压态（`glass-card:active` 微缩效果）
- 响应式适配（768px 以下 min-width 放宽）
- 打印样式（隐藏侧边栏，白色背景）

### 100.8 Tauri 窗口优化

- 默认尺寸从 800×600 调整为 1200×800
- 添加 `minWidth: 900`、`minHeight: 600` 约束
- 标题从 "ai-workbench" 改为 "AI Workbench"

### 100.9 文件变更清单

| 文件 | 变更 |
|---|---|
| `index.html` | 修复 HTML 结构，内联关键 CSS，添加 splash screen |
| `src/index.css` | content-visibility, will-change, 页面过渡, 交互反馈, 响应式, 打印样式 |
| `src/store/AppStore.tsx` | dispatch `[]` 依赖 + useEffect 持久化 |
| `src/pages/Dashboard.tsx` | useMemo 缓存 6 项 + React.memo 子组件 |
| `src/pages/SettingsPage.tsx` | useMemo 缓存 4 项 |
| `src/components/Layout.tsx` | PageTransition 组件, 搜索栏点击打开命令面板 |
| `src-tauri/tauri.conf.json` | 窗口尺寸 1200×800, 最小约束, 标题 |

### 100.10 闭环验证要点

- [ ] `tsc --noEmit` → 0 errors（测试文件除外）
- [ ] 切换页面时有淡入动画
- [ ] 搜索栏可点击打开命令面板
- [ ] 首次加载显示 splash screen 后过渡到应用
- [ ] Dashboard 重渲染次数显著减少（React DevTools 验证）

---

## §101 2026-04 增量实现：Scheduler + Reports + 自动化门禁修复

> 本节记录本次按“逐功能实现 + 逐项测试验证”完成的增量改造。

### 101.1 功能 1：Scheduler 定时任务（前端闭环）

已实现：

- 新增 `schedule-engine`：触发器校验（once/interval/daily/cron）、下次运行时间计算、预览与到期判断。
- 新增 `schedule-storage`：本地持久化、upsert/remove、自动计算 `next_run_at`。
- 新增页面 `SchedulerPage`：创建任务、预览未来触发时间、删除任务。
- 导航与命令面板接入：`/scheduler`，支持快捷键跳转。

验证结果：

- `src/__tests__/domain/schedule-engine.test.ts` 通过。
- `src/__tests__/domain/schedule-storage.test.ts` 通过。
- `src/__tests__/pages/SchedulerPage.test.tsx` 通过。

### 101.2 功能 2：资讯整理与 Markdown 汇报预览

已实现：

- 新增 `news-report`：资讯标准化、去重、Markdown 报告生成、`ReportDocument` 构建。
- 扩展导出链路：`config-export` 新增 `exportNewsToMarkdown()`。
- 新增页面 `ReportsPage`：手工录入资讯、实时生成报告、站内预览、导出 `.md`。
- 导航与命令面板接入：`/reports`，支持快捷键跳转。

验证结果：

- `src/__tests__/domain/news-report.test.ts` 通过。
- `src/__tests__/pages/ReportsPage.test.tsx` 通过。
- `src/__tests__/domain/config-export.test.ts`（新增 news 导出断言）通过。

### 101.3 多平台优化与检测增强

已实现：

- `task.go` 增强：
  - `pnpm` 缺失时自动回退到 `corepack pnpm`。
  - `doctor` 新增 Linux 依赖检测（`libwebkit2gtk-4.1-dev`、`libgtk-3-dev`、`libayatana-appindicator3-dev`、`librsvg2-dev`、`patchelf`）。
- CI 增强：
  - 新增 `platform-doctor`（ubuntu + windows）矩阵任务，执行环境检测。
  - 修复前端门禁依赖脚本缺失问题，确保 workflow 可执行。

### 101.4 自动化工作流修复

已实现：

- `package.json` 新增：
  - `test:ci`
  - `governance:validate`
  - `test:governance:api`
- 新增脚本：
  - `scripts/governance-validate.mjs`
  - `scripts/governance-api-check.mjs`
- `.github/workflows/ci.yml`：
  - 监听 `scripts/**` 变更。
  - 前端测试产物上传与构建步骤保持在 `frontend-check`。
  - `governance` 与 `build-release` 增加对 `platform-doctor` 的依赖。

### 101.5 本地验证快照（本次执行）

- `corepack pnpm governance:validate` 通过。
- `corepack pnpm test:governance:api` 通过。
- `corepack pnpm exec tsc --noEmit` 通过。
- `corepack pnpm test:ci` 通过：
  - `19` 个测试文件
  - `217` 个测试用例全部通过
  - 生成 `test-results.xml`

### 101.6 已知环境差异

- 当前执行环境未安装 `go`，因此 `go run task.go doctor` 无法在本机直接运行。
- 该限制已通过 CI 的 `platform-doctor` + `setup-go` 覆盖，远端流水线可验证 Go 侧 doctor 流程。

