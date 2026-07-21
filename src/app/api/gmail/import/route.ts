import { NextResponse } from 'next/server';
import { getFolders, createFolder, createSession, saveImage } from '@/lib/storage';
import { addImportedEmail } from '@/lib/importedEmails';
import { Session } from '@/types';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const { emails } = await request.json();
    if (!emails || !Array.isArray(emails)) {
      return NextResponse.json({ error: 'メールデータが不正です。' }, { status: 400 });
    }

    // 「取り込みフォルダ」を探す、なければ作る
    let folders = await getFolders();
    let importFolder = folders.find(f => f.name === '取り込みフォルダ');
    
    if (!importFolder) {
      importFolder = await createFolder('取り込みフォルダ');
    }

    // 未取得（プレビューしていない）のメールデータがある場合のため、IMAPクライアントを準備
    let client = null;
    let lock = null;
    const { getImapClient, parseEmail } = await import('@/lib/gmailHelper');
    const { saveMessage } = await import('@/lib/storage');

    for (const email of emails) {
      let finalFilename = email.filename;
      let finalMimeType = email.mimeType;
      let finalContentBase64 = email.contentBase64;
      let finalPrompt = email.prompt;

      // Base64データがない（プレビューボタンを押さずに一括取込された）場合は直接ダウンロードする
      if (!finalContentBase64) {
        if (!client) {
          client = await getImapClient();
          lock = await client.getMailboxLock('INBOX');
        }
        
        try {
          const message = await client.fetchOne(email.uid.toString(), { source: true }, { uid: true });
          if (message && message.source) {
            const parsed = await parseEmail(message.source);
            const attachments = parsed.attachments || [];
            const targetAttachment = attachments.find((a: any) => 
              a.contentType.startsWith('image/') || a.contentType.startsWith('video/')
            );
            if (targetAttachment) {
              finalFilename = targetAttachment.filename || 'unknown_file';
              finalMimeType = targetAttachment.contentType;
              finalContentBase64 = targetAttachment.content.toString('base64');
              finalPrompt = parsed.text || '';
            }
          }
        } catch (e) {
          console.error(`メールUID: ${email.uid} のダウンロードに失敗しました:`, e);
          continue; // ダウンロード失敗時はスキップ
        }
      }

      const sessionId = crypto.randomUUID();
      
      // 新しいセッション（画像まとめ）を作成
      const newSession: Session = {
        id: sessionId,
        title: email.subject || '無題',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        imageCount: 1,
        folderId: importFolder.id // 取り込みフォルダに紐付ける
      };

      await createSession(newSession);

      // 画像（または動画）の保存
      await saveImage(sessionId, finalFilename, finalContentBase64);

      // チャット画面に表示させるためのメッセージ情報を追加
      const mediaType = finalMimeType.startsWith('video/') ? 'video' : 'image';
      const newMessage = {
        id: crypto.randomUUID(),
        sender: 'ai',
        text: finalPrompt || 'メールから取り込みました。',
        timestamp: new Date().toISOString(),
        generatedImages: [{
          id: crypto.randomUUID(),
          filename: finalFilename,
          prompt: finalPrompt || '',
          version: 1,
          parentImageId: null,
          mediaType: mediaType as 'image' | 'video',
          title: email.subject || '無題'
        }]
      };
      
      await saveMessage(sessionId, newMessage as any);

      // 処理済みとしてIDを記録
      await addImportedEmail(email.uid);
    }

    if (lock) lock.release();
    if (client) await client.logout();

    return NextResponse.json({ success: true, count: emails.length });
  } catch (error: any) {
    console.error('取り込みエラー:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
