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

    const finalExportData = {
      folders: foldersDataExport,
      images: exportData
    };

    const dataJsContent = `const galleryData = ${JSON.stringify(finalExportData, null, 2)};`;
    await fs.writeFile(path.join(DOCS_DIR, 'data.js'), dataJsContent, 'utf-8');

    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJsonRaw = await fs.readFile(packageJsonPath, 'utf-8').catch(() => '{}');
    const packageJson = JSON.parse(packageJsonRaw);
    const nextVersion = (packageJson.dependencies?.next || '').replace(/[\^~]/g, '');
    const reactVersion = (packageJson.dependencies?.react || '').replace(/[\^~]/g, '');

    await generateStaticFiles(nextVersion, reactVersion);

    return NextResponse.json({ success: true, count: exportData.length });
  } catch (error) {
    console.error('Export Error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}

async function generateStaticFiles(nextVersion: string = '', reactVersion: string = '') {
  const timestamp = Date.now();
  const indexHtml = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Feeling Gallery</title>
    <link rel="stylesheet" href="style.css?v=${Date.now()}">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body>
    <header class="header glass-panel">
        <div class="logo" style="display: flex; align-items: center; gap: 12px;">
            <h1>🤖 Feeling Gallery</h1>
        </div>
        <!-- ヘッダー内のカテゴリ切り替えナビゲーション -->
        <nav class="nav">
            <button class="nav-btn active" data-category="media" title="生成画像・動画">🖼️</button>
            <button class="nav-btn" data-category="prompt" title="プロンプトメモ">💡</button>
        </nav>
    </header>

    <div class="layout">
        <!-- サイドバー -->
        <aside class="sidebar glass-panel">
            <ul class="category-list">
                <li class="category-item active" data-category="media">生成画像・動画<br><small>(AI Generated Media)</small></li>
                <li class="category-item" data-category="prompt">プロンプトメモ<br><small>(Prompt Memo)</small></li>
            </ul>

            <div class="sidebar-footer" style="text-align: center; font-size: 0.75rem; line-height: 1.4;">
                <p style="margin: 0;"><strong>&lt;制作環境&gt;</strong><br>
                Next.js v${nextVersion} / React v${reactVersion}<br>
                Gemini Pro Vision<br>
                Antigravity AI<br>
                <a href="https://github.com/wind8lovers-create/gemini-art-chat" target="_blank" rel="noopener" style="color: #ccc; text-decoration: underline;">GitHub</a>
                <br><br>
                <strong>&lt;画像動画生成AI&gt;</strong><br>
                -Gemini 3.1 Pro-<br>
                Nano Banana Pro<br>
                Nano Banana 2<br>
                Veo 3.1<br>
                <br>
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
        import { getFirestore, doc, setDoc, updateDoc, increment, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
                await updateDoc(statsRef, { visitors: increment(1) }).catch(async (e) => {
                    if (e.code === 'not-found') await setDoc(statsRef, { visitors: 1, downloads: 0 });
                });
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
                const popularIds = [];
                snapshot.forEach(doc => {
                    if (doc.data().views >= 3) {
                        popularIds.push(doc.id);
                    }
                });
                return popularIds;
            } catch(e) { console.error(e); return []; }
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
  .logo h1 { font-size: 1.1rem; margin: 0; }
  .header { padding: 4px 8px; }
  .nav-btn { padding: 6px 10px; font-size: 1.2rem; } /* スマホでも少しスリムに */
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
  position: absolute; top: 12px; right: 12px;
  background: linear-gradient(45deg, #ff4757, #ff6b81);
  color: white; padding: 4px 10px;
  border-radius: 12px; font-size: 0.85rem; font-weight: bold;
  box-shadow: 0 4px 8px rgba(0,0,0,0.4); z-index: 20;
  pointer-events: none; text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
}
/* ダウンロードボタンのスタイル */
.dl-btn {
  display: block; margin-top: 16px; text-align: center;
  background: #2ed573; color: #fff; padding: 12px;
  border-radius: 8px; text-decoration: none; font-weight: bold;
  transition: background 0.2s; box-shadow: 0 4px 6px rgba(0,0,0,0.2);
}
.dl-btn:hover { background: #26de81; }
`;

  const scriptJs = `
document.addEventListener('DOMContentLoaded', () => {
    // スマホ表示時にロゴタップでサイドバーを開閉する処理
    const logo = document.querySelector('.logo');
    const sidebar = document.querySelector('.sidebar');
    if (logo && sidebar) {
        logo.style.cursor = 'pointer';
        logo.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                sidebar.classList.toggle('show-mobile');
            }
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

    function renderGallery() {
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
            const coverHtml = coverImg 
                ? (coverImg.mediaType === 'video' ? \`<video src="assets/\${coverImg.filename}" muted autoplay loop playsinline></video>\` : \`<img src="assets/\${coverImg.filename}" alt="\${folder.name}">\`)
                : '<div style="font-size:4rem;">📁</div>';

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
        displayImages.forEach(item => {
            const mediaHtml = item.mediaType === 'video' 
                ? \`<video src="assets/\${item.filename}" controls loop playsinline class="media"></video>\`
                : \`<img src="assets/\${item.filename}" alt="generated image" class="media">\`;
            
            const titleOverlay = item.title ? \`<div class="image-title-overlay">\${item.title}</div>\` : '';
            
            html += \`
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
        });

        html += '</div>';
        mainContent.innerHTML = html;

        // 【追加】人気画像のラベル付与
        if (window.firebaseGetPopularImages) {
            window.firebaseGetPopularImages().then(popularIds => {
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
            const selectedCategory = item.getAttribute('data-category');
            categoryItems.forEach(i => i.classList.remove('active'));
            document.querySelectorAll(\`[data-category="\${selectedCategory}"]\`).forEach(i => i.classList.add('active'));
            
            if (window.innerWidth <= 768) {
                const title = item.getAttribute('title') || item.innerText.split('\\n')[0];
                showToast(title);
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
