// 動画ファイルから、等間隔に数枚の静止画（コマ）を切り出す部品。
// すべてブラウザの中だけで動く（動画をサーバーに送らない）。
// 返り値は、各コマの画像データ（data URL 文字列）の配列。

// 進捗を画面に伝えるためのコールバック型
type OnProgress = (message: string) => void;

// 指定イベントのどれか（複数可）が起きるまで待つ。error か時間切れなら失敗。
function waitForAny(
  el: HTMLMediaElement,
  events: string[],
  timeoutMs: number,
  label: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      events.forEach((ev) => el.removeEventListener(ev, onOk));
      el.removeEventListener("error", onErr);
      clearTimeout(timer);
    };
    const onOk = () => {
      cleanup();
      resolve();
    };
    const onErr = () => {
      cleanup();
      reject(new Error(`動画の読み込みに失敗しました（${label}）`));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`時間切れ：${label}が終わりませんでした`));
    }, timeoutMs);
    events.forEach((ev) => el.addEventListener(ev, onOk, { once: true }));
    el.addEventListener("error", onErr, { once: true });
  });
}

// 動画を指定秒へ移動し、その位置の絵が用意できるまで待つ
function seekTo(video: HTMLVideoElement, timeSec: number): Promise<void> {
  const p = waitForAny(video, ["seeked"], 15000, "コマ位置への移動");
  video.currentTime = timeSec;
  return p;
}

export async function extractFrames(
  file: File,
  count = 6,
  onProgress?: OnProgress,
): Promise<string[]> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.setAttribute("muted", "");
  video.setAttribute("playsinline", "");
  video.preload = "auto";
  // iPhone(Safari)は、動画を画面に置かないとデコードしないことがある。
  // 見えない位置に一時的にDOMへ追加する。
  video.style.cssText =
    "position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;";
  document.body.appendChild(video);

  try {
    onProgress?.("動画を読み込み中…");
    await waitForAny(
      video,
      ["loadeddata", "loadedmetadata"],
      15000,
      "動画の読み込み",
    );

    const duration = video.duration;
    onProgress?.(
      `読み込みOK（長さ ${isFinite(duration) ? duration.toFixed(1) : "?"}秒 / ${video.videoWidth}×${video.videoHeight}）`,
    );

    if (!isFinite(duration) || duration <= 0) {
      throw new Error("この動画は長さを取得できませんでした");
    }
    if (!video.videoWidth || !video.videoHeight) {
      throw new Error("この動画は映像サイズを取得できませんでした");
    }

    const maxWidth = 640;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("画像の描画に失敗しました");

    const frames: string[] = [];
    for (let i = 0; i < count; i++) {
      onProgress?.(`コマ ${i + 1}/${count} を取得中…`);
      const t = duration * ((i + 0.5) / count);
      await seekTo(video, t);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL("image/jpeg", 0.8));
    }

    onProgress?.(`完了：${frames.length}枚を切り出しました`);
    return frames;
  } finally {
    URL.revokeObjectURL(url);
    video.remove();
  }
}
