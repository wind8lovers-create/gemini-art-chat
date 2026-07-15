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

    // 動画機能のON/OFF状態をローカルストレージから読み込む
    const savedVideoToggle = localStorage.getItem('isVideoEnabled');
    const isVideoEnabled = savedVideoToggle !== 'false'; // デフォルトは true

    // 2. フェーズ1で作った /api/chat にメッセージを送る
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionId: currentSessionId, 
          text: text,
          inputImage: inputImage, // ここでAPIに画像を渡す！
          messageId: userMessageId, // サーバー側でも同じIDを使わせる
          isVideoEnabled: isVideoEnabled // 動画生成がONかどうかをAPIに伝える
        }),
      });
      
      
      const data = await res.json();
      
      if (res.ok) {
        // 3. 動画生成で非同期ポーリングが必要な場合
        if (data.isPollingRequired) {
          await pollVideoStatus(data.operationId, data.sessionId, data.prompt);
        } else {
          // 通常の画像生成・テキスト生成の場合
          const aiMessage: Message = data;
          setMessages(prev => [...prev, aiMessage]);
          if (aiMessage.generatedImages) {
            setImages(prev => [...prev, ...aiMessage.generatedImages!]);
          }
          setIsLoading(false); // 考え中マークをOFFにする
        }
      } else {
        console.error("AIからの返答エラー:", data.error);
        alert("エラーが発生しました: " + data.error);
        setIsLoading(false);
      }
    } catch (err) {
      console.error("通信エラー:", err);
      alert("通信に失敗しました。");
      setIsLoading(false);
    }
    // 注意: ポーリングの場合は pollVideoStatus 側で setIsLoading(false) を呼ぶため、ここでは呼ばない
  };

  // 動画生成のステータスを定期的に確認する関数
  const pollVideoStatus = async (operationId: string, sessionId: string, prompt: string) => {
    try {
      // 10秒おきにステータスを確認
      const checkStatus = async () => {
        try {
          const res = await fetch(`/api/chat/poll?operationId=${encodeURIComponent(operationId)}&sessionId=${encodeURIComponent(sessionId)}&prompt=${encodeURIComponent(prompt)}`);
          const data = await res.json();

          if (!res.ok) {
            throw new Error(data.error || 'ステータス確認エラー');
          }

          if (data.done) {
            // 生成完了！メッセージを画面に追加
            const aiMessage: Message = data.message;
            setMessages(prev => [...prev, aiMessage]);
            if (aiMessage.generatedImages) {
              setImages(prev => [...prev, ...aiMessage.generatedImages!]);
            }
            setIsLoading(false); // ようやく考え中マークをOFFにする
          } else {
            // まだ生成中の場合は、10秒後に再確認
            setTimeout(checkStatus, 10000);
          }
        } catch (err) {
          console.error("ポーリング中のエラー:", err);
          alert("動画の生成中にエラーが発生しました。");
          setIsLoading(false);
        }
      };

      // 最初の確認をスタート（少し待ってから）
      setTimeout(checkStatus, 10000);
      
    } catch (err) {
      console.error("ポーリング開始エラー:", err);
      setIsLoading(false);
    }
  };

  return { 
    messages, 
    images, 
    isLoading, 
    sendMessage 
  };
}
