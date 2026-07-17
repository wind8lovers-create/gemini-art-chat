'use client';
import React, { useEffect, useState } from 'react';
import styles from '../gallery/page.module.css'; // galleryのCSSを使い回す
import Header from '@/components/Header/Header';
import { GalleryImage } from '@/types';
import ImageWithActions from '@/components/ImageWithActions/ImageWithActions';

// 拡張した型を定義（dataUriが含まれる）
type UploadImage = GalleryImage & { dataUri?: string };

export default function UploadsPage() {
  const [images, setImages] = useState<UploadImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [enlargedImage, setEnlargedImage] = useState<UploadImage | null>(null);

  useEffect(() => {
    fetch('/api/uploads')
      .then(res => res.json())
      .then(data => {
        setImages(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error("アップ画像取得エラー:", err);
        setIsLoading(false);
      });
  }, []);

  const refreshGallery = () => {
    fetch('/api/uploads')
      .then(res => res.json())
      .then(data => setImages(data));
  };

  return (
    <>
      <Header />
      <main className={styles.galleryContainer}>
        <h1 className={styles.title}>📎 ★アップ画像の部屋</h1>
        <p className={styles.subtitle}>
          お気に入り（★）に登録したアップロード画像の一覧です。<br/>
          ダウンロードや拡大表示ができます。
        </p>

        {isLoading ? (
          <div className={styles.loading}>読み込み中...</div>
        ) : images.length === 0 ? (
          <div className={styles.empty}>
            まだ★がついたアップロード画像がありません。<br/>
            チャット画面で自分がアップロードした画像の☆マークをクリックして追加してみましょう！
          </div>
        ) : (
          <div className={styles.grid}>
            {images.map((img) => {
              const imageUrl = img.dataUri || '';
              return (
                <div key={img.id} className={styles.imageCard}>
                  <ImageWithActions
                    image={img}
                    sessionId={img.sessionId}
                    imageUrl={imageUrl}
                    className={styles.imageWrapper}
                    onClick={() => setEnlargedImage(img)}
                    onToggleFavorite={async (newFavState) => {
                      const res = await fetch(`/api/messages/${img.sessionId}/${img.id}/favorite`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ isFavorite: newFavState })
                      });
                      if (!res.ok) throw new Error('お気に入り登録に失敗しました');
                    }}
                  />
                  <div className={styles.info}>
                    <p className={styles.prompt}>{img.prompt}</p>
                    <p className={styles.sessionTitle}>フォルダ: {img.sessionTitle}</p>
                  </div>
                </div>
              );
            })}
          </div>
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
              imageUrl={enlargedImage.dataUri || ''}
              className={styles.enlargedImageWrapper}
              onToggleFavorite={async (newFavState) => {
                const res = await fetch(`/api/messages/${enlargedImage.sessionId}/${enlargedImage.id}/favorite`, {
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
