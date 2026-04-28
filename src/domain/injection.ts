// ═══════════════════════════════════════════════════════════
// §82-86 Instruction Injection Engine — 自动化定制指令插入
// ═══════════════════════════════════════════════════════════

/**
 * §82 注入块定义
 * 每个注入块代表一段要自动插入到 prompt 中的指令片段
 */
export interface InjectionBlock {
  block_id: string;
  /** 来源: "safety" | "user_pref" | "workflow" | "skill" | "dynamic" */
  source: string;
  /** 优先级: 1=最高(安全) → 5=最低(动态建议) §83 */
  priority: 1 | 2 | 3 | 4 | 5;
  /** 注入内容 */
  content: string;
  /** 是否可被用户关闭 */
  dismissible: boolean;
  /** 互斥组 — 同组内仅保留最高优先级 */
  mutex_group?: string;
}

/**
 * §83 注入策略
 */
export interface InjectionPolicy {
  enabled: boolean;
  /** "strict" | "balanced" | "minimal" §85 */
  mode: string;
  /** 用户硬偏好块 */
  user_preferences: InjectionBlock[];
  /** 安全策略块 (不可覆盖) */
  safety_blocks: InjectionBlock[];
  /** 最大总注入长度 */
  max_injection_length: number;
}

/**
 * §86 注入追踪记录
 */
export interface InjectionTrace {
  injection_trace_id: string;
  applied_blocks: string[];   // block_id[]
  dropped_blocks: string[];   // block_id[]
  conflicts: string[];        // 冲突描述
  final_prompt_checksum: string;
  ts_ms: number;
}

// ───────── 默认注入策略 ─────────

const DEFAULT_SAFETY_BLOCKS: InjectionBlock[] = [
  {
    block_id: "safety_boundary",
    source: "safety",
    priority: 1,
    content: "请在能力范围内回答，不确定时请明确说明。",
    dismissible: false,
  },
];

export function defaultInjectionPolicy(): InjectionPolicy {
  return {
    enabled: true,
    mode: "balanced",
    user_preferences: [],
    safety_blocks: DEFAULT_SAFETY_BLOCKS,
    max_injection_length: 2000,
  };
}

// ───────── §83 冲突检测 + 去重 + 合并 ─────────

/**
 * §83 合并注入块: 按优先级排序，去重，处理互斥冲突
 */
export function resolveInjectionBlocks(
  policy: InjectionPolicy,
  workflowBlocks: InjectionBlock[] = [],
  skillBlocks: InjectionBlock[] = [],
  dynamicBlocks: InjectionBlock[] = [],
): { applied: InjectionBlock[]; dropped: InjectionBlock[]; conflicts: string[] } {
  if (!policy.enabled) {
    return { applied: [], dropped: [], conflicts: [] };
  }

  // Collect all blocks
  const allBlocks: InjectionBlock[] = [
    ...policy.safety_blocks,         // priority 1
    ...policy.user_preferences,      // priority 2
    ...workflowBlocks,               // priority 3
    ...skillBlocks,                  // priority 4
    ...dynamicBlocks,                // priority 5
  ];

  // Sort by priority (ascending = higher priority first)
  allBlocks.sort((a, b) => a.priority - b.priority);

  // §83 去重: same block_id → keep first (higher priority)
  const seenIds = new Set<string>();
  const deduped: InjectionBlock[] = [];
  const dropped: InjectionBlock[] = [];
  const conflicts: string[] = [];

  for (const block of allBlocks) {
    if (seenIds.has(block.block_id)) {
      dropped.push(block);
      continue;
    }
    seenIds.add(block.block_id);
    deduped.push(block);
  }

  // §83 互斥处理: same mutex_group → keep highest priority
  const mutexWinners = new Map<string, InjectionBlock>();
  const applied: InjectionBlock[] = [];

  for (const block of deduped) {
    if (block.mutex_group) {
      const existing = mutexWinners.get(block.mutex_group);
      if (existing) {
        dropped.push(block);
        conflicts.push(
          `互斥冲突: "${block.block_id}" (priority=${block.priority}) 被 "${existing.block_id}" (priority=${existing.priority}) 覆盖, group="${block.mutex_group}"`,
        );
        continue;
      }
      mutexWinners.set(block.mutex_group, block);
    }
    applied.push(block);
  }

  // §86 长度约束
  // §P2-3 Account for join("\n") newlines in length calculation
  let totalLen = 0;
  const finalApplied: InjectionBlock[] = [];
  for (let idx = 0; idx < applied.length; idx++) {
    const block = applied[idx];
    // Add newline length except for last block
    const newlineLen = idx > 0 ? 1 : 0;
    if (totalLen + block.content.length + newlineLen > policy.max_injection_length) {
      dropped.push(block);
      conflicts.push(`注入长度超限: "${block.block_id}" 被截断丢弃`);
      continue;
    }
    totalLen += block.content.length + newlineLen;
    finalApplied.push(block);
  }

  return { applied: finalApplied, dropped, conflicts };
}

// ───────── §82 构造最终 prompt ─────────

/**
 * §82 构造 final_prompt = base_prompt + injected_blocks
 */
export function buildFinalPrompt(
  basePrompt: string,
  applied: InjectionBlock[],
): string {
  if (applied.length === 0) return basePrompt;

  const injectionText = applied
    .map((b) => b.content)
    .join("\n");

  return `${injectionText}\n\n${basePrompt}`;
}

/**
 * §86 Generate simple checksum for audit
 */
export function promptChecksum(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
    // §P2-4 Handle 32-bit integer overflow for MIN_SAFE_INTEGER
  return `ck-${(hash >>> 0).toString(16)}`;
}
