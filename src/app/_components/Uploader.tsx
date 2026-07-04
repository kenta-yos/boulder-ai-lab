"use client";

// 動画を選び→ブラウザでコマ抽出→AIに解析させ→敗因＋処方を表示する。
import { useEffect, useState } from "react";
import { extractFrames } from "../_lib/extractFrames";
import type { Feedback } from "../_lib/analyze";
import { ChatBox } from "./ChatBox";

type Status = "idle" | "working" | "done" | "error";

export function Uploader() {
  // コマ抽出まわり
  const [extractStatus, setExtractStatus] = useState<Status>("idle");
  const [frames, setFrames] = useState<string[]>([]);
  const [extractError, setExtractError] = useState("");
  const [progress, setProgress] = useState("");
  // 入力（任意）
  const [grade, setGrade] = useState("");
  // AI解析まわり
  const [analyzeStatus, setAnalyzeStatus] = useState<Status>("idle");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [analyzeError, setAnalyzeError] = useState("");

  const busy = extractStatus === "working" || analyzeStatus === "working";

  // 処理中は背景スクロールをロック（誤操作で中断しないため）
  useEffect(() => {
    if (busy) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [busy]);

  async function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // 新しい動画を選んだら、前回の結果を消す
    setFrames([]);
    setExtractError("");
    setFeedback(null);
    setAnalyzeError("");
    setAnalyzeStatus("idle");
    setProgress("準備中…");
    setExtractStatus("working");

    try {
      const result = await extractFrames(file, (msg) => setProgress(msg));
      setFrames(result);
      setExtractStatus("done");
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : "コマ抽出に失敗しました");
      setExtractStatus("error");
    } finally {
      e.target.value = ""; // 同じ動画を選び直せるようにリセット
    }
  }

  async function onAnalyze() {
    setAnalyzeError("");
    setFeedback(null);
    setAnalyzeStatus("working");
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frames, grade: grade || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "解析に失敗しました");
      setFeedback({ summary: data.summary, prescription: data.prescription });
      setAnalyzeStatus("done");
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "解析に失敗しました");
      setAnalyzeStatus("error");
    }
  }

  return (
    <div>
      {/* グレード入力（任意） */}
      <label className="mb-4 block">
        <span className="mb-1 block text-sm text-zinc-600 dark:text-zinc-300">
          グレード（任意・例：3級）
        </span>
        <input
          type="text"
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          placeholder="未入力でもOK"
          className="w-full max-w-xs rounded-lg border border-black/15 bg-transparent px-3 py-2 text-base dark:border-white/20"
        />
      </label>

      {/* 動画を選ぶボタン */}
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90">
        動画を選ぶ
        <input
          type="file"
          accept="video/*"
          className="hidden"
          onChange={onSelect}
        />
      </label>

      {/* コマ抽出のエラー */}
      {extractStatus === "error" && extractError && (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">
          {extractError}
        </p>
      )}

      {/* 切り出したコマ */}
      {extractStatus === "done" && frames.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-300">
            切り出したコマ（{frames.length}枚）
          </p>
          <div className="grid grid-cols-3 gap-2">
            {frames.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={src}
                alt={`コマ ${i + 1}`}
                className="w-full rounded-lg border border-black/10 dark:border-white/15"
              />
            ))}
          </div>

          {/* AIに解析してもらうボタン */}
          <button
            type="button"
            onClick={onAnalyze}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            AIに解析してもらう
          </button>
        </div>
      )}

      {/* AI解析のエラー */}
      {analyzeStatus === "error" && analyzeError && (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">
          {analyzeError}
        </p>
      )}

      {/* 解析結果（敗因＋処方） */}
      {analyzeStatus === "done" && feedback && (
        <div className="mt-8 space-y-4">
          <div className="rounded-xl border border-black/10 p-4 dark:border-white/15">
            <p className="mb-1 text-xs font-semibold text-red-600 dark:text-red-400">
              敗因（なぜ落ちたか）
            </p>
            <p className="whitespace-pre-wrap leading-7">{feedback.summary}</p>
          </div>
          <div className="rounded-xl border border-black/10 p-4 dark:border-white/15">
            <p className="mb-1 text-xs font-semibold text-green-700 dark:text-green-400">
              処方（どうすれば成功するか）
            </p>
            <p className="whitespace-pre-wrap leading-7">
              {feedback.prescription}
            </p>
          </div>

          {/* 深掘りチャット */}
          <ChatBox frames={frames} feedback={feedback} grade={grade || undefined} />
        </div>
      )}

      {/* 処理中の覆い（全画面・操作をブロック） */}
      {busy && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/70 px-8 text-center text-white backdrop-blur-sm"
          aria-live="polite"
        >
          <div className="h-11 w-11 animate-spin rounded-full border-4 border-white/30 border-t-white" />
          {extractStatus === "working" ? (
            <>
              <p className="text-base font-medium">コマを切り出しています…</p>
              <p className="text-sm text-white/80">{progress}</p>
            </>
          ) : (
            <>
              <p className="text-base font-medium">AIが解析しています…</p>
              <p className="text-sm text-white/80">
                20秒ほどかかることがあります
              </p>
            </>
          )}
          <p className="text-xs text-white/60">
            そのままお待ちください（画面を触らないでください）
          </p>
        </div>
      )}
    </div>
  );
}
