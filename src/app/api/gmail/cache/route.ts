import { NextResponse } from 'next/server';
import { clearAllCache } from '@/lib/gmailCache';

export async function DELETE() {
  try {
    await clearAllCache();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('キャッシュ削除エラー:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
