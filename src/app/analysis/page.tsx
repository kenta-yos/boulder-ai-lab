import Link from "next/link";
import { ScreenShell, ComingSoon } from "../_components/ScreenShell";

// ② 解析結果画面（トップ・記録から選ぶ案内）
export default function AnalysisPage() {
  return (
    <ScreenShell
      badge="②"
      title="解析結果"
      description="過去の解析の詳細（指摘・総括）をここで見ます。"
    >
      <ComingSoon>
        「記録」タブで見たい解析をタップすると、ここに指摘・総括が表示されます。
        <br />
        <Link href="/records" className="underline">
          記録を開く
        </Link>
      </ComingSoon>
    </ScreenShell>
  );
}
