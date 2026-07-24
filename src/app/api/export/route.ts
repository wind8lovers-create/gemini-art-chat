import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'sessions');
const DOCS_DIR = path.join(process.cwd(), 'docs');
const ASSETS_DIR = path.join(DOCS_DIR, 'assets');

export async function POST() {
    try {
        // docsとassetsディレクトリがなければ作成
        await fs.mkdir(DOCS_DIR, { recursive: true });
        await fs.mkdir(ASSETS_DIR, { recursive: true });

        const entries = await fs.readdir(DATA_DIR, { withFileTypes: true }).catch(() => []);
        const exportData: any[] = [];

        // 現在のassets内のファイル一覧を取得
        const existingAssets = new Set(await fs.readdir(ASSETS_DIR).catch(() => []));

        for (const entry of entries) {
            if (entry.isDirectory()) {
                const metadataPath = path.join(DATA_DIR, entry.name, 'metadata.json');
                const messagesPath = path.join(DATA_DIR, entry.name, 'messages.json');

                try {
                    const metadataStr = await fs.readFile(metadataPath, 'utf-8');
                    const metadata = JSON.parse(metadataStr);

                    // フォルダ情報を取得して、公開状態を確認
                    const foldersDataRaw = await fs.readFile(path.join(process.cwd(), 'data', 'folders.json'), 'utf-8').catch(() => '[]');
                    const folders = JSON.parse(foldersDataRaw);
                    const folderMap = new Map(folders.map((f: any) => [f.id, f]));
                    const folder = metadata.folderId ? folderMap.get(metadata.folderId) : null;
                    const isFolderPublished = folder?.isPublished === true;

                    const messagesStr = await fs.readFile(messagesPath, 'utf-8');
                    const messages = JSON.parse(messagesStr);

                    if (Array.isArray(messages)) {
                        for (const msg of messages) {
                            // アップロード画像
                            const inputStatus = msg.inputImage?.publishStatus;
                            if (msg.inputImage && inputStatus === 'published') {
                                const isVideo = msg.inputImage.mimeType?.startsWith('video/');
                                const ext = isVideo ? '.mp4' : '.png';
                                const filename = `${msg.id}${ext}`;

                                exportData.push({
                                    id: msg.id,
                                    filename: filename,
                                    prompt: msg.text || 'アップロード画像',
                                    mediaType: isVideo ? 'video' : 'image',
                                    sessionTitle: metadata.title,
                                    category: metadata.title.includes('物語') ? 'story' : metadata.title.includes('プロンプト') ? 'prompt' : 'media',
                                    dataUri: msg.inputImage.data,
                                    title: msg.inputImage.title || '',
                                    customComment: msg.inputImage.customComment || '',
                                    folderId: metadata.folderId || null,
                                    sessionOrder: metadata.order ?? Number.MAX_SAFE_INTEGER
                                });
                            }

                            // 生成画像
                            if (msg.generatedImages && Array.isArray(msg.generatedImages)) {
                                for (const img of msg.generatedImages) {
                                    const imgStatus = img.publishStatus;
                                    if (imgStatus === 'published') {
                                        const isVideo = img.mediaType === 'video' || img.filename.endsWith('.mp4');
                                        exportData.push({
                                            id: img.id,
                                            filename: img.filename,
                                            prompt: img.prompt,
                                            mediaType: isVideo ? 'video' : 'image',
                                            sessionTitle: metadata.title,
                                            category: metadata.title.includes('物語') ? 'story' : metadata.title.includes('プロンプト') ? 'prompt' : 'media',
                                            sessionId: entry.name,
                                            isGenerated: true,
                                            title: img.title || '',
                                            customComment: img.customComment || '',
                                            folderId: metadata.folderId || null,
                                            sessionOrder: metadata.order ?? Number.MAX_SAFE_INTEGER
                                        });
                                    }
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.warn(`[Export] Error reading session ${entry.name}`, e);
                }
            }
        }

        // ファイルのコピー処理（差分同期）
        for (const item of exportData) {
            if (!existingAssets.has(item.filename)) {
                console.log(`[Export] Copying new asset: ${item.filename}`);
                const destPath = path.join(ASSETS_DIR, item.filename);

                if (item.isGenerated) {
                    const srcPath = path.join(DATA_DIR, item.sessionId, 'images', item.filename);
                    try {
                        await fs.copyFile(srcPath, destPath);
                        existingAssets.add(item.filename);
                    } catch (e) {
                        console.error(`[Export] Failed to copy generated image: ${srcPath}`, e);
                    }
                } else if (item.dataUri) {
                    try {
                        const base64Data = item.dataUri.split(',')[1];
                        const buffer = Buffer.from(base64Data, 'base64');
                        await fs.writeFile(destPath, buffer);
                        existingAssets.add(item.filename);
                    } catch (e) {
                        console.error(`[Export] Failed to save uploaded data to ${item.filename}`, e);
                    }
                }
            }

            delete item.dataUri;
            delete item.sessionId;
        }

        // フォルダ情報を取得して追加する
        const foldersDataRaw = await fs.readFile(path.join(process.cwd(), 'data', 'folders.json'), 'utf-8').catch(() => '[]');
        let foldersDataExport = JSON.parse(foldersDataRaw);
        foldersDataExport = foldersDataExport.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));

        // image はセッションの並び順（order）を優先し、同じセッション内では古い順（ID昇順）で表示
        exportData.sort((a, b) => {
            const orderA = a.sessionOrder;
            const orderB = b.sessionOrder;
            if (orderA !== orderB) {
                return orderA - orderB;
            }
            return a.id.localeCompare(b.id);
        });

        // メモデータを読み込む
        const memosDataRaw = await fs.readFile(path.join(process.cwd(), 'src', 'data', 'memos.json'), 'utf-8').catch(() => '[]');
        const memosData = JSON.parse(memosDataRaw);

        const finalExportData = {
            folders: foldersDataExport,
            images: exportData,
            memos: memosData
        };

        const dataJsContent = `const galleryData = ${JSON.stringify(finalExportData, null, 2)};`;
        await fs.writeFile(path.join(DOCS_DIR, 'data.js'), dataJsContent, 'utf-8');

        const packageJsonPath = path.join(process.cwd(), 'package.json');
        const packageJsonRaw = await fs.readFile(packageJsonPath, 'utf-8').catch(() => '{}');
        const packageJson = JSON.parse(packageJsonRaw);
        const nextVersion = (packageJson.dependencies?.next || '').replace(/[\^~]/g, '');
        const reactVersion = (packageJson.dependencies?.react || '').replace(/[\^~]/g, '');

        // 設定の読み込みを追加
        const settingsPath = path.join(process.cwd(), 'data', 'app_settings.json');
        let pagesPassword = 'nino';
        try {
            const settingsRaw = await fs.readFile(settingsPath, 'utf-8');
            const settings = JSON.parse(settingsRaw);
            if (settings.pagesPassword !== undefined) {
                pagesPassword = settings.pagesPassword;
            }
        } catch (e) { }

        await generateStaticFiles(nextVersion, reactVersion, pagesPassword);

        return NextResponse.json({ success: true, count: exportData.length });
    } catch (error) {
        console.error('Export Error:', error);
        return NextResponse.json({ error: 'Export failed' }, { status: 500 });
    }
}

async function generateStaticFiles(nextVersion: string = '', reactVersion: string = '', pagesPassword: string = 'nino') {
    const timestamp = Date.now();
    const indexHtml = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!-- 検索エンジン避け -->
    <meta name="robots" content="noindex, nofollow">
    <title>Feeling Gallery</title>
    <link rel="stylesheet" href="style.css?v=${Date.now()}">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body>
    ${pagesPassword ? `
    <!-- パスワード保護用オーバーレイ -->
    <div id="password-overlay" style="position:fixed; top:0; left:0; width:100%; height:100%; background:#1a1a2e; z-index:9999; display:flex; align-items:center; justify-content:center; flex-direction:column; color:white; font-family:Inter, sans-serif;">
        <div style="background:rgba(30,30,50,0.8); padding:40px; border-radius:12px; border:1px solid rgba(255,255,255,0.1); text-align:center; max-width:400px; width:90%;">
            <h2 style="margin-top:0; margin-bottom:10px;">アクセス制限</h2>
            <p style="margin-bottom:20px; font-size:14px; opacity:0.8;">このページを見るにはパスワードが必要です。</p>
            <input type="password" id="password-input" placeholder="パスワードを入力" style="padding:10px; width:100%; box-sizing:border-box; border-radius:8px; border:1px solid rgba(255,255,255,0.2); background:rgba(0,0,0,0.3); color:white; margin-bottom:10px;">
            <div id="password-error" style="color:#ff4d4f; font-size:12px; margin-bottom:10px; text-align:left; display:none;">パスワードが間違っています。</div>
            <button id="password-submit" style="padding:10px; width:100%; background:#0070f3; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:bold;">送信</button>
        </div>
    </div>
    
    <script>
        (function() {
            const overlay = document.getElementById('password-overlay');
            const input = document.getElementById('password-input');
            const submit = document.getElementById('password-submit');
            const error = document.getElementById('password-error');
            const CORRECT_PASSWORD = '${pagesPassword}';
            
            // すでにパスワード入力済みならオーバーレイを非表示にする
            if (sessionStorage.getItem('site_auth') === 'true') {
                overlay.style.display = 'none';
            }

            submit.addEventListener('click', function() {
                if (input.value === CORRECT_PASSWORD) {
                    sessionStorage.setItem('site_auth', 'true');
                    overlay.style.display = 'none';
                    error.style.display = 'none';
                } else {
                    error.style.display = 'block';
                }
            });

            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') submit.click();
            });
        })();
    </script>
    ` : ''}
    <header class="header glass-panel">
        <div class="logo" style="display: flex; align-items: center; gap: 8px;">
            <h1>🎨 Feeling Gallery</h1>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
            <!-- 検索バー追加 -->
            <input type="text" id="global-search" placeholder="🔍..." class="search-input" />
            <!-- サムネ動画再生モード切り替えボタン -->
            <button id="video-mode-toggle" class="nav-btn" style="font-size: 1.1rem; padding: 4px 8px; white-space: nowrap;" title="動画の再生モードを切り替えます（▶️再生/🔇無音 ⇔ ⏸️停止/🎵音あり）">▶️ 🔇</button>
            <!-- ヘッダー内のカテゴリ切り替えナビゲーション -->
            <nav class="nav">
                <button class="nav-btn active" data-category="media" title="生成画像・動画" style="padding: 4px 8px;">🖼️</button>
                <button class="nav-btn" data-category="prompt" title="プロンプトメモ" style="padding: 4px 8px;">💡</button>
            </nav>
        </div>
    </header>

    <div class="layout">
        <!-- サイドバー -->
        <aside class="sidebar glass-panel">
            <ul class="category-list">
                <li class="category-item active" data-category="media" style="display: flex; align-items: baseline; gap: 8px;">
                    <span style="font-size: 1.1rem; white-space: nowrap;">生成画像・動画</span>
                    <small style="opacity: 0.7; font-size: 0.8rem; white-space: nowrap;">(by Gemini)</small>
                </li>
                <li class="category-item" data-category="prompt" style="display: flex; align-items: baseline; gap: 8px;">
                    <span style="font-size: 1.1rem; white-space: nowrap;">プロンプトめも</span>
                    <small style="opacity: 0.7; font-size: 0.8rem; white-space: nowrap;">(AI Insights)</small>
                </li>
            </ul>

            <div class="sidebar-footer" style="text-align: center; font-size: 0.75rem; line-height: 1.4;">
                <p style="margin: 0;"><strong>&lt;画像動画生成AI&gt;</strong><br>
                -Gemini 3.1 Pro-<br>
                Nano Banana Pro<br>
                Nano Banana 2<br>
                Veo 3.1<br>
                <br>
                <strong>&lt;開発環境&gt;</strong><br>
                Next.js v${nextVersion} / React v${reactVersion}<br>
                Gemini Pro Vision<br>
                Antigravity AI<br>
                <a href="https://github.com/wind8lovers-create/gemini-art-chat" target="_blank" rel="noopener" style="color: #ccc; text-decoration: underline;">GitHub</a>
                <br><br>
                -Hazuki-kiz-<br>
                <img src="assets/a104e18c-528e-4d68-9f9c-a17c481c064d.png" alt="Hazuki" style="width: 100%; max-width: 120px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); margin-top: 4px;" />
                </p>
            </div>
        </aside>

        <!-- メインコンテンツ -->
        <main class="main-content">
            <div id="gallery-grid" class="grid"></div>
        </main>
    </div>

    <!-- モーダル -->
    <div id="modal" class="modal hidden">
        <div class="modal-content">
            <button id="modal-close" class="modal-close">✕</button>
            <div id="modal-body" class="modal-body"></div>
        </div>
    </div>

    <!-- Firebase SDK & 初期化 -->
    <script type="module">
        import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
        import { getFirestore, doc, setDoc, updateDoc, increment, collection, getDocs, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

        const firebaseConfig = {
            apiKey: "AIzaSyCQJ1faA_vWSiEpcAgQNl4Yqgk20z-1x-M",
            authDomain: "feeling-gallery.firebaseapp.com",
            projectId: "feeling-gallery",
            storageBucket: "feeling-gallery.firebasestorage.app",
            messagingSenderId: "66103896954",
            appId: "1:66103896954:web:14b3c4d252a2dde34644c3"
        };

        const app = initializeApp(firebaseConfig);
        const db = getFirestore(app);

        window.firebaseRecordVisitor = async () => {
            try {
                const statsRef = doc(db, 'stats', 'global');
                
                // 過去に訪問したことがあるかチェック
                if (localStorage.getItem('hasVisited')) {
                    // 訪問済みの場合、現在の訪問者数を取得
                    const docSnap = await getDoc(statsRef);
                    if (docSnap.exists()) {
                        const currentCount = docSnap.data().visitors || 0;
                        // 1000未満ならまだ「PVモード」としてカウントを増やす
                        if (currentCount < 1000) {
                            await updateDoc(statsRef, { visitors: increment(1) });
                        }
                        // 1000以上の場合は、もう「1人1回モード」なので何もしない
                    }
                } else {
                    // 初回訪問なら必ずカウントを増やし、訪問済みのメモを残す
                    await updateDoc(statsRef, { visitors: increment(1) }).catch(async (e) => {
                        if (e.code === 'not-found') await setDoc(statsRef, { visitors: 1, downloads: 0 });
                    });
                    localStorage.setItem('hasVisited', 'true');
                }
            } catch(e) { console.error(e); }
        };

        window.firebaseRecordView = async (imageId) => {
            try {
                const statsRef = doc(db, 'stats', 'global');
                await updateDoc(statsRef, { views: increment(1) }).catch(e => {});
                
                const imgRef = doc(db, 'images', imageId);
                await updateDoc(imgRef, { views: increment(1) }).catch(async (e) => {
                    if (e.code === 'not-found') await setDoc(imgRef, { views: 1 });
                });
            } catch(e) { console.error(e); }
        };

        window.firebaseGetPopularImages = async () => {
            try {
                const imagesRef = collection(db, 'images');
                const snapshot = await getDocs(imagesRef);
                const popularStats = {};
                snapshot.forEach(doc => {
                    popularStats[doc.id] = doc.data().views || 0;
                });
                return popularStats;
            } catch(e) { console.error(e); return {}; }
        };

        window.firebaseRecordVisitor();
    </script>
    <script src="data.js?v=${Date.now()}"></script>
    <script src="script.js?v=${Date.now()}"></script>
</body>
</html>`;

    const styleCss = `
:root {
  --bg-color: #1a1a2e;
  --panel-bg: rgba(30, 30, 50, 0.7);
  --text-color: #ffffff;
  --accent-color: #6a5acd;
  --border-radius: 12px;
}
body {
  margin: 0; padding: 0;
  background-color: var(--bg-color); color: var(--text-color);
  font-family: 'Inter', sans-serif;
}
.glass-panel {
  background: var(--panel-bg); backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.header {
  position: sticky; top: 0; z-index: 100;
  display: flex; justify-content: space-between; align-items: center;
  padding: 6px 16px;
}
.logo h1 { margin: 0; font-size: 1.4rem; }
.nav {
  display: flex; gap: 8px; align-items: center;
}
.nav-btn {
  background: rgba(255,255,255,0.1); color: #fff; border: none;
  padding: 8px 12px; border-radius: 8px; cursor: pointer; transition: 0.2s;
  font-size: 1.2rem; display: flex; justify-content: center; align-items: center;
}
.nav-btn:hover { background: rgba(255,255,255,0.2); }
.nav-btn.active { background: var(--accent-color); }
.breadcrumb {
  margin-bottom: 20px; display: flex; align-items: center; gap: 12px;
}
.folder-card { background: var(--panel-bg); cursor: pointer; transition: transform 0.2s; }
.folder-cover {
  width: 100%; aspect-ratio: 16/9; display: flex; align-items: center; justify-content: center;
  font-size: 4rem; background: rgba(0,0,0,0.5);
}
.folder-cover img, .folder-cover video {
  width: 100%; height: 100%; object-fit: cover;
}
.folder-info {
  padding: 12px; text-align: center;
}
.folder-info h3 { margin: 0; font-size: 1.1rem; }

.btn {
  background: rgba(255,255,255,0.1); color: #fff; text-decoration: none;
  padding: 8px 16px; border-radius: 8px; transition: 0.2s;
}
.btn:hover { background: rgba(255,255,255,0.2); }
.layout { display: flex; min-height: calc(100vh - 60px); }
.sidebar {
  width: 250px; padding: 24px; display: flex; flex-direction: column;
  position: sticky; top: 60px; height: calc(100vh - 60px); box-sizing: border-box;
}
.sidebar-title { font-size: 1.2rem; margin-bottom: 24px; color: #aaa; }
.category-list { list-style: none; padding: 0; margin: 0; flex: 1; }
.category-item {
  padding: 12px; margin-bottom: 8px; border-radius: 8px;
  cursor: pointer; transition: background 0.2s; line-height: 1.4;
}
.category-item small { color: #888; font-size: 0.8rem; }
.category-item:hover { background: rgba(255, 255, 255, 0.05); }
.category-item.active { background: var(--accent-color); }
.sidebar-footer {
  margin-top: 16px; font-size: 0.85rem; color: #888;
  border-top: 1px solid rgba(255,255,255,0.1); padding-top: 16px; text-align: center;
}
.main-content { flex: 1; padding: 24px; }
.grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 24px;
}
.card {
  background: var(--panel-bg); border-radius: var(--border-radius);
  overflow: hidden; display: flex; flex-direction: column;
  border: 1px solid rgba(255,255,255,0.05);
}
.media-wrapper { width: 100%; cursor: pointer; position: relative; overflow: hidden; }
.media-wrapper img, .media-wrapper video { width: 100%; height: auto; display: block; }
.image-title-overlay {
  position: absolute; top: 0; left: 0; width: 100%;
  background: rgba(0, 0, 0, 0.3); color: #fff;
  padding: 4px 8px; font-size: 0.75rem; font-weight: normal;
  text-align: center; z-index: 10; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
  pointer-events: none;
}
.info { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.prompt-container {
  background: rgba(0,0,0,0.3); padding: 12px; border-radius: 8px;
  cursor: pointer; position: relative;
}
.prompt-text { margin: 0; font-size: 0.9rem; color: #ddd; line-height: 1.5; white-space: pre-wrap; }
.prompt-collapsed {
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.copy-btn {
  margin-top: 8px; background: #333; color: #fff; border: none;
  padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.8rem; width: 100%;
}
.copy-btn:hover { background: #444; }
.modal {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.9); z-index: 1000; display: flex;
  justify-content: center; align-items: center;
}
.modal.hidden { display: none; }
.modal-content { position: relative; max-width: 90vw; max-height: 90vh; }
.modal-close {
  position: absolute; top: -40px; right: 0; background: none;
  border: none; color: white; font-size: 2rem; cursor: pointer;
}
.modal-body img, .modal-body video { max-width: 100%; max-height: 90vh; object-fit: contain; }
/* スマホレイアウト切り替え用のクラス */
.sidebar.hidden {
  display: none !important;
}

@media (max-width: 768px) {
  .layout { flex-direction: column; }
  /* スマホではデフォルトで左のサイドバーを隠すが、クラス付与で表示 */
  .sidebar { display: none !important; width: 100%; margin-bottom: 16px; box-sizing: border-box; }
  .sidebar.show-mobile { display: block !important; }
  .main-content { padding: 12px; }
  .grid { gap: 16px; grid-template-columns: 1fr; }
  .logo h1 { font-size: 1.05rem; margin: 0; white-space: nowrap; }
  .header { padding: 4px 6px; gap: 4px; flex-wrap: nowrap; overflow-x: auto; overflow-y: hidden; }
  .nav-btn { font-size: 1.1rem; } /* スマホでも少しスリムに */
  .nav { gap: 4px; }
}
/* トースト通知（ポップアップ）のスタイル */
#toast {
  position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
  background: rgba(233, 30, 99, 0.9); color: white; padding: 12px 24px;
  border-radius: 30px; font-weight: bold; font-size: 1rem;
  z-index: 2000; opacity: 0; pointer-events: none; transition: opacity 0.3s ease;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}
#toast.show { opacity: 1; }
/* 人気バッジのスタイル */
.popular-badge {
  position: absolute; top: 12px; left: 12px;
  background: linear-gradient(135deg, var(--accent-color), #8a2be2);
  color: white; padding: 4px 10px;
  border-radius: 12px; font-size: 0.85rem; font-weight: bold;
  box-shadow: 0 4px 8px rgba(0,0,0,0.4); z-index: 20;
  pointer-events: none; text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
  display: inline-block; width: max-content;
}
/* ダウンロードボタンのスタイル */
.dl-btn {
  display: block; margin-top: 16px; text-align: center;
  background: #2ed573; color: #fff; padding: 12px;
  border-radius: 8px; text-decoration: none; font-weight: bold;
  transition: background 0.2s; box-shadow: 0 4px 6px rgba(0,0,0,0.2);
}
.dl-btn:hover { background: #26de81; }
.search-input {
  background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);
  color: #fff; padding: 6px 12px; border-radius: 8px; outline: none;
  font-family: inherit; transition: 0.2s; width: 110px; font-size: 0.9rem;
}
.search-input:focus { background: rgba(255,255,255,0.2); width: 160px; border-color: var(--accent-color); }
@media (max-width: 768px) {
  .header { padding: 8px 4px !important; justify-content: flex-start !important; }
  .header > div { gap: 4px !important; }
  .logo { flex-shrink: 1; margin-right: auto; }
  .logo h1 { font-size: 0.95rem; white-space: nowrap; }
  .search-input { width: 55px; padding: 4px; font-size: 0.85rem; }
  .search-input:focus { width: 110px; }
  .nav-btn { padding: 4px 6px !important; font-size: 0.9rem !important; }
}
.accordion-header {
  background: var(--panel-bg); padding: 12px 16px; border-radius: 8px;
  cursor: pointer; display: flex; justify-content: space-between;
  align-items: center; margin-top: 16px; margin-bottom: 8px; font-weight: bold;
  border: 1px solid rgba(255,255,255,0.1); transition: 0.2s;
}
.accordion-header:hover { background: rgba(255,255,255,0.1); }
.accordion-content { display: none; }
.accordion-content.open { display: block; }
`;

  const scriptJs = `
document.addEventListener('DOMContentLoaded', () => {
    // スマホ表示時にロゴタップでトップに戻る処理
    const logo = document.querySelector('.logo');
    if (logo) {
        logo.style.cursor = 'pointer';
        logo.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            const searchInput = document.getElementById('global-search');
            if (searchInput) {
                searchInput.value = '';
                searchQuery = '';
            }
            currentCategory = 'media';
            currentFolderId = null;
            const categoryItems = document.querySelectorAll('.category-item, .nav-btn[data-category]');
            categoryItems.forEach(i => i.classList.remove('active'));
            const mediaBtn = document.querySelector('.nav-btn[data-category="media"]');
            if (mediaBtn) mediaBtn.classList.add('active');
            renderGallery();
        });
    }

    const grid = document.getElementById('gallery-grid');
    const categoryItems = document.querySelectorAll('.category-item, .nav-btn[data-category]');
    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modal-body');
    const modalClose = document.getElementById('modal-close');
    const mainContent = document.querySelector('.main-content');
    
    // トースト通知（ポップアップ）用要素の作成
    let toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);

    function showToast(message) {
        toast.innerText = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2500);
    }

    let currentCategory = 'media';
    let currentFolderId = null;
    // 動画の再生モード（初期値は自動再生・無音）
    let isVideoAutoplay = true;
    let searchQuery = '';

    const searchInput = document.getElementById('global-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.trim().toLowerCase();
            renderGallery();
        });
    }

    // メモカードのHTMLを生成する共通関数
    function createMemoHtml(memo) {
        const tagHtml = (memo.tags || []).map(tag => 
            '<span style="background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 12px; font-size: 11px; margin-right: 4px;">#' + tag + '</span>'
        ).join('');
        
        return \`
        <article class="glass-panel memo-card-export" style="padding: 16px; border-left: 4px solid #C800DE; background-color: rgba(80, 40, 140, 1); display: flex; flex-direction: column; gap: 12px; transition: transform 0.2s; cursor: pointer;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                <h3 style="margin: 0; font-size: 1.1rem; color: #bb86fc; flex: 1; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">\${memo.title}</h3>
                <div style="font-size: 0.75rem; color: #888; white-space: nowrap; margin-top: 4px;">\${new Date(memo.updatedAt).toLocaleDateString()}</div>
            </div>
            <div class="memo-content-text" style="font-size: 0.9rem; color: #8c8c8c; white-space: pre-wrap; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">\${memo.content}</div>
            \${tagHtml ? '<div style="margin-top: auto;">' + tagHtml + '</div>' : ''}
        </article>
        \`;
    }

    // 画像カードのHTMLを生成する共通関数
    function createMediaHtml(item) {
        let mediaHtml = '';
        if (item.mediaType === 'video') {
            if (isVideoAutoplay) {
                mediaHtml = \`<video src="assets/\${item.filename}" autoplay muted loop playsinline class="media"></video>\`;
            } else {
                mediaHtml = \`<video src="assets/\${item.filename}" controls playsinline class="media"></video>\`;
            }
        } else {
            mediaHtml = \`<img src="assets/\${item.filename}" alt="generated image" class="media">\`;
        }
        
        const titleOverlay = item.title ? \`<div class="image-title-overlay">\${item.title}</div>\` : '';
        
        return \`
            <div class="card" data-id="\${item.id}">
                <div class="media-wrapper">\${titleOverlay}\${mediaHtml}</div>
                <div class="info">
                    <div class="prompt-container">
                        <p class="prompt-text prompt-collapsed">\${item.prompt}</p>
                        <button class="copy-btn hidden">📋 コピー</button>
                    </div>
                </div>
            </div>
        \`;
    }

    // サムネ動画モード切り替えのイベント設定
    const videoModeBtn = document.getElementById('video-mode-toggle');
    if (videoModeBtn) {
        videoModeBtn.addEventListener('click', () => {
            isVideoAutoplay = !isVideoAutoplay;
            // ボタンのテキストを変更
            videoModeBtn.innerText = isVideoAutoplay ? '▶️ 🔇' : '⏸️ 🎵';
            showToast(isVideoAutoplay ? '自動再生（無音）モードにしました' : '停止（音声あり）モードにしました');
            
            // ギャラリーを再描画して動画要素を作り直す
            renderGallery();
        });
    }

    function renderGallery() {
        if (searchQuery) {
            const allImages = galleryData.images || [];
            const allMemos = galleryData.memos || [];
            
            const matchedImages = allImages.filter(item => {
                const title = String(item.title || '').toLowerCase();
                const prompt = String(item.prompt || '').toLowerCase();
                const comment = String(item.customComment || '').toLowerCase();
                return title.includes(searchQuery) || prompt.includes(searchQuery) || comment.includes(searchQuery);
            });
            
            const matchedMemos = allMemos.filter(memo => {
                const title = String(memo.title || '').toLowerCase();
                const content = String(memo.content || '').toLowerCase();
                const tags = Array.isArray(memo.tags) ? memo.tags.join(' ').toLowerCase() : String(memo.tags || '').toLowerCase();
                return title.includes(searchQuery) || content.includes(searchQuery) || tags.includes(searchQuery);
            });

            let html = \`<div style="margin-bottom: 16px; font-size: 1.2rem; font-weight: bold;">🔍 「\${searchQuery}」の検索結果</div>\`;

            html += \`
                <div class="accordion-header" onclick="this.nextElementSibling.classList.toggle('open');">
                    <span>▼ 🖼️ 画像・動画 (\${matchedImages.length}件)</span>
                </div>
                <div class="accordion-content \${matchedImages.length > 0 ? 'open' : ''}">
                    <div class="grid" style="margin-bottom: 24px;">
                        \${matchedImages.length > 0 ? matchedImages.map(createMediaHtml).join('') : '<div style="color:#888;">見つかりませんでした。</div>'}
                    </div>
                </div>
            \`;

            html += \`
                <div class="accordion-header" onclick="this.nextElementSibling.classList.toggle('open');">
                    <span>▼ 💡 プロンプトメモ (\${matchedMemos.length}件)</span>
                </div>
                <div class="accordion-content \${matchedMemos.length > 0 ? 'open' : ''}">
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; margin-bottom: 24px;">
                        \${matchedMemos.length > 0 ? matchedMemos.map(createMemoHtml).join('') : '<div style="color:#888;">見つかりませんでした。</div>'}
                    </div>
                </div>
            \`;

            mainContent.innerHTML = html;
            attachCardEvents();
            return;
        }

        if (currentCategory === 'prompt') {
            const allMemos = galleryData.memos || [];
            let memoHtml = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; padding-bottom: 40px;">';
            
            if (allMemos.length === 0) {
                memoHtml += '<div style="color: #888; padding: 24px; grid-column: 1 / -1;">メモがありません。</div>';
            }
            
            memoHtml += allMemos.map(createMemoHtml).join('');
            memoHtml += '</div>';
            mainContent.innerHTML = memoHtml;

            attachCardEvents();
            return;
        }

        let displayImages = [];
        let displayFolders = [];

        // galleryData.folders と galleryData.images を使用
        const allImages = galleryData.images || [];
        const allFolders = galleryData.folders || [];

        // カテゴリによるフィルタリング
        const categoryImages = currentCategory === 'all' ? allImages : allImages.filter(item => item.category === currentCategory);

        if (currentFolderId === null) {
            displayImages = categoryImages.filter(img => !img.folderId);
            displayFolders = allFolders.filter(f => {
                if (f.isPublished) return true;
                return categoryImages.some(img => img.folderId === f.id);
            });
        } else {
            displayImages = categoryImages.filter(img => img.folderId === currentFolderId);
        }

        let html = '';
        if (currentFolderId !== null) {
            const currentFolder = allFolders.find(f => f.id === currentFolderId);
            html += \`
                <div class="breadcrumb">
                    <button class="btn" id="btn-back-root">← トップへ戻る</button>
                    <span style="font-size:1.2rem;font-weight:bold;">\${currentFolder ? currentFolder.name : ''}</span>
                </div>
            \`;
        }

        html += '<div class="grid" id="actual-grid">';
        
        if (displayImages.length === 0 && displayFolders.length === 0) {
            html += '<div style="color: #888; padding: 24px;">表示できる画像がありません。</div>';
        }

        // フォルダの描画
        displayFolders.forEach(folder => {
            const coverImg = allImages.find(img => img.id === folder.coverImageId) || allImages.find(img => img.folderId === folder.id);
            let coverHtml = '<div style="font-size:4rem;">📁</div>';
            if (coverImg) {
                if (coverImg.mediaType === 'video') {
                    coverHtml = '<video src="assets/' + coverImg.filename + '" muted autoplay loop playsinline></video>';
                } else {
                    coverHtml = '<img src="assets/' + coverImg.filename + '" alt="' + folder.name + '">';
                }
            }

            html += \`
                <div class="folder-card" data-folder-id="\${folder.id}" style="cursor:pointer; border:2px solid #FFC107; background:rgb(114, 117, 11); border-radius:12px; overflow:hidden; position:relative; display:flex; flex-direction:column;">
                    <div class="folder-cover" style="position:relative; width:100%; display:flex; align-items:center; justify-content:center; flex:1;">
                        \${coverHtml}
                        <!-- フォルダ名を透かしで下部に表示 -->
                        <div style="position:absolute; bottom:0; left:0; width:100%; background:rgba(0,0,0,0.6); color:#fff; padding:8px 12px; font-size:1rem; font-weight:bold; text-align:center; z-index:10; text-shadow:1px 1px 2px rgba(0,0,0,0.8);">
                            📁 \${folder.name}
                        </div>
                    </div>
                </div>
            \`;
        });

        // 画像の描画
        html += displayImages.map(createMediaHtml).join('');
        html += '</div>';
        mainContent.innerHTML = html;

        attachCardEvents();
    }

    function attachCardEvents() {
        // 【追加】人気画像のラベル付与
        if (window.firebaseGetPopularImages) {
            window.firebaseGetPopularImages().then(popularStats => {
                const topImagesPerFolder = {};
                
                // 全画像の中から、各フォルダの最多再生数(3回以上)を特定
                galleryData.images.forEach(img => {
                    const views = popularStats[img.id] || 0;
                    if (views >= 3) {
                        const fId = img.folderId || 'root';
                        // 同じ再生数の場合、先に記録されている(現状トップの)動画を優先するため「>」を使用
                        if (!topImagesPerFolder[fId] || views > topImagesPerFolder[fId].views) {
                            topImagesPerFolder[fId] = { id: img.id, views: views };
                        }
                    }
                });
                
                const popularIds = Object.values(topImagesPerFolder).map(x => x.id);

                document.querySelectorAll('.card').forEach(card => {
                    const id = card.getAttribute('data-id');
                    if (popularIds.includes(id)) {
                        const mediaWrapper = card.querySelector('.media-wrapper');
                        if (mediaWrapper && !mediaWrapper.querySelector('.popular-badge')) {
                            const badge = document.createElement('div');
                            badge.className = 'popular-badge';
                            badge.innerText = '🔥 人気';
                            mediaWrapper.appendChild(badge);
                        }
                    }
                });
            });
        }

        // イベントリスナーの再設定
        const backBtn = document.getElementById('btn-back-root');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                currentFolderId = null;
                renderGallery();
            });
        }

        // プロンプトメモクリック時の展開処理
        document.querySelectorAll('.memo-card-export').forEach(card => {
            card.addEventListener('click', () => {
                const textDiv = card.querySelector('.memo-content-text');
                if (textDiv) {
                    if (textDiv.style.webkitLineClamp === '3' || textDiv.style.webkitLineClamp === '') {
                        textDiv.style.webkitLineClamp = 'unset';
                    } else {
                        textDiv.style.webkitLineClamp = '3';
                    }
                }
            });
        });

        document.querySelectorAll('.folder-card').forEach(card => {
            card.addEventListener('click', () => {
                // プロンプトメモの場合はフォルダを開かせないようにする
                if (currentCategory === 'prompt') return;
                currentFolderId = card.getAttribute('data-folder-id');
                renderGallery();
            });
        });

        document.querySelectorAll('.card').forEach(card => {
            const mediaWrapper = card.querySelector('.media-wrapper');
            const mediaHtml = mediaWrapper.innerHTML;
            
            mediaWrapper.addEventListener('click', (e) => {
                e.preventDefault();
                const isVideo = mediaHtml.includes('<video');
                // サムネイル側の動画が再生されてしまうのを防ぐ（やまびこ防止）
                if (isVideo) {
                    const originalVideo = mediaWrapper.querySelector('video');
                    if (originalVideo) {
                        setTimeout(() => originalVideo.pause(), 10);
                    }
                }
                // 閲覧数のカウント
                const itemId = card.getAttribute('data-id');
                if (window.firebaseRecordView) {
                    window.firebaseRecordView(itemId);
                }
                
                modalBody.innerHTML = mediaHtml;
                modal.classList.remove('hidden');

                // モーダル表示時に動画を自動再生する
                if (isVideo) {
                    const modalVideo = modalBody.querySelector('video');
                    if (modalVideo) {
                        // モーダル側では常に音声をONにし、コントロールを表示する
                        modalVideo.muted = false;
                        modalVideo.controls = true;
                        modalVideo.play().catch(err => console.error("動画の自動再生に失敗しました:", err));
                    }
                }
            });

            const promptContainer = card.querySelector('.prompt-container');
            const promptText = card.querySelector('.prompt-text');
            const copyBtn = card.querySelector('.copy-btn');
            promptContainer.addEventListener('click', () => {
                if (promptText.classList.contains('prompt-collapsed')) {
                    promptText.classList.remove('prompt-collapsed');
                    copyBtn.classList.remove('hidden');
                } else {
                    promptText.classList.add('prompt-collapsed');
                    copyBtn.classList.add('hidden');
                }
            });

            copyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(promptText.innerText).then(() => {
                    const originalText = copyBtn.innerText;
                    copyBtn.innerText = '✅ コピーしました！';
                    setTimeout(() => copyBtn.innerText = originalText, 2000);
                });
            });
        });
    }

    categoryItems.forEach(item => {
        item.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            
            const searchInput = document.getElementById('global-search');
            if (searchInput) {
                searchInput.value = '';
                searchQuery = '';
            }

            const selectedCategory = item.getAttribute('data-category');
            categoryItems.forEach(i => i.classList.remove('active'));
            document.querySelectorAll(\`[data-category="\${selectedCategory}"]\`).forEach(i => i.classList.add('active'));
            
            if (window.innerWidth <= 768) {
                const title = item.getAttribute('title') || item.innerText.split('\\n')[0];
                showToast(title);
                const sidebar = document.querySelector('.sidebar');
                if (sidebar) sidebar.classList.remove('show-mobile');
            }
            
            currentCategory = selectedCategory;
            currentFolderId = null; // カテゴリが変わったらルートに戻す
            renderGallery();
        });
    });

    modalClose.addEventListener('click', () => { modal.classList.add('hidden'); modalBody.innerHTML = ''; });
    modal.addEventListener('click', (e) => { if (e.target === modal) { modal.classList.add('hidden'); modalBody.innerHTML = ''; }});

    if (typeof galleryData !== 'undefined') renderGallery();
});
`;

    await fs.writeFile(path.join(DOCS_DIR, 'index.html'), indexHtml, 'utf-8');
    await fs.writeFile(path.join(DOCS_DIR, 'style.css'), styleCss, 'utf-8');
    await fs.writeFile(path.join(DOCS_DIR, 'script.js'), scriptJs, 'utf-8');
}
