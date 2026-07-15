'use client';
import React, { useEffect, useState } from 'react';
import styles from './Sidebar.module.css';
import { Session, SessionFolder } from '@/types';

export default function Sidebar({ 
  currentSessionId, 
  onSelectSession,
  isVisible = true,
  onClose
}: { 
  currentSessionId: string | null, 
  onSelectSession: (id: string) => void,
  isVisible?: boolean,
  onClose?: () => void
}) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [folders, setFolders] = useState<SessionFolder[]>([]);
  
  // タイトル編集用の状態
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingSessionTitle, setEditingSessionTitle] = useState('');
  
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');

  // 展開されているフォルダのIDリスト（簡易的にIDの配列で管理）
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());

  // ドラッグ中かどうかを判定するための状態
  const [draggedSessionId, setDraggedSessionId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [sessionsRes, foldersRes] = await Promise.all([
        fetch('/api/sessions'),
        fetch('/api/folders')
      ]);
      const sessionsData = await sessionsRes.json();
      const foldersData = await foldersRes.json();
      
      setSessions(sessionsData);
      setFolders(foldersData);
      
      // 初期状態では全てのフォルダを開いておく
      setOpenFolders(new Set(foldersData.map((f: SessionFolder) => f.id)));
    } catch (err) {
      console.error("データ取得エラー:", err);
    }
  };

  useEffect(() => {
    loadData();
    
    // イベントリスナーで外部からの更新を検知
    const handleStorageChange = () => {
        loadData();
    };
    window.addEventListener('sessionsUpdated', handleStorageChange);
    return () => window.removeEventListener('sessionsUpdated', handleStorageChange);
  }, []);

  const createNewSession = async () => {
    try {
      const res = await fetch('/api/sessions', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '新しいチャット' }),
      });
      const newSession = await res.json();
      setSessions(prev => [newSession, ...prev]);
      onSelectSession(newSession.id);
    } catch (error) {
      console.error("セッション作成エラー:", error);
    }
  };

  const createNewFolder = async () => {
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '新しいフォルダ' }),
      });
      const newFolder = await res.json();
      setFolders(prev => [...prev, newFolder]);
      setOpenFolders(prev => new Set(prev).add(newFolder.id));
      setEditingFolderId(newFolder.id);
      setEditingFolderName(newFolder.name);
    } catch (error) {
      console.error("フォルダ作成エラー:", error);
    }
  };

  const handleSaveSessionTitle = async (sessionId: string) => {
    if (!editingSessionTitle.trim()) {
      setEditingSessionId(null);
      return;
    }
    try {
      const res = await fetch('/api/sessions/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, newTitle: editingSessionTitle.trim() })
      });
      if (res.ok) {
        setSessions(prev => prev.map(s => 
          s.id === sessionId ? { ...s, title: editingSessionTitle.trim() } : s
        ));
      }
    } catch (error) {} finally {
      setEditingSessionId(null);
    }
  };

  const handleSaveFolderName = async (folderId: string) => {
    if (!editingFolderName.trim()) {
      setEditingFolderId(null);
      return;
    }
    try {
      const res = await fetch(`/api/folders/${folderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingFolderName.trim() })
      });
      if (res.ok) {
        setFolders(prev => prev.map(f => 
          f.id === folderId ? { ...f, name: editingFolderName.trim() } : f
        ));
      }
    } catch (error) {} finally {
      setEditingFolderId(null);
    }
  };

  const toggleFolder = (folderId: string) => {
    setOpenFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) newSet.delete(folderId);
      else newSet.add(folderId);
      return newSet;
    });
  };

  const handleDragStart = (e: React.DragEvent, sessionId: string) => {
    e.dataTransfer.setData('sessionId', sessionId);
    setDraggedSessionId(sessionId);
  };

  const handleDragEnd = () => {
    setDraggedSessionId(null);
    setDragOverFolderId(null);
  };

  const handleDragOver = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault(); // ドロップを許可する
    e.stopPropagation(); // 親要素へのイベント伝播を防ぐ
    setDragOverFolderId(folderId);
  };

  const handleDrop = async (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    e.stopPropagation(); // 親要素のonDropが発火するのを防ぐ
    setDragOverFolderId(null);
    const sessionId = e.dataTransfer.getData('sessionId');
    
    if (sessionId) {
      // 画面上ですぐに反映させる
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, folderId } : s));
      
      // 裏側でAPIを叩く
      await fetch(`/api/sessions/${sessionId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId })
      });
    }
  };

  // セッションをフォルダごとに分ける
  const sessionsByFolder: Record<string, Session[]> = { 'root': [] };
  folders.forEach(f => sessionsByFolder[f.id] = []);
  
  sessions.forEach(s => {
    if (s.folderId && sessionsByFolder[s.folderId]) {
      sessionsByFolder[s.folderId].push(s);
    } else {
      sessionsByFolder['root'].push(s);
    }
  });

  const renderSession = (session: Session) => (
    <div 
      key={session.id} 
      className={`${styles.sessionItem} ${currentSessionId === session.id ? styles.active : ''} ${draggedSessionId === session.id ? styles.dragging : ''}`}
      onClick={() => {
        if (editingSessionId !== session.id) onSelectSession(session.id);
      }}
      draggable // ドラッグ可能にする
      onDragStart={(e) => handleDragStart(e, session.id)}
      onDragEnd={handleDragEnd}
    >
      {editingSessionId === session.id ? (
        <input 
          type="text" 
          value={editingSessionTitle}
          onChange={(e) => setEditingSessionTitle(e.target.value)}
          onBlur={() => handleSaveSessionTitle(session.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSaveSessionTitle(session.id);
            if (e.key === 'Escape') setEditingSessionId(null);
          }}
          className={styles.titleInput}
          autoFocus
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <div className={styles.titleRow}>
          <h3 className={styles.sessionTitle}>💬 {session.title}</h3>
          <button 
            className={styles.editBtn}
            onClick={(e) => {
              e.stopPropagation();
              setEditingSessionId(session.id);
              setEditingSessionTitle(session.title);
            }}
          >✎</button>
        </div>
      )}
    </div>
  );

  return (
    <aside className={`${styles.sidebar} ${!isVisible ? styles.hidden : ''} glass-panel`}>
      <div className={styles.header}>
        <h2>📁 履歴</h2>
        <div className={styles.headerButtons}>
          <button className={styles.iconBtn} onClick={onClose} title="スマホ画面にする（サイドバーを隠す）">📱</button>
          <button className={styles.iconBtn} onClick={createNewFolder} title="新しいフォルダ">📁+</button>
          <button className={styles.iconBtn} onClick={createNewSession} title="新しいチャット">💬+</button>
        </div>
      </div>
      
      <div 
        className={styles.list}
        onDragOver={(e) => handleDragOver(e, null)}
        onDrop={(e) => handleDrop(e, null)} // ルートへのドロップ
      >
        {/* フォルダ一覧の表示 */}
        {folders.map(folder => (
          <div key={folder.id} className={styles.folderContainer}>
            <div 
              className={`${styles.folderHeader} ${dragOverFolderId === folder.id ? styles.dragOver : ''}`}
              onClick={() => toggleFolder(folder.id)}
              onDragOver={(e) => handleDragOver(e, folder.id)}
              onDrop={(e) => handleDrop(e, folder.id)}
            >
              <div className={styles.folderTitleWrapper}>
                <span className={styles.folderIcon}>{openFolders.has(folder.id) ? '📂' : '📁'}</span>
                {editingFolderId === folder.id ? (
                  <input
                    type="text"
                    value={editingFolderName}
                    onChange={(e) => setEditingFolderName(e.target.value)}
                    onBlur={() => handleSaveFolderName(folder.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveFolderName(folder.id);
                      if (e.key === 'Escape') setEditingFolderId(null);
                    }}
                    className={styles.titleInput}
                    autoFocus
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span className={styles.folderTitle}>{folder.name}</span>
                )}
              </div>
              {!editingFolderId && (
                <button 
                  className={styles.editBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingFolderId(folder.id);
                    setEditingFolderName(folder.name);
                  }}
                >✎</button>
              )}
            </div>
            
            {/* フォルダの中身（展開時のみ表示） */}
            {openFolders.has(folder.id) && (
              <div 
                className={styles.folderContent}
                onDragOver={(e) => handleDragOver(e, folder.id)}
                onDrop={(e) => handleDrop(e, folder.id)}
              >
                {sessionsByFolder[folder.id].length > 0 ? (
                  sessionsByFolder[folder.id].map(renderSession)
                ) : (
                  <div className={styles.emptyFolder}>空のフォルダ</div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* フォルダに入っていないセッション（ルート） */}
        <div 
          className={styles.rootSessions}
          onDragOver={(e) => handleDragOver(e, null)}
          onDrop={(e) => handleDrop(e, null)}
        >
          {sessionsByFolder['root'].map(renderSession)}
        </div>

        {sessions.length === 0 && folders.length === 0 && (
          <div className={styles.empty}>チャット履歴がありません</div>
        )}
      </div>
    </aside>
  );
}
