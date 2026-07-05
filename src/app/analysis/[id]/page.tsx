import Link from "next/link";
import { notFound } from "next/navigation";
import { ScreenShell } from "../../_components/ScreenShell";
import { DeleteButton } from "../../_components/DeleteButton";
import { ScoreBars } from "../../_components/ScoreBars";
import { prisma } from "../../_lib/db";
import type { SkillScore } from "../../_lib/analyze";

export const dynamic = "force-dynamic";

// ② 解析結果（過去記録の詳細）
export default async function AnalysisDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const a = await prisma.analysis.findUnique({ where: { id } });

  if (!a) {
    notFound();
  }

  return (
    <ScreenShell
      badge="②"
      title="解析結果"
      description={
        new Date(a.createdAt).toLocaleString("ja-JP") +
        (a.grade ? ` ・ ${a.grade}` : "") +
        (a.gym ? ` ・ ${a.gym}` : "") +
        (a.holdColor ? ` ・ ${a.holdColor}` : "") +
        (a.wallAngle ? ` ・ ${a.wallAngle}` : "")
      }
    >
      {a.thumbnail && (
        <div className="mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={a.thumbnail}
            alt="サムネ"
            className="w-40 rounded-lg border border-black/10 dark:border-white/15"
          />
        </div>
      )}

      <div className="space-y-4">
        {a.note && (
          <div className="rounded-xl border border-black/10 p-4 dark:border-white/15">
            <p className="mb-1 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
              自分のメモ（落ちた場所・感触）
            </p>
            <p className="whitespace-pre-wrap leading-7">{a.note}</p>
          </div>
        )}
        {a.prescription && a.prescription.trim() && (
          <div className="rounded-xl border border-black/10 p-4 dark:border-white/15">
            <p className="mb-1 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
              指摘（落ちた瞬間のムーブ中心）
            </p>
            <p className="whitespace-pre-wrap leading-7">{a.prescription}</p>
          </div>
        )}
        {a.summary && a.summary.trim() && (
          <div className="rounded-xl border border-black/10 p-4 dark:border-white/15">
            <p className="mb-1 text-xs font-semibold text-green-700 dark:text-green-400">
              総括（次に意識すること）
            </p>
            <p className="whitespace-pre-wrap leading-7">{a.summary}</p>
          </div>
        )}

        {Array.isArray(a.scores) && a.scores.length > 0 && (
          <div className="rounded-xl border border-black/10 p-4 dark:border-white/15">
            <p className="mb-3 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
              技術8軸のスコア
            </p>
            <ScoreBars scores={a.scores as unknown as SkillScore[]} />
          </div>
        )}
      </div>

      <p className="mt-6 text-xs text-zinc-500 dark:text-zinc-400">
        ※ この画面ではチャットの続きはできません（登りの画像を保存していないため。将来 Blob 保存で対応予定）。
      </p>

      <DeleteButton id={a.id} />

      <Link
        href="/records"
        className="mt-4 inline-block text-sm text-zinc-600 underline dark:text-zinc-300"
      >
        ← 記録一覧に戻る
      </Link>
    </ScreenShell>
  );
}
