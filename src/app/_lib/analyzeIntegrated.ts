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
async function readVideoNotes(
  video: Blob,
  grade?: string,
  holdColor?: string,
  wallAngle?: string,
  userNote?: string,
): Promise<string> {
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
    "- 体の使い方を淡々と。次の点を「良し悪しや技術の正否は判断せず、見えた事実だけ」報告する（助言・講評はしない）：\n" +
    "  ・壁と体の距離：腰や胸が壁に近いか離れたか。腰が離れて腕が伸び切っていないか。\n" +
    "  ・荷重：体重が足に乗っているか腕にぶら下がっているか。腰が支持している足の真上か外側か。\n" +
    "  ・足：足元を見て置いたか／置き直したか／滑ったか。つま先（母指球）で乗ったか面で乗ったか。ヒールやトウを掛けたか。足が壁から切れたか。足を乗せた後に体が壁側へ寄った・上がったか。つま先の向きやカカトを内／外へ回したか。\n" +
    "  ・体のひねり・回転：体をひねって（旋回して）引いたか、正対のまま腕で引いたか。体が回って外へ振られたか。空いている脚を反対側へ伸ばしたか。膝を内へ落としたか。\n" +
    "  ・腕：伸ばして支えたか、曲げたまま保持し続けたか（その時間の長さ）。\n" +
    "  ・保持：持ち替え／持ち直し／もう一方の手を添えたか。片手を離せずにいる場面はどこか。\n" +
    "  ・動きの質：一手ずつ静的か、反動（腰を沈める→スウィング）を使ったか、跳んだか。取りに行くのが早い／遅い／ためらいがあるか。動きが途切れたか連続したか。\n" +
    "- どこで崩れた/止まった/落ちたかを秒数つきで。\n" +
    "- ここでは講評・助言は書かない（観察のみ）。\n" +
    "- 左右は取り違えやすいので、自信が無ければ体基準の左右・上下(高さ)・壁側/外側で述べる（色では述べない）。\n" +
    "- ホールドの色で指し示さないこと。壁には別課題のホールドが多色で混在し当てにならない。1課題は基本同じ色なので、複数の色に言及して登りを説明しない。" +
    (holdColor
      ? `\n- この課題の対象ホールドの色は「${holdColor}」。登り手が使うのはこの色のホールドだけ。他の色のホールドは別課題なので言及しない。`
      : "") +
    (wallAngle
      ? `\n- この壁の傾斜は「${wallAngle}」。それを踏まえて動きを観察する。`
      : "") +
    (userNote
      ? `\n- 登り手本人のメモ（落ちた場所・感触など）：「${userNote}」。この局面を特に丁寧に観察する。ただし鵜呑みにせず、実際の映像で確かめる。`
      : "") +
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
- 登り手のこれまでの傾向（あれば。弱い軸・改善/低下。あくまで背景情報）

出力（JSON）：
- summary（敗因）：根本原因を重要な順に。複数あれば複数挙げる（目安1〜3点、最重要を先頭に）。各点は改行で分け、上の知識ベースの技術名・合図で具体的に。休憩中に数秒で読める簡潔さを保つ。
- prescription（処方）：各敗因に対応する具体行動を、対応する順に（体のどこを・どの順で・どう動かすか）。最優先の1手が分かるよう先頭に置き、各手は改行で分ける。
- scores（技術8軸）：8軸すべてに0〜100（このグレードの理想を100とする相対評価）と一言の根拠(evidence)。読み取れない軸は50前後・低信頼として控えめに。
- findings（秒数つき指摘）：崩れた/改善したい瞬間を、動きメモの秒数を使って tSec（秒・数値）と comment（短い指摘）で2〜5個。関連軸があれば skill も。
- trendNote（傾向からの一言）：傾向情報が与えられた時だけ書く。1〜2文。該当が無ければ空文字。

傾向の使い方（重要）：今回の映像診断が主役。傾向は次の3つの時だけ使う。(1)今回も同じ弱点が映像に出ていれば「〜が続いている」と優先順位の根拠にする。(2)以前の弱点が今回は改善していれば前進として認める。(3)同じ弱点が続くなら、前回と同じ助言の繰り返しでなく次の段階のドリル/意識に進める。今回の映像に出ていない過去の弱点を無理に持ち出さない。傾向が無い/該当しなければ trendNote は空文字にする。

ルール：一般論で終わらせない（必ず技術名・合図で語る）。読み取れない点は低信頼と明示し断定しない。左右は向きを見極め体基準で、自信が無ければ上下(高さ)・壁側/外側で（色では述べない）。ホールドの色で指し示さないこと（壁には別課題のホールドが多色で混在し当てにならない。1課題は基本同じ色なので複数の色に言及して登りを説明しない）。強調記号(**,#)は使わずプレーンな日本語で。`;

async function coach(
  frames: string[],
  notes: string,
  grade?: string,
  holdColor?: string,
  wallAngle?: string,
  userNote?: string,
  trend?: string,
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
    (holdColor
      ? `\n課題の色: ${holdColor}（対象はこの色のホールドのみ。他の色のホールドは別課題なので言及しない）`
      : "") +
    (wallAngle
      ? `\n壁の傾斜: ${wallAngle}（この傾斜に合った技術を優先して診断する。例：強傾斜・ルーフはボディテンションと腰寄せ、スラブ・垂壁はフットワークと重心）`
      : "") +
    (userNote
      ? `\n登り手のメモ: ${userNote}（本人が感じた落ちた場所・難所。ここを最優先で診断する。ただし原因の解釈は自分で映像から判断し、メモと食い違えば映像を優先してその旨断る）`
      : "") +
    (trend
      ? `\n登り手のこれまでの傾向: ${trend}（背景情報。今回の映像診断を最優先に。今回も出た弱点の優先付け／改善の承認／次の一手にだけ使い、今回出ていない弱点は持ち出さない。該当が無ければ trendNote は空文字）`
      : "") +
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
            trendNote: { type: "string" },
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
    trendNote: parsed.trendNote ?? "",
  };
}

// ---- 3) 統合：Gemini動画メモ → Claude仕上げ ----
export async function analyzeIntegrated(input: {
  video: Blob;
  frames: string[];
  grade?: string;
  holdColor?: string;
  wallAngle?: string;
  note?: string;
  trend?: string;
}): Promise<Feedback> {
  const notes = await readVideoNotes(
    input.video,
    input.grade,
    input.holdColor,
    input.wallAngle,
    input.note,
  );
  const feedback = await coach(
    input.frames,
    notes,
    input.grade,
    input.holdColor,
    input.wallAngle,
    input.note,
    input.trend,
  );
  // AIがどう動きを読んだか（観察メモ）を結果に添える。理解の確認・フィードバック用。
  return { ...feedback, videoNotes: notes };
}
