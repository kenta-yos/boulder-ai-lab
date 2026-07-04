"use client";

// 動画を選び→ブラウザでコマ抽出→動画プレーヤー＋コマタップで該当秒へジャンプ→AI解析→敗因＋処方→チャット。
import { useEffect, useRef, useState } from "react";
import { extractFrames } from "../_lib/extractFrames";
import type { Feedback } from "../_lib/analyze";
import { ChatBox } from "./ChatBox";
import { ScoreBars } from "./ScoreBars";

type Status = "idle" | "working" | "done" | "error";

// 秒 → m:ss 表記
function formatTime(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function Uploader() {
  // コマ抽出まわり
  const [extractStatus, setExtractStatus] = useState<Status>("idle");
  const [frames, setFrames] = useState<string[]>([]);
  const [frameTimes, setFrameTimes] = useState<number[]>([]);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [extractError, setExtractError] = useState("");
  const [progress, setProgress] = useState("");
  // 入力（任意）
  const [grade, setGrade] = useState("");
  // AI解析まわり
  const [analyzeStatus, setAnalyzeStatus] = useState<Status>("idle");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [analyzeError, setAnalyzeError] = useState("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoUrlRef = useRef<string>("");

  const busy = extractStatus === "working" || analyzeStatus === "working";

  // 処理中は背景スクロールをロック
  useEffect(() => {
    if (busy) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [busy]);

  // 後片付け：一時的な動画URLを解放
  useEffect(() => {
    return () => {
      if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
    };
  }, []);

  // 動画はデフォルトでミュート（ジムでの利用を想定）。
  // React の muted 属性は初期反映が不安定なので、コードでも確実に設定する。
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = true;
  }, [videoUrl]);

  // コマをタップ → 動画をその秒へ移動して、そこから再生する。
  function seekTo(tSec: number) {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = tSec;
    v.play().catch(() => {});
    v.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setVideoFile(file);
    // 前回の結果を消す
    setFrames([]);
    setFrameTimes([]);
    setExtractError("");
    setFeedback(null);
    setAnalyzeError("");
    setAnalyzeStatus("idle");

    // 動画プレーヤー用の一時URLを作る（古いものは解放）
    if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
    const url = URL.createObjectURL(file);
    videoUrlRef.current = url;
    setVideoUrl(url);

    setProgress("準備中…");
    setExtractStatus("working");

    try {
      const result = await extractFrames(file, (msg) => setProgress(msg));
      setFrames(result.map((r) => r.dataUrl));
      setFrameTimes(result.map((r) => r.tSec));
      setExtractStatus("done");
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : "コマ抽出に失敗しました");
      setExtractStatus("error");
    } finally {
      e.target.value = "";
    }
  }

  // 統合解析：動画(Gemini)＋静止画＋知識ベース(Claude) を1回で。
  async function onAnalyze() {
    if (!videoFile) return;
    setAnalyzeError("");
    setFeedback(null);
    setAnalyzeStatus("working");
    try {
      const form = new FormData();
      form.append("video", videoFile);
      form.append("frames", JSON.stringify(frames));
      if (grade) form.append("grade", grade);
      if (frames[0]) form.append("thumbnail", frames[0]);
      const res = await fetch("/api/analyze-integrated", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "解析に失敗しました");
      setFeedback({
        summary: data.summary,
        prescription: data.prescription,
        scores: data.scores,
        findings: data.findings,
      });
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

      {/* 動画プレーヤー＋コマ（タップで該当秒へ） */}
      {extractStatus === "done" && frames.length > 0 && (
        <div className="mt-6">
          {videoUrl && (
            <video
              ref={videoRef}
              src={videoUrl}
              poster={frames[0]}
              controls
              playsInline
              muted
              preload="metadata"
              className="mb-3 w-full max-w-sm rounded-lg border border-black/10 dark:border-white/15"
            />
          )}
          <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-300">
            切り出したコマ（{frames.length}枚）
            <span className="text-zinc-400">
              {" "}
              — タップすると動画がその瞬間に飛びます
            </span>
          </p>
          <div className="grid grid-cols-3 gap-2">
            {frames.map((src, i) => (
              <button
                key={i}
                type="button"
                onClick={() => seekTo(frameTimes[i] ?? 0)}
                className="overflow-hidden rounded-lg border border-black/10 transition-opacity hover:opacity-80 dark:border-white/15"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`コマ ${i + 1}`} className="w-full" />
              </button>
            ))}
          </div>

          {/* 解析ボタン（統合：Gemini動画読み＋Claude知識ベース） */}
          <button
            type="button"
            onClick={onAnalyze}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            AIコーチに解析してもらう
          </button>
        </div>
      )}

      {/* AI解析のエラー */}
      {analyzeStatus === "error" && analyzeError && (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">
          {analyzeError}
        </p>
      )}

      {/* 解析結果（敗因＋処方）＋チャット */}
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

          {feedback.findings && feedback.findings.length > 0 && (
            <div className="rounded-xl border border-black/10 p-4 dark:border-white/15">
              <p className="mb-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                指摘（タップで動画のその瞬間へ）
              </p>
              <ul className="space-y-2">
                {feedback.findings.map((f, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => seekTo(f.tSec)}
                      className="w-full rounded-lg border border-black/10 p-2 text-left text-sm transition-colors hover:bg-black/[.03] dark:border-white/15 dark:hover:bg-white/[.06]"
                    >
                      <span className="font-medium text-blue-600 dark:text-blue-400">
                        {formatTime(f.tSec)}
                      </span>
                      {f.skill ? (
                        <span className="text-zinc-500"> ・{f.skill}</span>
                      ) : null}
                      <span className="block leading-6">{f.comment}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {feedback.scores && feedback.scores.length > 0 && (
            <div className="rounded-xl border border-black/10 p-4 dark:border-white/15">
              <p className="mb-3 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                技術8軸のスコア
              </p>
              <ScoreBars scores={feedback.scores} />
            </div>
          )}

          <ChatBox frames={frames} feedback={feedback} grade={grade || undefined} />
        </div>
      )}

      {/* 処理中の覆い */}
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
              <p className="text-base font-medium">AIコーチが解析しています…</p>
              <p className="text-sm text-white/80">
                動画を読み、知識で講評します（1分ほどかかることがあります）
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
