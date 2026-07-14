import fs from 'fs/promises';
import path from 'path';
import { Session, Message, SessionFolder, PromptSnippet } from '@/types';

// データ保存先の基準となるフォルダパス
const DATA_DIR = path.join(process.cwd(), 'data', 'sessions');
const FOLDERS_FILE = path.join(process.cwd(), 'data', 'folders.json');
const SNIPPETS_FILE = path.join(process.cwd(), 'data', 'snippets.json');

/**
 * フォルダが存在するかどうかを確認し、なければ自動で作成する便利ツールです。
 * （これがないと、フォルダがない時にエラーになってしまいます）
 */
async function ensureDir(dirPath: string) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    // 既にフォルダが存在する場合は何もしません
  }
}

/**
 * 【フォルダ一覧の取得】
 */
export async function getFolders(): Promise<SessionFolder[]> {
  try {
    const data = await fs.readFile(FOLDERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

/**
 * 【フォルダの保存】
 */
export async function saveFolders(folders: SessionFolder[]): Promise<void> {
  await ensureDir(path.join(process.cwd(), 'data'));
  await fs.writeFile(FOLDERS_FILE, JSON.stringify(folders, null, 2), 'utf-8');
}

/**
 * 【フォルダの作成】
 */
export async function createFolder(name: string): Promise<SessionFolder> {
  const folders = await getFolders();
  const newFolder: SessionFolder = {
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    isOpen: true
  };
  folders.push(newFolder);
  await saveFolders(folders);
  return newFolder;
}

/**
 * 【フォルダの更新】
 */
export async function updateFolder(updatedFolder: SessionFolder): Promise<void> {
  const folders = await getFolders();
  const index = folders.findIndex(f => f.id === updatedFolder.id);
  if (index !== -1) {
    folders[index] = updatedFolder;
    await saveFolders(folders);
  }
}

/**
 * 【フォルダの削除】
 */
export async function deleteFolder(folderId: string): Promise<void> {
  const folders = await getFolders();
  const filtered = folders.filter(f => f.id !== folderId);
  await saveFolders(filtered);
  
  // フォルダ内のセッションをルートに戻す
  const sessions = await getSessions();
  for (const session of sessions) {
    if (session.folderId === folderId) {
      session.folderId = null;
      await updateSession(session);
    }
  }
}

/**
 * 【定型文（スニペット）一覧の取得】
 */
export async function getSnippets(): Promise<PromptSnippet[]> {
  try {
    const data = await fs.readFile(SNIPPETS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    // ファイルがない場合は初期設定の定型文を返す
    return [
      {
        id: crypto.randomUUID(),
        title: "高画質化（リフレッシュ）",
        content: "細かいジャギを補正して、線は綺麗に色合いやグラデーションもスムーズに表現してリフレッシュしてください。"
      }
    ];
  }
}

/**
 * 【定型文（スニペット）の保存】
 */
export async function saveSnippets(snippets: PromptSnippet[]): Promise<void> {
  await ensureDir(path.join(process.cwd(), 'data'));
  await fs.writeFile(SNIPPETS_FILE, JSON.stringify(snippets, null, 2), 'utf-8');
}

/**
 * 【セッション一覧の取得】
 * 保存されているすべてのセッション（会話部屋）を読み込んでリストで返します。
 */
export async function getSessions(): Promise<Session[]> {
  await ensureDir(DATA_DIR);
  // data/sessions フォルダの中身（フォルダのリスト）を取得します
  const entries = await fs.readdir(DATA_DIR, { withFileTypes: true });
  const sessions: Session[] = [];

  for (const entry of entries) {
    // フォルダだった場合のみ処理します
    if (entry.isDirectory()) {
      try {
        const metadataPath = path.join(DATA_DIR, entry.name, 'metadata.json');
        // metadata.json（セッションの情報）を読み込んでJSONに戻します
        const data = await fs.readFile(metadataPath, 'utf-8');
        sessions.push(JSON.parse(data));
      } catch (e) {
        // metadata.jsonが無いフォルダ（作りかけなど）は無視して進みます
      }
    }
  }
  
  // 更新日時が新しい順（降順）に並び替えてから返します
  return sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/**
 * 【特定のセッションの取得】
 * IDを指定して、そのセッションの情報を取得します。
 */
export async function getSession(sessionId: string): Promise<Session | null> {
  try {
    const metadataPath = path.join(DATA_DIR, sessionId, 'metadata.json');
    const data = await fs.readFile(metadataPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    // 見つからない場合は空っぽ(null)を返します
    return null;
  }
}

/**
 * 【新しいセッションの作成】
 * フォルダを作り、初期データとして metadata.json と messages.json を作ります。
 */
export async function createSession(session: Session): Promise<void> {
  const sessionDir = path.join(DATA_DIR, session.id);
  
  // セッション用のフォルダと、その中の画像保存用フォルダ(images)を作ります
  await ensureDir(sessionDir);
  await ensureDir(path.join(sessionDir, 'images'));
  
  // セッションの基本情報（タイトルなど）を保存
  await fs.writeFile(
    path.join(sessionDir, 'metadata.json'),
    JSON.stringify(session, null, 2),
    'utf-8'
  );
  
  // チャットの履歴を入れるための空っぽのリストを保存
  await fs.writeFile(
    path.join(sessionDir, 'messages.json'),
    JSON.stringify([], null, 2),
    'utf-8'
  );
}

/**
 * 【セッションの更新】
 * セッションのタイトルが変わったり、画像が増えた時に上書き保存します。
 */
export async function updateSession(session: Session): Promise<void> {
  const sessionDir = path.join(DATA_DIR, session.id);
  await fs.writeFile(
    path.join(sessionDir, 'metadata.json'),
    JSON.stringify(session, null, 2),
    'utf-8'
  );
}

/**
 * 【メッセージ一覧の取得】
 * 特定のセッションのこれまでのチャットのやり取り（メッセージ）を全て取得します。
 */
export async function getMessages(sessionId: string): Promise<Message[]> {
  try {
    const messagesPath = path.join(DATA_DIR, sessionId, 'messages.json');
    const data = await fs.readFile(messagesPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    // 履歴がない場合は空のリストを返します
    return [];
  }
}

/**
 * 【メッセージの保存（追加）】
 * 新しい発言（ユーザーからでもAIからでも）を、これまでの履歴に付け足して保存します。
 */
export async function saveMessage(sessionId: string, message: Message): Promise<void> {
  // まず今までのメッセージを読み込む
  const messages = await getMessages(sessionId);
  // 新しいメッセージをリストの最後に追加する
  messages.push(message);
  
  // 再度ファイルに上書き保存する
  const messagesPath = path.join(DATA_DIR, sessionId, 'messages.json');
  await fs.writeFile(messagesPath, JSON.stringify(messages, null, 2), 'utf-8');
}

/**
 * 【画像の保存】
 * AIが作ってくれた画像データ（Base64という文字の羅列）を、本物の画像ファイルとして保存します。
 */
export async function saveImage(sessionId: string, filename: string, base64Data: string): Promise<void> {
  const imagePath = path.join(DATA_DIR, sessionId, 'images', filename);
  
  // Base64の頭についている「data:image/png;base64,」のようなお約束の文字を取り除きます
  const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '');
  
  // 文字列を「画像（バイナリデータ）」に変換します
  const buffer = Buffer.from(base64Image, 'base64');
  
  // ファイルとして書き出します
  await fs.writeFile(imagePath, buffer);
}
