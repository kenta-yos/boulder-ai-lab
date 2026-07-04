// 統合パイプライン（SPEC本来の分業）：
//   Gemini が動画を読んで「動きメモ（秒数つき）」を作る
//   → Claude がそのメモ＋静止画＋知識ベースで「敗因・処方・8軸スコア・秒数つき指摘」を仕上げる
// サーバー側でだけ動く。
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import type { Feedback } from "./analyze";
import { SKILLS } from "./analyze";
import { HANDBOOK } from "./handbook";

const CLAUDE_MODEL = "claude-opus-4-8";
const GEMINI_MODEL = "gemini-2.5-flash";

// ---- 1) Gemini：動画を読んで客観的な「動きメモ（秒数つき）」を作る ----
async function readVideoNotes(video: Blob, grade?: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const uploaded = await ai.files.upload({
    file: video,
    config: { mimeType: video.type || "video/mp4" },
  });
  let file = await ai.files.get({ name: uploaded.name ?? "" });
  const start = Date.now();
  while (file.state === "PROCESSING") {
    if (Date.now() - start > 180000) throw new Error("動画の処理がタイムアウトしました");
    await new Promise((r) => setTimeout(r, 2000));
    file = await ai.files.get({ name: uploaded.name ?? "" });
  }
  if (file.state !== "ACTIVE" || !file.uri) {
    throw new Error("動画の処理に失敗しました");
  }

  const prompt =
    "この動画は1回のボルダリングのトライです。後でコーチが敗因を診断できるよう、" +
    "起きたことを時系列で客観的に記述してください。\n" +
    "- 各局面に秒数を必ず付ける（例：0:04, 0:12）。\n" +
    "- 体の使い方を淡々と：腕（曲げ/伸ばし）、脚の押し、腰と壁の距離、重心が足に乗っているか、足の置き、動きの速さ・ためらい・タイミング。\n" +
    "- どこで崩れた/止まった/落ちたかを秒数つきで。\n" +
    "- ここでは講評・助言は書かない（観察のみ）。\n" +
    "- 左右は取り違えやすいので、自信が無ければホールドの色・位置・上下で述べる。" +
    (grade ? `\n- グレード: ${grade}` : "");

  const res = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { fileData: { fileUri: file.uri, mimeType: file.mimeType } },
          { text: prompt },
        ],
      },
    ],
  });
  return res.text ?? "";
}

// ---- 2) Claude：知識ベース＋静止画＋動きメモ で仕上げる ----
const COACH_SYSTEM = `${HANDBOOK}

---
あなたは上の知識ベースを持つボルダリングのコーチです。次の材料から日本語で講評します：
- 静止画（時系列のコマ。あなた自身の目で確認する材料）
- Geminiが動画を読んだ客観メモ（秒数つき。動きの流れ・タイミングの補完）
- グレード（あれば）

出力（JSON）：
- summary（敗因）：最も効く根本原因を1〜2点、上の知識ベースの技術名・合図で具体的に。
- prescription（処方）：その原因に直結する具体行動（体のどこを・どの順で・どう動かすか）。
- scores（技術8軸）：8軸すべてに0〜100（このグレードの理想を100とする相対評価）と一言の根拠(evidence)。読み取れない軸は50前後・低信頼として控えめに。
- findings（秒数つき指摘）：崩れた/改善したい瞬間を、動きメモの秒数を使って tSec（秒・数値）と comment（短い指摘）で2〜5個。関連軸があれば skill も。

ルール：一般論で終わらせない（必ず技術名・合図で語る）。読み取れない点は低信頼と明示し断定しない。左右は向きを見極め体基準で、自信が無ければホールドの色・位置・上下で。強調記号(**,#)は使わずプレーンな日本語で。`;

async function coach(
  frames: string[],
  notes: string,
  grade?: string,
): Promise<Feedback> {
  const client = new Anthropic();

  const imageBlocks = frames.map((dataUrl) => ({
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: "image/jpeg" as const,
      data: dataUrl.split(",")[1] ?? "",
    },
  }));

  const userText =
    "上は1回のトライの時系列コマです。\n\n" +
    "【Geminiの動画メモ（秒数つき・観察）】\n" +
    (notes || "（メモなし）") +
    (grade ? `\n\nグレード: ${grade}` : "") +
    "\n\n知識ベースに基づき、敗因・処方・8軸スコア・秒数つき指摘を出してください。";

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2000,
    // 知識ベースを含むシステムはキャッシュして毎回の費用を抑える
    system: [
      {
        type: "text",
        text: COACH_SYSTEM,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: [...imageBlocks, { type: "text", text: userText }],
      },
    ],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            prescription: { type: "string" },
            scores: {
              type: "array",
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
            findings: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  tSec: { type: "number" },
                  comment: { type: "string" },
                  skill: { type: "string" },
                },
                required: ["tSec", "comment"],
                additionalProperties: false,
              },
            },
          },
          required: ["summary", "prescription", "scores", "findings"],
          additionalProperties: false,
        },
      },
    },
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("解析結果を受け取れませんでした");
  }
  const parsed = JSON.parse(textBlock.text) as Feedback;
  return {
    summary: parsed.summary ?? "",
    prescription: parsed.prescription ?? "",
    scores: parsed.scores ?? [],
    findings: parsed.findings ?? [],
  };
}

// ---- 3) 統合：Gemini動画メモ → Claude仕上げ ----
export async function analyzeIntegrated(input: {
  video: Blob;
  frames: string[];
  grade?: string;
}): Promise<Feedback> {
  const notes = await readVideoNotes(input.video, input.grade);
  return coach(input.frames, notes, input.grade);
}
