"use client";

// 動画を選び→ブラウザでコマ抽出→動画プレーヤー＋コマタップで該当秒へジャンプ→AI解析→敗因＋処方→チャット。
import { useEffect, useRef, useState } from "react";
import { extractFrames } from "../_lib/extractFrames";
import type { Feedback } from "../_lib/analyze";
import { ChatBox } from "./ChatBox";

type Status = "idle" | "working" | "done" | "error";

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
  // どちらの解析か（静止画=Claude / 動画=Gemini）で覆いの文言を変える
  const [analyzeKind, setAnalyzeKind] = useState<"frames" | "video">("frames");

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

  async function onAnalyze() {
    setAnalyzeError("");
    setFeedback(null);
    setAnalyzeKind("frames");
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

  async function onAnalyzeVideo() {
    if (!videoFile) return;
    setAnalyzeError("");
    setFeedback(null);
    setAnalyzeKind("video");
    setAnalyzeStatus("working");
    try {
      const form = new FormData();
      form.append("video", videoFile);
      if (grade) form.append("grade", grade);
      if (frames[0]) form.append("thumbnail", frames[0]);
      const res = await fetch("/api/analyze-video", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "動画解析に失敗しました");
      setFeedback({ summary: data.summary, prescription: data.prescription });
      setAnalyzeStatus("done");
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "動画解析に失敗しました");
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

          {/* 解析ボタン（静止画Claude / 動画Gemini） */}
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onAnalyze}
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              静止画で解析（Claude）
            </button>
            <button
              type="button"
              onClick={onAnalyzeVideo}
              className="inline-flex items-center gap-2 rounded-full border border-black/20 px-6 py-3 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
            >
              動画で解析（Gemini）
            </button>
          </div>
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
          ) : analyzeKind === "video" ? (
            <>
              <p className="text-base font-medium">
                Geminiが動画を読んでいます…
              </p>
              <p className="text-sm text-white/80">
                アップロードと解析で1分ほどかかることがあります
              </p>
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
