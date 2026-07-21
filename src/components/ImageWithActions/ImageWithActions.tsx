import React, { useState } from 'react';
import styles from './ImageWithActions.module.css';
import { GeneratedImage } from '@/types';
import VideoPlayer from '@/components/VideoPlayer/VideoPlayer';

export default function ImageWithActions({
  image,
  sessionId,
  imageUrl,
  className,
  onClick,
  onFork,
  onToggleFavorite,
  onTogglePublish,
  onSetFolderCover,
  hideFavorite,
  hidePublish,
  isGenerated,
  hideTitle,
  onTitleChange
}: {
  image: GeneratedImage;
  sessionId: string;
  imageUrl: string;
  className?: string;
  onClick?: () => void;
  onFork?: (newSessionId: string) => void;
  onToggleFavorite?: (newFavState: boolean) => Promise<void>;
  onTogglePublish?: (newPublishStatus: 'none' | 'published' | 'hidden') => Promise<void>;
  onSetFolderCover?: () => void; // フォルダの表紙に設定する関数
  hideFavorite?: boolean;
  hidePublish?: boolean;
  isGenerated?: boolean; // AI生成画像かどうかを正確に判定するフラグ
  hideTitle?: boolean; // 拡大時などにタイトル透かしを隠すフラグ
  onTitleChange?: (newTitle: string) => Promise<void>; // タイトルを直接編集するためのコールバック
}) {
  const [isFav, setIsFav] = useState(image.isFavorite || false);
  const [pubStatus, setPubStatus] = useState<'none' | 'published' | 'hidden'>(image.publishStatus || 'none');
  const [isHovered, setIsHovered] = useState(false);
  const [isForking, setIsForking] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isFavoriting, setIsFavoriting] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFavoriting) return;
    setIsFavoriting(true);
    // すぐにUIを切り替えてサクサク動くように見せる
    const newFav = !isFav;
    setIsFav(newFav);
    
    try {
      if (onToggleFavorite) {
        await onToggleFavorite(newFav);
      } else {
        await fetch(`/api/images/${sessionId}/${image.id}/favorite`, { method: 'POST' });
      }
    } catch (error) {
      console.error('お気に入り登録エラー:', error);
      // 失敗したら元に戻す
      setIsFav(!newFav);
    } finally {
      setIsFavoriting(false);
    }
  };

  const togglePublish = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPublishing) return;
    setIsPublishing(true);
    // 現在のステータスから次のステータスを決定
    // none -> published, published -> hidden, hidden -> published
    const newStatus = pubStatus === 'published' ? 'hidden' : 'published';
    const oldStatus = pubStatus;
    setPubStatus(newStatus);
    
    try {
      if (onTogglePublish) {
        await onTogglePublish(newStatus);
      } else {
        const res = await fetch('/api/publish', { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            sessionId, 
            imageId: image.id, 
            publishStatus: newStatus,
            // propsで明示的に渡されていればそれを使い、無ければ古い簡易判定をフォールバックとして使う
            isGenerated: isGenerated !== undefined ? isGenerated : image.parentImageId !== undefined
          })
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(`API Error: ${res.status} ${errData.error || ''}`);
        }
      }
    } catch (error) {
      console.error('公開ステータス更新エラー:', error);
      setPubStatus(oldStatus);
    } finally {
      setIsPublishing(false);
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
      className={`${styles.container} ${className || ''} ${pubStatus === 'published' ? styles.isPublished : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {image.mediaType === 'video' || imageUrl.toLowerCase().endsWith('.mp4') ? (
        <VideoPlayer src={imageUrl} className={styles.image} />
      ) : (
        <img src={imageUrl} alt={image.prompt} className={styles.image} />
      )}
      
      {/* タイトルが設定されている、または編集中は画像上にオーバーレイ表示 */}
      {!hideTitle && (image.title || isEditingTitle) && (
        <div className={styles.titleOverlay} style={isEditingTitle ? { pointerEvents: 'auto' } : undefined}>
          {isEditingTitle ? (
            <input
              type="text"
              placeholder="タイトルを入力..."
              defaultValue={image.title || ''}
              autoFocus
              onBlur={async (e) => {
                const newTitle = e.target.value;
                if (newTitle !== image.title && onTitleChange) {
                  await onTitleChange(newTitle);
                }
                setIsEditingTitle(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur();
                }
              }}
              onClick={(e) => e.stopPropagation()} // クリック時に拡大させない
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                color: 'white',
                textAlign: 'center',
                outline: 'none',
                fontSize: 'inherit',
                fontWeight: 'inherit',
                textShadow: 'inherit'
              }}
            />
          ) : (
            image.title
          )}
        </div>
      )}
      
      {/* ホバー時またはお気に入り/公開済みの時にオーバーレイを表示 */}
      <div className={`${styles.overlay} ${(isHovered || (isFav && !hideFavorite) || (pubStatus === 'published' && !hidePublish)) ? styles.visible : ''}`}>
        <div className={styles.topActions}>
          {!hideFavorite && (
            <button 
              className={`${styles.actionBtn} ${isFav ? styles.favoriteActive : ''}`} 
              onClick={toggleFavorite}
              title={isFav ? "お気に入りを解除" : "お気に入りに登録"}
            >
              {isFav ? '★' : '☆'}
            </button>
          )}
          {!hidePublish && (
            <button 
              className={`${styles.actionBtn} ${pubStatus === 'published' ? styles.publishActive : ''}`} 
              onClick={togglePublish}
              disabled={isPublishing}
              title={pubStatus === 'published' ? "編集長室で非表示にする" : "編集長室に送る（公開ON）"}
            >
              {isPublishing ? '⏳' : '↑'}
            </button>
          )}
        </div>
        
        {/* ホバー時のみ下部ボタンを表示 */}
        {isHovered && (
          <div className={styles.bottomActions}>
            {onSetFolderCover && (
              <button 
                className={styles.actionBtn} 
                onClick={(e) => { e.stopPropagation(); onSetFolderCover(); }} 
                title="この画像をフォルダの表紙（代表サムネイル）に設定する"
              >
                📁
              </button>
            )}
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
            {onTitleChange && (
              <button 
                className={styles.actionBtn} 
                onClick={(e) => { e.stopPropagation(); setIsEditingTitle(true); }} 
                title="タイトルを編集する"
              >
                ✏️
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
