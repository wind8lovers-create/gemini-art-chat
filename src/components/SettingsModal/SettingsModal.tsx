'use client';
import React, { useState, useEffect } from 'react';
import styles from './SettingsModal.module.css';
import { PromptSnippet } from '@/types';

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const [snippets, setSnippets] = useState<PromptSnippet[]>([]);
  const [theme, setTheme] = useState<'dark' | 'purple'>('dark');
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // テーマをローカルストレージから読み込む
    const savedTheme = localStorage.getItem('app-theme');
    if (savedTheme === 'purple') {
      setTheme('purple');
    }
    const savedVideo = localStorage.getItem('isVideoEnabled');
    if (savedVideo === 'false') {
      setIsVideoEnabled(false);
    }

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
      // 1. 定型文の保存
      await fetch('/api/snippets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snippets)
      });
      window.dispatchEvent(new Event('snippetsUpdated'));

      // 2. テーマとその他の保存と適用
      localStorage.setItem('app-theme', theme);
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('isVideoEnabled', isVideoEnabled ? 'true' : 'false');

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
          {/* テーマ設定セクション */}
          <div className={styles.section}>
            <h3>🎨 テーマ（背景色）設定</h3>
            <p className={styles.description}>
              アプリ全体の背景色を変更できます。
            </p>
            <div className={styles.themeSelector}>
              <label className={`${styles.themeOption} ${theme === 'dark' ? styles.activeTheme : ''}`}>
                <input 
                  type="radio" 
                  name="theme" 
                  value="dark" 
                  checked={theme === 'dark'}
                  onChange={() => setTheme('dark')}
                  className={styles.hiddenRadio}
                />
                <span className={styles.themePreview} style={{ background: '#121212' }}></span>
                ダーク（黒基調）
              </label>
              <label className={`${styles.themeOption} ${theme === 'purple' ? styles.activeTheme : ''}`}>
                <input 
                  type="radio" 
                  name="theme" 
                  value="purple" 
                  checked={theme === 'purple'}
                  onChange={() => setTheme('purple')}
                  className={styles.hiddenRadio}
                />
                <span className={styles.themePreview} style={{ background: 'linear-gradient(135deg, #180D35 0%, #40237C 100%)' }}></span>
                パープル（紫基調）
              </label>
            </div>
          </div>

          <hr className={styles.divider} />

          {/* 動画生成設定セクション */}
          <div className={styles.section}>
            <h3>🎥 動画生成（Veo 3.1）設定</h3>
            <p className={styles.description}>
              プロンプトに「動画」というキーワードが含まれる場合、動画生成モデルを使用するかどうかを設定します。
            </p>
            <div className={styles.themeSelector}>
              <label className={`${styles.themeOption} ${isVideoEnabled ? styles.activeTheme : ''}`}>
                <input 
                  type="radio" 
                  name="videoEnabled" 
                  value="on" 
                  checked={isVideoEnabled}
                  onChange={() => setIsVideoEnabled(true)}
                  className={styles.hiddenRadio}
                />
                オン（有効）
              </label>
              <label className={`${styles.themeOption} ${!isVideoEnabled ? styles.activeTheme : ''}`}>
                <input 
                  type="radio" 
                  name="videoEnabled" 
                  value="off" 
                  checked={!isVideoEnabled}
                  onChange={() => setIsVideoEnabled(false)}
                  className={styles.hiddenRadio}
                />
                オフ（画像のみ）
              </label>
            </div>
          </div>

          <hr className={styles.divider} />

          {/* 定型文設定セクション */}
          <div className={styles.section}>
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
