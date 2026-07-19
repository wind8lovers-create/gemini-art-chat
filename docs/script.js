
document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('gallery-grid');
    const categoryItems = document.querySelectorAll('.category-item, .nav-btn[data-category]');
    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modal-body');
    const modalClose = document.getElementById('modal-close');
    
    // トースト通知（ポップアップ）用要素の作成
    let toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);

    function showToast(message) {
        toast.innerText = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2500);
    }

    let currentCategory = 'media'; // 初期表示を生成画像・動画に変更

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
                ? `<video src="assets/${item.filename}" controls loop playsinline class="media"></video>`
                : `<img src="assets/${item.filename}" alt="generated image" class="media">`;

            card.innerHTML = `
                <div class="media-wrapper">${mediaHtml}</div>
                <div class="info">
                    <div class="prompt-container">
                        <p class="prompt-text prompt-collapsed">${item.prompt}</p>
                        <button class="copy-btn hidden">📋 コピー</button>
                    </div>
                </div>
            `;

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
            document.querySelectorAll(`[data-category="${selectedCategory}"]`).forEach(i => i.classList.add('active'));
            
            // スマホなどの幅が狭い画面ではポップアップで説明を表示
            if (window.innerWidth <= 768) {
                const title = item.getAttribute('title') || item.innerText.split('\n')[0];
                showToast(title);
            }
            
            currentCategory = selectedCategory;
            renderGallery();
        });
    });

    modalClose.addEventListener('click', () => { modal.classList.add('hidden'); modalBody.innerHTML = ''; });
    modal.addEventListener('click', (e) => { if (e.target === modal) { modal.classList.add('hidden'); modalBody.innerHTML = ''; }});

    if (typeof galleryData !== 'undefined') renderGallery();
});
