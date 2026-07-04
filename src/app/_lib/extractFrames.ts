// 動画ファイルから、等間隔に数枚の静止画（コマ）を切り出す部品。
// すべてブラウザの中だけで動く（動画をサーバーに送らない）。
// 返り値は、各コマの「画像データ(data URL)」と「動画内の秒数」の配列。

type OnProgress = (message: string) => void;

// 1コマ：画像と、その動画内の位置（秒）
export type Frame = {
  dataUrl: string;
  tSec: number;
};

// iPhone等で使える「新しいコマが描かれた合図」の型（標準の型に無い場合の補助）
// metadata.mediaTime = 実際に描画されたコマの正確な秒数。
type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (
    cb: (now: number, metadata: { mediaTime: number }) => void,
  ) => number;
};

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

// iPhone対策：一瞬だけ無音再生してから止め、映像デコードを起こす。
// （これをしないと、指定位置へのコマ移動(seek)が動かないことがある）
async function primeDecoding(video: HTMLVideoElement): Promise<void> {
  try {
    await video.play();
    video.pause();
  } catch {
    // 再生がブロックされても、続行して試す
  }
}

// 動画を指定秒へ移動し、「実際に描画されたコマ」を canvas に描いて、
// そのコマの画像(data URL)と正確な秒数(mediaTime)をセットで返す。
// 画像と秒を同じ瞬間に取ることで、両者のズレを無くす。
function seekAndCapture(
  video: HTMLVideoElement,
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  timeSec: number,
): Promise<{ dataUrl: string; tSec: number }> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const v = video as VideoWithFrameCallback;
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onErr);
    };
    const capture = (mediaTime: number) => {
      if (settled) return;
      settled = true;
      video.pause();
      cleanup();
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      resolve({
        dataUrl: canvas.toDataURL("image/jpeg", 0.8),
        tSec: mediaTime,
      });
    };
    const onSeeked = () => {
      // requestVideoFrameCallback 非対応の環境向けフォールバック
      if (typeof v.requestVideoFrameCallback !== "function") {
        capture(video.currentTime);
      }
    };
    const onErr = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("コマの取得に失敗しました"));
    };
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("時間切れ：コマ位置への移動が終わりませんでした"));
    }, 15000);

    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onErr);

    video.currentTime = timeSec;
    if (typeof v.requestVideoFrameCallback === "function") {
      // 実際に描画されたコマの正確な秒(mediaTime)で捉える
      v.requestVideoFrameCallback((_now, metadata) => capture(metadata.mediaTime));
    }
    // iOSで描画を確実に起こすため一瞬だけ再生（captureで即停止）
    video.play().catch(() => {});
  });
}

export async function extractFrames(
  file: File,
  onProgress?: OnProgress,
  maxWidth = 640, // 横の最大px
): Promise<Frame[]> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.setAttribute("muted", "");
  video.setAttribute("playsinline", "");
  video.preload = "auto";
  // iPhone(Safari)は、画面内に置かないとデコードしないことがある。
  // 見えないくらい小さくして画面の隅に一時的に置く。
  video.style.cssText =
    "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0.01;pointer-events:none;z-index:-1;";
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

    // コマ数を動画の長さに応じて決める（約2秒に1枚、6〜12枚の範囲）。
    // 多すぎると処理が重く・後でClaudeに送る量も増えるため上限を設ける。
    const count = Math.min(12, Math.max(6, Math.round(duration / 2)));
    onProgress?.(`コマ数を${count}枚に設定（長さに合わせて自動調整）`);

    onProgress?.("映像デコードを準備中…");
    await primeDecoding(video);

    const scale = Math.min(1, maxWidth / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("画像の描画に失敗しました");

    const frames: Frame[] = [];
    for (let i = 0; i < count; i++) {
      onProgress?.(`コマ ${i + 1}/${count} を取得中…`);
      const t = duration * ((i + 0.5) / count);
      // 画像と正確な秒を同じ瞬間に取得（両者のズレを防ぐ）
      const frame = await seekAndCapture(video, ctx, canvas, t);
      frames.push(frame);
    }

    onProgress?.(`完了：${frames.length}枚を切り出しました`);
    return frames;
  } finally {
    URL.revokeObjectURL(url);
    video.remove();
  }
}
