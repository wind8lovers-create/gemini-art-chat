"use client";

import React, { useState, useEffect } from 'react';
import styles from './PasswordProtect.module.css';

export default function PasswordProtect({ children }: { children: React.ReactNode }) {
  // 認証が通っているかどうかの状態
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // 入力されたパスワードを保存する状態
  const [password, setPassword] = useState('');
  // エラーメッセージを表示するための状態
  const [error, setError] = useState('');
  // 画面がブラウザに表示されたか（マウントされたか）を判定する状態
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // コンポーネントが読み込まれたら true にする（サーバーとクライアントの表示ズレを防ぐため）
    setIsMounted(true);
    
    // ブラウザのセッションストレージ（一時的な記憶領域）から認証済みか確認します
    // ※ブラウザを閉じるとリセットされます
    const auth = sessionStorage.getItem('site_auth');
    if (auth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault(); // フォーム送信時のページリロードを防ぐ
    
    // ==========================================
    // ここでパスワードを設定します！
    // 好きな文字列に変更してください。
    // ==========================================
    const CORRECT_PASSWORD = 'gemini'; 

    if (password === CORRECT_PASSWORD) {
      // パスワードが合っていたら、セッションストレージに「認証済み」として保存
      sessionStorage.setItem('site_auth', 'true');
      setIsAuthenticated(true);
      setError('');
    } else {
      // パスワードが間違っている場合
      setError('パスワードが間違っています。');
    }
  };

  // SSR（サーバー側での処理中）は何も表示しないことで、画面のチラつきを防ぎます
  if (!isMounted) return null;

  // 認証済みなら、本来のページ（children）を表示します
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // 認証されていない場合は、パスワード入力画面を表示します
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h2 className={styles.title}>アクセス制限</h2>
        <p className={styles.description}>このページを見るにはパスワードが必要です。</p>
        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="パスワードを入力"
            className={styles.input}
          />
          {error && <p className={styles.error}>{error}</p>}
          <button type="submit" className={styles.button}>送信</button>
        </form>
      </div>
    </div>
  );
}
