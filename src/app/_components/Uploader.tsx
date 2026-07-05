"use client";

// 動画を選び→ブラウザでコマ抽出→動画プレーヤー＋コマタップで該当秒へジャンプ→AI解析→敗因＋処方→チャット。
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { extractFrames } from "../_lib/extractFrames";
import type { Feedback } from "../_lib/analyze";
import { ChatBox } from "./ChatBox";
import { ScoreBars } from "./ScoreBars";

type Status = "idle" | "working" | "done" | "error";

type GymOption = {
  id: string;
  name: string;
  grades: { id: string; label: string }[];
};

// 課題の色（同じ色のホールドで1課題。AIに「対象はこの色だけ」と伝えるため）
const HOLD_COLORS = [
  "白",
  "黄",
  "緑",
  "青",
  "赤",
  "ピンク",
  "オレンジ",
  "紫",
  "黒",
  "灰",
  "茶",
  "水色",
];

// 壁の傾斜（傾斜でアドバイスが大きく変わるためAIに伝える）
const WALL_ANGLES = ["スラブ", "垂壁", "緩傾斜", "強傾斜", "ルーフ"];

// 秒 → m:ss 表記
function formatTime(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

// 「0:25」「25秒」「1分25秒」「1分」などの表記 → 秒数へ変換
function timeLabelToSec(label: string): number {
  if (label.includes(":")) {
    const [m, s] = label.split(":");
    return Number(m) * 60 + Number(s);
  }
  const min = label.match(/(\d+)分/);
  const sec = label.match(/(\d+)秒/);
  return (min ? Number(min[1]) : 0) * 60 + (sec ? Number(sec[1]) : 0);
}

// 文章中の時刻表記（0:25 / 25秒 / 1分25秒 / 1分）を拾って、
// タップで動画のその秒へ飛ぶリンクに変える。それ以外はそのままの文字。
function LinkedText({
  text,
  onSeek,
}: {
  text: string;
  onSeek: (sec: number) => void;
}) {
  const re = /(\d+:\d{2}|\d+分\d+秒|\d+分|\d+秒)/g;
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const label = m[0];
    const sec = timeLabelToSec(label);
    nodes.push(
      <button
        key={key++}
        type="button"
        onClick={() => onSeek(sec)}
        className="font-medium text-blue-600 underline underline-offset-2 dark:text-blue-400"
      >
        {label}
      </button>,
    );
    last = m.index + label.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return <>{nodes}</>;
}

export function Uploader({ gyms }: { gyms: GymOption[] }) {
  // ジム・グレード（マスタから選択）
  const [gymId, setGymId] = useState("");
  const [gradeLabel, setGradeLabel] = useState("");
  const [holdColor, setHoldColor] = useState("");
  const [wallAngle, setWallAngle] = useState("");
  const [note, setNote] = useState("");
  const selectedGym = gyms.find((g) => g.id === gymId);

  // コマ抽出まわり
  const [extractStatus, setExtractStatus] = useState<Status>("idle");
  const [frames, setFrames] = useState<string[]>([]);
  const [frameTimes, setFrameTimes] = useState<number[]>([]);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [extractError, setExtractError] = useState("");
  const [progress, setProgress] = useState("");
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
    setNote(""); // メモはそのトライ固有なので、動画を選び直したら消す

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
      if (selectedGym) form.append("gym", selectedGym.name);
      if (gradeLabel) form.append("grade", gradeLabel);
      if (holdColor) form.append("holdColor", holdColor);
      if (wallAngle) form.append("wallAngle", wallAngle);
      if (note.trim()) form.append("note", note.trim());
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
        videoNotes: data.videoNotes,
      });
      setAnalyzeStatus("done");
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "解析に失敗しました");
      setAnalyzeStatus("error");
    }
  }

  return (
    <div>
      {/* ジム・グレード（マスタから選択・任意） */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-sm text-zinc-600 dark:text-zinc-300">
            ジム（任意）
          </span>
          <select
            value={gymId}
            onChange={(e) => {
              setGymId(e.target.value);
              setGradeLabel("");
            }}
            className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-base dark:border-white/20"
          >
            <option value="">未選択</option>
            {gyms.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-zinc-600 dark:text-zinc-300">
            グレード（任意）
          </span>
          <select
            value={gradeLabel}
            onChange={(e) => setGradeLabel(e.target.value)}
            disabled={!selectedGym}
            className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-base disabled:opacity-50 dark:border-white/20"
          >
            <option value="">未選択</option>
            {selectedGym?.grades.map((gr) => (
              <option key={gr.id} value={gr.label}>
                {gr.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-zinc-600 dark:text-zinc-300">
            課題の色（任意）
          </span>
          <select
            value={holdColor}
            onChange={(e) => setHoldColor(e.target.value)}
            className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-base dark:border-white/20"
          >
            <option value="">未選択</option>
            {HOLD_COLORS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-zinc-600 dark:text-zinc-300">
            壁の傾斜（任意）
          </span>
          <select
            value={wallAngle}
            onChange={(e) => setWallAngle(e.target.value)}
            className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-base dark:border-white/20"
          >
            <option value="">未選択</option>
            {WALL_ANGLES.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </label>
      </div>
      {/* 落ちた場所・感触（任意・AIが核心に絞る手がかり） */}
      <div className="mb-4">
        <label className="block">
          <span className="mb-1 block text-sm text-zinc-600 dark:text-zinc-300">
            落ちた場所・感触（任意）
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="例：ラストのガバ取りで体が左に振られて落ちた／核心は3手目の遠い右手"
            className="w-full resize-none rounded-lg border border-black/15 bg-transparent px-3 py-2 text-base leading-6 dark:border-white/20"
          />
        </label>
      </div>

      {/* 動画を選ぶボタン */}
      <div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90">
          動画を選ぶ
          <input
            type="file"
            accept="video/*"
            className="hidden"
            onChange={onSelect}
          />
        </label>
      </div>
      <div className="mt-3">
        <Link
          href="/settings"
          className="text-xs text-zinc-500 underline dark:text-zinc-400"
        >
          ジム・グレードを登録/編集
        </Link>
      </div>

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
            <p className="whitespace-pre-wrap leading-7">
              <LinkedText text={feedback.summary} onSeek={seekTo} />
            </p>
          </div>
          <div className="rounded-xl border border-black/10 p-4 dark:border-white/15">
            <p className="mb-1 text-xs font-semibold text-green-700 dark:text-green-400">
              処方（どうすれば成功するか）
            </p>
            <p className="whitespace-pre-wrap leading-7">
              <LinkedText text={feedback.prescription} onSeek={seekTo} />
            </p>
          </div>

          {feedback.videoNotes && (
            <details className="rounded-xl border border-black/10 p-4 dark:border-white/15">
              <summary className="cursor-pointer text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                AIが読み取った動き（観察メモ・タップで動画へ）
              </summary>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-zinc-700 dark:text-zinc-200">
                <LinkedText text={feedback.videoNotes} onSeek={seekTo} />
              </p>
              <p className="mt-2 text-xs text-zinc-400">
                ※ AIがこう動きを理解した上で、上の敗因・処方を出しています。ずれていたら深掘りチャットで直せます。
              </p>
            </details>
          )}

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

          <ChatBox
            frames={frames}
            feedback={feedback}
            grade={gradeLabel || undefined}
          />
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
