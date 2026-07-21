import { NextRequest, NextResponse } from 'next/server';
import { getFolders, updateFolder, deleteFolder, getSessions } from '@/lib/storage';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'sessions');

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
    
    // フォルダの公開状態が変わった場合、フォルダ内の全画像のステータスも連動させる
    if (updates.isPublished !== undefined) {
      const sessions = await getSessions();
      const folderSessions = sessions.filter(s => s.folderId === id);
      const newStatus = updates.isPublished ? 'published' : 'none';
      
      for (const session of folderSessions) {
        const messagesPath = path.join(DATA_DIR, session.id, 'messages.json');
        try {
          const data = await fs.readFile(messagesPath, 'utf-8');
          const messages = JSON.parse(data);
          let isUpdated = false;
          
          for (const msg of messages) {
            if (msg.generatedImages) {
              for (const img of msg.generatedImages) {
                if (img.publishStatus !== newStatus) {
                  img.publishStatus = newStatus;
                  isUpdated = true;
                }
              }
            }
            if (msg.inputImage) {
              if (msg.inputImage.publishStatus !== newStatus) {
                msg.inputImage.publishStatus = newStatus;
                isUpdated = true;
              }
            }
          }
          if (isUpdated) {
            await fs.writeFile(messagesPath, JSON.stringify(messages, null, 2), 'utf-8');
          }
        } catch(e) {
          console.error(`[Folder API] セッション ${session.id} の画像一括更新に失敗:`, e);
        }
      }
    }
    
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
