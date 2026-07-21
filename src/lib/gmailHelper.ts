import { ImapFlow } from 'imapflow';
import { simpleParser, ParsedMail } from 'mailparser';

export async function getImapClient() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_PASSWORD;

  if (!user || !pass || user === 'your_email@gmail.com') {
    throw new Error('Gmailの認証情報が設定されていません。.env.local を確認してください。');
  }

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: {
      user: user,
      pass: pass
    },
    logger: false // ログを無効化
  });

  await client.connect();
  return client;
}

export async function parseEmail(source: Buffer | string): Promise<ParsedMail> {
  return await simpleParser(source);
}
