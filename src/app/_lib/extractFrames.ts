// 動画ファイルから、等間隔に数枚の静止画（コマ）を切り出す部品。
// すべてブラウザの中だけで動く（動画をサーバーに送らない）。
// 返り値は、各コマの画像データ（data URL 文字列）の配列。

// 指定したイベントが起きるまで待つ小さなヘルパー
function waitFor(el: HTMLMediaElement, event: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const onOk = () => {
      cleanup();
      resolve();
    };
    const onErr = () => {
      cleanup();
      reject(new Error("動画の読み込みに失敗しました"));
    };
    const cleanup = () => {
      el.removeEventListener(event, onOk);
      el.removeEventListener("error", onErr);
    };
    el.addEventListener(event, onOk, { once: true });
    el.addEventListener("error", onErr, { once: true });
  });
}

// 動画を指定の秒数へ移動し、その位置の絵が用意できるまで待つ
function seekTo(video: HTMLVideoElement, timeSec: number): Promise<void> {
  const p = waitFor(video, "seeked");
  video.currentTime = timeSec;
  return p;
}

export async function extractFrames(
  file: File,
  count = 6,
): Promise<string[]> {
  // ファイルからブラウザ内だけで使える一時URLを作る
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";

  try {
    // 動画の長さ・サイズが分かるまで待つ
    await waitFor(video, "loadedmetadata");

    const duration = video.duration;
    if (!isFinite(duration) || duration <= 0) {
      throw new Error("この動画は長さを取得できませんでした（別の動画でお試しください）");
    }

    // 送信・表示を軽くするため、横幅は最大640pxに縮小する
    const maxWidth = 640;
    const scale = Math.min(1, maxWidth / (video.videoWidth || maxWidth));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("画像の描画に失敗しました");

    const frames: string[] = [];
    for (let i = 0; i < count; i++) {
      // 各コマの位置（最初と最後ちょうどは避け、等間隔に散らす）
      const t = duration * ((i + 0.5) / count);
      await seekTo(video, t);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      // JPEG・品質0.8でデータ化（十分きれいで、サイズは軽い）
      frames.push(canvas.toDataURL("image/jpeg", 0.8));
    }

    return frames;
  } finally {
    // 使い終わった一時URLを解放する
    URL.revokeObjectURL(url);
  }
}
