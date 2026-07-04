// 技術8軸のスコアをバーで表示する部品（クライアント/サーバー両方で使える）。
import type { SkillScore } from "../_lib/analyze";
import { SKILLS } from "../_lib/analyze";

function barColor(v: number): string {
  if (v < 40) return "bg-red-500";
  if (v < 70) return "bg-amber-500";
  return "bg-green-600";
}

export function ScoreBars({ scores }: { scores: SkillScore[] }) {
  const byName = new Map(scores.map((s) => [s.skill, s]));
  return (
    <div className="space-y-3">
      {SKILLS.map((skill) => {
        const s = byName.get(skill);
        const val = s ? Math.max(0, Math.min(100, s.score)) : 0;
        return (
          <div key={skill}>
            <div className="mb-0.5 flex items-baseline justify-between text-sm">
              <span>{skill}</span>
              <span className="text-zinc-500 dark:text-zinc-400">
                {s ? val : "—"}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded bg-black/10 dark:bg-white/15">
              <div
                className={"h-full rounded " + barColor(val)}
                style={{ width: `${val}%` }}
              />
            </div>
            {s?.evidence && (
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {s.evidence}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
