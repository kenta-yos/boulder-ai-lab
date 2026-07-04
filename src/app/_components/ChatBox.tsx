"use client";

// 解析結果を文脈に持ったまま深掘りするチャット。
import { useState } from "react";
import type { Feedback } from "../_lib/analyze";
import type { ChatTurn } from "../_lib/chat";

type Props = {
  frames: string[];
  feedback: Feedback;
  grade?: string;
};

export function ChatBox({ frames, feedback, grade }: Props) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function send() {
    const text = input.trim();
    if (!text || sending) return;

    const userTurn: ChatTurn = { role: "user", content: text };
    const nextTurns = [...turns, userTurn];
    setTurns(nextTurns);
    setInput("");
    setError("");
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frames, feedback, grade, messages: nextTurns }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "返答を受け取れませんでした");
      setTurns((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "送信に失敗しました");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-8">
      <p className="mb-2 text-sm font-semibold">深掘りチャット</p>
      <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
        この解析について質問できます（例：「なぜ腰が離れていた？」）
      </p>

      {/* 会話 */}
      {turns.length > 0 && (
        <div className="mb-3 space-y-3">
          {turns.map((t, i) => (
            <div
              key={i}
              className={t.role === "user" ? "text-right" : "text-left"}
            >
              <span
                className={
                  "inline-block max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-6 " +
                  (t.role === "user"
                    ? "bg-foreground text-background"
                    : "bg-black/5 dark:bg-white/10")
                }
              >
                {t.content}
              </span>
            </div>
          ))}
          {sending && (
            <p className="text-left text-sm text-zinc-500">コーチが考えています…</p>
          )}
        </div>
      )}

      {error && (
        <p className="mb-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* 入力 */}
      <div className="flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            // かな漢字変換の確定(Enter)では送信しない。Shift+Enterは改行。
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          placeholder="質問を入力…"
          disabled={sending}
          className="min-w-0 flex-1 resize-none rounded-2xl border border-black/15 bg-transparent px-4 py-2 text-base leading-6 dark:border-white/20"
        />
        <button
          type="button"
          onClick={send}
          disabled={sending || !input.trim()}
          className="shrink-0 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          送信
        </button>
      </div>
    </div>
  );
}
