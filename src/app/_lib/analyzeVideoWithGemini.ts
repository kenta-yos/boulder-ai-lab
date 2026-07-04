// Gemini に「動画そのもの」を読ませて敗因＋処方を出す実装。
// サーバー側でだけ動く（APIキーを使うため）。
// 動画は Gemini の File API にアップロードしてから読ませる。
import { GoogleGenAI, Type } from "@google/genai";
import type { Feedback } from "./analyze";

const MODEL = "gemini-2.5-flash";

const SYSTEM = `あなたはボルダリングの経験豊富なコーチです。
1回のトライを撮った動画を見て、動きの流れ・タイミング・体の使い方を踏まえ、日本語で講評します。

出力は次の2点だけに絞ってください。休憩中に数秒で読める密度にします。
- summary（敗因）：なぜ落ちた/停滞したと考えられるか。最も重要な原因を1〜2点、具体的に。
- prescription（処方）：次のトライでどう変えれば成功に近づくか。具体的な体の使い方で。

技術軸の言葉（フットワーク/ボディテンション/重心・バランス/腰の位置/保持/力の方向/ムーブ効率/ダイナミクス）を使い、専門用語には一言添えてください。
静止画ではなく動画なので、動きの速さ・ためらい・タイミングにも触れてください。
左右（右手/左手・右足/左足）は映像から取り違えやすいので注意してください。まず登り手がカメラに対して後ろ向き（背中側）か前向きかを見極め、左右は必ず登り手自身の体を基準に述べてください（見る人から見た左右ではありません）。向きに自信が持てないときは左右の断定を避け、ホールドの色や位置、壁側/外側の手足、上/下の手足など取り違えにくい言い方で指摘してください。
強調に ** や # などの記号（マークダウン）は使わず、プレーンな日本語の文章で書いてください。`;

export async function analyzeVideoWithGemini(
  video: Blob,
  grade?: string,
): Promise<Feedback> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // 1) 動画を Gemini にアップロード
  const uploaded = await ai.files.upload({
    file: video,
    config: { mimeType: video.type || "video/mp4" },
  });

  // 2) 処理が終わる（ACTIVE になる）まで待つ
  let file = await ai.files.get({ name: uploaded.name ?? "" });
  const start = Date.now();
  while (file.state === "PROCESSING") {
    if (Date.now() - start > 180000) {
      throw new Error("動画の処理がタイムアウトしました");
    }
    await new Promise((r) => setTimeout(r, 2000));
    file = await ai.files.get({ name: uploaded.name ?? "" });
  }
  if (file.state !== "ACTIVE" || !file.uri) {
    throw new Error("動画の処理に失敗しました");
  }

  // 3) 動画＋指示を渡して敗因・処方を生成（JSONで固定）
  const promptText =
    "この動画は1回のボルダリングのトライです。敗因と処方を出してください。" +
    (grade ? `\nグレード: ${grade}` : "");

  const res = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { fileData: { fileUri: file.uri, mimeType: file.mimeType } },
          { text: promptText },
        ],
      },
    ],
    config: {
      systemInstruction: SYSTEM,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          prescription: { type: Type.STRING },
        },
        required: ["summary", "prescription"],
      },
    },
  });

  const text = res.text ?? "";
  const parsed = JSON.parse(text) as {
    summary?: string;
    prescription?: string;
  };
  return {
    summary: parsed.summary ?? "",
    prescription: parsed.prescription ?? "",
  };
}
