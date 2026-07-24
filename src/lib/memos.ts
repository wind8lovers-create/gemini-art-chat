import fs from 'fs';
import path from 'path';

// メモデータの保存先（今回はローカルJSONファイルを使用）
const dataFilePath = path.join(process.cwd(), 'src', 'data', 'memos.json');

// データを読み込むヘルパー関数
export function readMemos() {
  try {
    if (!fs.existsSync(dataFilePath)) {
      return [];
    }
    const data = fs.readFileSync(dataFilePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error("データの読み込みエラー:", error);
    return [];
  }
}

// データを書き込むヘルパー関数
export function writeMemos(memos: any[]) {
  try {
    const dir = path.dirname(dataFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(dataFilePath, JSON.stringify(memos, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error("データの書き込みエラー:", error);
    return false;
  }
}
