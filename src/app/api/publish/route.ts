import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { Message } from '@/types';

const DATA_DIR = path.join(process.cwd(), 'data', 'sessions');

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, messageId, imageId, publishStatus, isGenerated } = body;

    if (!sessionId || !publishStatus) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const messagesPath = path.join(DATA_DIR, sessionId, 'messages.json');
    const data = await fs.readFile(messagesPath, 'utf-8');
    const messages: Message[] = JSON.parse(data);

    let updated = false;

    for (let i = 0; i < messages.length; i++) {
      if (messageId && messages[i].id !== messageId) continue;

      if (isGenerated && messages[i].generatedImages) {
        for (let j = 0; j < messages[i].generatedImages!.length; j++) {
          if (messages[i].generatedImages![j].id === imageId) {
            messages[i].generatedImages![j].publishStatus = publishStatus;
            updated = true;
            break;
          }
        }
      } else if (!isGenerated && messages[i].inputImage) {
        if (!imageId || messages[i].id === imageId || messages[i].inputImage?.id === imageId) {
            messages[i].inputImage!.publishStatus = publishStatus;
            updated = true;
        }
      }

      if (updated) break;
    }

    if (updated) {
      await fs.writeFile(messagesPath, JSON.stringify(messages, null, 2), 'utf-8');
      console.log(`[Publish API] Success. imageId=${imageId}, status=${publishStatus}, isGenerated=${isGenerated}`);
      return NextResponse.json({ success: true, publishStatus });
    } else {
      console.error(`[Publish API] Image not found. imageId=${imageId}, isGenerated=${isGenerated}`);
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }
  } catch (error) {
    console.error('公開ステータス更新エラー:', error);
    return NextResponse.json({ error: 'Failed to update publish status' }, { status: 500 });
  }
}
