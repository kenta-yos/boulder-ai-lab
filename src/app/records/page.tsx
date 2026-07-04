import Link from "next/link";
import { ScreenShell, ComingSoon } from "../_components/ScreenShell";
import { prisma } from "../_lib/db";

// 常に最新のDB内容を表示する（キャッシュしない）
export const dynamic = "force-dynamic";

// ③ 記録・傾向画面
export default async function RecordsPage() {
  const analyses = await prisma.analysis.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <ScreenShell
      badge="③"
      title="記録・傾向"
      description="過去の解析が自動で溜まります。（技術軸の推移チャットは Phase 2 で追加）"
    >
      {analyses.length === 0 ? (
        <ComingSoon>
          まだ記録がありません。
          <br />
          「上げる」で動画を解析すると、ここに自動で溜まっていきます。
        </ComingSoon>
      ) : (
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
                  </p>
                  <p className="mt-1 line-clamp-3 text-sm leading-6">
                    {a.summary}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </ScreenShell>
  );
}
