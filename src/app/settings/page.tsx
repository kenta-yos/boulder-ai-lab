import Link from "next/link";
import { revalidatePath } from "next/cache";
import { ScreenShell } from "../_components/ScreenShell";
import { prisma } from "../_lib/db";

export const dynamic = "force-dynamic";

// --- サーバーアクション（フォーム送信でDBを更新） ---
async function addGym(formData: FormData) {
  "use server";
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await prisma.gym.create({ data: { name } });
  revalidatePath("/settings");
}

async function deleteGym(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.gym.delete({ where: { id } });
  revalidatePath("/settings");
}

async function addGrade(formData: FormData) {
  "use server";
  const gymId = String(formData.get("gymId") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  if (!gymId || !label) return;
  const count = await prisma.grade.count({ where: { gymId } });
  await prisma.grade.create({ data: { gymId, label, orderIndex: count } });
  revalidatePath("/settings");
}

async function deleteGrade(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.grade.delete({ where: { id } });
  revalidatePath("/settings");
}

export default async function SettingsPage() {
  const gyms = await prisma.gym.findMany({
    orderBy: { createdAt: "asc" },
    include: { grades: { orderBy: { orderIndex: "asc" } } },
  });

  return (
    <ScreenShell
      badge="⚙"
      title="ジム・グレード登録"
      description="よく行くジムと、そのグレードを登録しておくと、アップロード時に選べます。"
    >
      {/* ジムを追加 */}
      <form action={addGym} className="mb-6 flex gap-2">
        <input
          name="name"
          placeholder="ジム名を追加（例：〇〇ボルダリング）"
          className="min-w-0 flex-1 rounded-lg border border-black/15 bg-transparent px-3 py-2 text-base dark:border-white/20"
        />
        <button className="shrink-0 rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background">
          追加
        </button>
      </form>

      {gyms.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          まだジムがありません。上で追加してください。
        </p>
      ) : (
        <ul className="space-y-5">
          {gyms.map((g) => (
            <li
              key={g.id}
              className="rounded-xl border border-black/10 p-4 dark:border-white/15"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="font-medium">{g.name}</span>
                <form action={deleteGym}>
                  <input type="hidden" name="id" value={g.id} />
                  <button className="text-xs text-red-600 underline dark:text-red-400">
                    ジム削除
                  </button>
                </form>
              </div>

              {/* グレード一覧 */}
              {g.grades.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {g.grades.map((gr) => (
                    <span
                      key={gr.id}
                      className="inline-flex items-center gap-1 rounded-full bg-black/5 px-3 py-1 text-sm dark:bg-white/10"
                    >
                      {gr.label}
                      <form action={deleteGrade} className="inline">
                        <input type="hidden" name="id" value={gr.id} />
                        <button className="text-red-600 dark:text-red-400">
                          ×
                        </button>
                      </form>
                    </span>
                  ))}
                </div>
              )}

              {/* グレード追加 */}
              <form action={addGrade} className="flex gap-2">
                <input type="hidden" name="gymId" value={g.id} />
                <input
                  name="label"
                  placeholder="グレードを追加（例：3級 / V4）"
                  className="min-w-0 flex-1 rounded-lg border border-black/15 bg-transparent px-3 py-2 text-base dark:border-white/20"
                />
                <button className="shrink-0 rounded-full border border-black/20 px-4 py-2 text-sm font-medium dark:border-white/25">
                  追加
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/"
        className="mt-6 inline-block text-sm text-zinc-600 underline dark:text-zinc-300"
      >
        ← 上げるに戻る
      </Link>
    </ScreenShell>
  );
}
