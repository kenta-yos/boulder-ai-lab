// 各画面で共通して使う「枠」。
// 画面番号バッジ・タイトル・説明・中身(children)を受け取って、そろった見た目で表示する。
import type { ReactNode } from "react";

type ScreenShellProps = {
  badge: string; // 画面番号（例: "①"）
  title: string; // 画面名
  description: string; // この画面が何をする場所かの一言
  children?: ReactNode; // 画面ごとの中身
};

export function ScreenShell({
  badge,
  title,
  description,
  children,
}: ScreenShellProps) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-lg">{badge}</span>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      </div>
      <p className="mb-8 text-zinc-600 dark:text-zinc-400">{description}</p>
      {children}
    </div>
  );
}

// 「これから作る場所」を示す点線の枠。中身がまだ無いことを分かりやすく見せる。
export function ComingSoon({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-black/20 p-6 text-sm text-zinc-500 dark:border-white/20 dark:text-zinc-400">
      {children}
    </div>
  );
}
