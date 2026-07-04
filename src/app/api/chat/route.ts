// 深掘りチャットの窓口（サーバー側）。
import { NextResponse } from "next/server";
import { chatWithClaude } from "@/app/_lib/chatWithClaude";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const frames = body?.frames;
    const feedback = body?.feedback;
    const messages = body?.messages;

    if (!Array.isArray(frames) || frames.length === 0) {
      return NextResponse.json({ error: "コマ画像がありません" }, { status: 400 });
    }
    if (!feedback || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "会話の情報が不足しています" }, { status: 400 });
    }

    const reply = await chatWithClaude({
      frames,
      feedback,
      grade: body?.grade,
      messages,
    });

    return NextResponse.json({ reply });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "チャット中にエラーが発生しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
