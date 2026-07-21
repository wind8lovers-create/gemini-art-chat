import { NextRequest, NextResponse } from 'next/server';
import { getSession, updateSession, getMessages, deleteSession } from '@/lib/storage';

/**
 * URLの [id] の部分を受け取って、特定のセッションに対する操作を行います。
 * params には { id: "session-12345" } のように対象のIDが入っています。
 */

/**
 * 【GET: 特定のセッションの情報を取得する】
 * サイドバーで過去の会話をクリックした時などに呼ばれ、
 * 「その部屋の情報」と「過去のやり取り」をまとめて返します。
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;
  
  // その部屋があるか探す
  const session = await getSession(sessionId);
  if (!session) {
    // 見つからなければ 404（Not Found）エラーを返す
    return NextResponse.json({ error: 'お探しのチャット履歴が見つかりません。' }, { status: 404 });
  }
  
  // 過去のメッセージのやり取りを全て取得する
  const messages = await getMessages(sessionId);
  
  // 部屋の情報とメッセージの両方を画面に返す
  return NextResponse.json({ session, messages });
}

/**
 * 【セッションの更新 (PATCH)】
 * タイトルなどが変更された時に呼ばれ、情報を上書き保存します。
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;
  
  // 画面から送られてきた新しいタイトルを受け取ります
  const { title } = await req.json();

  // その部屋があるか探す
  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: 'セッションが見つかりません' }, { status: 404 });
  }

  // タイトルと更新日時を上書きして保存します
  session.title = title;
  session.updatedAt = new Date().toISOString();
  await updateSession(session);

  return NextResponse.json(session);
}

/**
 * 【PUT: セッションの情報を更新する】
 * 「部屋のタイトル」を変えたい時などに呼ばれます。
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;
  
  // まず今の部屋の情報を取得
  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: 'お探しのチャット履歴が見つかりません。' }, { status: 404 });
  }
  
  // 画面から「どこを変えるか」の指示を受け取る（例： { title: "犬の絵に変更" }）
  const updates = await req.json();
  
  // 今の情報に、新しい情報を上書き（合体）させる
  // updatedAt（更新日時）も今の時間で上書きします
  const updatedSession = { 
    ...session, 
    ...updates, 
    updatedAt: new Date().toISOString() 
  };
  
  // ファイルに上書き保存
  await updateSession(updatedSession);

  // フォルダが変更された場合、移動先のフォルダが公開設定なら、このセッション内の画像も公開にする
  // （非公開フォルダに移動した場合は非公開にする）
  if (updates.folderId !== undefined && updates.folderId !== session.folderId) {
    const { getFolders } = await import('@/lib/storage');
    const folders = await getFolders();
    const targetFolder = folders.find(f => f.id === updates.folderId);
    
    if (targetFolder) {
      const newStatus = targetFolder.isPublished ? 'published' : 'none';
      const fs = await import('fs/promises');
      const path = await import('path');
      const messagesPath = path.join(process.cwd(), 'data', 'sessions', sessionId, 'messages.json');
      
      try {
        const messagesData = await fs.readFile(messagesPath, 'utf-8');
        const messages = JSON.parse(messagesData);
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
        console.error(`[Session API] セッション ${sessionId} の移動時画像ステータス更新に失敗:`, e);
      }
    }
  }
  
  // 更新し終わった最新の情報を画面に返す
  return NextResponse.json(updatedSession);
}

/**
 * 【DELETE: セッションを削除する】
 * サイドバーのゴミ箱ボタンが押された時などに呼ばれます。
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;
  
  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: 'セッションが見つかりません' }, { status: 404 });
  }

  await deleteSession(sessionId);

  return NextResponse.json({ success: true });
}
