import { NextResponse } from 'next/server';
import { getMessages } from '@/lib/storage';
import path from 'path';
import fs from 'fs/promises';

const DATA_DIR = path.join(process.cwd(), 'data', 'sessions');

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const sessionId = params.id;
    const { messageId } = await req.json();

    if (!messageId) {
      return NextResponse.json({ error: 'messageId is required' }, { status: 400 });
    }

    const messages = await getMessages(sessionId);
    const index = messages.findIndex(m => m.id === messageId);

    if (index === -1) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // indexの要素を含め、それ以降を全て削除 (indexの要素はユーザーの過去のプロンプト)
    const truncatedMessages = messages.slice(0, index);

    const messagesPath = path.join(DATA_DIR, sessionId, 'messages.json');
    await fs.writeFile(messagesPath, JSON.stringify(truncatedMessages, null, 2), 'utf-8');

    return NextResponse.json({ success: true, messages: truncatedMessages });
  } catch (error) {
    console.error("Rewind error:", error);
    return NextResponse.json({ error: 'Failed to rewind session' }, { status: 500 });
  }
}
