'use client';
import React, { useState, useEffect } from 'react';
import styles from './page.module.css';
import Header from '@/components/Header/Header';

interface Memo {
  id: string;
  title: string;
  content: string;
  tags: string[];
  updatedAt: string;
}

export default function PromptMemoPage() {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // モーダル用state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editTags, setEditTags] = useState('');

  // 初回読み込み
  useEffect(() => {
    fetchMemos();
  }, []);

  const fetchMemos = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/memos');
      const data = await res.json();
      setMemos(data);
    } catch (err) {
      console.error("メモの取得に失敗しました", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveMemo = async () => {
    if (!editTitle.trim() && !editContent.trim()) return;
    
    // タグをカンマ区切りで配列に
    const tagsArray = editTags.split(',').map(t => t.trim()).filter(t => t);

    try {
      const res = await fetch('/api/memos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          content: editContent,
          tags: tagsArray
        })
      });
      
      if (res.ok) {
        // 保存成功したらリロード
        fetchMemos();
        setIsModalOpen(false);
        setEditTitle('');
        setEditContent('');
        setEditTags('');
      }
    } catch (err) {
      alert("保存に失敗しました");
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('本当にこのメモを削除しますか？')) return;
    
    try {
      const res = await fetch(`/api/memos?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchMemos();
      }
    } catch (err) {
      alert("削除に失敗しました");
    }
  };

  return (
    <>
      <Header />
      <main className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>
            <span className="material-symbols-outlined text-primary">notes</span>
            プロンプトメモ (Lumina Notes)
          </h1>
          <div className={styles.actions}>
            <button className="btn" onClick={async () => {
              if (confirm('現在のメモや画像をすべてPages用に書き出しますか？')) {
                const res = await fetch('/api/export', { method: 'POST' });
                if (res.ok) alert('書き出しが完了しました！');
              }
            }}>
              🚀 Pages用に書き出す
            </button>
            <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
              ＋ 新しいメモ
            </button>
          </div>
        </div>

        {isLoading ? (
          <p>読み込み中...</p>
        ) : memos.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>メモがありません。「新しいメモ」から追加してください。<br/>（将来はGmailからも自動でここに追加されます）</p>
        ) : (
          <div className={styles.masonryGrid}>
            {memos.map(memo => (
              <article key={memo.id} className={`glass-panel ${styles.memoCard}`}>
                <div className={styles.memoHeader}>
                  <h3 className={styles.memoTitle}>{memo.title}</h3>
                </div>
                <div className={styles.memoContent}>
                  {memo.content}
                </div>
                {memo.tags.length > 0 && (
                  <div className={styles.memoTags}>
                    {memo.tags.map(tag => (
                      <span key={tag} className={styles.tag}>#{tag}</span>
                    ))}
                  </div>
                )}
                <div className={styles.memoFooter}>
                  <span className={styles.date}>
                    {new Date(memo.updatedAt).toLocaleDateString()}
                  </span>
                  <button className={styles.deleteBtn} onClick={(e) => handleDelete(memo.id, e)}>
                    削除
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* 新規追加モーダル */}
        {isModalOpen && (
          <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
            <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>新しいメモを作成</h2>
              
              <input 
                className={styles.inputField}
                placeholder="タイトル" 
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
              />
              <textarea 
                className={`${styles.inputField} ${styles.textareaField}`}
                placeholder="プロンプトやメモを入力..."
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
              />
              <input 
                className={styles.inputField}
                placeholder="タグ（カンマ区切り。例: PromptEng, Data）" 
                value={editTags}
                onChange={e => setEditTags(e.target.value)}
              />
              
              <div className={styles.modalActions}>
                <button className="btn" onClick={() => setIsModalOpen(false)}>キャンセル</button>
                <button className="btn btn-primary" onClick={handleSaveMemo}>保存する</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
