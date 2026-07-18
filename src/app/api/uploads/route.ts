import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { GalleryImage } from '@/types';

const DATA_DIR = path.join(process.cwd(), 'data', 'sessions');

export async function GET() {
  try {
    const sessionsDirExists = await fs.access(DATA_DIR).then(() => true).catch(() => false);
    if (!sessionsDirExists) {
      return NextResponse.json([]); // まだフォルダがなければ空リストを返す
    }

    const entries = await fs.readdir(DATA_DIR, { withFileTypes: true });
    let allFavoriteUploads: GalleryImage[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const metadataPath = path.join(DATA_DIR, entry.name, 'metadata.json');
        const messagesPath = path.join(DATA_DIR, entry.name, 'messages.json');
        try {
          const metadataData = await fs.readFile(metadataPath, 'utf-8');
          const metadata = JSON.parse(metadataData);
          
          const messagesData = await fs.readFile(messagesPath, 'utf-8');
          const messages = JSON.parse(messagesData);

          if (messages && Array.isArray(messages)) {
            for (const message of messages) {
              if (message.inputImage && message.inputImage.isFavorite) {
                allFavoriteUploads.push({
                  id: message.id,
                  filename: message.id, // urlで直接 data:image を扱うようにするか、APIを噛ませるか。今回はdataURIをそのまま渡す形にする。
                  prompt: message.text || 'アップロード画像',
                  version: 1,
                  parentImageId: null,
                  isFavorite: true,
                  mediaType: message.inputImage.mimeType?.startsWith('video/') ? 'video' : 'image',
                  sessionId: metadata.id,
                  sessionTitle: metadata.title,
                  // @ts-ignore (特別なプロパティとして dataURI を付与)
                  dataUri: message.inputImage.data
                });
              }
            }
          }
        } catch (error) {
          console.warn(`[Uploads] セッション ${entry.name} の読み込みをスキップしました`, error);
        }
      }
    }

    // 新しい順に並べ替え
    allFavoriteUploads.sort((a, b) => b.id.localeCompare(a.id));

    return NextResponse.json(allFavoriteUploads);
  } catch (error) {
    console.error('アップ画像ギャラリー取得エラー:', error);
    return NextResponse.json({ error: 'Failed to fetch uploads' }, { status: 500 });
  }
}
