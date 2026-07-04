import { ScreenShell } from "./_components/ScreenShell";
import { Uploader } from "./_components/Uploader";

// ① アップロード画面（アプリの入口）
export default function UploadPage() {
  return (
    <ScreenShell
      badge="①"
      title="アップロード"
      description="撮影した登りの動画を選ぶと、ブラウザが自動でコマ（静止画）を切り出します。"
    >
      <Uploader />
    </ScreenShell>
  );
}
