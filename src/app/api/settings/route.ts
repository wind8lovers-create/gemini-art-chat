import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const SETTINGS_FILE_PATH = path.join(process.cwd(), 'data', 'app_settings.json');

// 初期設定（デフォルト値）
const DEFAULT_SETTINGS = {
  pagesPassword: 'nino',
  promptMemoImportMode: 'all'
};

export async function GET() {
  try {
    const fileContents = await fs.readFile(SETTINGS_FILE_PATH, 'utf-8');
    const settings = JSON.parse(fileContents);
    return NextResponse.json(settings);
  } catch (error: any) {
    // ファイルが存在しない場合はデフォルト値を返す
    if (error.code === 'ENOENT') {
      return NextResponse.json(DEFAULT_SETTINGS);
    }
    console.error('設定の読み込みに失敗しました:', error);
    return NextResponse.json({ error: '設定の読み込みに失敗しました' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const newSettings = await request.json();
    
    // 既存の設定を読み込む（存在しない場合はデフォルト）
    let currentSettings = { ...DEFAULT_SETTINGS };
    try {
      const fileContents = await fs.readFile(SETTINGS_FILE_PATH, 'utf-8');
      currentSettings = { ...currentSettings, ...JSON.parse(fileContents) };
    } catch (e) {
      // ファイルがない場合は無視
    }

    // 設定をマージ
    const mergedSettings = { ...currentSettings, ...newSettings };

    // ディレクトリが存在しない場合は作成
    await fs.mkdir(path.dirname(SETTINGS_FILE_PATH), { recursive: true });
    
    // 保存
    await fs.writeFile(SETTINGS_FILE_PATH, JSON.stringify(mergedSettings, null, 2), 'utf-8');
    
    return NextResponse.json({ success: true, settings: mergedSettings });
  } catch (error) {
    console.error('設定の保存に失敗しました:', error);
    return NextResponse.json({ error: '設定の保存に失敗しました' }, { status: 500 });
  }
}
