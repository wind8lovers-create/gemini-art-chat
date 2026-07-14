import { NextResponse } from 'next/server';
import { getSnippets, saveSnippets } from '@/lib/storage';

export async function GET() {
  try {
    const snippets = await getSnippets();
    return NextResponse.json(snippets);
  } catch (error) {
    console.error("スニペット取得エラー:", error);
    return NextResponse.json({ error: 'Failed to fetch snippets' }, { status: 500 });
  }
}

// 配列を丸ごと受け取って上書き保存します（件数が少ないためこれで十分）
export async function POST(req: Request) {
  try {
    const snippets = await req.json();
    if (!Array.isArray(snippets)) {
      return NextResponse.json({ error: '配列形式で送信してください' }, { status: 400 });
    }
    
    await saveSnippets(snippets);
    return NextResponse.json({ success: true, snippets });
  } catch (error) {
    console.error("スニペット保存エラー:", error);
    return NextResponse.json({ error: 'Failed to save snippets' }, { status: 500 });
  }
}
