'use client';
import React, { useEffect, useState } from 'react';
import styles from './page.module.css';
import Header from '@/components/Header/Header';
import { GalleryImage, SessionFolder } from '@/types';
import ImageWithActions from '@/components/ImageWithActions/ImageWithActions';
import Pagination from '@/components/Pagination/Pagination';

// 拡張した型を定義（dataUriが含まれる）
type ManagedImage = GalleryImage & { dataUri?: string; messageId?: string; isGenerated?: boolean; folderId?: string | null; title?: string; customComment?: string };

export default function UploadsPage() {
  const [images, setImages] = useState<ManagedImage[]>([]);
  const [folders, setFolders] = useState<SessionFolder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [enlargedImage, setEnlargedImage] = useState<ManagedImage | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 6;

  useEffect(() => {
    setCurrentPage(1);
  }, [currentFolderId]);

  const loadData = () => {
    Promise.all([
      fetch('/api/manage').then(res => res.json()),
      fetch('/api/folders').then(res => res.json())
    ])
    .then(([imagesData, foldersData]) => {
      setImages(imagesData);
      setFolders(foldersData.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0)));
      setIsLoading(false);
    })
    .catch(err => {
      console.error("データ取得エラー:", err);
      setIsLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const refreshGallery = () => {
    loadData();
  };

  // 表示するべき画像やフォルダをフィルタリング
  let displayImages: ManagedImage[] = [];
  let displayFolders: SessionFolder[] = [];

  if (currentFolderId === null) {
    // ルート階層：
    // 1. フォルダに属していない画像
    displayImages = images.filter(img => !img.folderId);
    // 2. 表示すべきフォルダ（自身が公開設定されている、または公開画像を含んでいる）
    displayFolders = folders.filter(f => {
      if (f.isPublished) return true;
      return images.some(img => img.folderId === f.id);
    });
  } else {
    // フォルダ内階層
    displayImages = images.filter(img => img.folderId === currentFolderId);
  }

  // ページネーション用にアイテムを結合
  const displayItems = [
    ...displayFolders.map(f => ({ type: 'folder' as const, data: f })),
    ...displayImages.map(img => ({ type: 'image' as const, data: img }))
  ];
  const totalPages = Math.ceil(displayItems.length / ITEMS_PER_PAGE);
  const paginatedItems = displayItems.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <>
      <Header />
      <main className={styles.galleryContainer}>
        <h1 className={styles.title}>👑 編集長室（Pages公開管理）</h1>
        {currentFolderId !== null ? (
          <div className={styles.breadcrumb} style={{ marginBottom: '20px' }}>
            <button onClick={() => setCurrentFolderId(null)} className="btn btn-secondary" style={{ marginRight: '10px' }}>
              ← feering gallery (トップへ戻る)
            </button>
            <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
              {folders.find(f => f.id === currentFolderId)?.name || '不明なフォルダ'}
            </span>
          </div>
        ) : (
          <p className={styles.subtitle}>
            チャット画面で「↑」を押した公開候補画像や、自動で取り込まれた画像の一覧です。<br/>
            画像の「↑」マークをクリックして、公開・非公開を一括管理できます。
          </p>
        )}

        {isLoading ? (
          <div className={styles.loading}>読み込み中...</div>
        ) : (displayItems.length === 0) ? (
          <div className={styles.empty}>
            まだ公開候補の画像がありません。<br/>
            チャット画面で画像の「↑」マークをクリックして、ここに追加してみましょう！
          </div>
        ) : (
          <>
            <div className={styles.grid}>
              {paginatedItems.map((item) => {
                if (item.type === 'folder') {
                  const folder = item.data;
                  // カバー画像を探す（指定がなければフォルダ内の最初の画像）
                  const coverImg = images.find(img => img.id === folder.coverImageId) 
                    || images.find(img => img.folderId === folder.id);
                  const imageUrl = coverImg ? (coverImg.isGenerated ? `/api/images/${coverImg.sessionId}/${coverImg.filename}` : (coverImg.dataUri || '')) : '';
                  
                  return (
                    <div key={`folder_${folder.id}`} className={styles.imageCard} onClick={() => setCurrentFolderId(folder.id)} style={{ cursor: 'pointer', border: '2px solid #FFC107', background: 'rgb(114, 117, 11)' }}>
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
                    <div key={uniqueKey} className={styles.imageCard}>
                      <ImageWithActions
                        image={img}
                        sessionId={img.sessionId}
                        imageUrl={imageUrl}
                        className={styles.imageWrapper}
                        isGenerated={img.isGenerated}
                        hideFavorite={true}
                        onClick={() => setEnlargedImage(img)}
                    onTogglePublish={async (newStatus) => {
                      const res = await fetch('/api/publish', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                          sessionId: img.sessionId, 
                          imageId: img.id, 
                          publishStatus: newStatus,
                          isGenerated: img.isGenerated 
                        })
                      });
                      if (!res.ok) throw new Error('公開状態の更新に失敗しました');
                      refreshGallery();
                    }}
                    onToggleFavorite={async (newFavState) => {
                      // 生成画像とアップロード画像でエンドポイントが異なる
                      const endpoint = img.isGenerated 
                        ? `/api/images/${img.sessionId}/${img.id}/favorite`
                        : `/api/messages/${img.sessionId}/${img.messageId}/favorite`;
                      const res = await fetch(endpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ isFavorite: newFavState })
                      });
                      if (!res.ok) throw new Error('お気に入り登録に失敗しました');
                    }}
                    onSetFolderCover={
                      img.folderId ? async () => {
                        const res = await fetch(`/api/folders/${img.folderId}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ coverImageId: img.id })
                        });
                        if (res.ok) {
                          alert('フォルダの表紙に設定しました！');
                          refreshGallery();
                        }
                      } : undefined
                    }
                    onTitleChange={async (newTitle: string) => {
                      await fetch(`/api/messages/${img.sessionId}/${img.messageId}/meta`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ title: newTitle, isGenerated: img.isGenerated })
                      });
                      refreshGallery();
                    }}
                  />
                  <div className={styles.info}>
                    <textarea 
                      placeholder="元プロンプト（未設定）"
                      defaultValue={img.prompt || ''}
                      onBlur={async (e) => {
                        const newPrompt = e.target.value;
                        if (newPrompt !== img.prompt) {
                          await fetch(`/api/messages/${img.sessionId}/${img.messageId}/meta`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ prompt: newPrompt, isGenerated: img.isGenerated })
                          });
                        }
                      }}
                      style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid gray', color: 'white', padding: '4px', resize: 'vertical', fontSize: '0.8rem', marginTop: '8px' }}
                    />
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
        <div className={styles.modalOverlay} onClick={() => {
          setEnlargedImage(null);
          refreshGallery();
        }}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <button className={styles.closeBtn} onClick={() => {
              setEnlargedImage(null);
              refreshGallery();
            }}>✕</button>
            <ImageWithActions 
              image={enlargedImage}
              sessionId={enlargedImage.sessionId}
              imageUrl={enlargedImage.isGenerated ? `/api/images/${enlargedImage.sessionId}/${enlargedImage.filename}` : (enlargedImage.dataUri || '')}
              className={styles.enlargedImageWrapper}
              isGenerated={enlargedImage.isGenerated}
              hideTitle={true}
              onToggleFavorite={async (newFavState) => {
                const endpoint = enlargedImage.isGenerated 
                  ? `/api/images/${enlargedImage.sessionId}/${enlargedImage.id}/favorite`
                  : `/api/messages/${enlargedImage.sessionId}/${enlargedImage.messageId}/favorite`;
                const res = await fetch(endpoint, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ isFavorite: newFavState })
                });
                if (!res.ok) throw new Error('お気に入り登録に失敗しました');
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
