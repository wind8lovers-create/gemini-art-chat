import { NextResponse } from 'next/server';
import { getFolders, createFolder } from '@/lib/storage';

export async function GET() {
  try {
    const folders = await getFolders();
    return NextResponse.json(folders);
  } catch (error) {
    console.error("フォルダ一覧取得エラー:", error);
    return NextResponse.json({ error: 'Failed to fetch folders' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { name } = await req.json();
    if (!name) {
      return NextResponse.json({ error: 'フォルダ名が必要です' }, { status: 400 });
    }
    const newFolder = await createFolder(name);
    return NextResponse.json(newFolder, { status: 201 });
  } catch (error) {
    console.error("フォルダ作成エラー:", error);
    return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 });
  }
}
