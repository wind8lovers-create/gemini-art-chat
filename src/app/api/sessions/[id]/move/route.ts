import { NextRequest, NextResponse } from 'next/server';
import { getSession, updateSession } from '@/lib/storage';

/**
 * 【セッションのフォルダ移動 API】
 * POST /api/sessions/[id]/move
 * body: { folderId: string | null }
 */
export async function POST(
  req: NextRequest, 
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const { folderId } = await req.json();

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'セッションが見つかりません' }, { status: 404 });
    }

    session.folderId = folderId;
    session.updatedAt = new Date().toISOString();
    
    await updateSession(session);

    return NextResponse.json(session);
  } catch (error) {
    console.error("セッション移動エラー:", error);
    return NextResponse.json({ error: 'Failed to move session' }, { status: 500 });
  }
}
