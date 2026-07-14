import React, { useState } from 'react';
import styles from './ImageWithActions.module.css';
import { GeneratedImage } from '@/types';

export default function ImageWithActions({
  image,
  sessionId,
  imageUrl,
  className,
  onClick,
  onFork
}: {
  image: GeneratedImage;
  sessionId: string;
  imageUrl: string;
  className?: string;
  onClick?: () => void;
  onFork?: (newSessionId: string) => void;
}) {
  const [isFav, setIsFav] = useState(image.isFavorite || false);
  const [isHovered, setIsHovered] = useState(false);
  const [isForking, setIsForking] = useState(false);

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    // すぐにUIを切り替えてサクサク動くように見せる
    setIsFav(!isFav);
    
    try {
      await fetch(`/api/images/${sessionId}/${image.id}/favorite`, { method: 'POST' });
    } catch (error) {
      console.error('お気に入り登録エラー:', error);
      // 失敗したら元に戻す
      setIsFav(isFav);
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = image.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('ダウンロードエラー:', error);
    }
  };

  const handleFork = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isForking || !onFork) return;
    
    setIsForking(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/fork`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId: image.id })
      });
      if (res.ok) {
        const { newSessionId } = await res.json();
        window.dispatchEvent(new Event('sessionsUpdated')); // サイドバーを更新
        onFork(newSessionId);
      }
    } catch (error) {
      console.error('フォークエラー:', error);
    } finally {
      setIsForking(false);
    }
  };

  return (
    <div 
      className={`${styles.container} ${className || ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      <img src={imageUrl} alt={image.prompt} className={styles.image} />
      
      {/* ホバー時またはお気に入り済みの時にオーバーレイを表示 */}
      <div className={`${styles.overlay} ${(isHovered || isFav) ? styles.visible : ''}`}>
        <div className={styles.topActions}>
          <button 
            className={`${styles.actionBtn} ${isFav ? styles.favoriteActive : ''}`} 
            onClick={toggleFavorite}
            title={isFav ? "お気に入りを解除" : "お気に入りに登録"}
          >
            {isFav ? '★' : '☆'}
          </button>
        </div>
        
        {/* ホバー時のみ下部ボタンを表示 */}
        {isHovered && (
          <div className={styles.bottomActions}>
            {onFork && (
              <button 
                className={styles.actionBtn} 
                onClick={handleFork} 
                title="この画像をベースに新しいチャットを始める"
                disabled={isForking}
              >
                {isForking ? '⏳' : '🌱'}
              </button>
            )}
            <button className={styles.actionBtn} onClick={handleDownload} title="画像をダウンロード">
              ⬇️
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
