import { ScreenShell, ComingSoon } from "../_components/ScreenShell";

// ③ 記録・傾向画面
export default function RecordsPage() {
  return (
    <ScreenShell
      badge="③"
      title="記録・傾向"
      description="過去の解析が自動で溜まり、技術軸ごとのスコアの推移が見えるようになります。"
    >
      <ComingSoon>
        ここに「過去の解析一覧」と「傾向チャート」が入ります。
        <br />
        （一覧はステップ7で作ります。チャートは Phase 2 で作ります。）
      </ComingSoon>
    </ScreenShell>
  );
}
