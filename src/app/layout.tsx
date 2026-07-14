import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Google Fontsの「Inter」という綺麗で見やすいフォントを読み込みます
const inter = Inter({ subsets: ["latin"] });

// アプリ全体のタイトルと説明文（ブラウザのタブなどに表示されます）
export const metadata: Metadata = {
  title: "GeminiArtChat - AI画像生成チャット",
  description: "Gemini 2.0 Flashを利用した画像生成＆チャットアプリ",
};

/**
 * 【アプリ全体の骨組み】
 * すべてのページはこの RootLayout の中に表示されます。
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // htmlの言語を日本語(ja)に設定します
    <html lang="ja">
      <body className={inter.className}>
        {/* ここに page.tsx の内容が差し込まれます */}
        {children}
      </body>
    </html>
  );
}
