import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { GeneratedImage, GalleryImage } from '@/types';

const DATA_DIR = path.join(process.cwd(), 'data', 'sessions');

export async function GET() {
  try {
    const sessionsDirExists = await fs.access(DATA_DIR).then(() => true).catch(() => false);
    if (!sessionsDirExists) {
      return NextResponse.json([]); // まだフォルダがなければ空リストを返す
    }

    const entries = await fs.readdir(DATA_DIR, { withFileTypes: true });
    let allFavoriteImages: GalleryImage[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const metadataPath = path.join(DATA_DIR, entry.name, 'metadata.json');
        const messagesPath = path.join(DATA_DIR, entry.name, 'messages.json');
        try {
          const metadataData = await fs.readFile(metadataPath, 'utf-8');
          const metadata = JSON.parse(metadataData);
          
          const messagesData = await fs.readFile(messagesPath, 'utf-8');
          const messages = JSON.parse(messagesData);

          // メッセージの中からお気に入り画像だけを抽出
          if (messages && Array.isArray(messages)) {
            for (const message of messages) {
              // AI生成画像
              if (message.generatedImages) {
                for (const img of message.generatedImages) {
                  if (img.isFavorite) {
                    allFavoriteImages.push({
                      ...img,
                      sessionId: metadata.id,
                      sessionTitle: metadata.title,
                      // @ts-ignore
                      isGenerated: true
                    });
                  }
                }
              }
              // アップロード画像（動画含む）
              if (message.inputImage && message.inputImage.isFavorite) {
                allFavoriteImages.push({
                  id: message.id, // messageId
                  filename: message.id, // urlで直接 data:image を扱う
                  prompt: message.text || 'アップロード画像',
                  version: 1,
                  parentImageId: null,
                  isFavorite: true,
                  publishStatus: message.inputImage.publishStatus,
                  mediaType: message.inputImage.mimeType?.startsWith('video/') ? 'video' : 'image',
                  sessionId: metadata.id,
                  sessionTitle: metadata.title,
                  // @ts-ignore
                  dataUri: message.inputImage.data,
                  // @ts-ignore
                  isGenerated: false
                });
              }
            }
          }
        } catch (error) {
          console.warn(`[Gallery] セッション ${entry.name} の読み込みをスキップしました`, error);
        }
      }
    }

    // 新しい順（もしくはID順）に並べ替え
    allFavoriteImages.sort((a, b) => b.id.localeCompare(a.id));

    return NextResponse.json(allFavoriteImages);
  } catch (error) {
    console.error('ギャラリー取得エラー:', error);
    return NextResponse.json({ error: 'Failed to fetch gallery' }, { status: 500 });
  }
}
