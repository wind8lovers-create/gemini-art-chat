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
    let managedImages: GalleryImage[] = [];

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
              // アップロード画像（inputImage）のチェック
              if (message.inputImage && (message.inputImage.publishStatus === 'published' || message.inputImage.publishStatus === 'hidden')) {
                managedImages.push({
                  id: message.id, // messageId
                  filename: message.id, // ファイル名として代用
                  prompt: message.text || 'アップロード画像',
                  version: 1,
                  parentImageId: null,
                  isFavorite: message.inputImage.isFavorite,
                  publishStatus: message.inputImage.publishStatus,
                  mediaType: message.inputImage.mimeType?.startsWith('video/') ? 'video' : 'image',
                  sessionId: metadata.id,
                  sessionTitle: metadata.title,
                  // @ts-ignore
                  dataUri: message.inputImage.data,
                  // フロントエンドで更新しやすいように isGenerated フラグを持たせておく（UI側に影響しないように拡張）
                  // @ts-ignore
                  isGenerated: false,
                  // @ts-ignore
                  messageId: message.id
                });
              }

              // AI生成画像（generatedImages）のチェック
              if (message.generatedImages && Array.isArray(message.generatedImages)) {
                for (const img of message.generatedImages) {
                  if (img.publishStatus === 'published' || img.publishStatus === 'hidden') {
                    managedImages.push({
                      ...img,
                      sessionId: metadata.id,
                      sessionTitle: metadata.title,
                      // @ts-ignore
                      isGenerated: true,
                      // @ts-ignore
                      messageId: message.id
                    });
                  }
                }
              }
            }
          }
        } catch (error) {
          console.warn(`[Manage] セッション ${entry.name} の読み込みをスキップしました`, error);
        }
      }
    }

    // 新しい順（またはファイル名・IDの降順）に並べ替え
    managedImages.sort((a, b) => b.id.localeCompare(a.id));

    return NextResponse.json(managedImages);
  } catch (error) {
    console.error('管理画像一覧取得エラー:', error);
    return NextResponse.json({ error: 'Failed to fetch managed images' }, { status: 500 });
  }
}
