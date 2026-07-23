
document.addEventListener('DOMContentLoaded', () => {
    // スマホ表示時にロゴタップでサイドバーを開閉する処理
    const logo = document.querySelector('.logo');
    const sidebar = document.querySelector('.sidebar');
    if (logo && sidebar) {
        logo.style.cursor = 'pointer';
        logo.addEventListener('click', (e) => {
            if (window.innerWidth <= 768) {
                sidebar.classList.toggle('show-mobile');
                e.stopPropagation(); // 外側クリック判定がすぐ発火しないように伝播を止める
            }
        });

        // 画面のどこかをクリックしたらサイドバーを閉じる
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && sidebar.classList.contains('show-mobile')) {
                // 上部のアイコン、文字列のリンク、ロゴ以外をクリックした場合に閉じる
                const isNavBtn = e.target.closest('.nav-btn');
                const isCategoryItem = e.target.closest('.category-item');
                const isLogo = e.target.closest('.logo');
                const isLink = e.target.closest('a');
                
                if (!isNavBtn && !isCategoryItem && !isLogo && !isLink) {
                    sidebar.classList.remove('show-mobile');
                }
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
    // 動画の再生モード（初期値は自動再生・無音）
    let isVideoAutoplay = true;

    // サムネ動画モード切り替えのイベント設定
    const videoModeBtn = document.getElementById('video-mode-toggle');
    if (videoModeBtn) {
        videoModeBtn.addEventListener('click', () => {
            isVideoAutoplay = !isVideoAutoplay;
            // ボタンのテキストを変更
            videoModeBtn.innerText = isVideoAutoplay ? 'サムネ:再生(音無)' : 'サムネ:停止(音有)';
            showToast(isVideoAutoplay ? '自動再生（無音）モードにしました' : '停止（音声あり）モードにしました');
            
            // ギャラリーを再描画して動画要素を作り直す
            renderGallery();
        });
    }

    function renderGallery() {
        if (currentCategory === 'prompt') {
            const allMemos = galleryData.memos || [];
            let memoHtml = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; padding-bottom: 40px;">';
            
            if (allMemos.length === 0) {
                memoHtml += '<div style="color: #888; padding: 24px; grid-column: 1 / -1;">メモがありません。</div>';
            }
            
            allMemos.forEach(memo => {
                const tagHtml = (memo.tags || []).map(tag => 
                    '<span style="background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 12px; font-size: 11px; margin-right: 4px;">#' + tag + '</span>'
                ).join('');
                
                memoHtml += `
                <article class="glass-panel" style="padding: 16px; border-left: 4px solid var(--accent-color); display: flex; flex-direction: column; gap: 12px; transition: transform 0.2s;">
                    <h3 style="margin: 0; font-size: 1.1rem; color: #fff;">${memo.title}</h3>
                    <div style="font-size: 0.9rem; color: #ccc; white-space: pre-wrap; line-height: 1.5;">${memo.content}</div>
                    ${tagHtml ? '<div>' + tagHtml + '</div>' : ''}
                    <div style="font-size: 0.75rem; color: #888; text-align: right; margin-top: auto;">${new Date(memo.updatedAt).toLocaleDateString()}</div>
                </article>
                `;
            });
            memoHtml += '</div>';
            mainContent.innerHTML = memoHtml;
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
            html += `
                <div class="breadcrumb">
                    <button class="btn" id="btn-back-root">← トップへ戻る</button>
                    <span style="font-size:1.2rem;font-weight:bold;">${currentFolder ? currentFolder.name : ''}</span>
                </div>
            `;
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

            html += `
                <div class="folder-card" data-folder-id="${folder.id}" style="cursor:pointer; border:2px solid #FFC107; background:rgb(114, 117, 11); border-radius:12px; overflow:hidden; position:relative; display:flex; flex-direction:column;">
                    <div class="folder-cover" style="position:relative; width:100%; display:flex; align-items:center; justify-content:center; flex:1;">
                        ${coverHtml}
                        <!-- フォルダ名を透かしで下部に表示 -->
                        <div style="position:absolute; bottom:0; left:0; width:100%; background:rgba(0,0,0,0.6); color:#fff; padding:8px 12px; font-size:1rem; font-weight:bold; text-align:center; z-index:10; text-shadow:1px 1px 2px rgba(0,0,0,0.8);">
                            📁 ${folder.name}
                        </div>
                    </div>
                </div>
            `;
        });

        // 画像の描画
        displayImages.forEach(item => {
            // モードに応じて動画タグの中身を変更
            let mediaHtml = '';
            if (item.mediaType === 'video') {
                if (isVideoAutoplay) {
                    // 自動再生（無音・ループ）※コントロールバーなし
                    mediaHtml = `<video src="assets/${item.filename}" autoplay muted loop playsinline class="media"></video>`;
                } else {
                    // 停止状態（音声あり・コントロールバーあり）
                    mediaHtml = `<video src="assets/${item.filename}" controls playsinline class="media"></video>`;
                }
            } else {
                mediaHtml = `<img src="assets/${item.filename}" alt="generated image" class="media">`;
            }
            
            const titleOverlay = item.title ? `<div class="image-title-overlay">${item.title}</div>` : '';
            
            html += `
                <div class="card" data-id="${item.id}">
                    <div class="media-wrapper">${titleOverlay}${mediaHtml}</div>
                    <div class="info">
                        <div class="prompt-container">
                            <p class="prompt-text prompt-collapsed">${item.prompt}</p>
                            <button class="copy-btn hidden">📋 コピー</button>
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        mainContent.innerHTML = html;

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
            const selectedCategory = item.getAttribute('data-category');
            categoryItems.forEach(i => i.classList.remove('active'));
            document.querySelectorAll(`[data-category="${selectedCategory}"]`).forEach(i => i.classList.add('active'));
            
            if (window.innerWidth <= 768) {
                const title = item.getAttribute('title') || item.innerText.split('\n')[0];
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
