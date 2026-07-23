import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
// パスワード保護用のコンポーネントを読み込みます
import PasswordProtect from "@/components/PasswordProtect/PasswordProtect";

// Google Fontsの「Inter」という綺麗で見やすいフォントを読み込みます
const inter = Inter({ subsets: ["latin"] });

// アプリ全体のタイトルと説明文（ブラウザのタブなどに表示されます）
// 【変更点】検索エンジンに表示されないように、robots設定（noindex, nofollow）を追加しました
export const metadata: Metadata = {
  title: "GeminiArtChat - AI画像生成チャット",
  description: "Gemini 2.0 Flashを利用した画像生成＆チャットアプリ",
  robots: {
    index: false,
    follow: false,
  },
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
    <html lang="ja" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var theme = localStorage.getItem('app-theme') || 'dark';
                document.documentElement.setAttribute('data-theme', theme);
              } catch(e) {}
            `,
          }}
        />
      </head>
      <body className={inter.className}>
        {/* パスワード保護の仕組みでアプリ全体を包み込みます */}
        <PasswordProtect>
          {/* ここに page.tsx の内容が差し込まれます */}
          {children}
        </PasswordProtect>
      </body>
    </html>
  );
}
