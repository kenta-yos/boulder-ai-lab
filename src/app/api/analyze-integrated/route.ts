// 統合解析の窓口（サーバー側）。動画＋静止画を受け取る。
import { NextResponse } from "next/server";
import { analyzeIntegrated } from "@/app/_lib/analyzeIntegrated";
import { prisma } from "@/app/_lib/db";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const video = form.get("video");
    const framesRaw = form.get("frames");
    const grade = form.get("grade");
    const thumbnail = form.get("thumbnail");

    if (!(video instanceof Blob)) {
      return NextResponse.json({ error: "動画がありません" }, { status: 400 });
    }
    let frames: string[] = [];
    if (typeof framesRaw === "string") {
      try {
        frames = JSON.parse(framesRaw);
      } catch {
        frames = [];
      }
    }
    if (frames.length === 0) {
      return NextResponse.json({ error: "コマ画像がありません" }, { status: 400 });
    }

    const gradeStr = typeof grade === "string" && grade ? grade : undefined;

    const feedback = await analyzeIntegrated({ video, frames, grade: gradeStr });

    await prisma.analysis.create({
      data: {
        grade: gradeStr ?? null,
        summary: feedback.summary,
        prescription: feedback.prescription,
        thumbnail:
          typeof thumbnail === "string" ? thumbnail : (frames[0] ?? null),
        scores: feedback.scores ?? undefined,
      },
    });

    return NextResponse.json(feedback);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "解析中にエラーが発生しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
