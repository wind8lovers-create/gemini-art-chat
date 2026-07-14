'use client';
import React, { useEffect, useState } from 'react';
import styles from './page.module.css';
import Header from '@/components/Header/Header';
import { GalleryImage } from '@/types';
import ImageWithActions from '@/components/ImageWithActions/ImageWithActions';

export default function GalleryPage() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [enlargedImage, setEnlargedImage] = useState<GalleryImage | null>(null);

  useEffect(() => {
    fetch('/api/gallery')
      .then(res => res.json())
      .then(data => {
        setImages(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error("ギャラリー取得エラー:", err);
        setIsLoading(false);
      });
  }, []);

  // お気に入り解除などでリストから消えた時のための更新用
  const refreshGallery = () => {
    fetch('/api/gallery')
      .then(res => res.json())
      .then(data => setImages(data));
  };

  return (
    <>
      <Header />
      <main className={styles.galleryContainer}>
        <h1 className={styles.title}>⭐️ お気に入りギャラリー</h1>
        <p className={styles.subtitle}>
          お気に入り（★）に登録した画像の一覧です。<br/>
          ダウンロードや拡大表示ができます。
        </p>

        {isLoading ? (
          <div className={styles.loading}>読み込み中...</div>
        ) : images.length === 0 ? (
          <div className={styles.empty}>
            まだお気に入り画像がありません。<br/>
            チャット画面で画像の☆マークをクリックしてお気に入りに追加してみましょう！
          </div>
        ) : (
          <div className={styles.grid}>
            {images.map((img) => {
              const imageUrl = `/api/images/${img.sessionId}/${img.filename}`;
              return (
                <div key={img.id} className={styles.imageCard}>
                  <ImageWithActions
                    image={img}
                    sessionId={img.sessionId}
                    imageUrl={imageUrl}
                    className={styles.imageWrapper}
                    onClick={() => setEnlargedImage(img)}
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
          refreshGallery(); // 閉じた時にお気に入り解除が反映されるようにリロード
        }}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <button className={styles.closeBtn} onClick={() => {
              setEnlargedImage(null);
              refreshGallery();
            }}>✕</button>
            <ImageWithActions 
              image={enlargedImage}
              sessionId={enlargedImage.sessionId}
              imageUrl={`/api/images/${enlargedImage.sessionId}/${enlargedImage.filename}`}
              className={styles.enlargedImageWrapper}
            />
          </div>
        </div>
      )}
    </>
  );
}
