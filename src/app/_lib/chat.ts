// 深掘りチャットの型。解析結果を文脈に持ったまま対話する。
import type { Feedback } from "./analyze";

// 会話の1発言
export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

// チャットに渡す入力
export type ChatInput = {
  frames: string[]; // この登りのコマ画像（data URL）
  feedback: Feedback; // これまでの解析（敗因・処方）
  grade?: string;
  messages: ChatTurn[]; // これまでの会話（最後がユーザーの新しい質問）
};

// 差し替え可能なチャット関数の型
export type Chatter = (input: ChatInput) => Promise<string>;
