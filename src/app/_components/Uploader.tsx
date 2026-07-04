"use client";

// 動画を選び、ブラウザでコマを切り出してプレビュー表示する部分。
import { useEffect, useState } from "react";
import { extractFrames } from "../_lib/extractFrames";

type Status = "idle" | "working" | "done" | "error";

export function Uploader() {
  const [status, setStatus] = useState<Status>("idle");
  const [frames, setFrames] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [logs, setLogs] = useState<string[]>([]);
  // プログラム(JavaScript)がこの端末で起動しているかの目印。
  // 起動していれば true になり「準備OK」が表示される。
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  function addLog(line: string) {
    setLogs((prev) => [...prev, line]);
  }

  async function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    setLogs(["① ファイル選択を受け取りました"]);
    setFrames([]);
    setErrorMsg("");
    setStatus("working");

    const file = e.target.files?.[0];
    if (!file) {
      addLog("⚠ ファイルが空でした（選択キャンセルの可能性）");
      setStatus("error");
      setErrorMsg("動画が選ばれませんでした。もう一度お試しください。");
      return;
    }

    addLog(
      `② ファイル情報: 名前=${file.name} / 種類=${file.type || "不明"} / サイズ=${(
        file.size /
        (1024 * 1024)
      ).toFixed(1)}MB`,
    );

    try {
      const result = await extractFrames(file, 6, addLog);
      setFrames(result);
      setStatus("done");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "解析に失敗しました";
      addLog(`✕ エラー: ${msg}`);
      setErrorMsg(msg);
      setStatus("error");
    }
  }

  return (
    <div>
      {/* バージョン印と、プログラム起動の目印 */}
      <p className="mb-3 text-xs text-zinc-400">
        診断版 v3 —{" "}
        {mounted ? (
          <span className="text-green-600 dark:text-green-400">
            準備OK（動画を選べます）
          </span>
        ) : (
          <span>読み込み中…（この表示のままなら知らせてください）</span>
        )}
      </p>

      {/* 動画選択欄（今回は隠さず、普通の選択ボタンにする） */}
      <input
        type="file"
        accept="video/*"
        onChange={onSelect}
        className="block text-sm file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-foreground file:px-5 file:py-2.5 file:text-sm file:font-medium file:text-background"
      />

      {/* 診断ログ */}
      {logs.length > 0 && (
        <div className="mt-4 rounded-lg bg-black/5 p-3 text-xs leading-6 text-zinc-700 dark:bg-white/10 dark:text-zinc-200">
          {logs.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}

      {/* エラー表示 */}
      {status === "error" && errorMsg && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{errorMsg}</p>
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
