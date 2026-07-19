'use client';
import React, { useEffect, useState } from 'react';
import styles from '../gallery/page.module.css'; // galleryのCSSを使い回す
import Header from '@/components/Header/Header';
import { GalleryImage } from '@/types';
import ImageWithActions from '@/components/ImageWithActions/ImageWithActions';

// 拡張した型を定義（dataUriが含まれる）
type ManagedImage = GalleryImage & { dataUri?: string; messageId?: string; isGenerated?: boolean };

export default function UploadsPage() {
  const [images, setImages] = useState<ManagedImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [enlargedImage, setEnlargedImage] = useState<ManagedImage | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (confirm('現在「↑（公開ON）」になっている画像を、GitHub Pages 用の静的HPとして書き出しますか？\n（ONのファイルだけが追加・更新されます）')) {
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
    fetch('/api/manage')
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
    fetch('/api/manage')
      .then(res => res.json())
      .then(data => setImages(data));
  };

  return (
    <>
      <Header />
      <main className={styles.galleryContainer}>
        <h1 className={styles.title}>👑 編集長室（Pages公開管理）</h1>
        <p className={styles.subtitle}>
          チャット画面で「↑」を押した公開候補画像や、自動で取り込まれた画像の一覧です。<br/>
          画像の「↑」マークをクリックして、公開・非公開を一括管理できます。
        </p>

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
          <div className={styles.loading}>読み込み中...</div>
        ) : images.length === 0 ? (
          <div className={styles.empty}>
            まだ公開候補の画像がありません。<br/>
            チャット画面で画像の「↑」マークをクリックして、ここに追加してみましょう！
          </div>
        ) : (
          <div className={styles.grid}>
            {images.map((img) => {
              const imageUrl = img.isGenerated ? `/api/images/${img.sessionId}/${img.filename}` : (img.dataUri || '');
              // idが重複する可能性があるため、sessionId + id の組み合わせをkeyにする
              const uniqueKey = `${img.sessionId}_${img.id}`;
              return (
                <div key={uniqueKey} className={styles.imageCard}>
                  <ImageWithActions
                    image={img}
                    sessionId={img.sessionId}
                    imageUrl={imageUrl}
                    className={styles.imageWrapper}
                    isGenerated={img.isGenerated}
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
              imageUrl={enlargedImage.isGenerated ? `/api/images/${enlargedImage.sessionId}/${enlargedImage.filename}` : (enlargedImage.dataUri || '')}
              className={styles.enlargedImageWrapper}
              isGenerated={enlargedImage.isGenerated}
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
