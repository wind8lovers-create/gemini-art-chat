'use client';
import React, { useState, useEffect } from 'react';
import styles from './page.module.css';
import Header from '@/components/Header/Header';
import Sidebar from '@/components/Sidebar/Sidebar';
import ChatWindow from '@/components/Chat/ChatWindow';
import ChatInput from '@/components/Chat/ChatInput';
import ImagePanel from '@/components/ImagePanel/ImagePanel';
import { useChat } from '@/hooks/useChat';
import { GeneratedImage } from '@/types';
import ImageWithActions from '@/components/ImageWithActions/ImageWithActions';

export default function Home() {
  // 「今どの会話部屋（セッション）を開いているか」を記憶する箱
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  
  // 「いま拡大表示している画像」を記憶する箱
  const [enlargedImage, setEnlargedImage] = useState<{img: GeneratedImage, url: string, sessionId: string} | null>(null);
  
  // サイドバーの表示・非表示を記憶する箱（デフォルトはPC向けに開いておく）
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);

  // 画面が最初に読み込まれたとき、スマホ画面の幅なら最初からサイドバーを閉じる
  useEffect(() => {
    if (window.innerWidth <= 768) {
      setIsSidebarVisible(false);
    }
  }, []);

  // 先ほど作った「司令塔（useChat）」を呼び出します
  // 現在の部屋IDを渡すと、その部屋のメッセージや画像、送信用の機能を返してくれます
  const { messages, images, isLoading, sendMessage } = useChat(currentSessionId);

  return (
    <>
      <Header onLogoClick={() => setIsSidebarVisible(true)} />
      
      <div className={styles.mainLayout}>
        {/* サイドバーには「今の部屋のID」と「部屋を切り替える機能」などを渡します */}
        <Sidebar 
          currentSessionId={currentSessionId} 
          onSelectSession={setCurrentSessionId} 
          isVisible={isSidebarVisible}
          onClose={() => setIsSidebarVisible(false)}
        />
        
        <main className={styles.centerArea}>
          {/* チャット画面には「メッセージ一覧」と「今の部屋のID（画像表示用）」を渡します */}
          <ChatWindow 
            messages={messages} 
            currentSessionId={currentSessionId} 
            onImageClick={(img, url, sid) => setEnlargedImage({img, url, sessionId: sid})}
            onFork={(id) => { setCurrentSessionId(id); setEnlargedImage(null); }}
          />
          
          {/* 入力欄には「送信する機能」と「AIが考え中かどうかの状態」を渡します */}
          <ChatInput onSendMessage={sendMessage} isLoading={isLoading} />
        </main>
        
        {/* 画像パネルには「画像一覧」と「今の部屋のID」を渡します */}
        <ImagePanel 
          images={images} 
          currentSessionId={currentSessionId} 
          onImageClick={(img, url, sid) => setEnlargedImage({img, url, sessionId: sid})}
          onFork={(id) => { setCurrentSessionId(id); setEnlargedImage(null); }}
          isVisible={isSidebarVisible}
        />
      </div>

      {/* 拡大画像を表示する黒い背景（モーダル） */}
      {enlargedImage && (
        <div className={styles.modalOverlay} onClick={() => setEnlargedImage(null)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <button className={styles.closeBtn} onClick={() => setEnlargedImage(null)}>✕</button>
            <ImageWithActions 
              image={enlargedImage.img}
              sessionId={enlargedImage.sessionId}
              imageUrl={enlargedImage.url}
              className={styles.enlargedImageWrapper}
              onFork={(id) => { setCurrentSessionId(id); setEnlargedImage(null); }}
            />
          </div>
        </div>
      )}
    </>
  );
}
