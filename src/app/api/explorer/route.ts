import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';
import os from 'os';

const DATA_DIR = path.join(process.cwd(), 'data');

export async function GET() {
  try {
    const isWindows = os.platform() === 'win32';
    if (isWindows) {
      // Windowsの場合はexplorerで開く
      exec(`explorer.exe "${DATA_DIR}"`);
      return NextResponse.json({ success: true, message: 'エクスプローラを開きました' });
    } else if (os.platform() === 'darwin') {
      // Macの場合
      exec(`open "${DATA_DIR}"`);
      return NextResponse.json({ success: true, message: 'Finderを開きました' });
    } else {
      // その他のOS (Linuxなど)
      exec(`xdg-open "${DATA_DIR}"`);
      return NextResponse.json({ success: true, message: 'ファイルマネージャを開きました' });
    }
  } catch (error) {
    console.error('エクスプローラ起動エラー:', error);
    return NextResponse.json({ error: 'エクスプローラの起動に失敗しました' }, { status: 500 });
  }
}
