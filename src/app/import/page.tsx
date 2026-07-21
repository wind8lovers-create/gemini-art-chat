'use client';

import React, { useState, useEffect } from 'react';
import styles from './page.module.css';

type EmailData = {
  uid: string;
  subject: string;
  prompt: string;
  filename: string;
  mimeType: string;
  contentBase64: string;
  isImported: boolean;
};

export default function ImportPage() {
  const [emails, setEmails] = useState<EmailData[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [showImported, setShowImported] = useState(false);
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState<Set<string>>(new Set());
  useEffect(() => {
    fetchEmails();
  }, []);

  const fetchEmails = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/gmail/fetch`);
      if (!res.ok) {
        throw new Error('メールの取得に失敗しました。認証情報などを確認してください。');
      }
      const data = await res.json();
      setEmails(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async (uid: string) => {
    setPreviewLoading(prev => new Set(prev).add(uid));
    try {
      const res = await fetch('/api/gmail/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid })
      });
      if (!res.ok) throw new Error('プレビューの取得に失敗しました');
      const previewData = await res.json();
      
      setEmails(prev => prev.map(e => {
        if (e.uid === uid) {
          return {
            ...e,
            prompt: previewData.prompt,
            filename: previewData.filename,
            mimeType: previewData.mimeType,
            contentBase64: previewData.contentBase64,
          };
        }
        return e;
      }));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setPreviewLoading(prev => {
        const next = new Set(prev);
        next.delete(uid);
        return next;
      });
    }
  };

  const handleToggleSelect = (uid: string) => {
    const newSet = new Set(selectedUids);
    if (newSet.has(uid)) {
      newSet.delete(uid);
    } else {
      newSet.add(uid);
    }
    setSelectedUids(newSet);
  };

  const handleImport = async (targetEmails: EmailData[]) => {
    if (targetEmails.length === 0) return;
    setImporting(true);
    try {
      const res = await fetch('/api/gmail/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: targetEmails })
      });
      if (!res.ok) {
        throw new Error('取り込みに失敗しました。');
      }
      alert(`${targetEmails.length}件の取り込みが完了しました！`);
      // 再取得してリストを更新
      await fetchEmails();
      setSelectedUids(newSet => {
        const next = new Set(newSet);
        targetEmails.forEach(e => next.delete(e.uid));
        return next;
      });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setImporting(false);
    }
  };

  // プランA: 未取り込みをすべて取り込む
  const handleImportAllUnimported = () => {
    const targets = emails.filter(e => !e.isImported);
    handleImport(targets);
  };

  // プランB: 選択したものを取り込む
  const handleImportSelected = () => {
    const targets = emails.filter(e => selectedUids.has(e.uid));
    handleImport(targets);
  };

  // 取込済みのアイテムを未取込状態に戻し、チェックボックスを表示するための関数
  const handleRevealCheckbox = (uid: string) => {
    // 該当のメールの isImported を false に変更することで、他の未取込ファイルと同じようにチェックボックスが表示されるようになります
    setEmails(prev => prev.map(e => e.uid === uid ? { ...e, isImported: false } : e));
  };

  const displayedEmails = emails.filter(e => showImported ? true : !e.isImported);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <button 
            className={`${styles.btn} ${styles.btnSecondary}`} 
            onClick={() => window.location.href = '/'}
          >
            ← トップへ戻る
          </button>
          <h1 className={styles.title} style={{ margin: 0 }}>Gmail取込み</h1>

          <label className={styles.toggleLabel} style={{ marginLeft: 'auto' }}>
            <input 
              type="checkbox" 
              checked={showImported} 
              onChange={e => setShowImported(e.target.checked)} 
            />
            受信済み（取り込み済み）を表示する
          </label>
        </div>

        <div className={styles.controls} style={{ justifyContent: 'flex-start' }}>
          <button 
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={handleImportSelected}
            disabled={selectedUids.size === 0 || importing || loading}
          >
            選択したものを取込 ({selectedUids.size})
          </button>
          <button 
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={handleImportAllUnimported}
            disabled={emails.filter(e => !e.isImported).length === 0 || importing || loading}
          >
            未取込をすべて取込
          </button>
        </div>
      </header>

      {error && <div style={{color: '#ef4444', marginBottom: 20}}>{error}</div>}

      {loading ? (
        <div className={styles.loading}>メールを読み込んでいます...</div>
      ) : displayedEmails.length === 0 ? (
        <div className={styles.empty}>表示できるメールがありません。</div>
      ) : (
        <div className={styles.grid}>
          {displayedEmails.map(email => (
            <div key={email.uid} className={`${styles.card} ${email.isImported ? styles.cardImported : ''}`}>
              <div className={styles.cardHeader}>
                {/* 未取込の場合（あるいは取込済バッジをクリックして isImported が false になった場合）にチェックボックスを表示します */}
                {!email.isImported && (
                  <input 
                    type="checkbox" 
                    className={styles.checkbox}
                    checked={selectedUids.has(email.uid)}
                    onChange={() => handleToggleSelect(email.uid)}
                  />
                )}
                {/* 取込済の場合に表示されるバッジ。クリックすると isImported が false になり、チェックボックスが表示されます */}
                {email.isImported && (
                  <span 
                    className={styles.statusBadge}
                    style={{ cursor: 'pointer' }}
                    title="クリックして再度チェックボックスを表示する"
                    onClick={() => handleRevealCheckbox(email.uid)}
                  >
                    取込済
                  </span>
                )}
              </div>
              
              <div className={styles.mediaContainer}>
                {!email.contentBase64 ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', backgroundColor: 'rgba(0,0,0,0.2)' }}>
                    <button 
                      className={`${styles.btn} ${styles.btnSecondary}`}
                      onClick={() => handlePreview(email.uid)}
                      disabled={previewLoading.has(email.uid)}
                    >
                      {previewLoading.has(email.uid) ? '読み込み中...' : '▶ プレビューを読み込む'}
                    </button>
                  </div>
                ) : email.mimeType.startsWith('video/') ? (
                  <video 
                    className={styles.media} 
                    src={`data:${email.mimeType};base64,${email.contentBase64}`} 
                    controls 
                  />
                ) : (
                  <img 
                    className={styles.media} 
                    src={`data:${email.mimeType};base64,${email.contentBase64}`} 
                    alt={email.subject} 
                  />
                )}
              </div>
              
              <div className={styles.info}>
                <div className={styles.subject}>{email.subject}</div>
                <div className={styles.prompt}>{email.prompt}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
