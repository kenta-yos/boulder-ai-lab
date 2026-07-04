// ブラウザ内で姿勢推定（体の関節点の検出）を行う部品。
// MediaPipe を使い、動画をサーバーに送らずクライアント側で完結する。

// 関節点1つ（x,y は 0〜1 の割合。z は奥行き、visibility は写り度合い）
export type PosePoint = {
  x: number;
  y: number;
  z: number;
  visibility?: number;
};

// MediaPipe の WASM とモデル（ネット上の公式ファイルを読み込む）
const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

// 姿勢推定器は重いので、1回だけ用意して使い回す
let landmarkerPromise: Promise<unknown> | null = null;

async function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FilesetResolver, PoseLandmarker } = await import(
        "@mediapipe/tasks-vision"
      );
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);
      return PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL },
        runningMode: "IMAGE",
        numPoses: 1,
      });
    })();
  }
  return landmarkerPromise;
}

// data URL の画像を読み込む
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
    img.src = dataUrl;
  });
}

// 1枚のコマに対して姿勢を検出し、
// 「関節点を重ねた確認用画像」と「関節点データ」を返す。
export async function detectPoseOnFrame(dataUrl: string): Promise<{
  overlay: string;
  points: PosePoint[] | null;
}> {
  const { PoseLandmarker, DrawingUtils } = await import(
    "@mediapipe/tasks-vision"
  );
  // 型は緩めに扱う（MediaPipeの型を持ち回らない）
  const landmarker = (await getLandmarker()) as {
    detect: (img: HTMLImageElement) => {
      landmarks?: PosePoint[][];
    };
  };

  const img = await loadImage(dataUrl);
  const result = landmarker.detect(img);
  const points = result.landmarks?.[0] ?? null;

  // 確認用に、元画像へ関節点と骨格線を描く
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("描画に失敗しました");
  ctx.drawImage(img, 0, 0);

  if (points) {
    const du = new DrawingUtils(ctx);
    du.drawConnectors(
      points as never,
      PoseLandmarker.POSE_CONNECTIONS as never,
      { color: "#22c55e", lineWidth: 3 },
    );
    du.drawLandmarks(points as never, {
      color: "#ef4444",
      radius: 3,
    });
  }

  return {
    overlay: canvas.toDataURL("image/jpeg", 0.8),
    points,
  };
}
