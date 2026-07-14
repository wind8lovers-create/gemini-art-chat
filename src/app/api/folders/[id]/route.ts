import { NextRequest, NextResponse } from 'next/server';
import { getFolders, updateFolder, deleteFolder } from '@/lib/storage';

export async function PATCH(
  req: NextRequest, 
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const updates = await req.json();
    
    const folders = await getFolders();
    const folder = folders.find(f => f.id === id);
    
    if (!folder) {
      return NextResponse.json({ error: 'フォルダが見つかりません' }, { status: 404 });
    }
    
    const updatedFolder = { ...folder, ...updates };
    await updateFolder(updatedFolder);
    
    return NextResponse.json(updatedFolder);
  } catch (error) {
    console.error("フォルダ更新エラー:", error);
    return NextResponse.json({ error: 'Failed to update folder' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest, 
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteFolder(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("フォルダ削除エラー:", error);
    return NextResponse.json({ error: 'Failed to delete folder' }, { status: 500 });
  }
}
