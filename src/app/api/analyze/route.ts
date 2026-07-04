// ブラウザ ⇄ Claude の窓口（サーバー側）。
// ブラウザから「コマ画像＋文脈」を受け取り、Claudeで解析して結果を返す。
import { NextResponse } from "next/server";
import { analyzeWithClaude } from "@/app/_lib/analyzeWithClaude";

// Node.jsランタイムで動かす（SDKに必要）。最大60秒まで許可。
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const frames = body?.frames;

    if (!Array.isArray(frames) || frames.length === 0) {
      return NextResponse.json(
        { error: "コマ画像がありません" },
        { status: 400 },
      );
    }

    const feedback = await analyzeWithClaude({
      frames,
      grade: body?.grade,
      gym: body?.gym,
      note: body?.note,
    });

    return NextResponse.json(feedback);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "解析中にエラーが発生しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
