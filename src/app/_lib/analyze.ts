// 解析の共通インターフェース（SPEC 3.7）。
// 「入力(コマ画像＋文脈) → 出力(敗因＋処方)」を1枚の形に固定し、
// 中身の実装（今はClaude、将来はGemini）を差し替えられるようにする。

// 解析に渡す入力
export type AnalyzeInput = {
  frames: string[]; // コマ画像（data URL の配列。時系列順）
  grade?: string; // グレード（任意）
  gym?: string; // ジム名（任意）
  note?: string; // メモ・落ちた箇所など（任意）
};

// 採点する技術8軸（SPEC 6.1）
export const SKILLS = [
  "フットワーク",
  "ボディテンション",
  "重心・バランス",
  "腰の位置",
  "保持",
  "力の方向",
  "ムーブ効率",
  "ダイナミクス",
] as const;

// 1つの技術軸のスコア
export type SkillScore = {
  skill: string; // 技術軸名（SKILLSのいずれか）
  score: number; // 0〜100
  evidence: string; // 一言の根拠
};

// 秒数つきの指摘（タップで動画のその瞬間へジャンプする）
export type Finding = {
  tSec: number; // 動画内の秒数
  comment: string; // その瞬間の指摘
  skill?: string; // 関連する技術軸（任意）
};

// 解析の出力（アプリの顔＝②画面に出す）
export type Feedback = {
  summary: string; // 敗因：なぜ落ちたか
  prescription: string; // 処方：どうすれば成功するか
  scores?: SkillScore[]; // 技術8軸のスコア
  findings?: Finding[]; // 秒数つきの指摘
};

// 差し替え可能な解析関数の型
export type Analyzer = (input: AnalyzeInput) => Promise<Feedback>;
