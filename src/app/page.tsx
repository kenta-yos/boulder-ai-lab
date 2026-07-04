import { ScreenShell } from "./_components/ScreenShell";
import { Uploader } from "./_components/Uploader";
import { prisma } from "./_lib/db";

export const dynamic = "force-dynamic";

// ① アップロード画面（アプリの入口）
export default async function UploadPage() {
  const gyms = await prisma.gym.findMany({
    orderBy: { createdAt: "asc" },
    include: { grades: { orderBy: { orderIndex: "asc" } } },
  });
  const gymData = gyms.map((g) => ({
    id: g.id,
    name: g.name,
    grades: g.grades.map((gr) => ({ id: gr.id, label: gr.label })),
  }));

  return (
    <ScreenShell
      badge="①"
      title="アップロード"
      description="撮影した登りの動画を選ぶと、AIコーチが動きを読んで敗因・処方を返します。"
    >
      <Uploader gyms={gymData} />
    </ScreenShell>
  );
}
