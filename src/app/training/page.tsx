import Link from "next/link";
import { ScreenShell, ComingSoon } from "../_components/ScreenShell";
import { prisma } from "../_lib/db";
import { SKILLS, type SkillScore } from "../_lib/analyze";
import { AXIS_TIPS } from "../_lib/handbook";

export const dynamic = "force-dynamic";

// ④ トレーニング提案画面
export default async function TrainingPage() {
  const analyses = await prisma.analysis.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  // 各軸の平均スコアを出す（スコアがある解析だけ）
  const sums: Record<string, { total: number; n: number }> = {};
  for (const a of analyses) {
    if (!Array.isArray(a.scores)) continue;
    for (const s of a.scores as unknown as SkillScore[]) {
      if (!SKILLS.includes(s.skill as (typeof SKILLS)[number])) continue;
      sums[s.skill] = sums[s.skill] ?? { total: 0, n: 0 };
      sums[s.skill].total += s.score;
      sums[s.skill].n += 1;
    }
  }

  const averaged = Object.entries(sums)
    .map(([skill, v]) => ({ skill, avg: Math.round(v.total / v.n), n: v.n }))
    .sort((a, b) => a.avg - b.avg); // 低い＝弱点が先頭

  const weakest = averaged.slice(0, 3);
  const analyzedCount = analyses.filter((a) => Array.isArray(a.scores)).length;

  return (
    <ScreenShell
      badge="④"
      title="トレーニング提案"
      description="これまでの解析の傾向から、弱点の技術軸とドリルを提案します。"
    >
      {weakest.length === 0 ? (
        <ComingSoon>
          まだ提案できる傾向データがありません。
          <br />
          <Link href="/" className="underline">
            動画を解析
          </Link>
          してスコアを溜めると、弱点に応じた提案が出ます。
        </ComingSoon>
      ) : (
        <div className="space-y-5">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            直近{analyzedCount}回の平均から、点数が低い軸を弱点として優先提案します。
          </p>
          {weakest.map((w) => {
            const tip = AXIS_TIPS[w.skill];
            return (
              <div
                key={w.skill}
                className="rounded-xl border border-black/10 p-4 dark:border-white/15"
              >
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="font-semibold">{w.skill}</span>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    平均 {w.avg}
                  </span>
                </div>
                {tip && (
                  <>
                    <p className="mb-2 text-sm leading-6">{tip.focus}</p>
                    <ul className="list-disc pl-5 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                      {tip.drills.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </ScreenShell>
  );
}
