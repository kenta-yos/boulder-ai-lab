import { ScreenShell, ComingSoon } from "./_components/ScreenShell";

// ① アップロード画面（アプリの入口）
export default function UploadPage() {
  return (
    <ScreenShell
      badge="①"
      title="アップロード"
      description="撮影した登りの動画を選び、ジムやグレードを付けて解析にかけます。"
    >
      <ComingSoon>
        ここに「動画を選ぶ」「ジム・グレードを入力する」ボタンが入ります。
        <br />
        （ステップ4以降で作ります。今は画面の枠だけです。）
      </ComingSoon>
    </ScreenShell>
  );
}
