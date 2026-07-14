import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'sessions');

export async function POST(req: Request) {
  try {
    const { sessionId, newTitle } = await req.json();

    if (!sessionId || !newTitle) {
      return NextResponse.json({ error: 'sessionId and newTitle are required' }, { status: 400 });
    }

    const metadataPath = path.join(DATA_DIR, sessionId, 'metadata.json');
    
    // Check if session exists
    try {
      await fs.access(metadataPath);
    } catch {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Read and update metadata
    const data = await fs.readFile(metadataPath, 'utf-8');
    const metadata = JSON.parse(data);
    
    metadata.title = newTitle;
    metadata.updatedAt = new Date().toISOString();

    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    return NextResponse.json({ success: true, title: newTitle });
  } catch (error) {
    console.error('タイトル変更エラー:', error);
    return NextResponse.json({ error: 'Failed to rename session' }, { status: 500 });
  }
}
