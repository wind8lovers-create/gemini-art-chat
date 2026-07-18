'use client';
import { useState, useEffect } from 'react';
import { Message, GeneratedImage, Session } from '@/types';

/**
 * 【チャットの司令塔（カスタムフック）】
 * 画面とAI（API）の橋渡しをする重要なプログラムです。
 */
export function useChat(currentSessionId: string | null) {
  // 画面に表示するための「メッセージ一覧」と「画像一覧」の箱
  const [messages, setMessages] = useState<Message[]>([]);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [isLoading, setIsLoading] = useState(false); // AIが考え中かどうか

  // 画像生成中（isLoadingがtrue）の時にスマホ画面が暗転しないようにする処理 (WakeLock API)
  useEffect(() => {
    let wakeLock: any = null; // WakeLockSentinel

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch (err) {
        console.error("Wake Lock error:", err);
      }
    };

    if (isLoading) {
      requestWakeLock();
    } else {
      if (wakeLock) {
        wakeLock.release().then(() => { wakeLock = null; });
      }
    }

    // コンポーネントのアンマウント時にもリリースする
    return () => {
      if (wakeLock) wakeLock.release();
    };
  }, [isLoading]);

  // 選択されたセッションが変わった時、その部屋の過去のやり取りを読み込みます
  useEffect(() => {
    // 【修正箇所】部屋を切り替えた瞬間に、まずは前の部屋の履歴をパッと消してリセットする
    setMessages([]);
    setImages([]);

    if (!currentSessionId) {
      return;
    }

    // 過去のメッセージを取得
    fetch(`/api/sessions/${currentSessionId}`)
      .then(res => res.json())
      .then(data => {
        if (data.messages) {
          setMessages(data.messages);
          
          // メッセージの中から「AIが生成した画像」だけを集めて、右パネル用のリストを作ります
          const loadedImages: GeneratedImage[] = [];
          data.messages.forEach((msg: Message) => {
            if (msg.generatedImages) {
              loadedImages.push(...msg.generatedImages);
            }
          });
          setImages(loadedImages);
        }
      })
      .catch(err => console.error("メッセージ読み込みエラー:", err));

    // やり直し処理のリスナーを登録
    const handleRewind = async (e: Event) => {
      if (!currentSessionId) return;
      const customEvent = e as CustomEvent;
      const { messageId, text } = customEvent.detail;
      
      try {
        const res = await fetch(`/api/sessions/${currentSessionId}/rewind`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId })
        });
        
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages);
          
          // 画像リストも再計算
          const loadedImages: GeneratedImage[] = [];
          data.messages.forEach((msg: Message) => {
            if (msg.generatedImages) {
              loadedImages.push(...msg.generatedImages);
            }
          });
          setImages(loadedImages);
          
          // ChatInputに文字をセット
          window.dispatchEvent(new CustomEvent('editPrompt', { detail: text }));
        }
      } catch (err) {
        console.error("やり直しエラー:", err);
        alert("やり直し処理に失敗しました。");
      }
    };

    window.addEventListener('editPromptRewind', handleRewind);
    return () => window.removeEventListener('editPromptRewind', handleRewind);
  }, [currentSessionId]);

  // メッセージを送信する処理
  const sendMessage = async (text: string, inputImage?: { mimeType: string, data: string }) => {
    if (!currentSessionId) {
      alert("まずは左側のサイドバーから「＋ 新規」を押して会話部屋を作ってください！");
      return;
    }

    setIsLoading(true); // 考え中マークをONにする

    // 1. まずはユーザーのメッセージを画面にすぐ表示する
    const userMessageId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
    const newUserMsg: Message = {
      id: userMessageId,
      sender: 'user',
      text,
      timestamp: new Date().toISOString(),
      inputImage: inputImage // ユーザーが送った画像も一緒に保存
    };
    setMessages(prev => [...prev, newUserMsg]);

    // 2. フェーズ1で作った /api/chat にメッセージを送る
    try {
      const isVideoEnabled = localStorage.getItem('isVideoEnabled') !== 'false';
      
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionId: currentSessionId, 
          text: text,
          inputImage: inputImage, // ここでAPIに画像を渡す！
          messageId: userMessageId, // サーバー側でも同じIDを使わせる
          isVideoEnabled
        }),
      });
      
      const data: any = await res.json();
      
      if (res.ok) {
        if (data.isPollingRequired) {
          // 動画生成の非同期処理のポーリング
          const pollInterval = setInterval(async () => {
            try {
              const pollRes = await fetch(`/api/chat/poll?operationId=${data.operationId}&sessionId=${data.sessionId}&prompt=${encodeURIComponent(data.prompt)}`);
              const pollData = await pollRes.json();
              
              if (pollData.done) {
                clearInterval(pollInterval);
                setMessages(prev => [...prev, pollData.message]);
                if (pollData.message.generatedImages) {
                  setImages(prev => [...prev, ...pollData.message.generatedImages]);
                }
                setIsLoading(false);
              } else if (pollData.error) {
                clearInterval(pollInterval);
                alert("エラーが発生しました: " + pollData.error);
                setIsLoading(false);
              }
            } catch (err) {
              clearInterval(pollInterval);
              console.error("ポーリング通信エラー:", err);
              alert("通信に失敗しました。");
              setIsLoading(false);
            }
          }, 10000);
          return; // isLoadingはtrueのままで待機
        }

        const aiMessage: Message = data;
        // 3. 成功したら、AIからの返答を画面に追加する
        setMessages(prev => [...prev, aiMessage]);
        
        // もしAIがメディアを作ってくれていたらリストに追加する
        if (aiMessage.generatedImages) {
          setImages(prev => [...prev, ...aiMessage.generatedImages!]);
        }
      } else {
        console.error("AIからの返答エラー:", data.error);
        alert("エラーが発生しました: " + data.error);
      }
    } catch (err) {
      console.error("通信エラー:", err);
      alert("通信に失敗しました。");
    } finally {
      setIsLoading(false); // 考え中マークをOFFにする
    }
  };

  return { 
    messages, 
    images, 
    isLoading, 
    sendMessage 
  };
}
