'use client';
import React, { useState, useEffect } from 'react';
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
  const [visitors, setVisitors] = useState<string>('...');

  // 画面が表示された時にFirebaseから訪問者数を取得する
  useEffect(() => {
    const fetchVisitors = async () => {
      try {
        const res = await fetch('https://firestore.googleapis.com/v1/projects/feeling-gallery/databases/(default)/documents/stats/global');
        const data = await res.json();
        if (data && data.fields && data.fields.visitors) {
          setVisitors(data.fields.visitors.integerValue);
        } else {
          setVisitors('-');
        }
      } catch (err) {
        console.error('訪問者数の取得に失敗しました', err);
        setVisitors('-');
      }
    };
    fetchVisitors();
  }, []);

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
            <h1>Feeling Gallery</h1>
          </Link>
          
          {/* 【追加】訪問者カウンターの表示 */}
          <div style={{ marginLeft: '12px', fontSize: '0.9rem', color: '#a8b2d1', display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '4px 10px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' }} title="GitHub Pagesの総訪問者数">
            <span style={{ marginRight: '6px' }}>👀</span>
            <span style={{ fontWeight: 'bold' }}>{visitors}</span>
          </div>
        </div>
        
        {/* 右側のボタン部分（ナビゲーション） */}
        <nav className={styles.nav}>
          <Link href="/" className="btn btn-secondary">
            <span className={styles.navIcon}>🖼️</span>
            <span className={styles.navText}>ギャラリー</span>
          </Link>
          <Link href="/uploads" className="btn btn-secondary">
            <span className={styles.navIcon}>👑</span>
            <span className={styles.navText}>編集長室</span>
          </Link>
          <Link href="/preview" className="btn btn-secondary">
            <span className={styles.navIcon}>👀</span>
            <span className={styles.navText}>プレビュー</span>
          </Link>
          <Link href="/prompt-memo" className="btn btn-secondary">
            <span className={styles.navIcon}>📝</span>
            <span className={styles.navText}>メモ</span>
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
