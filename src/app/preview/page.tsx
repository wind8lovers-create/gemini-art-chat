'use client';
import React, { useEffect, useState } from 'react';
import styles from './page.module.css';
import Header from '@/components/Header/Header';
import { GalleryImage } from '@/types';
import VideoPlayer from '@/components/VideoPlayer/VideoPlayer';

type ManagedImage = GalleryImage & { dataUri?: string; messageId?: string; isGenerated?: boolean };

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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/manage')
      .then(res => res.json())
      .then((data: ManagedImage[]) => {
        // 公開（published）になっているものだけをフィルタリング
        const publishedImages = data.filter(img => img.publishStatus === 'published');
        setImages(publishedImages);
        setIsLoading(false);
      })
      .catch(err => {
        console.error("プレビュー画像取得エラー:", err);
        setIsLoading(false);
      });
  }, []);

  return (
    <>
      <Header />
      <main className={styles.container}>
        <h1 className={styles.title}>👀 Pages表示イメージ（プレビュー）</h1>
        <p className={styles.subtitle}>
          編集長室で「↑（公開ON）」にした画像が、実際に公開ページでどのように見えるかを確認できます。
        </p>

        {isLoading ? (
          <div className={styles.empty}>読み込み中...</div>
        ) : images.length === 0 ? (
          <div className={styles.empty}>
            公開中の画像がありません。<br/>
            編集長室で公開したい画像の「↑」マークをクリックしてください。
          </div>
        ) : (
          <div className={styles.grid}>
            {images.map((img) => {
              const imageUrl = img.isGenerated ? `/api/images/${img.sessionId}/${img.filename}` : (img.dataUri || '');
              const uniqueKey = `${img.sessionId}_${img.id}`;
              
              return (
                <div key={uniqueKey} className={styles.card}>
                  <div className={styles.imageWrapper}>
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
            })}
          </div>
        )}
      </main>
    </>
  );
}
