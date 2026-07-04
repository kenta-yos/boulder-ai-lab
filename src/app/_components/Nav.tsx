"use client";

// 画面下に固定される4つのタブバー。スマホで親指が届きやすく、常に見える形。
// 「今どの画面にいるか」を色で示すため、現在のURLを見て判定する。
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// タブの一覧（短い表示名・飛び先URL・アイコン）
const items: { href: string; label: string; icon: ReactNode }[] = [
  { href: "/", label: "上げる", icon: <UploadIcon /> },
  { href: "/analysis", label: "結果", icon: <SparkleIcon /> },
  { href: "/records", label: "記録", icon: <ChartIcon /> },
  { href: "/training", label: "提案", icon: <BulbIcon /> },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-10 border-t border-black/10 bg-background/95 backdrop-blur dark:border-white/15"
      // iPhoneのホームバーぶんの安全余白を確保
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-3xl">
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
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors " +
                (active
                  ? "text-foreground"
                  : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200")
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// --- 以下、タブのアイコン（外部ライブラリを使わず、その場で描く単純な線画） ---

function iconProps() {
  return {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

function UploadIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M12 15V3" />
      <path d="m7 8 5-5 5 5" />
      <path d="M20 15v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Z" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </svg>
  );
}

function BulbIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5A5 5 0 0 0 6 8c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5" />
      <path d="M9 18h6" />
      <path d="M10 22h4" />
    </svg>
  );
}
