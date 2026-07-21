import { NextResponse } from 'next/server';
import { getSession, getMessages, updateSession } from '@/lib/storage';
import path from 'path';
import fs from 'fs/promises';

const DATA_DIR = path.join(process.cwd(), 'data', 'sessions');

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string, messageId: string }> }
) {
  try {
    const { sessionId, messageId } = await params;
    const updates = await req.json(); // { title?: string, customComment?: string, prompt?: string, isGenerated?: boolean }
    
    const messages = await getMessages(sessionId);
    const messageIndex = messages.findIndex(m => m.id === messageId);
    
    if (messageIndex === -1) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }
    
    const message = messages[messageIndex];
    let updated = false;

    if (updates.isGenerated) {
      if (message.generatedImages) {
        message.generatedImages = message.generatedImages.map(img => {
          if (img.id === messageId || img.filename === messageId || (img as any).messageId === messageId || true) { 
            // 簡易的にこのメッセージ内の全生成画像（通常1つ）に適用
            updated = true;
            return { 
              ...img, 
              title: updates.title ?? img.title, 
              customComment: updates.customComment ?? img.customComment,
              prompt: updates.prompt ?? img.prompt
            };
          }
          return img;
        });
      }
    } else {
      if (message.inputImage) {
        updated = true;
        message.inputImage = { 
          ...message.inputImage, 
          title: updates.title ?? message.inputImage.title, 
          customComment: updates.customComment ?? message.inputImage.customComment
        };
      }
      if (updates.prompt !== undefined) {
        updated = true;
        message.text = updates.prompt;
      }
    }

    if (updated) {
      const messagesPath = path.join(DATA_DIR, sessionId, 'messages.json');
      await fs.writeFile(messagesPath, JSON.stringify(messages, null, 2), 'utf-8');
      
      const session = await getSession(sessionId);
      if (session) {
        session.updatedAt = new Date().toISOString();
        await updateSession(session);
      }
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('メタデータ更新エラー:', error);
    return NextResponse.json({ error: 'Failed to update metadata' }, { status: 500 });
  }
}
