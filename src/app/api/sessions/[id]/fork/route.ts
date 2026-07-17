import { NextRequest, NextResponse } from 'next/server';
import { getSession, updateSession, createSession, getMessages, saveMessage, getFolders, createFolder } from '@/lib/storage';
import { Session, Message, GeneratedImage } from '@/types';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'sessions');

export async function POST(
  req: NextRequest, 
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: originalSessionId } = await params;
    const { imageId } = await req.json();

    const originalSession = await getSession(originalSessionId);
    if (!originalSession) {
      return NextResponse.json({ error: '元のセッションが見つかりません' }, { status: 404 });
    }

    // 元のメッセージから対象の画像を探す
    const messages = await getMessages(originalSessionId);
    let targetImage: GeneratedImage | null = null;
    let originalPrompt = '';

    for (const msg of messages) {
      if (msg.generatedImages) {
        const found = msg.generatedImages.find(img => img.id === imageId);
        if (found) {
          targetImage = found;
          originalPrompt = found.prompt || '';
          break;
        }
      }
    }

    if (!targetImage) {
      return NextResponse.json({ error: '引き継ぐ画像が見つかりません' }, { status: 404 });
    }

    // 1. フォルダの準備（元のセッションがフォルダに入っていなければ自動作成）
    let targetFolderId = originalSession.folderId;
    if (!targetFolderId) {
      const newFolder = await createFolder(`📂 ${originalSession.title} の派生`);
      targetFolderId = newFolder.id;
      // 元のセッションもこのフォルダに入れる
      originalSession.folderId = targetFolderId;
      await updateSession(originalSession);
    }

    // 2. 新しいセッションの作成
    const newSessionId = crypto.randomUUID();
    const newSession: Session = {
      id: newSessionId,
      title: `→${originalSession.title}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      imageCount: 1,
      folderId: targetFolderId
    };
    
    await createSession(newSession);

    // 3. 画像ファイルのコピー
    const oldImagePath = path.join(DATA_DIR, originalSessionId, 'images', targetImage.filename);
    const newImagePath = path.join(DATA_DIR, newSessionId, 'images', targetImage.filename);
    
    // 画像ファイルを新しいセッションのフォルダにコピー
    await fs.copyFile(oldImagePath, newImagePath);

    // 4. 新しいセッションの最初のメッセージとして、この画像を登録
    const initialMessage: Message = {
      id: crypto.randomUUID(),
      sender: 'ai',
      text: '前のチャットから画像を引き継ぎました。この画像についてどのように修正しますか？',
      timestamp: new Date().toISOString(),
      generatedImages: [{
        ...targetImage,
        id: crypto.randomUUID(), // IDは新しくする
      }]
    };

    await saveMessage(newSessionId, initialMessage);

    // クライアントには新しいセッションのIDとフォルダ情報を返す
    return NextResponse.json({ newSessionId, folderId: targetFolderId }, { status: 201 });
  } catch (error) {
    console.error("フォーク（引き継ぎ）エラー:", error);
    return NextResponse.json({ error: 'Failed to fork session' }, { status: 500 });
  }
}
