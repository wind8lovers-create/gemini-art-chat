'use client';
import React from 'react';
import styles from './ChatWindow.module.css';
import MessageBubble from './MessageBubble';
import { Message, GeneratedImage } from '@/types';

// currentSessionId も親からもらうようにします
export default function ChatWindow({ 
  messages, 
  currentSessionId,
  onImageClick,
  onFork
}: { 
  messages: Message[], 
  currentSessionId: string | null,
  onImageClick: (img: GeneratedImage, url: string, sessionId: string) => void,
  onFork?: (id: string) => void
}) {
  return (
    <div className={styles.chatWindow}>
      {messages.length === 0 ? (
        <div className={styles.emptyChat}>
          <img 
            src="/feeling-gallery.jpg" 
            alt="Feeling Gallery" 
            style={{ maxWidth: '300px', borderRadius: '12px', marginBottom: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }} 
          />
          <h3>👋 Feeling Gallery へようこそ♪</h3>
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
    </div>
  );
}
