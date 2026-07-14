import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

export async function GET() {
  try {
    // 変更されたファイルの一覧を取得（-s は短いフォーマット）
    const { stdout } = await execAsync('git status -s');
    
    // 文字列を行ごとに分割して配列にする
    const files = stdout.split('\n').filter(line => line.trim() !== '').map(line => {
      // 例: " M src/app/page.tsx" または "?? data/sessions/xxx"
      const status = line.substring(0, 2).trim();
      const path = line.substring(3).trim();
      return { status, path };
    });
    
    return NextResponse.json({ files });
  } catch (error: any) {
    console.error("Git status error:", error);
    return NextResponse.json({ error: error.message || 'Failed to get git status' }, { status: 500 });
  }
}
