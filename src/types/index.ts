/**
 * Gemini Art Chat - データ型定義ファイル
 * アプリ内で使われるデータの「ルール（形）」をここにまとめます。
 */

// セッション（会話の単位）の型定義
export interface Session {
  id: string;             // セッションの一意なID
  title: string;          // セッションのタイトル（例：猫のイラスト制作）
  createdAt: string;      // 作成日時
  updatedAt: string;      // 最終更新日時
  imageCount: number;     // このセッションで生成された画像の数
  folderId?: string | null; // 所属するフォルダのID（フェーズ5）
}

// フォルダを表す型定義（フェーズ5）
export interface SessionFolder {
  id: string;
  name: string;
  createdAt: string;
  isOpen: boolean; // サイドバーで展開されているかどうか
}

// 定型文スニペットを表す型定義（フェーズ6）
export interface PromptSnippet {
  id: string;
  title: string;   // 例: "高画質化"
  content: string; // 例: "細かいジャギを補正して..."
}

// 生成された画像（メタデータ）の型定義
export interface GeneratedImage {
  id: string;             // 画像の一意なID
  filename: string;       // 保存されたファイル名
  prompt: string;         // この画像を生成した時の指示文
  version: number;        // バージョン番号
  parentImageId: string | null; // 元になった画像のID（修正画像の場合）
  isFavorite?: boolean;   // お気に入りに追加されているかどうか（フェーズ4）
}

// ギャラリー用に使う拡張画像データ型（どのセッションの画像かわかるようにする）
export interface GalleryImage extends GeneratedImage {
  sessionId: string;
  sessionTitle: string;
}

// 画像のバージョン履歴をまとめるための型定義
export interface ImageVersion {
  id: string;
  versions: GeneratedImage[]; // 関連するバージョンの画像リスト
}

// Git（バージョン管理）の状態を表す型定義
export interface GitStatus {
  changedFiles: number;           // 変更されたファイルの数
  lastCommitMessage: string | null; // 最後のコミットメッセージ
  branch: string;                 // 現在のブランチ名
}

// チャットのメッセージの型定義
export interface Message {
  id: string;             // メッセージの一意なID
  sender: "user" | "ai";  // ユーザーかAIか
  text: string;           // 送信したテキスト
  timestamp: string;      // 送信日時
  
  // AIが画像を生成した場合、この項目に画像の情報が入ります
  generatedImages?: GeneratedImage[];
  
  // ユーザーが画像をアップロードして修正を頼んだ場合、この項目に画像データが入ります
  inputImage?: {
    id?: string;
    mimeType: string;
    data: string; // base64形式のデータ
    isFavorite?: boolean;
  };
}
