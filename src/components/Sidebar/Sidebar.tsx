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
  const [draggedFolderId, setDraggedFolderId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [dragOverSessionId, setDragOverSessionId] = useState<string | null>(null);
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const loadData = async () => {
    try {
      const [sessionsRes, foldersRes] = await Promise.all([
        fetch('/api/sessions'),
        fetch('/api/folders')
      ]);
      const sessionsData = await sessionsRes.json();
      const foldersData = await foldersRes.json();
      
      const sortedSessions = sessionsData.sort((a: Session, b: Session) => {
        const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
        const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
        return orderA - orderB;
      });
      const sortedFolders = foldersData.sort((a: SessionFolder, b: SessionFolder) => {
        const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
        const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
        return orderA - orderB;
      });

      setSessions(sortedSessions);
      setFolders(sortedFolders);
      
      // 初期状態では全てのフォルダを閉じておく
      setOpenFolders(new Set());
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

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('このチャット履歴を完全に削除しますか？\n（関連する画像も削除されます）')) {
      try {
        const res = await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
        if (res.ok) {
          setSessions(prev => prev.filter(s => s.id !== sessionId));
          if (currentSessionId === sessionId) {
            onSelectSession(''); // 選択状態を解除
          }
        }
      } catch (err) {
        console.error('削除エラー:', err);
      }
    }
  };

  const handleDeleteFolder = async (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('このフォルダを削除しますか？\n（中のチャット履歴は外に出るだけで削除されません）')) {
      try {
        const res = await fetch(`/api/folders/${folderId}`, { method: 'DELETE' });
        if (res.ok) {
          setFolders(prev => prev.filter(f => f.id !== folderId));
          loadData(); // 中身が外に出るので再読み込み
        }
      } catch (err) {
        console.error('フォルダ削除エラー:', err);
      }
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

  const toggleFolderPublish = async (folderId: string, currentStatus: boolean) => {
    try {
      const newStatus = !currentStatus;
      const res = await fetch(`/api/folders/${folderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: newStatus })
      });
      if (res.ok) {
        setFolders(prev => prev.map(f => 
          f.id === folderId ? { ...f, isPublished: newStatus } : f
        ));
      }
    } catch (error) {
      console.error("公開ステータス更新エラー:", error);
    }
  };

  const handleDragStart = (e: React.DragEvent, sessionId: string) => {
    e.stopPropagation();
    e.dataTransfer.setData('sessionId', sessionId);
    setDraggedSessionId(sessionId);
  };

  const handleFolderDragStart = (e: React.DragEvent, folderId: string) => {
    e.stopPropagation();
    e.dataTransfer.setData('folderId', folderId);
    setDraggedFolderId(folderId);
  };

  const handleDragEnd = () => {
    setDraggedSessionId(null);
    setDraggedFolderId(null);
    setDragOverFolderId(null);
    setDragOverSessionId(null);
  };

  const handleDragOver = (e: React.DragEvent, folderId: string | null, sessionId: string | null = null) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(folderId);
    setDragOverSessionId(sessionId);
  };

  const handleDrop = async (e: React.DragEvent, targetFolderId: string | null, targetSessionId: string | null = null) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);
    setDragOverSessionId(null);

    const sessionId = e.dataTransfer.getData('sessionId') || draggedSessionId;
    const folderId = e.dataTransfer.getData('folderId') || draggedFolderId;

    if (folderId && targetFolderId && folderId !== targetFolderId && !targetSessionId) {
      // フォルダの並び替え
      const draggedIndex = folders.findIndex(f => f.id === folderId);
      const targetIndex = folders.findIndex(f => f.id === targetFolderId);
      if (draggedIndex > -1 && targetIndex > -1) {
        const newFolders = [...folders];
        const [draggedItem] = newFolders.splice(draggedIndex, 1);
        newFolders.splice(targetIndex, 0, draggedItem);
        // orderを更新
        const updatedItems = newFolders.map((f, index) => ({ id: f.id, order: index }));
        setFolders(newFolders.map((f, i) => ({ ...f, order: i })));
        
        await fetch('/api/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'folder', items: updatedItems })
        });
      }
    } else if (sessionId) {
      if (targetSessionId && sessionId !== targetSessionId) {
        // セッションの並び替え
        const sFolderId = targetFolderId || null;
        let folderSessions = sessions.filter(s => (s.folderId || null) === sFolderId);
        
        // 移動元と移動先のインデックスを見つける
        const draggedSession = sessions.find(s => s.id === sessionId);
        if (!draggedSession) return;
        
        // 別のフォルダからの移動も考慮して、まずは移動先フォルダに追加する形をとる
        if (draggedSession.folderId !== sFolderId) {
          draggedSession.folderId = sFolderId;
          folderSessions.push(draggedSession);
          // APIでフォルダ移動を反映
          await fetch(`/api/sessions/${sessionId}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderId: sFolderId })
          });
        }

        const draggedIndex = folderSessions.findIndex(s => s.id === sessionId);
        const targetIndex = folderSessions.findIndex(s => s.id === targetSessionId);
        
        if (draggedIndex > -1 && targetIndex > -1) {
          folderSessions.splice(draggedIndex, 1);
          folderSessions.splice(targetIndex, 0, draggedSession);
          
          // orderを更新
          const updatedItems = folderSessions.map((s, index) => ({ id: s.id, order: index }));
          setSessions(prev => {
            const newSessions = prev.map(s => {
              const updated = updatedItems.find(u => u.id === s.id);
              return updated ? { ...s, order: updated.order, folderId: s.folderId } : s;
            });
            return newSessions.sort((a, b) => {
              const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
              const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
              return orderA - orderB;
            });
          });

          await fetch('/api/reorder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'session', items: updatedItems })
          });
        }
      } else if (targetFolderId !== undefined && !targetSessionId) {
        // セッションをフォルダに入れる
        const currentSession = sessions.find(s => s.id === sessionId);
        if (currentSession && currentSession.folderId !== targetFolderId) {
          setSessions(prev => {
            const newSessions = prev.map(s => s.id === sessionId ? { ...s, folderId: targetFolderId, order: sessions.length } : s);
            return newSessions.sort((a, b) => {
              const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
              const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
              return orderA - orderB;
            });
          });
          await fetch(`/api/sessions/${sessionId}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderId: targetFolderId })
          });
        }
      }
    }
    setDraggedSessionId(null);
    setDraggedFolderId(null);
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
      className={`${styles.sessionItem} ${currentSessionId === session.id ? styles.active : ''} ${draggedSessionId === session.id ? styles.dragging : ''} ${dragOverSessionId === session.id ? styles.dragOverSession : ''}`}
      onClick={() => {
        if (editingSessionId !== session.id) onSelectSession(session.id);
      }}
      draggable // ドラッグ可能にする
      onDragStart={(e) => handleDragStart(e, session.id)}
      onDragEnd={handleDragEnd}
      onDragOver={(e) => handleDragOver(e, session.folderId || null, session.id)}
      onDrop={(e) => handleDrop(e, session.folderId || null, session.id)}
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
          <div style={{ display: 'flex', gap: '4px' }}>
            <button 
              className={styles.editBtn}
              onClick={(e) => {
                e.stopPropagation();
                setEditingSessionId(session.id);
                setEditingSessionTitle(session.title);
              }}
              title="名前の変更"
            >✎</button>
            <button 
              className={styles.editBtn}
              onClick={(e) => handleDeleteSession(session.id, e)}
              title="削除"
            >🗑️</button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <aside className={`${styles.sidebar} ${!isVisible ? styles.hidden : ''} glass-panel`}>
      <div className={styles.header}>
        <div style={{ position: 'relative' }}>
          <h2 
            onClick={() => setIsMenuOpen(!isMenuOpen)} 
            style={{ cursor: 'pointer', margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}
            title="メニューを開く"
          >
            🖼️ アルバム <span style={{ fontSize: '12px', opacity: 0.7 }}>▼</span>
          </h2>
          {isMenuOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setIsMenuOpen(false)}></div>
              <div style={{ position: 'absolute', top: '100%', left: 0, backgroundColor: 'rgba(100, 50, 180, 0.95)', backdropFilter: 'blur(8px)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px', zIndex: 100, width: 'max-content', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                <button className="btn btn-secondary" onClick={() => { setIsMenuOpen(false); createNewFolder(); }} style={{ width: '100%', textAlign: 'left', padding: '8px', fontSize: '14px', color: 'pink' }}>
                  📁 新規フォルダ作成
                </button>
                <button className="btn btn-secondary" onClick={() => { setIsMenuOpen(false); createNewSession(); }} style={{ width: '100%', textAlign: 'left', padding: '8px', fontSize: '14px', color: 'pink' }}>
                  💬 新しいチャット
                </button>
                <hr style={{ borderTop: '1px solid var(--border-color)', margin: '4px 0' }} />
                <button className={styles.btnSecondary} onClick={() => { setIsMenuOpen(false); window.location.href = '/import'; }} style={{ width: '100%', textAlign: 'left', border: 'none', background: 'transparent', color: 'var(--text-color)', cursor: 'pointer', padding: '4px' }}>
                  📧 Gmail取込み
                </button>
                <button className="btn btn-secondary" onClick={() => { setIsMenuOpen(false); fetch('/api/explorer'); }} style={{ width: '100%', textAlign: 'left', padding: '8px', fontSize: '14px', color: 'pink' }}>
                  📁 エクスプローラ表示
                </button>
                <button className="btn btn-secondary" onClick={() => { setIsMenuOpen(false); window.location.href = '/api/download-all'; }} style={{ width: '100%', textAlign: 'left', padding: '8px', fontSize: '14px', color: 'pink' }}>
                  📦 全アルバムbackup & DL
                </button>
              </div>
            </>
          )}
        </div>
        <div className={styles.headerButtons}>
          <button className={styles.iconBtn} onClick={onClose} title="スマホ画面にする（サイドバーを隠す）">📱</button>
        </div>
      </div>
      
      <div 
        className={styles.list}
        onDragOver={(e) => handleDragOver(e, null)}
        onDrop={(e) => handleDrop(e, null)} // ルートへのドロップ
      >
        {/* フォルダ一覧の表示 */}
        {folders.map(folder => (
          <div 
            key={folder.id} 
            className={`${styles.folderContainer} ${draggedFolderId === folder.id ? styles.dragging : ''}`}
            draggable
            onDragStart={(e) => handleFolderDragStart(e, folder.id)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, folder.id)}
            onDrop={(e) => handleDrop(e, folder.id)}
          >
            <div 
              className={`${styles.folderHeader} ${dragOverFolderId === folder.id ? styles.dragOver : ''}`}
              onClick={() => toggleFolder(folder.id)}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  className={`${styles.iconBtn} ${folder.isPublished ? styles.published : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFolderPublish(folder.id, folder.isPublished || false);
                  }}
                  title={folder.isPublished ? "編集長室から外す（非公開）" : "フォルダごと編集長室へ（公開）"}
                  style={{ color: folder.isPublished ? '#e91e63' : 'inherit', fontSize: '1.2rem', padding: '0 4px' }}
                >
                  ↑
                </button>
                {!editingFolderId && (
                  <>
                    <button 
                      className={styles.editBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingFolderId(folder.id);
                        setEditingFolderName(folder.name);
                      }}
                      title="名前の変更"
                    >✎</button>
                    <button 
                      className={styles.editBtn}
                      onClick={(e) => handleDeleteFolder(folder.id, e)}
                      title="フォルダを削除"
                    >🗑️</button>
                  </>
                )}
              </div>
            </div>
            
            {/* フォルダの中身（展開時のみ表示） */}
            {openFolders.has(folder.id) && (
              <div className={styles.folderContent}>
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
        <div className={styles.rootSessions}>
          {sessionsByFolder['root'].map(renderSession)}
        </div>

        {sessions.length === 0 && folders.length === 0 && (
          <div className={styles.empty}>チャット履歴がありません</div>
        )}
      </div>
    </aside>
  );
}
