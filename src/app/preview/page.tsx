'use client';
import React, { useEffect, useState } from 'react';
import styles from './page.module.css';
import Header from '@/components/Header/Header';
import { GalleryImage, SessionFolder } from '@/types';
import Pagination from '@/components/Pagination/Pagination';
import VideoPlayer from '@/components/VideoPlayer/VideoPlayer';

type ManagedImage = GalleryImage & { dataUri?: string; messageId?: string; isGenerated?: boolean; folderId?: string | null; title?: string; customComment?: string };

// プロンプトを折りたたみ/展開するコンポーネント
const PromptView = ({ prompt }: { prompt: string }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={styles.promptContainer} onClick={() => setIsExpanded(!isExpanded)}>
      <p className={isExpanded ? styles.promptExpanded : styles.promptCollapsed}>
        {prompt}
      </p>
      {isExpanded && (
        <button 
          className={styles.copyBtn} 
          onClick={(e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(prompt);
            alert('プロンプトをコピーしました！');
          }}
        >
          📋 コピー
        </button>
      )}
    </div>
  );
};

export default function PreviewPage() {
  const [images, setImages] = useState<ManagedImage[]>([]);
  const [folders, setFolders] = useState<SessionFolder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 6;

  useEffect(() => {
    setCurrentPage(1);
  }, [currentFolderId]);
  const [enlargedImage, setEnlargedImage] = useState<ManagedImage | null>(null);

  const handleExport = async () => {
    if (confirm('現在プレビューに表示されている内容で、GitHub Pages 用の静的HPとして書き出しますか？\n（ONのファイルだけが追加・更新されます）')) {
      setIsExporting(true);
      try {
        const res = await fetch('/api/export', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          alert(`書き出しが完了しました！\n（${data.count}件の画像・動画をエクスポートしました）\n\n「Git」ボタンから push を行うと Pages に反映されます。`);
        } else {
          alert(`エラーが発生しました: ${data.error}`);
        }
      } catch (err) {
        alert('通信エラーが発生しました。');
      } finally {
        setIsExporting(false);
      }
    }
  };

  useEffect(() => {
    Promise.all([
      fetch('/api/manage').then(res => res.json()),
      fetch('/api/folders').then(res => res.json())
    ])
    .then(([imagesData, foldersData]) => {
      // 公開（published）になっているものだけをフィルタリング
      const publishedImages = imagesData.filter((img: ManagedImage) => img.publishStatus === 'published');
      setImages(publishedImages);
      setFolders(foldersData.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0)));
      setIsLoading(false);
    })
    .catch(err => {
      console.error("プレビューデータ取得エラー:", err);
      setIsLoading(false);
    });
  }, []);

  // 表示するべき画像やフォルダをフィルタリング
  let displayImages: ManagedImage[] = [];
  let displayFolders: SessionFolder[] = [];

  if (currentFolderId === null) {
    displayImages = images.filter(img => !img.folderId);
    displayFolders = folders.filter(f => {
      if (f.isPublished) return true;
      return images.some(img => img.folderId === f.id);
    });
  } else {
    displayImages = images.filter(img => img.folderId === currentFolderId);
  }

  const displayItems = [
    ...displayFolders.map(f => ({ type: 'folder' as const, data: f })),
    ...displayImages.map(img => ({ type: 'image' as const, data: img }))
  ];
  const totalPages = Math.ceil(displayItems.length / ITEMS_PER_PAGE);
  const paginatedItems = displayItems.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <>
      <Header />
      <main className={styles.container}>
        <h1 className={styles.title}>👀 Pages表示イメージ（プレビュー）</h1>
        {currentFolderId !== null ? (
          <div style={{ marginBottom: '20px' }}>
            <button onClick={() => setCurrentFolderId(null)} className="btn btn-secondary" style={{ marginRight: '10px' }}>
              ← feering gallery (トップへ戻る)
            </button>
            <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
              {folders.find(f => f.id === currentFolderId)?.name || '不明なフォルダ'}
            </span>
          </div>
        ) : (
          <p className={styles.subtitle}>
            編集長室で「↑（公開ON）」にした画像が、実際に公開ページでどのように見えるかを確認できます。
          </p>
        )}

        <div style={{ marginBottom: '24px', display: 'flex', gap: '12px' }}>
          <button 
            className="btn btn-primary" 
            onClick={handleExport}
            disabled={isExporting || isLoading}
            style={{ padding: '12px 24px', fontSize: '1.1rem', background: '#e91e63', color: '#fff', border: 'none', borderRadius: '8px', cursor: isExporting ? 'wait' : 'pointer', fontWeight: 'bold' }}
          >
            {isExporting ? '⏳ 書き出し中...' : '🚀 GitHub Pages用に書き出す'}
          </button>
        </div>

        {isLoading ? (
          <div className={styles.empty}>読み込み中...</div>
        ) : (displayItems.length === 0) ? (
          <div className={styles.empty}>
            公開中の画像がありません。<br/>
            編集長室で公開したい画像の「↑」マークをクリックしてください。
          </div>
        ) : (
          <>
          <div className={styles.grid}>
            {paginatedItems.map((item) => {
              if (item.type === 'folder') {
                const folder = item.data;
                const coverImg = images.find(img => img.id === folder.coverImageId) 
                  || images.find(img => img.folderId === folder.id);
                const imageUrl = coverImg ? (coverImg.isGenerated ? `/api/images/${coverImg.sessionId}/${coverImg.filename}` : (coverImg.dataUri || '')) : '';
                
              return (
                <div key={`folder_${folder.id}`} className={styles.card} onClick={() => setCurrentFolderId(folder.id)} style={{ cursor: 'pointer', border: '2px solid #FFC107', background: 'rgb(114, 117, 11)' }}>
                  <div className={styles.imageWrapper} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', flex: 1 }}>
                    {imageUrl ? (
                      coverImg?.mediaType === 'video' ? (
                        <video src={imageUrl} muted autoPlay loop playsInline style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                      ) : (
                        <img src={imageUrl} alt={folder.name} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                      )
                    ) : (
                      <span style={{ fontSize: '4rem', padding: '40px' }}>📁</span>
                    )}
                    {/* フォルダ名を透かしで下部に表示 */}
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, width: '100%',
                      background: 'rgba(0, 0, 0, 0.6)', color: '#fff',
                      padding: '8px 12px', fontSize: '1rem', fontWeight: 'bold',
                      textAlign: 'center', zIndex: 10, textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
                    }}>
                      📁 {folder.name}
                    </div>
                  </div>
                </div>
              );
            } else {
              const img = item.data;
              const imageUrl = img.isGenerated ? `/api/images/${img.sessionId}/${img.filename}` : (img.dataUri || '');
              const uniqueKey = `${img.sessionId}_${img.id}`;
              
              return (
                <div key={uniqueKey} className={styles.card}>
                  <div className={styles.imageWrapper} onClick={() => setEnlargedImage(img)} style={{ cursor: 'zoom-in' }}>
                    {img.title && (
                      <div className={styles.imageTitleOverlay}>
                        {img.title}
                      </div>
                    )}
                    {img.mediaType === 'video' || imageUrl.toLowerCase().endsWith('.mp4') ? (
                      <VideoPlayer src={imageUrl} className={styles.image} />
                    ) : (
                      <img src={imageUrl} alt={img.prompt} className={styles.image} />
                    )}
                  </div>
                  <div className={styles.info}>
                    <PromptView prompt={img.prompt} />
                  </div>
                </div>
              );
            }
          })}
          </div>
          
          <Pagination 
            currentPage={currentPage} 
            totalPages={totalPages} 
            onPageChange={setCurrentPage} 
          />
        </>
        )}
      </main>

      {/* 拡大画像を表示する黒い背景（モーダル） */}
      {enlargedImage && (
        <div className={styles.modalOverlay} onClick={() => setEnlargedImage(null)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <button className={styles.closeBtn} onClick={() => setEnlargedImage(null)}>✕</button>
            <div className={styles.enlargedImageWrapper}>
              {enlargedImage.mediaType === 'video' || (enlargedImage.isGenerated ? `/api/images/${enlargedImage.sessionId}/${enlargedImage.filename}` : (enlargedImage.dataUri || '')).toLowerCase().endsWith('.mp4') ? (
                <video src={enlargedImage.isGenerated ? `/api/images/${enlargedImage.sessionId}/${enlargedImage.filename}` : (enlargedImage.dataUri || '')} controls autoPlay loop />
              ) : (
                <img src={enlargedImage.isGenerated ? `/api/images/${enlargedImage.sessionId}/${enlargedImage.filename}` : (enlargedImage.dataUri || '')} alt={enlargedImage.prompt} />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
