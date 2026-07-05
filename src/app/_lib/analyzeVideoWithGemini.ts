// Gemini に「動画そのもの」を読ませて敗因＋処方を出す実装。
// サーバー側でだけ動く（APIキーを使うため）。
// 動画は Gemini の File API にアップロードしてから読ませる。
import { GoogleGenAI, Type } from "@google/genai";
import type { Feedback } from "./analyze";
import { SKILLS } from "./analyze";

const MODEL = "gemini-2.5-flash";

const SYSTEM = `あなたはボルダリングの経験豊富なコーチです。
1回のトライを撮った動画を見て、動きの流れ・タイミング・体の使い方を踏まえ、日本語で講評します。

出力は次を返してください。summary/prescriptionは休憩中に数秒で読める密度にします。
- summary（敗因）：なぜ落ちた/停滞したと考えられるか。原因を重要な順に、複数あれば複数（目安1〜3点、最重要を先頭に・各点改行）具体的に。
- prescription（処方）：次のトライでどう変えれば成功に近づくか。具体的な体の使い方で。
- scores（技術8軸の採点）：8軸すべてについて、0〜100の点数(このグレードの理想を100とする相対評価)と、一言の根拠(evidence)。読み取れない軸は50前後・低信頼として控えめに。

技術軸の言葉（フットワーク/ボディテンション/重心・バランス/腰の位置/保持/力の方向/ムーブ効率/ダイナミクス）を使い、専門用語には一言添えてください。
静止画ではなく動画なので、動きの速さ・ためらい・タイミングにも触れてください。
左右（右手/左手・右足/左足）は映像から取り違えやすいので注意してください。まず登り手がカメラに対して後ろ向き（背中側）か前向きかを見極め、左右は必ず登り手自身の体を基準に述べてください（見る人から見た左右ではありません）。向きに自信が持てないときは左右の断定を避け、壁側/外側の手足、上/下の手足、位置など取り違えにくい言い方で指摘してください。ホールドの色でホールドを指し示さないでください（壁には別課題のホールドが多色で混在し当てになりません。1つの課題は基本的に同じ色です）。
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
          scores: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                skill: { type: Type.STRING, enum: [...SKILLS] },
                score: { type: Type.INTEGER },
                evidence: { type: Type.STRING },
              },
              required: ["skill", "score", "evidence"],
            },
          },
        },
        required: ["summary", "prescription", "scores"],
      },
    },
  });

  const text = res.text ?? "";
  const parsed = JSON.parse(text) as {
    summary?: string;
    prescription?: string;
    scores?: { skill: string; score: number; evidence: string }[];
  };
  return {
    summary: parsed.summary ?? "",
    prescription: parsed.prescription ?? "",
    scores: parsed.scores ?? [],
  };
}
