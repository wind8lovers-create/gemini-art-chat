import React, { useState } from 'react';
import Link from 'next/link';
import styles from './Header.module.css';
import SettingsModal from '@/components/SettingsModal/SettingsModal';
import GitModal from '@/components/GitModal/GitModal';

/**
 * 画面の一番上につく「ヘッダー」の部品です。
 * タイトルや、設定画面へのボタンなどを配置します。
 */
export default function Header() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGitModalOpen, setIsGitModalOpen] = useState(false);

  return (
    <>
      {/* globals.cssで定義した glass-panel という魔法のクラスをつけて、すりガラス風にします */}
      <header className={`${styles.header} glass-panel`}>
        {/* 左側のロゴ部分 */}
        <div className={styles.logo}>
          <Link href="/" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className={styles.icon}>🤖</span>
            <h1>GeminiArtChat</h1>
          </Link>
        </div>
        
        {/* 右側のボタン部分（ナビゲーション） */}
        <nav className={styles.nav}>
          <Link href="/gallery" className="btn btn-secondary">🖼️ ギャラリー</Link>
          <button className="btn btn-secondary" onClick={() => setIsSettingsOpen(true)}>⚙️ 設定</button>
          <button className="btn btn-secondary" onClick={() => setIsGitModalOpen(true)}>📦 Git</button>
        </nav>
      </header>

      {/* 設定モーダル */}
      {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
      
      {/* Gitモーダル */}
      {isGitModalOpen && <GitModal onClose={() => setIsGitModalOpen(false)} />}
    </>
  );
}
