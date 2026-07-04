// 記録（解析1件）を削除する窓口（サーバー側）。
import { NextResponse } from "next/server";
import { prisma } from "@/app/_lib/db";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await prisma.analysis.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "削除に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
