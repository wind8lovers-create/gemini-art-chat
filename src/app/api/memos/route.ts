import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// メモデータの保存先（今回はローカルJSONファイルを使用）
const dataFilePath = path.join(process.cwd(), 'src', 'data', 'memos.json');

// データを読み込むヘルパー関数
function readMemos() {
  try {
    if (!fs.existsSync(dataFilePath)) {
      return [];
    }
    const data = fs.readFileSync(dataFilePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error("データの読み込みエラー:", error);
    return [];
  }
}

// データを書き込むヘルパー関数
function writeMemos(memos: any[]) {
  try {
    const dir = path.dirname(dataFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(dataFilePath, JSON.stringify(memos, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error("データの書き込みエラー:", error);
    return false;
  }
}

export async function GET() {
  const memos = readMemos();
  // 最新のものが一番上に来るようにソート
  memos.sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return NextResponse.json(memos);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const memos = readMemos();
    
    const newMemo = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
      title: body.title || '無題のメモ',
      content: body.content || '',
      tags: body.tags || [],
      updatedAt: new Date().toISOString()
    };
    
    memos.push(newMemo);
    
    if (writeMemos(memos)) {
      return NextResponse.json({ success: true, memo: newMemo });
    } else {
      return NextResponse.json({ success: false, error: '書き込みに失敗しました' }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: '不正なリクエスト' }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ success: false, error: 'IDが指定されていません' }, { status: 400 });
    }
    
    const memos = readMemos();
    const newMemos = memos.filter((m: any) => m.id !== id);
    
    if (writeMemos(newMemos)) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, error: '削除に失敗しました' }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: '削除エラー' }, { status: 500 });
  }
}
