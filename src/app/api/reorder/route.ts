import { NextResponse } from 'next/server';
import { getFolders, updateFolder, getSessions, updateSession } from '@/lib/storage';

export async function POST(req: Request) {
  try {
    const { type, items } = await req.json(); // type: 'folder' | 'session', items: { id: string, order: number }[]

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Invalid items array' }, { status: 400 });
    }

    if (type === 'folder') {
      const folders = await getFolders();
      for (const item of items) {
        const folder = folders.find(f => f.id === item.id);
        if (folder) {
          await updateFolder({ ...folder, order: item.order });
        }
      }
    } else if (type === 'session') {
      const sessions = await getSessions();
      for (const item of items) {
        const session = sessions.find(s => s.id === item.id);
        if (session) {
          await updateSession({ ...session, order: item.order });
        }
      }
    } else {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("並び替えエラー:", error);
    return NextResponse.json({ error: 'Failed to reorder' }, { status: 500 });
  }
}
