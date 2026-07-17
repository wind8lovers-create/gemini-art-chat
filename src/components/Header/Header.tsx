import React, { useState } from 'react';
import Link from 'next/link';
import styles from './Header.module.css';
import SettingsModal from '@/components/SettingsModal/SettingsModal';
import GitModal from '@/components/GitModal/GitModal';

/**
 * 画面の一番上につく「ヘッダー」の部品です。
 * タイトルや、設定画面へのボタンなどを配置します。
 */
export default function Header({ onLogoClick }: { onLogoClick?: () => void }) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGitModalOpen, setIsGitModalOpen] = useState(false);

  return (
    <>
      {/* globals.cssで定義した glass-panel という魔法のクラスをつけて、すりガラス風にします */}
      <header className={`${styles.header} glass-panel`}>
        {/* 左側のロゴ部分 */}
        <div className={styles.logo}>
          <div 
            className={`${styles.icon} ${styles.hideOnMobile}`} 
            onClick={async (e) => {
              e.stopPropagation();
              try {
                const res = await fetch('/api/git/branch');
                const data = await res.json();
                if (data.branch) {
                  alert(`現在のGitブランチは「${data.branch}」です。`);
                } else {
                  alert(`ブランチの取得に失敗しました: ${data.error}`);
                }
              } catch (err) {
                alert('通信エラーが発生しました。');
              }
            }}
            title="現在のGitブランチを確認する"
            style={{ cursor: 'pointer' }}
          >
            🤖
          </div>
          <Link 
            href="/" 
            style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '12px' }}
            onClick={(e) => {
              if (onLogoClick) onLogoClick();
            }}
          >
            <h1>GeminiArtChat</h1>
          </Link>
        </div>
        
        {/* 右側のボタン部分（ナビゲーション） */}
        <nav className={styles.nav}>
          <Link href="/gallery" className="btn btn-secondary">
            <span className={styles.navIcon}>🖼️</span>
            <span className={styles.navText}>ギャラリー</span>
          </Link>
          <Link href="/uploads" className="btn btn-secondary">
            <span className={styles.navIcon}>📎</span>
            <span className={styles.navText}>アップ画像</span>
          </Link>
          <button className="btn btn-secondary" onClick={() => setIsSettingsOpen(true)}>
            <span className={styles.navIcon}>⚙️</span>
            <span className={styles.navText}>設定</span>
          </button>
          <button className="btn btn-secondary" onClick={() => setIsGitModalOpen(true)}>
            <span className={styles.navIcon}>📦</span>
            <span className={styles.navText}>Git</span>
          </button>
        </nav>
      </header>

      {/* 設定モーダル */}
      {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
      
      {/* Gitモーダル */}
      {isGitModalOpen && <GitModal onClose={() => setIsGitModalOpen(false)} />}
    </>
  );
}
