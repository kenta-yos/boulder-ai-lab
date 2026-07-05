import Link from "next/link";
import { ScreenShell, ComingSoon } from "../_components/ScreenShell";
import { TrendSparklines, type AxisSeries } from "../_components/TrendSparklines";
import { prisma } from "../_lib/db";
import { SKILLS, type SkillScore } from "../_lib/analyze";

// 常に最新のDB内容を表示する（キャッシュしない）
export const dynamic = "force-dynamic";

// ③ 記録・傾向画面
export default async function RecordsPage() {
  const analyses = await prisma.analysis.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // 推移用：スコアがある解析だけを古い→新しい順に並べ、軸ごとの点数列を作る
  const withScores = [...analyses]
    .reverse()
    .filter((a) => Array.isArray(a.scores) && a.scores.length > 0);

  const series: AxisSeries[] = SKILLS.map((skill) => ({
    skill,
    points: withScores
      .map((a) => {
        const arr = a.scores as unknown as SkillScore[];
        return arr.find((s) => s.skill === skill)?.score;
      })
      .filter((v): v is number => typeof v === "number"),
  }));

  return (
    <ScreenShell
      badge="③"
      title="記録・傾向"
      description="過去の解析が自動で溜まり、技術軸ごとの点数の推移が見えます。"
    >
      {analyses.length === 0 ? (
        <ComingSoon>
          まだ記録がありません。
          <br />
          「上げる」で動画を解析すると、ここに自動で溜まっていきます。
        </ComingSoon>
      ) : (
        <div className="space-y-8">
          {/* 傾向チャート（軸ごとの推移） */}
          {withScores.length > 0 && (
            <div className="rounded-xl border border-black/10 p-4 dark:border-white/15">
              <p className="mb-3 text-sm font-semibold">
                技術軸の推移（{withScores.length}回分）
              </p>
              <TrendSparklines series={series} />
              <p className="mt-3 text-xs text-zinc-400">
                左が古い・右が新しい。点は最新値。
              </p>
            </div>
          )}

          {/* 記録一覧 */}
          <div>
            <p className="mb-3 text-sm font-semibold">記録一覧</p>
            <ul className="space-y-3">
              {analyses.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/analysis/${a.id}`}
                    className="flex gap-3 rounded-xl border border-black/10 p-3 transition-colors hover:bg-black/[.03] dark:border-white/15 dark:hover:bg-white/[.06]"
                  >
                    {a.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={a.thumbnail}
                        alt="サムネ"
                        className="h-20 w-20 flex-shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="h-20 w-20 flex-shrink-0 rounded-lg bg-black/5 dark:bg-white/10" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {new Date(a.createdAt).toLocaleString("ja-JP")}
                        {a.grade ? ` ・ ${a.grade}` : ""}
                        {a.gym ? ` ・ ${a.gym}` : ""}
                        {a.holdColor ? ` ・ ${a.holdColor}` : ""}
                        {a.wallAngle ? ` ・ ${a.wallAngle}` : ""}
                      </p>
                      {a.note ? (
                        <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500 dark:text-zinc-400">
                          メモ: {a.note}
                        </p>
                      ) : null}
                      <p className="mt-1 line-clamp-3 text-sm leading-6">
                        {a.summary}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </ScreenShell>
  );
}
