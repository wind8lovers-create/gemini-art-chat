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
          
          const messagesStr = await fs.readFile(messagesPath, 'utf-8');
          const messages = JSON.parse(messagesStr);

          if (Array.isArray(messages)) {
            for (const msg of messages) {
              // アップロード画像
              if (msg.inputImage && msg.inputImage.publishStatus === 'published') {
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
                  dataUri: msg.inputImage.data
                });
              }

              // 生成画像
              if (msg.generatedImages && Array.isArray(msg.generatedImages)) {
                for (const img of msg.generatedImages) {
                  if (img.publishStatus === 'published') {
                    const isVideo = img.mediaType === 'video' || img.filename.endsWith('.mp4');
                    exportData.push({
                      id: img.id,
                      filename: img.filename,
                      prompt: img.prompt,
                      mediaType: isVideo ? 'video' : 'image',
                      sessionTitle: metadata.title,
                      category: metadata.title.includes('物語') ? 'story' : metadata.title.includes('プロンプト') ? 'prompt' : 'media',
                      sessionId: entry.name,
                      isGenerated: true
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

    exportData.sort((a, b) => b.id.localeCompare(a.id));

    const dataJsContent = `const galleryData = ${JSON.stringify(exportData, null, 2)};`;
    await fs.writeFile(path.join(DOCS_DIR, 'data.js'), dataJsContent, 'utf-8');

    await generateStaticFiles();

    return NextResponse.json({ success: true, count: exportData.length });
  } catch (error) {
    console.error('Export Error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}

async function generateStaticFiles() {
  const indexHtml = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Feeling Gallery</title>
    <link rel="stylesheet" href="style.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body>
    <header class="header glass-panel">
        <div class="logo">
            <h1>🤖 Feeling Gallery</h1>
        </div>
        <!-- ヘッダー内のカテゴリ切り替えナビゲーション -->
        <nav class="nav">
            <button class="nav-btn active" data-category="all" title="すべて表示">🏠</button>
            <button class="nav-btn" data-category="media" title="生成画像・動画">🖼️</button>
            <button class="nav-btn" data-category="prompt" title="プロンプト考察">💡</button>
            <button class="nav-btn" data-category="story" title="ある一つの物語">📖</button>
            <a href="https://github.com/wind8lovers-create/gemini-art-chat" class="btn github-btn" target="_blank" rel="noopener">GitHub</a>
        </nav>
    </header>

    <div class="layout">
        <!-- サイドバー -->
        <aside class="sidebar glass-panel">
            <h2 class="sidebar-title">📑 目次</h2>
            <ul class="category-list">
                <li class="category-item active" data-category="all">すべて表示</li>
                <li class="category-item" data-category="media">生成画像・動画<br><small>(AI Generated Media)</small></li>
                <li class="category-item" data-category="prompt">プロンプト考察<br><small>(Prompt Analysis)</small></li>
                <li class="category-item" data-category="story">ある一つの物語<br><small>(A Single Story)</small></li>
            </ul>

            <div class="sidebar-footer">
                <p><strong>制作環境</strong></p>
                <p>Next.js / React<br>Gemini Pro Vision<br>Antigravity AI</p>
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

    <script src="data.js"></script>
    <script src="script.js"></script>
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
  padding: 12px 24px;
}
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
  margin-top: auto; font-size: 0.85rem; color: #888;
  border-top: 1px solid rgba(255,255,255,0.1); padding-top: 16px;
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
.media-wrapper { width: 100%; aspect-ratio: 16/9; background: #000; cursor: pointer; position: relative; }
.media-wrapper img, .media-wrapper video { width: 100%; height: 100%; object-fit: contain; }
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
@media (max-width: 768px) {
  .layout { flex-direction: column; }
  /* スマホでは左のサイドバーを完全に隠す */
  .sidebar { display: none; }
  .main-content { padding: 12px; }
  .grid { gap: 16px; grid-template-columns: 1fr; }
  /* ヘッダーのGitHubボタンを隠してスペースを確保する（アイコンを優先） */
  .github-btn { display: none; }
  .logo h1 { font-size: 1.2rem; }
  .header { padding: 12px 8px; }
  .nav-btn { padding: 8px 10px; font-size: 1.1rem; }
}
`;

  const scriptJs = `
document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('gallery-grid');
    const categoryItems = document.querySelectorAll('.category-item, .nav-btn');
    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modal-body');
    const modalClose = document.getElementById('modal-close');
    let currentCategory = 'all';

    function renderGallery() {
        grid.innerHTML = '';
        const filteredData = currentCategory === 'all' 
            ? galleryData 
            : galleryData.filter(item => item.category === currentCategory);

        if (filteredData.length === 0) {
            grid.innerHTML = '<div style="color: #888; padding: 24px;">このカテゴリの画像はまだありません。</div>';
            return;
        }

        filteredData.forEach(item => {
            const card = document.createElement('div');
            card.className = 'card';
            const mediaHtml = item.mediaType === 'video' 
                ? \`<video src="assets/\${item.filename}" controls loop playsinline class="media"></video>\`
                : \`<img src="assets/\${item.filename}" alt="generated image" class="media">\`;

            card.innerHTML = \`
                <div class="media-wrapper">\${mediaHtml}</div>
                <div class="info">
                    <div class="prompt-container">
                        <p class="prompt-text prompt-collapsed">\${item.prompt}</p>
                        <button class="copy-btn hidden">📋 コピー</button>
                    </div>
                </div>
            \`;

            const mediaWrapper = card.querySelector('.media-wrapper');
            mediaWrapper.addEventListener('click', () => {
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
                navigator.clipboard.writeText(item.prompt).then(() => {
                    const originalText = copyBtn.innerText;
                    copyBtn.innerText = '✅ コピーしました！';
                    setTimeout(() => copyBtn.innerText = originalText, 2000);
                });
            });

            grid.appendChild(card);
        });
    }

    categoryItems.forEach(item => {
        item.addEventListener('click', () => {
            const selectedCategory = item.getAttribute('data-category');
            // すべてのボタン・アイテムのアクティブを外す
            categoryItems.forEach(i => i.classList.remove('active'));
            // 選択されたカテゴリと同じ data-category を持つものをすべてアクティブにする
            document.querySelectorAll(\`[data-category="\${selectedCategory}"]\`).forEach(i => i.classList.add('active'));
            
            currentCategory = selectedCategory;
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
