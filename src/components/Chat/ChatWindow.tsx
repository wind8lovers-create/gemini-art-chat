'use client';
import React from 'react';
import styles from './ChatWindow.module.css';
import MessageBubble from './MessageBubble';
import LoadingOverlay from '../LoadingOverlay/LoadingOverlay';
import { Message, GeneratedImage } from '@/types';

// currentSessionId も親からもらうようにします
export default function ChatWindow({ 
  messages, 
  currentSessionId,
  isLoading,
  loadingVideoUrl,
  onImageClick,
  onFork
}: { 
  messages: Message[], 
  currentSessionId: string | null,
  isLoading?: boolean,
  loadingVideoUrl?: string,
  onImageClick: (img: GeneratedImage, url: string, sessionId: string) => void,
  onFork?: (id: string) => void
}) {
  return (
    <div className={styles.chatWindow}>
      {messages.length === 0 ? (
        <div className={styles.emptyChat}>
          <h3>👋 Gemini Art Chat へようこそ！</h3>
          <p>
            まずは左側の「＋ 新規」を押して会話をスタートしてください。<br/>
            下の入力欄からAIに「猫の絵を描いて」などと話しかけてみましょう。
          </p>
        </div>
      ) : (
        <div className={styles.messageList}>
          {messages.map(msg => (
            // MessageBubble にも currentSessionId を渡します
            <MessageBubble 
              key={msg.id} 
              msg={msg} 
              currentSessionId={currentSessionId!} 
              onImageClick={onImageClick}
              onFork={onFork}
            />
          ))}
        </div>
      )}
      {isLoading && <LoadingOverlay isVisible={isLoading} videoUrl={loadingVideoUrl} />}
    </div>
  );
}
