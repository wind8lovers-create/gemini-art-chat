'use client';
import React from 'react';
import styles from './ImagePanel.module.css';
import { GeneratedImage } from '@/types';
import ImageWithActions from '@/components/ImageWithActions/ImageWithActions';

export default function ImagePanel({ 
  images, 
  currentSessionId,
  onImageClick,
  onFork
}: { 
  images: GeneratedImage[], 
  currentSessionId: string | null,
  onImageClick: (img: GeneratedImage, url: string, sessionId: string) => void,
  onFork?: (id: string) => void
}) {
  return (
    <aside className={`${styles.imagePanel} glass-panel`}>
      <h2 className={styles.title}>🖼️ セッション内の画像</h2>
      
      <div className={styles.grid}>
        {images.length === 0 ? (
          <div className={styles.empty}>まだ画像がありません</div>
        ) : (
          images.map(img => {
            const imageUrl = `/api/images/${currentSessionId}/${img.filename}`;
            return (
              <div key={img.id} className={styles.imageCard}>
                <div className={styles.placeholderBox}>
                  {currentSessionId ? (
                    <ImageWithActions
                      image={img}
                      sessionId={currentSessionId}
                      imageUrl={imageUrl}
                      onClick={() => onImageClick(img, imageUrl, currentSessionId)}
                      onFork={onFork}
                    />
                  ) : (
                    `画像 v${img.version}`
                  )}
                </div>
                <p className={styles.promptText}>{img.prompt}</p>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
