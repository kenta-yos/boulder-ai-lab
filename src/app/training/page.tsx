import { ScreenShell, ComingSoon } from "../_components/ScreenShell";

// ④ トレーニング提案画面
export default function TrainingPage() {
  return (
    <ScreenShell
      badge="④"
      title="トレーニング提案"
      description="溜まった傾向から弱点を見つけ、それに合った練習ドリルを提案します。"
    >
      <ComingSoon>
        ここに「傾向にもとづくドリル提案」が入ります。
        <br />
        （Phase 2 で作ります。今は画面の枠だけです。）
      </ComingSoon>
    </ScreenShell>
  );
}
