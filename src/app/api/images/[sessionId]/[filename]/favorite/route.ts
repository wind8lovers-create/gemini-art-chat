import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'sessions');

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string; filename: string }> }
) {
  try {
    const { sessionId, filename: imageId } = await params;

    const messagesPath = path.join(DATA_DIR, sessionId, 'messages.json');
    
    // メッセージ履歴の読み込み
    const data = await fs.readFile(messagesPath, 'utf-8');
    const messages = JSON.parse(data);

    let foundImage = false;
    let newFavoriteState = false;

    // メッセージ履歴の中から対象の画像を探して、お気に入り状態を反転する
    for (const message of messages) {
      if (message.generatedImages) {
        for (const img of message.generatedImages) {
          if (img.id === imageId) {
            // お気に入り状態を反転（trueならfalse、falseならtrue）
            img.isFavorite = !img.isFavorite;
            newFavoriteState = img.isFavorite;
            foundImage = true;
            break;
          }
        }
      }
      if (foundImage) break;
    }

    if (!foundImage) {
      return NextResponse.json({ error: '画像が見つかりません' }, { status: 404 });
    }

    // 変更を保存 (messages.jsonを上書き)
    await fs.writeFile(messagesPath, JSON.stringify(messages, null, 2));

    return NextResponse.json({ success: true, isFavorite: newFavoriteState });
  } catch (error) {
    console.error('お気に入り登録エラー:', error);
    return NextResponse.json({ error: 'Failed to toggle favorite' }, { status: 500 });
  }
}
