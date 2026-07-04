import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "./_components/Nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BoulderAILab",
  description: "自分の登りをAIで解析・蓄積する、ボルダリングのコーチ兼アナリスト",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* 上部は細いアプリ名タイトルだけ */}
        <header className="border-b border-black/10 dark:border-white/15">
          <div className="mx-auto max-w-3xl px-4 py-3 font-semibold tracking-tight">
            BoulderAILab
          </div>
        </header>
        {/* 各画面の中身。下のタブバーに隠れないよう、下に余白(pb-24)を入れる */}
        <main className="flex-1 pb-24">{children}</main>
        {/* 画面下に固定のタブバー */}
        <Nav />
      </body>
    </html>
  );
}
