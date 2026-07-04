// Claude(Opus 4.8) を使って「敗因＋処方」を生成する実装。
// サーバー側でだけ動く（APIキーを使うため、ブラウザには出さない）。
import Anthropic from "@anthropic-ai/sdk";
import type { Analyzer } from "./analyze";

// 使うモデル。より安く抑えたいときはここを "claude-haiku-4-5" などに変えるだけ。
const MODEL = "claude-opus-4-8";

// コーチとしての振る舞いを決める指示（システムプロンプト）
const SYSTEM = `あなたはボルダリングの経験豊富なコーチです。
1回のトライを時系列に並べた数枚の静止画（動画から抜き出したコマ）を見て、日本語で講評します。

出力は次の2点だけに絞ってください。休憩中に数秒で読める密度にします。
- summary（敗因）：なぜ落ちた/停滞したと考えられるか。最も重要な原因を1〜2点、具体的に。
- prescription（処方）：次のトライでどう変えれば成功に近づくか。具体的な体の使い方で。

指摘は次の技術軸の言葉を使って具体的にしてください：フットワーク / ボディテンション(支持) / 重心・バランス / 腰の位置 / 保持 / 力の方向 / ムーブ効率 / ダイナミクス。

重要な前提：
- 今は静止画のみで、数値計測はありません。断定しすぎず、画像から読み取れる範囲で述べてください。
- グレードが与えられたら、その難度の理想を基準に評価してください。
- 専門用語には一言の補足を添えてください。`;

export const analyzeWithClaude: Analyzer = async (input) => {
  const client = new Anthropic(); // 環境変数 ANTHROPIC_API_KEY を自動で読む

  // コマ画像を Claude に渡せる形（base64）に変換する
  const imageBlocks = input.frames.map((dataUrl) => {
    // "data:image/jpeg;base64,XXXX" の XXXX の部分だけ取り出す
    const base64 = dataUrl.split(",")[1] ?? "";
    return {
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: "image/jpeg" as const,
        data: base64,
      },
    };
  });

  // 文脈（ジム・グレード・メモ）をテキストにまとめる
  const context: string[] = [];
  if (input.gym) context.push(`ジム: ${input.gym}`);
  if (input.grade) context.push(`グレード: ${input.grade}`);
  if (input.note) context.push(`メモ: ${input.note}`);

  const userText =
    `これは1回のボルダリングのトライを時系列に並べた静止画です（左上から時間順）。` +
    `敗因と処方を出してください。` +
    (context.length ? `\n\n${context.join("\n")}` : "");

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [...imageBlocks, { type: "text", text: userText }],
      },
    ],
    // 出力を必ず {summary, prescription} の形に固定する（構造化出力）
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            summary: { type: "string", description: "敗因：なぜ落ちたか" },
            prescription: {
              type: "string",
              description: "処方：どうすれば成功するか",
            },
          },
          required: ["summary", "prescription"],
          additionalProperties: false,
        },
      },
    },
  });

  // 返ってきたテキスト（JSON）を取り出して解釈する
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("解析結果を受け取れませんでした");
  }
  const parsed = JSON.parse(textBlock.text) as Feedbackish;
  return {
    summary: parsed.summary ?? "",
    prescription: parsed.prescription ?? "",
  };
};

type Feedbackish = { summary?: string; prescription?: string };
