import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function GET() {
  try {
    const { ZipArchive } = require('archiver');
    const dataDir = path.join(process.cwd(), 'data');
    const zipPath = path.join(process.cwd(), 'backup.zip');

    // 一旦ローカルにZIPファイルを作成する
    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = new ZipArchive({ zlib: { level: 9 } });

      output.on('close', () => resolve(true));
      archive.on('error', (err) => reject(err));

      archive.pipe(output);
      archive.directory(dataDir, false); // dataフォルダの中身を全て追加
      archive.finalize();
    });

    // 作成したZIPファイルを読み込む
    const fileBuffer = fs.readFileSync(zipPath);
    
    // 一時ファイルを削除
    fs.unlinkSync(zipPath);

    const now = new Date();
    const dateString = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="gemini_art_chat_backup_${dateString}.zip"`
      }
    });
  } catch (error) {
    console.error('ZIP圧縮エラー:', error);
    return NextResponse.json({ error: 'バックアップの作成に失敗しました' }, { status: 500 });
  }
}
