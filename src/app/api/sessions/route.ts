import { NextRequest, NextResponse } from 'next/server';
import { getSessions, createSession } from '@/lib/storage';
import { v4 as uuidv4 } from 'uuid';
import { Session } from '@/types';

/**
 * 【GET: セッション（会話部屋）の一覧を取得する】
 * 画面を開いた時や、サイドバーに過去の履歴を表示する時に呼ばれます。
 */
export async function GET() {
  // storage.ts の機能を使って全リストを取得
  const sessions = await getSessions();
  // JSON（プログラムが読みやすい形式）にして画面に返します
  return NextResponse.json(sessions);
}

/**
 * 【POST: 新しいセッション（会話部屋）を作成する】
 * 「＋新規作成」ボタンを押した時などに呼ばれます。
 */
export async function POST(req: NextRequest) {
  // 画面から「どんなタイトルにするか」を受け取ります
  // 例： { title: "猫の絵を描く" }
  const body = await req.json();
  const title = body.title || "新規コンテンツ";

  // 新しい会話部屋のプロフィール（ルール）を作ります
  const newSession: Session = {
    id: uuidv4(), // ランダムなIDを付ける
    title: title,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    imageCount: 0, // 最初は画像ゼロ枚
  };
  
  // 実際にフォルダを作って保存します
  await createSession(newSession);
  
  // 作った部屋の情報を画面に返します
  return NextResponse.json(newSession);
}
