"use client";

// 4つの画面を行き来する共通メニュー。
// 「今どの画面にいるか」を色で示すため、現在のURLを見て判定する。
import Link from "next/link";
import { usePathname } from "next/navigation";

// メニューの項目一覧（表示名と、飛び先のURL）
const items = [
  { href: "/", label: "アップロード" },
  { href: "/analysis", label: "解析結果" },
  { href: "/records", label: "記録・傾向" },
  { href: "/training", label: "トレーニング提案" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-black/10 dark:border-white/15">
      <nav className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Link href="/" className="mr-2 font-semibold tracking-tight">
          BoulderAILab
        </Link>
        {items.map((item) => {
          // 今いる画面かどうか（トップは完全一致、他は前方一致で判定）
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                "rounded-full px-3 py-1 text-sm transition-colors " +
                (active
                  ? "bg-foreground text-background"
                  : "text-zinc-600 hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10")
              }
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
