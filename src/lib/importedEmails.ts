import fs from 'fs/promises';
import path from 'path';

const IMPORTED_EMAILS_FILE = path.join(process.cwd(), 'data', 'imported_emails.json');

export async function getImportedEmails(): Promise<string[]> {
  try {
    const data = await fs.readFile(IMPORTED_EMAILS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return [];
    }
    console.error('取り込み済みメールリストの読み込みエラー:', error);
    return [];
  }
}

export async function addImportedEmail(messageId: string): Promise<void> {
  const current = await getImportedEmails();
  if (!current.includes(messageId)) {
    current.push(messageId);
    await fs.writeFile(IMPORTED_EMAILS_FILE, JSON.stringify(current, null, 2), 'utf-8');
  }
}
