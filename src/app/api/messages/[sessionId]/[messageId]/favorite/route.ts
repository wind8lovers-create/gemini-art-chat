import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { Message } from '@/types';

const DATA_DIR = path.join(process.cwd(), 'data', 'sessions');

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string; messageId: string }> }
) {
  try {
    const { sessionId, messageId } = await params;
    const body = await req.json();
    const isFavorite = body.isFavorite;

    const messagesPath = path.join(DATA_DIR, sessionId, 'messages.json');
    const data = await fs.readFile(messagesPath, 'utf-8');
    const messages: Message[] = JSON.parse(data);

    let updated = false;
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].id === messageId && messages[i].inputImage) {
        messages[i].inputImage!.isFavorite = isFavorite;
        updated = true;
        break;
      }
    }

    if (updated) {
      await fs.writeFile(messagesPath, JSON.stringify(messages, null, 2), 'utf-8');
      return NextResponse.json({ success: true, isFavorite });
    } else {
      return NextResponse.json({ error: 'Message or inputImage not found' }, { status: 404 });
    }
  } catch (error) {
    console.error('お気に入り登録エラー:', error);
    return NextResponse.json({ error: 'Failed to update favorite' }, { status: 500 });
  }
}
