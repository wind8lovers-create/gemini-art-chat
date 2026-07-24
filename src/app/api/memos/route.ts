import { NextResponse } from 'next/server';
import { readMemos, writeMemos } from '@/lib/memos';

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

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ success: false, error: 'IDが指定されていません' }, { status: 400 });
    }
    const memos = readMemos();
    const index = memos.findIndex((m: any) => m.id === body.id);
    if (index === -1) {
      return NextResponse.json({ success: false, error: 'メモが見つかりません' }, { status: 404 });
    }
    
    memos[index] = {
      ...memos[index],
      title: body.title !== undefined ? body.title : memos[index].title,
      content: body.content !== undefined ? body.content : memos[index].content,
      tags: body.tags !== undefined ? body.tags : memos[index].tags,
      updatedAt: new Date().toISOString()
    };
    
    if (writeMemos(memos)) {
      return NextResponse.json({ success: true, memo: memos[index] });
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
