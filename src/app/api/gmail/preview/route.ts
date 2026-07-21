import { NextResponse } from 'next/server';
import { getImapClient, parseEmail } from '@/lib/gmailHelper';
import { getCache, saveCache } from '@/lib/gmailCache';

export async function POST(request: Request) {
  try {
    const { uid } = await request.json();
    if (!uid) {
      return NextResponse.json({ error: 'UIDが指定されていません。' }, { status: 400 });
    }

    const client = await getImapClient();
    let lock = await client.getMailboxLock('INBOX');
    let previewData = null;

    try {
      const uidStr = uid.toString();
      
      const cached = await getCache(uidStr);
      if (cached) {
        if (lock) lock.release();
        if (client) await client.logout();
        return NextResponse.json(cached);
      }

      const message = await client.fetchOne(uidStr, { source: true }, { uid: true });
      if (message && message.source) {
        const parsed = await parseEmail(message.source);
        
        // 添付ファイルを探す
        const attachments = parsed.attachments || [];
        const targetAttachment = attachments.find((a: any) => 
          a.contentType.startsWith('image/') || a.contentType.startsWith('video/')
        );

        if (targetAttachment) {
          previewData = {
            uid: uidStr,
            prompt: parsed.text || '',
            filename: targetAttachment.filename || 'unknown_file',
            mimeType: targetAttachment.contentType,
            contentBase64: targetAttachment.content.toString('base64'),
          };
          // キャッシュとして保存
          await saveCache(previewData);
        } else {
          // 添付ファイルがない場合
          previewData = {
            prompt: parsed.text || '',
            filename: '',
            mimeType: '',
            contentBase64: '',
            error: '画像または動画の添付ファイルが見つかりませんでした。'
          };
        }
      }
    } finally {
      lock.release();
    }
    
    await client.logout();

    if (previewData) {
      return NextResponse.json(previewData);
    } else {
      return NextResponse.json({ error: 'メールの取得に失敗しました。' }, { status: 404 });
    }
  } catch (error: any) {
    console.error('プレビュー取得エラー:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
