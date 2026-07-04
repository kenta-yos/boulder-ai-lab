import { ScreenShell, ComingSoon } from "../_components/ScreenShell";

// ② 解析結果画面（アプリの顔）
export default function AnalysisPage() {
  return (
    <ScreenShell
      badge="②"
      title="解析結果"
      description="敗因（なぜ落ちたか）と処方（どうすれば成功するか）を表示し、下のチャットで深掘りします。"
    >
      <ComingSoon>
        ここに「一言サマリー（敗因＋処方）」と「深掘りチャット」が入ります。
        <br />
        （敗因・処方はステップ5、チャットはステップ6で作ります。）
      </ComingSoon>
    </ScreenShell>
  );
}
