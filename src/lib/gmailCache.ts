import fs from 'fs/promises';
import path from 'path';

export type CachedPreview = {
  uid: string;
  prompt: string;
  filename: string;
  mimeType: string;
  contentBase64: string;
};

const CACHE_DIR = path.join(process.cwd(), 'data', 'gmail_cache');

// キャッシュフォルダを作成する
export async function ensureCacheDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (e) {
    // 存在する場合は無視
  }
}

// UIDからキャッシュファイルのパスを取得
function getCacheFilePath(uid: string) {
  return path.join(CACHE_DIR, `${uid}.json`);
}

// キャッシュの保存
export async function saveCache(data: CachedPreview): Promise<void> {
  await ensureCacheDir();
  const filePath = getCacheFilePath(data.uid);
  await fs.writeFile(filePath, JSON.stringify(data), 'utf-8');
}

// キャッシュの取得
export async function getCache(uid: string): Promise<CachedPreview | null> {
  try {
    const filePath = getCacheFilePath(uid);
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null; // キャッシュがない場合
  }
}

// 全キャッシュの削除
export async function clearAllCache(): Promise<void> {
  try {
    await ensureCacheDir();
    const files = await fs.readdir(CACHE_DIR);
    for (const file of files) {
      if (file.endsWith('.json')) {
        await fs.unlink(path.join(CACHE_DIR, file));
      }
    }
  } catch (e) {
    console.error('キャッシュクリアエラー:', e);
  }
}

// 指定したUIDリスト（最新の30件など）に含まれないキャッシュファイルを削除する
export async function cleanupCache(validUids: string[]): Promise<void> {
  try {
    await ensureCacheDir();
    const files = await fs.readdir(CACHE_DIR);
    
    // ".json" を除いたファイル名部分（=uid）を取り出し、validUidsに含まれていなければ削除
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      
      const uid = file.replace('.json', '');
      if (!validUids.includes(uid)) {
        await fs.unlink(path.join(CACHE_DIR, file));
      }
    }
  } catch (e) {
    console.error('キャッシュのクリーンアップエラー:', e);
  }
}
