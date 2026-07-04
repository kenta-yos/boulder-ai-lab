"use client";

// 動画を選び、ブラウザでコマを切り出してプレビュー表示する部分。
import { useState } from "react";
import { extractFrames } from "../_lib/extractFrames";

type Status = "idle" | "working" | "done" | "error";

export function Uploader() {
  const [status, setStatus] = useState<Status>("idle");
  const [fileName, setFileName] = useState<string>("");
  const [frames, setFrames] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>("");

  async function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setFrames([]);
    setErrorMsg("");
    setStatus("working");

    try {
      const result = await extractFrames(file, 6);
      setFrames(result);
      setStatus("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "解析に失敗しました");
      setStatus("error");
    }
  }

  return (
    <div>
      {/* 動画を選ぶボタン（中身のinputは隠して、ラベル全体を押せるボタンにする） */}
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90">
        動画を選ぶ
        <input
          type="file"
          accept="video/*"
          className="hidden"
          onChange={onSelect}
        />
      </label>

      {/* 選んだファイル名 */}
      {fileName && (
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          選択中: {fileName}
        </p>
      )}

      {/* 処理中の表示 */}
      {status === "working" && (
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">
          コマを切り出しています…
        </p>
      )}

      {/* エラー表示 */}
      {status === "error" && (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">
          {errorMsg}
        </p>
      )}

      {/* 切り出したコマのプレビュー（3列グリッド） */}
      {frames.length > 0 && (
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
    </div>
  );
}
