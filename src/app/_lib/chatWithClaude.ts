// Claude(Opus 4.8) を使って、解析結果を文脈に持ったまま深掘りチャットに答える。
// サーバー側でだけ動く（APIキーを使うため）。
import Anthropic from "@anthropic-ai/sdk";
import type { Chatter } from "./chat";

const MODEL = "claude-opus-4-8";

const SYSTEM = `あなたはボルダリングの経験豊富なコーチです。
ユーザーの1回のトライ（時系列の静止画）を既に解析し、敗因と処方を伝えました。
これからユーザーの深掘りの質問に、日本語で会話形式で答えます。

- 画像に写るその登りに即して、具体的に答えてください。
- 技術軸の言葉（フットワーク/ボディテンション/重心・バランス/腰の位置/保持/力の方向/ムーブ効率/ダイナミクス）を使い、専門用語には一言添えてください。
- 返答は簡潔に。休憩中に読める長さにします。
- 静止画のみで数値計測はない前提。断定しすぎないでください。
- 左右は取り違えやすい。登り手の向き（後ろ向き/前向き）を見極め、左右は登り手自身の体基準で。自信が無ければ上下(高さ)・壁側/外側など取り違えにくい言い方に。ホールドの色で指し示さない（壁に別課題のホールドが多色で混在し当てにならない。1課題は基本同じ色）。
- 強調に ** や # などの記号（マークダウン）は使わず、プレーンな日本語の文章で書いてください。`;

export const chatWithClaude: Chatter = async (input) => {
  const client = new Anthropic();

  // コマ画像を base64 に変換
  const imageBlocks = input.frames.map((dataUrl) => ({
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: "image/jpeg" as const,
      data: dataUrl.split(",")[1] ?? "",
    },
  }));

  const contextText =
    `上の画像がこの登りです。` +
    (input.grade ? `\nグレード: ${input.grade}` : "") +
    `\n\nこれまでの解析:\n【敗因】${input.feedback.summary}\n【処方】${input.feedback.prescription}\n\n` +
    `以降の私の質問に、この登りに即して答えてください。`;

  // 会話の土台：画像＋文脈を1回だけ置く。
  // 画像ブロックにキャッシュ印を付け、会話が続いても画像の再計算費用を抑える。
  const primingUser = {
    role: "user" as const,
    content: [
      ...imageBlocks.slice(0, -1),
      ...(imageBlocks.length > 0
        ? [
            {
              ...imageBlocks[imageBlocks.length - 1],
              cache_control: { type: "ephemeral" as const },
            },
          ]
        : []),
      { type: "text" as const, text: contextText },
    ],
  };
  const primingAssistant = {
    role: "assistant" as const,
    content: "わかりました。この登りについて、何でも聞いてください。",
  };

  // これまでの会話を続ける
  const convo = input.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1000,
    system: SYSTEM,
    messages: [primingUser, primingAssistant, ...convo],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("返答を受け取れませんでした");
  }
  return textBlock.text;
};
