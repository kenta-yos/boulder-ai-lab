"use client";

// 動画を選び、ブラウザでコマを切り出してプレビュー表示する部分。
import { useEffect, useState } from "react";
import { extractFrames } from "../_lib/extractFrames";

type Status = "idle" | "working" | "done" | "error";

export function Uploader() {
  const [status, setStatus] = useState<Status>("idle");
  const [frames, setFrames] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>("");
  // 処理中に表示する「今なにをしているか」の一言
  const [progress, setProgress] = useState<string>("");

  // 処理中は背景をスクロールできないようにロックする（誤操作で中断しないため）
  useEffect(() => {
    if (status === "working") {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [status]);

  async function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFrames([]);
    setErrorMsg("");
    setProgress("準備中…");
    setStatus("working");

    try {
      const result = await extractFrames(file, (msg) => setProgress(msg));
      setFrames(result);
      setStatus("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "解析に失敗しました");
      setStatus("error");
    } finally {
      // 同じ動画を選び直せるように選択欄をリセット
      e.target.value = "";
    }
  }

  return (
    <div>
      {/* 動画を選ぶボタン（中のinputは隠し、ラベル全体を押せるボタンにする） */}
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90">
        動画を選ぶ
        <input
          type="file"
          accept="video/*"
          className="hidden"
          onChange={onSelect}
        />
      </label>

      {/* エラー表示 */}
      {status === "error" && errorMsg && (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">{errorMsg}</p>
      )}

      {/* 切り出したコマのプレビュー */}
      {status === "done" && frames.length > 0 && (
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
        </div>
      )}

      {/* 処理中の覆い（全画面・操作をブロック） */}
      {status === "working" && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/70 px-8 text-center text-white backdrop-blur-sm"
          aria-live="polite"
        >
          <div className="h-11 w-11 animate-spin rounded-full border-4 border-white/30 border-t-white" />
          <p className="text-base font-medium">コマを切り出しています…</p>
          <p className="text-sm text-white/80">{progress}</p>
          <p className="text-xs text-white/60">
            そのままお待ちください（画面を触らないでください）
          </p>
        </div>
      )}
    </div>
  );
}
