// ═══════════════════════════════════════════════════════════
// Config Export/Import — 配置备份与恢复
// 支持 targets、skills、workflows、router_rules 的导出/导入
// ═══════════════════════════════════════════════════════════

import type { TargetsConfig, Skill, Workflow, RouterRulesConfig } from "../types";

export interface ConfigBundle {
  version: string;
  exported_at: string;
  targets: TargetsConfig | null;
  skills: Skill[];
  workflows: Workflow[];
  routerRules: RouterRulesConfig | null;
}

/** 导出当前配置为 JSON Bundle */
export function exportConfigBundle(
  targets: TargetsConfig | null,
  skills: Skill[],
  workflows: Workflow[],
  routerRules: RouterRulesConfig | null
): ConfigBundle {
  return {
    version: "1.0.0",
    exported_at: new Date().toISOString(),
    targets,
    skills,
    workflows,
    routerRules,
  };
}

/** 将 ConfigBundle 序列化为可下载的 JSON 字符串 */
export function serializeBundle(bundle: ConfigBundle): string {
  return JSON.stringify(bundle, null, 2);
}

/** 触发浏览器下载 */
export function downloadAsFile(content: string, filename: string, mime: string = "application/json") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** 验证导入的 JSON 是有效的 ConfigBundle */
export function validateConfigBundle(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!data || typeof data !== "object") {
    errors.push("无效的 JSON 对象");
    return { valid: false, errors };
  }
  const obj = data as Record<string, unknown>;
  if (typeof obj.version !== "string") {
    errors.push("缺少 version 字段");
  }
  if (!Array.isArray(obj.skills)) {
    errors.push("skills 必须为数组");
  }
  if (!Array.isArray(obj.workflows)) {
    errors.push("workflows 必须为数组");
  }
  return { valid: errors.length === 0, errors };
}

/** 从文件读取 ConfigBundle */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsText(file);
  });
}

// ───────── Run 导出为 Markdown ─────────

import type { RunRecord } from "../types";

export function exportRunsToMarkdown(runs: RunRecord[]): string {
  const lines: string[] = [
    "# AI Workbench — Run History Export",
    "",
    `> Exported at: ${new Date().toISOString()}`,
    `> Total runs: ${runs.length}`,
    "",
    "---",
    "",
  ];

  for (const run of runs) {
    lines.push(`## Run: ${run.id}`);
    lines.push("");
    lines.push(`| Field | Value |`);
    lines.push(`|-------|-------|`);
    lines.push(`| Skill | ${run.skill_id} |`);
    lines.push(`| Target | ${run.target_id} |`);
    lines.push(`| Provider | ${run.provider} |`);
    lines.push(`| Status | ${run.status} |`);
    lines.push(`| Trace ID | ${run.trace_id} |`);
    if (run.error_code) lines.push(`| Error | ${run.error_code} |`);
    lines.push(`| Started | ${new Date(run.ts_start).toLocaleString()} |`);
    if (run.ts_end) lines.push(`| Ended | ${new Date(run.ts_end).toLocaleString()} |`);
    lines.push("");
    if (run.prompt) {
      lines.push("### Prompt");
      lines.push("```");
      lines.push(run.prompt.substring(0, 2000));
      lines.push("```");
      lines.push("");
    }
    if (run.output) {
      lines.push("### Output");
      lines.push("```");
      lines.push(run.output.substring(0, 3000));
      lines.push("```");
      lines.push("");
    }
    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}
