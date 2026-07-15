'use client';
import React, { useState, useRef, useEffect } from 'react';
import styles from './ChatInput.module.css';
import { Message, PromptSnippet } from '@/types';

/**
 * 【チャット入力欄】
 * ユーザーが文字を入力したり、画像をドラッグ＆ドロップして送信する部品です。
 */export default function ChatInput({ 
  onSendMessage, 
  isLoading 
}: { 
  onSendMessage: (text: string, image?: { mimeType: string, data: string }) => void,
  isLoading: boolean
}) {
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  // ドラッグ＆ドロップ関連の状態
  const [isDragging, setIsDragging] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ url: string, file: File } | null>(null);
  
  // 隠しファイル入力用の参照
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // 音声入力用の状態と参照
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  
  // 定型文用の状態
  const [snippets, setSnippets] = useState<PromptSnippet[]>([]);
  const [isSnippetMenuOpen, setIsSnippetMenuOpen] = useState(false);
  const snippetMenuRef = useRef<HTMLDivElement>(null);

  const loadSnippets = async () => {
    try {
      const res = await fetch('/api/snippets');
      const data = await res.json();
      setSnippets(data);
    } catch (err) {
      console.error('定型文取得エラー:', err);
    }
  };

  useEffect(() => {
    loadSnippets();
    window.addEventListener('snippetsUpdated', loadSnippets);
    
    // 他のメッセージから「編集」ボタンが押された時に入力欄に文字を入れる
    const handleEditPrompt = (e: Event) => {
      const customEvent = e as CustomEvent;
      setText(customEvent.detail);
      // 入力欄にフォーカスを当てる
      if (inputRef.current) {
        inputRef.current.focus();
      }
    };
    window.addEventListener('editPrompt', handleEditPrompt);
    
    return () => {
      window.removeEventListener('snippetsUpdated', loadSnippets);
      window.removeEventListener('editPrompt', handleEditPrompt);
    };
  }, []);

  // ドロップダウンの外をクリックしたら閉じる処理
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (snippetMenuRef.current && !snippetMenuRef.current.contains(e.target as Node)) {
        setIsSnippetMenuOpen(false);
      }
    };
    if (isSnippetMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSnippetMenuOpen]);

  // 定型文を選択した時の処理（後ろに付け足す）
  const handleSelectSnippet = (content: string) => {
    setText(prev => prev ? `${prev} ${content}` : content);
    setIsSnippetMenuOpen(false);
  };

  // 送信ボタンが押された時の処理
  const handleSend = async () => {
    // 文字も画像もない時は何もしない
    if (!text.trim() && !selectedImage) return;

    setIsSending(true);
    try {
      // 画像が選択されている場合は、Base64形式に変換して送る
      let inputImageData;
      if (selectedImage) {
        inputImageData = {
          mimeType: selectedImage.file.type,
          data: selectedImage.url
        };
      }

      await onSendMessage(text, inputImageData);
      
      // 送信成功したら入力欄と画像を空っぽにする
      setText('');
      setSelectedImage(null);
    } catch (error) {
      console.error("送信エラー:", error);
    } finally {
      setIsSending(false);
    }
  };

  // エンターキーが押された時の処理
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // 改行を防ぐ
      handleSend();
    }
  };

  // ----------------------------------------
  // 音声入力（マイク）の処理
  // ----------------------------------------
  const toggleListening = () => {
    if (isListening) {
      // 録音中なら止める
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    // ブラウザが音声入力に対応しているかチェック
    const SpeechRecognition = typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;
    
    if (!SpeechRecognition) {
      alert("お使いのブラウザは音声入力に対応していません。ChromeやEdgeなどの最新版をご利用ください。");
      return;
    }

    // 音声入力の準備
    const recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP'; // 日本語を聞き取る
    recognition.interimResults = false; // 確定した言葉だけを受け取る

    recognition.onstart = () => {
      setIsListening(true);
    };

    // 声を聞き取って文字になった時
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      // 今ある文章の後ろに、スペースを空けて付け足す
      setText(prev => prev ? `${prev} ${transcript}` : transcript);
    };

    recognition.onerror = (event: any) => {
      console.error("音声認識エラー:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    // 録音スタート！
    recognition.start();
    recognitionRef.current = recognition;
  };

  // ----------------------------------------
  // ドラッグ＆ドロップの処理
  // ----------------------------------------
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    // ドロップされたファイルの中から最初の画像を取り出す
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleImageSelection(file);
    }
  };

  // クリップマークが押されてファイルが選択された時
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      handleImageSelection(file);
    }
    // 続けて同じファイルを選べるようにリセット
    e.target.value = '';
  };

  // ファイルを読み込んでプレビューを表示する処理
  const handleImageSelection = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setSelectedImage({
        url: e.target?.result as string,
        file: file
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div 
      className={`${styles.inputContainer} ${isDragging ? styles.dragging : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 隠しファイル入力欄 */}
      <input 
        type="file" 
        accept="image/*" 
        style={{ display: 'none' }} 
        ref={fileInputRef}
        onChange={handleFileChange}
      />

      {/* クリップマーク（画像添付ボタン） */}
      <button 
        className={styles.attachBtn} 
        onClick={() => fileInputRef.current?.click()}
        title="画像を添付する"
        disabled={isSending}
      >
        📎
      </button>

      {/* 定型文ボタンとドロップダウン */}
      <div className={styles.snippetWrapper} ref={snippetMenuRef}>
        <button 
          className={styles.snippetBtn}
          onClick={() => setIsSnippetMenuOpen(!isSnippetMenuOpen)}
          title="定型文を選ぶ"
          disabled={isSending || snippets.length === 0}
        >
          ✨
        </button>
        
        {isSnippetMenuOpen && snippets.length > 0 && (
          <div className={styles.snippetMenu}>
            {snippets.map(snippet => (
              <div 
                key={snippet.id} 
                className={styles.snippetMenuItem}
                onClick={() => handleSelectSnippet(snippet.content)}
              >
                <span className={styles.snippetTitle}>{snippet.title}</span>
                <span className={styles.snippetContentPreview}>{snippet.content}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* マイク（音声入力）ボタン */}
      <button 
        className={`${styles.micBtn} ${isListening ? styles.listening : ''}`}
        onClick={toggleListening}
        title={isListening ? "音声入力を停止する" : "音声入力で文字を打つ"}
        disabled={isSending}
      >
        🎤
      </button>

      {/* 入力エリア全体を縦に並べる箱 */}
      <div className={styles.inputArea}>
        {/* 選んだ画像の小さなプレビュー */}
        {selectedImage && (
          <div className={styles.imagePreviewContainer}>
            <img src={selectedImage.url} alt="選択された画像" className={styles.imagePreview} />
            <button className={styles.removeImageBtn} onClick={() => setSelectedImage(null)}>✕</button>
          </div>
        )}

        <input
          ref={inputRef}
          type="text"
          className={styles.inputField}
          placeholder="AIにメッセージを送信する（「猫の絵を描いて」など）..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSending}
        />
      </div>

      <button 
        className={`${styles.sendBtn} ${isSending ? styles.sending : ''}`}
        onClick={handleSend}
        disabled={isSending || (!text.trim() && !selectedImage)}
      >
        {isSending ? '考え中...' : '送信 🚀'}
      </button>
    </div>
  );
}
