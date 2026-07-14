'use client';
import React, { useState, useEffect } from 'react';
import styles from './GitModal.module.css';

export default function GitModal({ onClose }: { onClose: () => void }) {
  const [files, setFiles] = useState<{status: string, path: string}[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPushing, setIsPushing] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [resultMessage, setResultMessage] = useState<{text: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    fetch('/api/git/status')
      .then(res => res.json())
      .then(data => {
        if (data.files) {
          setFiles(data.files);
        } else {
          setResultMessage({ text: data.error || 'ステータスの取得に失敗しました', type: 'error' });
        }
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Git status error:', err);
        setResultMessage({ text: '通信エラーが発生しました', type: 'error' });
        setIsLoading(false);
      });
  }, []);

  const handlePush = async () => {
    setIsPushing(true);
    setResultMessage(null);
    try {
      const res = await fetch('/api/git/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: commitMessage })
      });
      const data = await res.json();
      
      if (data.success) {
        setResultMessage({ text: 'GitHubへのプッシュが成功しました！🚀', type: 'success' });
        setFiles([]); // 成功したら変更一覧を空にする
        setCommitMessage('');
      } else {
        setResultMessage({ text: 'プッシュに失敗しました: ' + data.error, type: 'error' });
      }
    } catch (err) {
      console.error('Push error:', err);
      setResultMessage({ text: '通信エラーが発生しました', type: 'error' });
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>📦 GitHub連携 (バックアップ)</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>
          <p className={styles.description}>
            現在のアプリの状態や保存された画像を、GitHubへ自動でアップロードします。<br/>
            これにより、スマホのCodespaces等からでも最新の状態でアプリを開けるようになります。
          </p>

          {resultMessage && (
            <div className={`${styles.alert} ${styles[resultMessage.type]}`}>
              {resultMessage.text}
            </div>
          )}

          <div className={styles.statusSection}>
            <h3>📝 変更されたファイル</h3>
            {isLoading ? (
              <p>変更を確認中...</p>
            ) : files.length > 0 ? (
              <ul className={styles.fileList}>
                {files.map((f, i) => (
                  <li key={i}>
                    <span className={styles.fileStatus}>{f.status}</span>
                    <span className={styles.filePath}>{f.path}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.noChanges}>変更されたファイルはありません（全て最新です）。<br/>それでもプッシュを強制実行することは可能です。</p>
            )}
          </div>

          <div className={styles.commitSection}>
            <h3>💬 変更内容のメモ（コミットメッセージ）</h3>
            <input
              type="text"
              className={styles.commitInput}
              placeholder="例：新しい猫の画像を生成した"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              disabled={isPushing}
            />
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose} disabled={isPushing}>閉じる</button>
          <button className={styles.pushBtn} onClick={handlePush} disabled={isPushing}>
            {isPushing ? 'プッシュ中... ⏳' : '🚀 GitHubへプッシュする'}
          </button>
        </div>
      </div>
    </div>
  );
}
