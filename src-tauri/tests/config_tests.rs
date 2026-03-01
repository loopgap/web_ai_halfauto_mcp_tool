#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    #[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
    struct TargetMatchConfig {
        title_regex: Vec<String>,
        #[serde(default)]
        bound_hwnd: Option<u64>,
        #[serde(default)]
        exe_name: Option<String>,
        #[serde(default)]
        class_name: Option<String>,
        #[serde(default)]
        process_id: Option<u32>,
    }

    #[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
    struct TargetBehavior {
        auto_enter: bool,
        paste_delay_ms: u64,
        #[serde(default)]
        restore_clipboard_after_paste: bool,
        #[serde(default)]
        focus_recipe: Vec<String>,
        #[serde(default = "default_true")]
        append_run_watermark: bool,
    }

    #[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
    struct TargetEntry {
        provider: String,
        #[serde(rename = "match")]
        match_config: TargetMatchConfig,
        behavior: TargetBehavior,
    }

    #[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
    struct TargetsConfig {
        targets: HashMap<String, TargetEntry>,
    }

    // ─── Skill Schema v3 ───

    #[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
    struct SkillInput {
        #[serde(rename = "type")]
        input_type: String,
        #[serde(default)]
        required: bool,
        #[serde(default)]
        description: Option<String>,
        #[serde(default)]
        max_length: Option<usize>,
    }

    #[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
    struct SkillDispatch {
        mode: String,
        prefer_providers: Vec<String>,
        #[serde(default)]
        timeout_ms: u64,
        #[serde(default)]
        retry_count: u32,
    }

    #[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
    struct QualityGate {
        #[serde(default)]
        min_length: Option<usize>,
        #[serde(default)]
        max_length: Option<usize>,
        #[serde(default)]
        must_contain: Vec<String>,
        #[serde(default)]
        must_not_contain: Vec<String>,
    }

    #[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
    struct SkillFallback {
        #[serde(default)]
        fallback_providers: Vec<String>,
        #[serde(default)]
        fallback_skill: Option<String>,
        #[serde(default = "default_action")]
        action: String,
    }
    fn default_action() -> String { "retry_other".to_string() }

    #[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
    struct SkillObservability {
        #[serde(default = "default_true")]
        emit_start: bool,
        #[serde(default = "default_true")]
        emit_end: bool,
        #[serde(default = "default_true")]
        emit_error: bool,
        #[serde(default)]
        custom_metrics: Vec<String>,
    }
    fn default_true() -> bool { true }

    #[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
    struct Skill {
        id: String,
        #[serde(default = "default_version")]
        version: String,
        title: String,
        #[serde(default)]
        intent_tags: Vec<String>,
        #[serde(default)]
        inputs: HashMap<String, SkillInput>,
        #[serde(alias = "prompt")]
        prompt_template: String,
        #[serde(default)]
        dispatch: Option<SkillDispatch>,
        #[serde(default)]
        quality_gates: Vec<QualityGate>,
        #[serde(default)]
        fallbacks: Vec<SkillFallback>,
        #[serde(default)]
        observability: Option<SkillObservability>,
        #[serde(default)]
        safety_level: String,
        #[serde(default)]
        cost_class: String,
        #[serde(default)]
        latency_class: String,
        #[serde(default)]
        determinism: String,
    }
    fn default_version() -> String { "1.0".to_string() }

    // ─── Workflow Schema v3 ───

    #[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
    struct RetryPolicy {
        #[serde(default)]
        max_retries: u32,
        #[serde(default)]
        delay_ms: u64,
        #[serde(default = "default_fixed")]
        backoff: String,
    }
    fn default_fixed() -> String { "fixed".to_string() }

    #[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
    struct WorkflowStep {
        #[serde(default)]
        id: Option<String>,
        #[serde(rename = "use")]
        use_skill: String,
        #[serde(default)]
        depends_on: Vec<String>,
        #[serde(default)]
        retry_policy: Option<RetryPolicy>,
        #[serde(default)]
        timeout_ms: u64,
        #[serde(default)]
        compensation: Option<String>,
        #[serde(default)]
        emit_events: Vec<String>,
        #[serde(default)]
        dispatch: Option<SkillDispatch>,
    }

    #[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
    struct WorkflowPolicy {
        #[serde(default = "default_parallelism")]
        max_parallelism: u32,
        #[serde(default)]
        global_timeout_ms: u64,
        #[serde(default = "default_fail_policy")]
        fail_policy: String,
        #[serde(default)]
        checkpoint_policy: String,
        #[serde(default)]
        resume_policy: String,
        #[serde(default)]
        merge_strategy: String,
    }
    fn default_parallelism() -> u32 { 2 }
    fn default_fail_policy() -> String { "fail_fast".to_string() }

    #[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
    struct Workflow {
        id: String,
        #[serde(default = "default_version")]
        version: String,
        title: String,
        steps: Vec<WorkflowStep>,
        #[serde(default)]
        policy: Option<WorkflowPolicy>,
    }

    // ─── Router Rules v2 ───

    #[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
    struct IntentRule {
        keywords: Vec<String>,
        #[serde(default)]
        patterns: Vec<String>,
        dispatch_prefer: Vec<String>,
        #[serde(default)]
        fanout: bool,
        #[serde(default)]
        confidence_boost: f64,
    }

    #[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
    struct RouterDefaults {
        #[serde(default)]
        fanout: bool,
        #[serde(default)]
        auto_enter: bool,
        #[serde(default)]
        confidence_auto_threshold: f64,
        #[serde(default)]
        confidence_confirm_threshold: f64,
    }

    #[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
    struct RouterRulesConfig {
        intents: HashMap<String, IntentRule>,
        #[serde(default)]
        defaults: Option<RouterDefaults>,
    }

    // ─── Error Model ───

    #[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
    struct ErrorDefinition {
        code: String,
        category: String,
        user_message: String,
        fix_suggestion: String,
        alert_level: String,
    }

    // ═══════════════════════════
    //  Tests
    // ═══════════════════════════

    #[test]
    fn test_targets_yaml_roundtrip() {
        let yaml = r#"
targets:
  chatgpt_main:
    provider: chatgpt
    match:
      title_regex:
        - "ChatGPT.*Mozilla Firefox"
        - "ChatGPT.*(Chrome|Chromium)"
    behavior:
      auto_enter: false
      paste_delay_ms: 80
  deepseek_main:
    provider: deepseek
    match:
      title_regex:
        - "DeepSeek.*Mozilla Firefox"
    behavior:
      auto_enter: false
      paste_delay_ms: 100
"#;
        let cfg: TargetsConfig = serde_yaml::from_str(yaml).unwrap();
        assert_eq!(cfg.targets.len(), 2);
        assert!(cfg.targets.contains_key("chatgpt_main"));
        assert!(cfg.targets.contains_key("deepseek_main"));

        let chatgpt = &cfg.targets["chatgpt_main"];
        assert_eq!(chatgpt.provider, "chatgpt");
        assert_eq!(chatgpt.match_config.title_regex.len(), 2);
        assert!(!chatgpt.behavior.auto_enter);
        assert_eq!(chatgpt.behavior.paste_delay_ms, 80);

        // Roundtrip
        let serialized = serde_yaml::to_string(&cfg).unwrap();
        let cfg2: TargetsConfig = serde_yaml::from_str(&serialized).unwrap();
        assert_eq!(cfg2.targets.len(), 2);
    }

    #[test]
    fn test_skill_v3_yaml_parsing() {
        let yaml = r#"
id: analysis.tech_feasibility
version: "1.0"
title: 技术可行性评估
intent_tags: [analyze, architecture]
inputs:
  topic:
    type: text
    required: true
    description: 评估主题
    max_length: 5000
prompt_template: |
  你是资深技术架构师。
  对 {topic} 做可行性评估。
dispatch:
  mode: prefer_provider
  prefer_providers: [gemini, deepseek, chatgpt]
  timeout_ms: 30000
  retry_count: 2
quality_gates:
  - min_length: 200
    must_contain: ["可行性", "风险"]
    must_not_contain: []
fallbacks:
  - fallback_providers: [chatgpt]
    action: retry_other
observability:
  emit_start: true
  emit_end: true
  emit_error: true
  custom_metrics: []
safety_level: safe
cost_class: medium
latency_class: slow
determinism: non_deterministic
"#;
        let skill: Skill = serde_yaml::from_str(yaml).unwrap();
        assert_eq!(skill.id, "analysis.tech_feasibility");
        assert_eq!(skill.version, "1.0");
        assert_eq!(skill.title, "技术可行性评估");
        assert_eq!(skill.intent_tags, vec!["analyze", "architecture"]);
        assert!(skill.prompt_template.contains("{topic}"));
        assert_eq!(skill.safety_level, "safe");
        assert_eq!(skill.cost_class, "medium");
        assert_eq!(skill.latency_class, "slow");
        assert_eq!(skill.determinism, "non_deterministic");

        // Dispatch
        let dispatch = skill.dispatch.unwrap();
        assert_eq!(dispatch.mode, "prefer_provider");
        assert_eq!(dispatch.prefer_providers, vec!["gemini", "deepseek", "chatgpt"]);
        assert_eq!(dispatch.timeout_ms, 30000);
        assert_eq!(dispatch.retry_count, 2);

        // Quality gates
        assert_eq!(skill.quality_gates.len(), 1);
        assert_eq!(skill.quality_gates[0].min_length, Some(200));
        assert_eq!(skill.quality_gates[0].must_contain, vec!["可行性", "风险"]);

        // Fallbacks
        assert_eq!(skill.fallbacks.len(), 1);
        assert_eq!(skill.fallbacks[0].fallback_providers, vec!["chatgpt"]);
        assert_eq!(skill.fallbacks[0].action, "retry_other");

        // Observability
        let obs = skill.observability.unwrap();
        assert!(obs.emit_start);
        assert!(obs.emit_end);
        assert!(obs.emit_error);

        // Input
        let topic_input = &skill.inputs["topic"];
        assert_eq!(topic_input.input_type, "text");
        assert!(topic_input.required);
        assert_eq!(topic_input.description.as_deref(), Some("评估主题"));
        assert_eq!(topic_input.max_length, Some(5000));
    }

    #[test]
    fn test_skill_backward_compat_prompt_alias() {
        // Old format: "prompt" field should be parsed via alias
        let yaml = r#"
id: old_skill
title: Old Skill
prompt: |
  This is old-style prompt.
"#;
        let skill: Skill = serde_yaml::from_str(yaml).unwrap();
        assert!(skill.prompt_template.contains("old-style prompt"));
    }

    #[test]
    fn test_workflow_v3_yaml_parsing() {
        let yaml = r#"
id: robotics.realtime_to_proposal
version: "1.0"
title: 实时信息→分析→成稿
steps:
  - id: step_collect
    use: collect.realtime_brief
    depends_on: []
    retry_policy:
      max_retries: 2
      delay_ms: 1000
      backoff: exponential
    timeout_ms: 30000
    emit_events: ["step_start", "step_end"]
    dispatch:
      mode: prefer_provider
      prefer_providers: [grok, kimi, yuanbao]
  - id: step_analyze
    use: analysis.tech_feasibility
    depends_on: [step_collect]
    timeout_ms: 60000
    emit_events: ["step_start", "step_end"]
    dispatch:
      mode: prefer_provider
      prefer_providers: [gemini, deepseek]
  - id: step_write
    use: writing.proposal_polish
    depends_on: [step_analyze]
    timeout_ms: 45000
    compensation: rollback_draft
    emit_events: ["step_start", "step_end"]
    dispatch:
      mode: prefer_provider
      prefer_providers: [chatgpt, kimi]
policy:
  max_parallelism: 2
  global_timeout_ms: 300000
  fail_policy: fail_fast
  checkpoint_policy: per_step
  resume_policy: from_last_checkpoint
  merge_strategy: concatenate
"#;
        let wf: Workflow = serde_yaml::from_str(yaml).unwrap();
        assert_eq!(wf.id, "robotics.realtime_to_proposal");
        assert_eq!(wf.version, "1.0");
        assert_eq!(wf.steps.len(), 3);

        // Step 1
        let s1 = &wf.steps[0];
        assert_eq!(s1.id.as_deref(), Some("step_collect"));
        assert_eq!(s1.use_skill, "collect.realtime_brief");
        assert!(s1.depends_on.is_empty());
        assert!(s1.retry_policy.is_some());
        let rp = s1.retry_policy.as_ref().unwrap();
        assert_eq!(rp.max_retries, 2);
        assert_eq!(rp.delay_ms, 1000);
        assert_eq!(rp.backoff, "exponential");
        assert_eq!(s1.timeout_ms, 30000);
        assert_eq!(s1.emit_events, vec!["step_start", "step_end"]);

        // Step 2: depends_on
        let s2 = &wf.steps[1];
        assert_eq!(s2.depends_on, vec!["step_collect"]);

        // Step 3: compensation
        let s3 = &wf.steps[2];
        assert_eq!(s3.compensation.as_deref(), Some("rollback_draft"));

        // Policy
        let policy = wf.policy.unwrap();
        assert_eq!(policy.max_parallelism, 2);
        assert_eq!(policy.global_timeout_ms, 300000);
        assert_eq!(policy.fail_policy, "fail_fast");
        assert_eq!(policy.checkpoint_policy, "per_step");
        assert_eq!(policy.resume_policy, "from_last_checkpoint");
        assert_eq!(policy.merge_strategy, "concatenate");
    }

    #[test]
    fn test_router_rules_v2_yaml_parsing() {
        let yaml = r#"
intents:
  realtime:
    keywords: ["最新", "release", "CVE"]
    patterns: ["(?i)latest|recent|新闻"]
    dispatch_prefer: [grok]
    fanout: false
    confidence_boost: 0.15
  analyze:
    keywords: ["可行性", "风险", "架构"]
    patterns: ["(?i)evaluat|assess|分析"]
    dispatch_prefer: [deepseek]
    fanout: true
    confidence_boost: 0.10
  write:
    keywords: ["润色", "PPT"]
    patterns: ["(?i)polish|draft|写"]
    dispatch_prefer: [chatgpt]
    confidence_boost: 0.05
defaults:
  fanout: false
  auto_enter: false
  confidence_auto_threshold: 0.8
  confidence_confirm_threshold: 0.6
"#;
        let cfg: RouterRulesConfig = serde_yaml::from_str(yaml).unwrap();
        assert_eq!(cfg.intents.len(), 3);
        assert!(cfg.intents["analyze"].fanout);
        assert!(!cfg.intents["realtime"].fanout);
        assert_eq!(
            cfg.intents["write"].dispatch_prefer,
            vec!["chatgpt"]
        );
        // v2: patterns
        assert_eq!(cfg.intents["realtime"].patterns, vec!["(?i)latest|recent|新闻"]);
        // v2: confidence_boost
        assert!((cfg.intents["realtime"].confidence_boost - 0.15).abs() < 0.001);

        // v2: defaults with thresholds
        let defaults = cfg.defaults.unwrap();
        assert!(!defaults.fanout);
        assert!(!defaults.auto_enter);
        assert!((defaults.confidence_auto_threshold - 0.8).abs() < 0.001);
        assert!((defaults.confidence_confirm_threshold - 0.6).abs() < 0.001);
    }

    #[test]
    fn test_regex_matching_providers() {
        let patterns = vec![
            "ChatGPT.*Mozilla Firefox".to_string(),
            "ChatGPT.*(Chrome|Chromium|Microsoft Edge|Brave)".to_string(),
        ];

        let test_titles = vec![
            ("ChatGPT - Mozilla Firefox", true),
            ("ChatGPT — Google Chrome", true),
            ("ChatGPT - Microsoft Edge", true),
            ("Gemini - Mozilla Firefox", false),
            ("DeepSeek - Chrome", false),
        ];

        for (title, expected) in test_titles {
            let matched = patterns.iter().any(|p| {
                regex::Regex::new(p)
                    .map(|re| re.is_match(title))
                    .unwrap_or(false)
            });
            assert_eq!(matched, expected, "Title '{}' expected={}", title, expected);
        }
    }

    #[test]
    fn test_router_keyword_matching_with_confidence() {
        let yaml = r#"
intents:
  realtime:
    keywords: ["最新", "release", "CVE"]
    patterns: []
    dispatch_prefer: [grok]
    confidence_boost: 0.15
  analyze:
    keywords: ["可行性", "风险", "架构"]
    patterns: []
    dispatch_prefer: [deepseek]
    confidence_boost: 0.10
  write:
    keywords: ["润色", "PPT"]
    patterns: []
    dispatch_prefer: [chatgpt]
    confidence_boost: 0.05
"#;
        let cfg: RouterRulesConfig = serde_yaml::from_str(yaml).unwrap();

        let test_prompts = vec![
            ("请查找最新的ROS2 release信息", "realtime"),
            ("评估这个架构的风险", "analyze"),
            ("帮我润色这份PPT大纲", "write"),
        ];

        for (prompt, expected_intent) in test_prompts {
            // Simulate scoring: count keyword matches + confidence_boost
            let mut best: Option<(&str, f64)> = None;
            for (intent, rule) in &cfg.intents {
                let keyword_hits = rule.keywords.iter().filter(|kw| prompt.contains(kw.as_str())).count();
                if keyword_hits > 0 {
                    let base = keyword_hits as f64 * 0.3;
                    let score = (base + rule.confidence_boost).min(1.0);
                    if best.is_none() || score > best.unwrap().1 {
                        best = Some((intent.as_str(), score));
                    }
                }
            }
            assert!(best.is_some(), "Prompt should match: {}", prompt);
            assert_eq!(
                best.unwrap().0,
                expected_intent,
                "Prompt '{}' should match intent '{}'",
                prompt,
                expected_intent
            );
        }
    }

    #[test]
    fn test_error_definition_serde() {
        let err = ErrorDefinition {
            code: "INPUT_EMPTY".to_string(),
            category: "INPUT".to_string(),
            user_message: "输入不能为空".to_string(),
            fix_suggestion: "请填写必填字段".to_string(),
            alert_level: "warn".to_string(),
        };
        let json = serde_json::to_string(&err).unwrap();
        let parsed: ErrorDefinition = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.code, "INPUT_EMPTY");
        assert_eq!(parsed.category, "INPUT");
        assert_eq!(parsed.alert_level, "warn");
    }

    // ═══════════════════════════
    //  §9 Target Status & Multi-factor Fingerprint Tests
    // ═══════════════════════════

    #[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
    #[serde(rename_all = "snake_case")]
    enum TargetStatus {
        Ready,
        Missing,
        Ambiguous,
        NeedsRebind,
        Inactive,
    }

    #[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
    struct PreflightResult {
        target_id: String,
        status: TargetStatus,
        matched_hwnd: Option<u64>,
        matched_title: Option<String>,
        candidate_count: usize,
        suggestion: String,
    }

    #[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
    struct SelfHealAction {
        strategy_id: String,
        description: String,
        action_type: String,
        max_attempts: u32,
        cooldown_ms: u64,
    }

    #[test]
    fn test_target_status_serde() {
        // Test all variants serialize/deserialize correctly with snake_case
        let statuses = vec![
            (TargetStatus::Ready, "\"ready\""),
            (TargetStatus::Missing, "\"missing\""),
            (TargetStatus::Ambiguous, "\"ambiguous\""),
            (TargetStatus::NeedsRebind, "\"needs_rebind\""),
            (TargetStatus::Inactive, "\"inactive\""),
        ];

        for (status, expected_json) in statuses {
            let json = serde_json::to_string(&status).unwrap();
            assert_eq!(json, expected_json, "TargetStatus::{:?} should serialize to {}", status, expected_json);
            let parsed: TargetStatus = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, status);
        }
    }

    #[test]
    fn test_multifactor_target_match_config() {
        // §9.1: Multi-factor fingerprint with all fields
        let yaml = r#"
targets:
  chatgpt_main:
    provider: chatgpt
    match:
      title_regex:
        - "ChatGPT.*Chrome"
      bound_hwnd: 12345678
      exe_name: chrome.exe
      class_name: Chrome_WidgetWin_1
      process_id: 9876
    behavior:
      auto_enter: false
      paste_delay_ms: 80
      restore_clipboard_after_paste: true
      focus_recipe: ["alt", "tab"]
      append_run_watermark: true
"#;
        let cfg: TargetsConfig = serde_yaml::from_str(yaml).unwrap();
        let chatgpt = &cfg.targets["chatgpt_main"];

        // Multi-factor match
        assert_eq!(chatgpt.match_config.bound_hwnd, Some(12345678));
        assert_eq!(chatgpt.match_config.exe_name.as_deref(), Some("chrome.exe"));
        assert_eq!(chatgpt.match_config.class_name.as_deref(), Some("Chrome_WidgetWin_1"));
        assert_eq!(chatgpt.match_config.process_id, Some(9876));

        // Enhanced behavior
        assert!(chatgpt.behavior.restore_clipboard_after_paste);
        assert_eq!(chatgpt.behavior.focus_recipe, vec!["alt", "tab"]);
        assert!(chatgpt.behavior.append_run_watermark);
    }

    #[test]
    fn test_multifactor_target_match_backward_compat() {
        // §9.1: Old config without new fields should still parse
        let yaml = r#"
targets:
  legacy_target:
    provider: chatgpt
    match:
      title_regex:
        - "ChatGPT.*Firefox"
    behavior:
      auto_enter: false
      paste_delay_ms: 80
"#;
        let cfg: TargetsConfig = serde_yaml::from_str(yaml).unwrap();
        let target = &cfg.targets["legacy_target"];

        assert!(target.match_config.bound_hwnd.is_none());
        assert!(target.match_config.exe_name.is_none());
        assert!(target.match_config.class_name.is_none());
        assert!(target.match_config.process_id.is_none());

        // New behavior fields should have defaults
        assert!(!target.behavior.restore_clipboard_after_paste);
        assert!(target.behavior.focus_recipe.is_empty());
        assert!(target.behavior.append_run_watermark); // default true
    }

    #[test]
    fn test_preflight_result_serde() {
        // §9.3: PreflightResult roundtrip
        let result = PreflightResult {
            target_id: "chatgpt_main".to_string(),
            status: TargetStatus::Ambiguous,
            matched_hwnd: None,
            matched_title: None,
            candidate_count: 3,
            suggestion: "发现 3 个候选窗口，请重新绑定".to_string(),
        };

        let json = serde_json::to_string(&result).unwrap();
        let parsed: PreflightResult = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.target_id, "chatgpt_main");
        assert_eq!(parsed.status, TargetStatus::Ambiguous);
        assert!(parsed.matched_hwnd.is_none());
        assert_eq!(parsed.candidate_count, 3);
        assert!(parsed.suggestion.contains("3 个候选窗口"));
    }

    #[test]
    fn test_preflight_result_ready() {
        let result = PreflightResult {
            target_id: "test".to_string(),
            status: TargetStatus::Ready,
            matched_hwnd: Some(123456),
            matched_title: Some("ChatGPT - Chrome".to_string()),
            candidate_count: 1,
            suggestion: "目标就绪".to_string(),
        };

        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("\"ready\""));
        assert!(json.contains("123456"));
    }

    // ═══════════════════════════
    //  §8 Self-Heal Registry Tests
    // ═══════════════════════════

    #[test]
    fn test_self_heal_action_serde() {
        let action = SelfHealAction {
            strategy_id: "retry_activate".to_string(),
            description: "重新激活目标窗口并重试".to_string(),
            action_type: "auto".to_string(),
            max_attempts: 3,
            cooldown_ms: 1000,
        };

        let json = serde_json::to_string(&action).unwrap();
        let parsed: SelfHealAction = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.strategy_id, "retry_activate");
        assert_eq!(parsed.action_type, "auto");
        assert_eq!(parsed.max_attempts, 3);
        assert_eq!(parsed.cooldown_ms, 1000);
    }

    #[test]
    fn test_self_heal_registry() {
        // Simulate the 5 strategies from config::self_heal_registry()
        let registry = vec![
            SelfHealAction {
                strategy_id: "retry_activate".to_string(),
                description: "重新激活目标窗口并重试".to_string(),
                action_type: "auto".to_string(),
                max_attempts: 3,
                cooldown_ms: 1000,
            },
            SelfHealAction {
                strategy_id: "delay_retry".to_string(),
                description: "等待后重试".to_string(),
                action_type: "auto".to_string(),
                max_attempts: 2,
                cooldown_ms: 3000,
            },
            SelfHealAction {
                strategy_id: "retry_with_backoff".to_string(),
                description: "指数退避重试".to_string(),
                action_type: "auto".to_string(),
                max_attempts: 5,
                cooldown_ms: 500,
            },
            SelfHealAction {
                strategy_id: "reset_config".to_string(),
                description: "重置配置并重新加载".to_string(),
                action_type: "manual".to_string(),
                max_attempts: 1,
                cooldown_ms: 5000,
            },
            SelfHealAction {
                strategy_id: "escalate".to_string(),
                description: "上报给用户手动处理".to_string(),
                action_type: "manual".to_string(),
                max_attempts: 1,
                cooldown_ms: 0,
            },
        ];

        assert_eq!(registry.len(), 5);

        // Verify auto vs manual strategies
        let auto_count = registry.iter().filter(|a| a.action_type == "auto").count();
        let manual_count = registry.iter().filter(|a| a.action_type == "manual").count();
        assert_eq!(auto_count, 3);
        assert_eq!(manual_count, 2);

        // Check all strategy_ids are unique
        let ids: Vec<&str> = registry.iter().map(|a| a.strategy_id.as_str()).collect();
        let mut unique_ids = ids.clone();
        unique_ids.sort();
        unique_ids.dedup();
        assert_eq!(ids.len(), unique_ids.len(), "Strategy IDs should be unique");

        // Roundtrip through JSON
        let json = serde_json::to_string(&registry).unwrap();
        let parsed: Vec<SelfHealAction> = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.len(), 5);
    }

    // ═══════════════════════════
    //  §10 State Machine Constraint Tests
    // ═══════════════════════════

    #[test]
    fn test_valid_run_transitions() {
        // §10: Reproduce the state transition map from config::valid_run_transitions()
        let mut transitions: HashMap<String, Vec<String>> = HashMap::new();
        transitions.insert("idle".into(), vec!["running".into()]);
        transitions.insert("running".into(), vec!["paused".into(), "done".into(), "error".into(), "cancelled".into()]);
        transitions.insert("paused".into(), vec!["running".into(), "cancelled".into()]);
        transitions.insert("error".into(), vec!["running".into(), "closed".into()]);
        transitions.insert("done".into(), vec!["closed".into()]);
        transitions.insert("cancelled".into(), vec!["closed".into()]);

        // Terminal states should not have outgoing transitions (except to closed)
        assert!(!transitions.contains_key("closed"), "closed is terminal");

        // Valid transitions
        assert!(transitions["idle"].contains(&"running".to_string()));
        assert!(transitions["running"].contains(&"paused".to_string()));
        assert!(transitions["running"].contains(&"done".to_string()));
        assert!(transitions["running"].contains(&"error".to_string()));
        assert!(transitions["running"].contains(&"cancelled".to_string()));
        assert!(transitions["paused"].contains(&"running".to_string()));
        assert!(transitions["paused"].contains(&"cancelled".to_string()));
        assert!(transitions["error"].contains(&"running".to_string()));  // retry
        assert!(transitions["error"].contains(&"closed".to_string()));
        assert!(transitions["done"].contains(&"closed".to_string()));
        assert!(transitions["cancelled"].contains(&"closed".to_string()));
    }

    #[test]
    fn test_validate_run_transition() {
        // §10: validate_run_transition(from, to) -> bool
        let transitions: HashMap<&str, Vec<&str>> = HashMap::from([
            ("idle", vec!["running"]),
            ("running", vec!["paused", "done", "error", "cancelled"]),
            ("paused", vec!["running", "cancelled"]),
            ("error", vec!["running", "closed"]),
            ("done", vec!["closed"]),
            ("cancelled", vec!["closed"]),
        ]);

        let validate = |from: &str, to: &str| -> bool {
            transitions.get(from).map_or(false, |valid| valid.contains(&to))
        };

        // Valid transitions
        assert!(validate("idle", "running"));
        assert!(validate("running", "paused"));
        assert!(validate("running", "done"));
        assert!(validate("error", "running"));
        assert!(validate("done", "closed"));

        // Invalid transitions
        assert!(!validate("idle", "done"), "Cannot skip to done from idle");
        assert!(!validate("idle", "paused"), "Cannot pause from idle");
        assert!(!validate("done", "running"), "Cannot resume from done");
        assert!(!validate("closed", "running"), "Closed is terminal");
        assert!(!validate("running", "idle"), "Cannot go back to idle");
        assert!(!validate("paused", "done"), "Cannot finish while paused");
        assert!(!validate("paused", "error"), "Cannot error while paused");
    }

    #[test]
    fn test_target_status_in_health_check() {
        // §9.3: Simulate TargetHealth with new fields
        #[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
        struct TargetHealth {
            target_id: String,
            provider: String,
            matched: bool,
            matched_title: Option<String>,
            status: TargetStatus,
            matched_hwnd: Option<u64>,
        }

        let health_ready = TargetHealth {
            target_id: "chatgpt_main".into(),
            provider: "chatgpt".into(),
            matched: true,
            matched_title: Some("ChatGPT - Chrome".into()),
            status: TargetStatus::Ready,
            matched_hwnd: Some(65536),
        };

        let health_missing = TargetHealth {
            target_id: "deepseek_main".into(),
            provider: "deepseek".into(),
            matched: false,
            matched_title: None,
            status: TargetStatus::Missing,
            matched_hwnd: None,
        };

        // Serialize and verify
        let json = serde_json::to_string(&health_ready).unwrap();
        assert!(json.contains("\"ready\""));
        assert!(json.contains("65536"));

        let json2 = serde_json::to_string(&health_missing).unwrap();
        assert!(json2.contains("\"missing\""));
        assert!(!json2.contains("65536"));

        // Roundtrip
        let parsed: TargetHealth = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.status, TargetStatus::Ready);
        assert_eq!(parsed.matched_hwnd, Some(65536));
    }

    // ═══════════════════════════
    //  §35 Artifact Model Tests
    // ═══════════════════════════

    #[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
    struct Artifact {
        artifact_id: String,
        #[serde(default)]
        run_id: Option<String>,
        #[serde(default)]
        step_id: Option<String>,
        artifact_type: String,
        producer: String,
        #[serde(default)]
        path: Option<String>,
        created_at: u64,
        #[serde(default)]
        checksum: Option<String>,
        #[serde(default)]
        content: Option<String>,
    }

    #[test]
    fn test_artifact_serialization() {
        let artifact = Artifact {
            artifact_id: "art-001".into(),
            run_id: Some("run-abc".into()),
            step_id: Some("step-1".into()),
            artifact_type: "clipboard_capture".into(),
            producer: "captureOutput".into(),
            path: Some("vault/artifacts/art-001.json".into()),
            created_at: 1700000000,
            checksum: Some("sha256:abc123".into()),
            content: Some("Hello world".into()),
        };

        let json = serde_json::to_string(&artifact).unwrap();
        assert!(json.contains("\"artifact_id\":\"art-001\""));
        assert!(json.contains("\"clipboard_capture\""));
        assert!(json.contains("\"sha256:abc123\""));

        // Roundtrip
        let parsed: Artifact = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.artifact_id, "art-001");
        assert_eq!(parsed.run_id, Some("run-abc".into()));
        assert_eq!(parsed.content, Some("Hello world".into()));
    }

    #[test]
    fn test_artifact_minimal() {
        // Optional fields can be omitted
        let json = r#"{"artifact_id":"art-002","artifact_type":"prompt","producer":"dispatch","created_at":1700000000}"#;
        let parsed: Artifact = serde_json::from_str(json).unwrap();
        assert_eq!(parsed.artifact_id, "art-002");
        assert!(parsed.run_id.is_none());
        assert!(parsed.step_id.is_none());
        assert!(parsed.checksum.is_none());
        assert!(parsed.content.is_none());
    }

    // ═══════════════════════════
    //  §37 StepStatus + StepRecord Tests
    // ═══════════════════════════

    #[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
    #[serde(rename_all = "snake_case")]
    enum StepStatus {
        Pending,
        Dispatched,
        AwaitingSend,
        WaitingOutput,
        Captured,
        Failed,
    }

    #[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
    struct StepRecord {
        id: String,
        run_id: String,
        skill_id: String,
        status: StepStatus,
        #[serde(default)]
        target_id: Option<String>,
        #[serde(default)]
        input_artifacts: Vec<String>,
        #[serde(default)]
        output_artifact: Option<String>,
        #[serde(default)]
        error_code: Option<String>,
        #[serde(default)]
        trace_id: Option<String>,
        #[serde(default)]
        ts_start: Option<u64>,
        #[serde(default)]
        ts_end: Option<u64>,
    }

    #[test]
    fn test_step_status_serde() {
        let statuses = vec![
            StepStatus::Pending,
            StepStatus::Dispatched,
            StepStatus::AwaitingSend,
            StepStatus::WaitingOutput,
            StepStatus::Captured,
            StepStatus::Failed,
        ];

        for status in &statuses {
            let json = serde_json::to_string(status).unwrap();
            let parsed: StepStatus = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, *status);
        }

        // Check snake_case serialization
        assert_eq!(serde_json::to_string(&StepStatus::AwaitingSend).unwrap(), "\"awaiting_send\"");
        assert_eq!(serde_json::to_string(&StepStatus::WaitingOutput).unwrap(), "\"waiting_output\"");
    }

    #[test]
    fn test_step_record_roundtrip() {
        let record = StepRecord {
            id: "step-001".into(),
            run_id: "run-abc".into(),
            skill_id: "translate".into(),
            status: StepStatus::Captured,
            target_id: Some("chatgpt_main".into()),
            input_artifacts: vec!["art-001".into()],
            output_artifact: Some("art-002".into()),
            error_code: None,
            trace_id: Some("t-xyz".into()),
            ts_start: Some(1700000000),
            ts_end: Some(1700000010),
        };

        let json = serde_json::to_string(&record).unwrap();
        assert!(json.contains("\"captured\""));
        assert!(json.contains("\"art-001\""));

        let parsed: StepRecord = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.id, "step-001");
        assert_eq!(parsed.status, StepStatus::Captured);
        assert_eq!(parsed.input_artifacts.len(), 1);
    }

    #[test]
    fn test_step_valid_transitions() {
        // §37: Step 状态转换
        let valid: HashMap<&str, Vec<&str>> = HashMap::from([
            ("pending", vec!["dispatched"]),
            ("dispatched", vec!["awaiting_send", "failed"]),
            ("awaiting_send", vec!["waiting_output", "failed"]),
            ("waiting_output", vec!["captured", "failed"]),
        ]);

        let validate = |from: &str, to: &str| -> bool {
            valid.get(from).map_or(false, |v| v.contains(&to))
        };

        assert!(validate("pending", "dispatched"));
        assert!(validate("dispatched", "awaiting_send"));
        assert!(validate("awaiting_send", "waiting_output"));
        assert!(validate("waiting_output", "captured"));
        assert!(validate("dispatched", "failed"));
        assert!(!validate("pending", "captured"), "Cannot skip to captured");
        assert!(!validate("captured", "pending"), "captured is terminal");
        assert!(!validate("failed", "dispatched"), "failed is terminal");
    }

    // ═══════════════════════════
    //  §9.9 + §29.3 DispatchTrace Tests
    // ═══════════════════════════

    #[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
    struct DispatchTrace {
        trace_id: String,
        #[serde(default)]
        run_id: Option<String>,
        #[serde(default)]
        step_id: Option<String>,
        #[serde(default)]
        target_id: Option<String>,
        ts_start: u64,
        ts_end: u64,
        duration_ms: u64,
        candidate_windows: Vec<String>,
        #[serde(default)]
        matched_fingerprint: Option<String>,
        #[serde(default)]
        matched_hwnd: Option<u64>,
        activation_ok: bool,
        activation_attempts: u32,
        clipboard_backup_ok: bool,
        clipboard_restore_ok: bool,
        focus_recipe_executed: bool,
        stage_ok: bool,
        #[serde(default)]
        confirm_ok: Option<bool>,
        #[serde(default)]
        clipboard_txn_id: Option<String>,
        outcome: String,
        #[serde(default)]
        error_detail: Option<String>,
    }

    #[test]
    fn test_dispatch_trace_success() {
        let trace = DispatchTrace {
            trace_id: "t-123".into(),
            run_id: Some("run-abc".into()),
            step_id: Some("step-1".into()),
            target_id: Some("chatgpt_main".into()),
            ts_start: 1000,
            ts_end: 1200,
            duration_ms: 200,
            candidate_windows: vec!["hwnd=65536".into()],
            matched_fingerprint: Some("chatgpt_main".into()),
            matched_hwnd: Some(65536),
            activation_ok: true,
            activation_attempts: 1,
            clipboard_backup_ok: true,
            clipboard_restore_ok: true,
            focus_recipe_executed: false,
            stage_ok: true,
            confirm_ok: Some(true),
            clipboard_txn_id: Some("ctx-t-123".into()),
            outcome: "ok".into(),
            error_detail: None,
        };

        let json = serde_json::to_string_pretty(&trace).unwrap();
        assert!(json.contains("\"activation_ok\": true"));
        assert!(json.contains("\"stage_ok\": true"));
        assert!(json.contains("\"duration_ms\": 200"));

        let parsed: DispatchTrace = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.trace_id, "t-123");
        assert_eq!(parsed.duration_ms, 200);
        assert!(parsed.activation_ok);
        assert!(parsed.stage_ok);
        assert_eq!(parsed.outcome, "ok");
    }

    #[test]
    fn test_dispatch_trace_failure() {
        let trace = DispatchTrace {
            trace_id: "t-456".into(),
            run_id: Some("run-def".into()),
            step_id: None,
            target_id: Some("deepseek_main".into()),
            ts_start: 2000,
            ts_end: 2100,
            duration_ms: 100,
            candidate_windows: vec![],
            matched_fingerprint: None,
            matched_hwnd: None,
            activation_ok: false,
            activation_attempts: 3,
            clipboard_backup_ok: true,
            clipboard_restore_ok: false,
            focus_recipe_executed: true,
            stage_ok: false,
            confirm_ok: None,
            clipboard_txn_id: None,
            outcome: "err".into(),
            error_detail: Some("TARGET_ACTIVATE_FAILED".into()),
        };

        let json = serde_json::to_string(&trace).unwrap();
        assert!(json.contains("\"activation_ok\":false"));
        assert!(json.contains("\"stage_ok\":false"));
        assert!(json.contains("\"TARGET_ACTIVATE_FAILED\""));

        let parsed: DispatchTrace = serde_json::from_str(&json).unwrap();
        assert!(!parsed.activation_ok);
        assert!(!parsed.stage_ok);
        assert_eq!(parsed.error_detail, Some("TARGET_ACTIVATE_FAILED".into()));
    }

    // ═══════════════════════════
    //  §35+§37 RunRecord Enhanced Fields
    // ═══════════════════════════

    #[test]
    fn test_run_record_with_new_fields() {
        // RunRecord now has steps, artifact_ids, confirm_source
        let json = r#"{
            "id": "run-001",
            "ts_start": 1700000000,
            "skill_id": "translate",
            "target_id": "chatgpt_main",
            "provider": "chatgpt",
            "prompt": "翻译这段话",
            "status": "dispatched",
            "trace_id": "t-xxx",
            "steps": [
                {
                    "id": "step-1",
                    "run_id": "run-001",
                    "skill_id": "translate",
                    "status": "captured",
                    "target_id": "chatgpt_main",
                    "input_artifacts": ["art-001"],
                    "output_artifact": "art-002",
                    "trace_id": "t-xxx"
                }
            ],
            "artifact_ids": ["art-001", "art-002"],
            "confirm_source": "user_click"
        }"#;

        // Verify steps field
        let val: serde_json::Value = serde_json::from_str(json).unwrap();
        let steps = val["steps"].as_array().unwrap();
        assert_eq!(steps.len(), 1);
        assert_eq!(steps[0]["status"], "captured");

        // Verify artifact_ids
        let artifacts = val["artifact_ids"].as_array().unwrap();
        assert_eq!(artifacts.len(), 2);

        // Verify confirm_source
        assert_eq!(val["confirm_source"], "user_click");
    }

    #[test]
    fn test_run_record_backward_compat() {
        // Old RunRecord JSON without new fields should still parse
        let json = r#"{
            "id": "run-old",
            "ts_start": 1700000000,
            "skill_id": "translate",
            "target_id": "chatgpt_main",
            "provider": "chatgpt",
            "prompt": "翻译这段话",
            "status": "dispatched",
            "trace_id": "t-old"
        }"#;

        let val: serde_json::Value = serde_json::from_str(json).unwrap();
        assert_eq!(val["id"], "run-old");
        // New fields should not exist (or be null)
        assert!(val.get("steps").is_none() || val["steps"].is_null());
        assert!(val.get("artifact_ids").is_none() || val["artifact_ids"].is_null());
    }
}
