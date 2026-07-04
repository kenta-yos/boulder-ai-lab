// 動画をGeminiに読ませて敗因＋処方を出す窓口（サーバー側）。
// 動画は大きいので multipart/form-data で受け取る。
import { NextResponse } from "next/server";
import { analyzeVideoWithGemini } from "@/app/_lib/analyzeVideoWithGemini";
import { prisma } from "@/app/_lib/db";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const video = form.get("video");
    const grade = form.get("grade");
    const thumbnail = form.get("thumbnail");

    if (!(video instanceof Blob)) {
      return NextResponse.json({ error: "動画がありません" }, { status: 400 });
    }

    const gradeStr = typeof grade === "string" && grade ? grade : undefined;

    const feedback = await analyzeVideoWithGemini(video, gradeStr);

    // 記録に保存（サムネはクライアントから受け取った先頭コマ）
    await prisma.analysis.create({
      data: {
        grade: gradeStr ?? null,
        summary: feedback.summary,
        prescription: feedback.prescription,
        thumbnail: typeof thumbnail === "string" ? thumbnail : null,
        scores: feedback.scores ?? undefined,
      },
    });

    return NextResponse.json(feedback);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "動画解析中にエラーが発生しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
