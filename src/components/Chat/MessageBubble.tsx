'use client';
import React from 'react';
import styles from './ChatWindow.module.css';
import { Message, GeneratedImage } from '@/types';
import ImageWithActions from '@/components/ImageWithActions/ImageWithActions';

export default function MessageBubble({ 
  msg, 
  currentSessionId,
  onImageClick,
  onFork
}: { 
  msg: Message, 
  currentSessionId: string,
  onImageClick: (img: GeneratedImage, url: string, sessionId: string) => void,
  onFork?: (id: string) => void
}) {
  const isUser = msg.sender === 'user';
  
  return (
    <div className={`${styles.messageWrapper} ${isUser ? styles.userWrapper : styles.aiWrapper}`}>
      <div className={`${styles.bubble} ${isUser ? styles.userBubble : styles.aiBubble}`}>
        {/* ユーザーが画像をアップロードしていたら、吹き出しの中に表示する */}
        {msg.inputImage && (() => {
          const dummyImg: GeneratedImage = {
            id: msg.id,
            filename: msg.inputImage.mimeType?.startsWith('video/') ? 'uploaded_video.mp4' : 'uploaded_image.png',
            prompt: 'アップロード画像',
            version: 1,
            parentImageId: null,
            isFavorite: msg.inputImage.isFavorite || false,
            mediaType: msg.inputImage.mimeType?.startsWith('video/') ? 'video' : 'image'
          };
          
          return (
            <div style={{ maxWidth: '300px', marginBottom: '8px' }}>
              <ImageWithActions 
                image={dummyImg}
                sessionId={currentSessionId}
                imageUrl={msg.inputImage.data}
                onToggleFavorite={async (newFavState) => {
                  const res = await fetch(`/api/messages/${currentSessionId}/${msg.id}/favorite`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ isFavorite: newFavState })
                  });
                  if (!res.ok) throw new Error('お気に入り登録に失敗しました');
                }}
                onClick={() => onImageClick(dummyImg, msg.inputImage!.data, currentSessionId)}
              />
            </div>
          );
        })()}
        <div className={styles.text}>{msg.text}</div>
        
        {/* 画像があれば、さっき作った画像配信用APIを使って本物の画像を表示します */}
        {msg.generatedImages && msg.generatedImages.length > 0 && (
          <div className={styles.imageGrid}>
            {msg.generatedImages.map((img, idx) => {
              const imageUrl = `/api/images/${currentSessionId}/${img.filename}`;
              return (
                <ImageWithActions 
                  key={idx}
                  image={img}
                  sessionId={currentSessionId}
                  imageUrl={imageUrl}
                  className={styles.generatedImage}
                  onClick={() => onImageClick(img, imageUrl, currentSessionId)}
                  onFork={onFork}
                />
              );
            })}
          </div>
        )}

        {isUser && (
          <div className={styles.actionButtons}>
            <button 
              className={styles.actionBtn}
              onClick={() => {
                if (confirm('このプロンプト以降の会話を削除して、この時点からやり直しますか？')) {
                  window.dispatchEvent(new CustomEvent('editPromptRewind', { detail: { messageId: msg.id, text: msg.text } }));
                }
              }}
              title="この時点に戻ってやり直す"
            >
              ✎ 編集（やり直し）
            </button>
            <button 
              className={styles.actionBtn}
              onClick={() => {
                navigator.clipboard.writeText(msg.text);
                alert('コピーしました！');
              }}
            >
              📋 コピー
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
