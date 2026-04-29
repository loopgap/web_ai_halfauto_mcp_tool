import { useMemo } from "react";
import type { Skill } from "../types";

interface SkillSelectorProps {
  skills: Skill[];
  selectedSkill: string;
  onChange: (skillId: string) => void;
}

export default function SkillSelector({ skills, selectedSkill, onChange }: SkillSelectorProps) {
  const currentSkill = useMemo(() => skills.find((s) => s.id === selectedSkill), [skills, selectedSkill]);

  return (
    <div className="glass-card-static p-4">
      <label htmlFor="skill-select" className="block text-sm font-medium text-slate-300 mb-2">
        {"选择 Skill"}
      </label>
      <select
        id="skill-select"
        className="select-modern"
        value={selectedSkill}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{"-- 选择技能 --"}</option>
        {skills.map((s) => (
          <option key={s.id} value={s.id}>
            {s.title} ({s.id}) v{s.version}
          </option>
        ))}
      </select>
      {currentSkill && (
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {currentSkill.intent_tags.map((t) => (
            <span key={t} className="badge badge-purple text-[10px]">
              {t}
            </span>
          ))}
          <span
            className={`badge text-[10px] ${
              currentSkill.safety_level === "safe"
                ? "badge-green"
                : currentSkill.safety_level === "dangerous"
                ? "badge-red"
                : "badge-yellow"
            }`}
          >
            {currentSkill.safety_level}
          </span>
        </div>
      )}
    </div>
  );
}
