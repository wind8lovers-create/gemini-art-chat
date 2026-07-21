import { NextResponse, NextRequest } from 'next/server';
import { getImapClient, parseEmail } from '@/lib/gmailHelper';
import { getImportedEmails } from '@/lib/importedEmails';
import { getCache, saveCache, cleanupCache } from '@/lib/gmailCache';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'manual30';

    const client = await getImapClient();
    const importedEmails = await getImportedEmails();

    let lock = await client.getMailboxLock('INBOX');
    const emails = [];

    try {
      // 送信者に 'kiz' が含まれるものを検索
      // 送信者に 'kiz' が含まれるものを検索
      const searchResult = await client.search({ from: 'kiz' }, { uid: true });
      
      const limit = 30;
      const uids = searchResult.slice(-limit);

      const validUids: string[] = [];

      for (const uid of uids) {
        const uidStr = uid.toString();
        validUids.push(uidStr);

        const cached = await getCache(uidStr);
        const isImported = importedEmails.includes(uidStr);

        if (cached) {
          // キャッシュが存在すれば、通信をスキップして即利用
          emails.push({
            ...cached,
            isImported
          });
          continue;
        }

        // キャッシュがない場合は source まで取得し、即プレビュー＆キャッシュ保存
        const message = await client.fetchOne(uidStr, { source: true }, { uid: true });
        if (!message || !message.source) continue;

        const parsed = await parseEmail(message.source);
        
        const fromAddress = parsed.from?.value?.[0]?.address || '';
        const fromName = parsed.from?.value?.[0]?.name || '';
        const fromText = `${fromName} ${fromAddress}`.toLowerCase();
        
        if (!fromText.includes('kiz')) {
          continue;
        }

        const attachments = parsed.attachments || [];
        const targetAttachment = attachments.find(a => 
          a.contentType.startsWith('image/') || a.contentType.startsWith('video/')
        );

        if (!targetAttachment) continue;

        const emailData = {
          uid: uidStr,
          subject: parsed.subject || '無題',
          prompt: parsed.text || '',
          filename: targetAttachment.filename || 'unknown_file',
          mimeType: targetAttachment.contentType,
          contentBase64: targetAttachment.content.toString('base64'),
        };

        // 取得したデータをキャッシュに保存
        await saveCache(emailData);

        emails.push({
          ...emailData,
          isImported
        });
      }

      // 今回の最新30件に含まれなかった古いキャッシュを削除
      await cleanupCache(validUids);
    } finally {
      lock.release();
    }
    
    await client.logout();
    
    // 新しい順（降順）にして返す
    emails.reverse();
    return NextResponse.json(emails);
  } catch (error: any) {
    console.error('Gmail取得エラー:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
