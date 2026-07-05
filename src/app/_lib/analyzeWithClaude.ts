// Claude(Opus 4.8) を使って「敗因＋処方」を生成する実装。
// サーバー側でだけ動く（APIキーを使うため、ブラウザには出さない）。
import Anthropic from "@anthropic-ai/sdk";
import type { Analyzer } from "./analyze";
import { SKILLS } from "./analyze";

// 使うモデル。より安く抑えたいときはここを "claude-haiku-4-5" などに変えるだけ。
const MODEL = "claude-opus-4-8";

// コーチとしての振る舞いを決める指示（システムプロンプト）
const SYSTEM = `あなたはボルダリングの経験豊富なコーチです。
1回のトライを時系列に並べた数枚の静止画（動画から抜き出したコマ）を見て、日本語で講評します。

出力は次を返してください。summary/prescriptionは休憩中に数秒で読める密度にします。
- summary（敗因）：なぜ落ちた/停滞したと考えられるか。原因を重要な順に、複数あれば複数（目安1〜3点、最重要を先頭に・各点改行）具体的に。
- prescription（処方）：次のトライでどう変えれば成功に近づくか。具体的な体の使い方で。
- scores（技術8軸の採点）：下の8軸すべてについて、0〜100の点数(このグレードの理想を100とする相対評価)と、一言の根拠(evidence)。読み取れない軸は50前後・低信頼として控えめに。

指摘は次の技術軸の言葉を使って具体的にしてください：フットワーク / ボディテンション(支持) / 重心・バランス / 腰の位置 / 保持 / 力の方向 / ムーブ効率 / ダイナミクス。

重要な前提：
- 今は静止画のみで、数値計測はありません。断定しすぎず、画像から読み取れる範囲で述べてください。
- グレードが与えられたら、その難度の理想を基準に評価してください。
- 専門用語には一言の補足を添えてください。
- 左右（右手/左手・右足/左足）は画像から取り違えやすい。まず登り手がカメラに対して後ろ向き（背中側）か前向きかを見極め、左右は必ず登り手自身の体を基準に述べてください（見る人から見た左右ではありません）。向きに自信が持てないときは左右の断定を避け、壁側/外側の手足、上/下の手足、位置など取り違えにくい言い方で指摘してください。ホールドの色でホールドを指し示さないでください（壁には別課題のホールドが多色で混在し当てになりません。1つの課題は基本的に同じ色です）。
- 強調に ** や # などの記号（マークダウン）は使わず、プレーンな日本語の文章で書いてください。`;

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
    // 出力を必ず {summary, prescription, scores} の形に固定する（構造化出力）
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
            scores: {
              type: "array",
              description: "技術8軸の採点（8軸すべて）",
              items: {
                type: "object",
                properties: {
                  skill: { type: "string", enum: [...SKILLS] },
                  score: { type: "integer" },
                  evidence: { type: "string" },
                },
                required: ["skill", "score", "evidence"],
                additionalProperties: false,
              },
            },
          },
          required: ["summary", "prescription", "scores"],
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
    scores: parsed.scores ?? [],
  };
};

type Feedbackish = {
  summary?: string;
  prescription?: string;
  scores?: { skill: string; score: number; evidence: string }[];
};
