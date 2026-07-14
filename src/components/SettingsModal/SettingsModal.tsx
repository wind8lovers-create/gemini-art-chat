'use client';
import React, { useState, useEffect } from 'react';
import styles from './SettingsModal.module.css';
import { PromptSnippet } from '@/types';

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const [snippets, setSnippets] = useState<PromptSnippet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetch('/api/snippets')
      .then(res => res.json())
      .then(data => {
        setSnippets(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('定型文の取得エラー:', err);
        setIsLoading(false);
      });
  }, []);

  const handleAddSnippet = () => {
    const newSnippet: PromptSnippet = {
      id: crypto.randomUUID(),
      title: '新しい定型文',
      content: ''
    };
    setSnippets([...snippets, newSnippet]);
  };

  const handleRemoveSnippet = (id: string) => {
    setSnippets(snippets.filter(s => s.id !== id));
  };

  const handleChange = (id: string, field: 'title' | 'content', value: string) => {
    setSnippets(snippets.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await fetch('/api/snippets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snippets)
      });
      // 保存完了時にイベントを発火して、チャット入力欄などがリロードできるようにする
      window.dispatchEvent(new Event('snippetsUpdated'));
      onClose();
    } catch (error) {
      console.error('保存エラー:', error);
      alert('保存に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>⚙️ 設定</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>
          <h3>✨ 定型文（プロンプト・スニペット）</h3>
          <p className={styles.description}>
            チャット入力欄で素早く呼び出せる「よく使う指示（呪文）」を登録できます。
          </p>

          {isLoading ? (
            <p>読み込み中...</p>
          ) : (
            <div className={styles.snippetList}>
              {snippets.map((snippet, index) => (
                <div key={snippet.id} className={styles.snippetItem}>
                  <div className={styles.snippetHeader}>
                    <span className={styles.snippetNumber}>#{index + 1}</span>
                    <button 
                      className={styles.deleteBtn} 
                      onClick={() => handleRemoveSnippet(snippet.id)}
                      title="削除"
                    >🗑️</button>
                  </div>
                  <input
                    className={styles.inputTitle}
                    type="text"
                    placeholder="タイトル（例：高画質化）"
                    value={snippet.title}
                    onChange={(e) => handleChange(snippet.id, 'title', e.target.value)}
                  />
                  <textarea
                    className={styles.textareaContent}
                    placeholder="プロンプト内容（例：細かいジャギを補正して...）"
                    value={snippet.content}
                    onChange={(e) => handleChange(snippet.id, 'content', e.target.value)}
                    rows={3}
                  />
                </div>
              ))}
              <button className={styles.addBtn} onClick={handleAddSnippet}>
                ＋ 定型文を追加
              </button>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>キャンセル</button>
          <button className={styles.saveBtn} onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving ? '保存中...' : '保存する'}
          </button>
        </div>
      </div>
    </div>
  );
}
