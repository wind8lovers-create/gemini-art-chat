import React, { useEffect, useState } from 'react';
import styles from './LoadingOverlay.module.css';

interface LoadingOverlayProps {
  isVisible: boolean;
  videoUrl?: string; // 待機中動画のURL
}

export default function LoadingOverlay({ isVisible, videoUrl }: LoadingOverlayProps) {
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);

  useEffect(() => {
    let activeLock: WakeLockSentinel | null = null;

    const requestWakeLock = async () => {
      if ('wakeLock' in navigator) {
        try {
          activeLock = await navigator.wakeLock.request('screen');
          setWakeLock(activeLock);
          console.log('Wake Lock is active');
        } catch (err: any) {
          console.error(`Wake Lock error: ${err.name}, ${err.message}`);
        }
      }
    };

    const releaseWakeLock = async () => {
      if (activeLock) {
        await activeLock.release();
        setWakeLock(null);
        console.log('Wake Lock has been released');
      }
    };

    if (isVisible) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    return () => {
      releaseWakeLock();
    };
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.content}>
        {videoUrl ? (
          <video 
            src={videoUrl} 
            className={styles.loadingVideo} 
            autoPlay 
            loop 
            muted 
            playsInline
          />
        ) : (
          <div className={styles.spinner}></div>
        )}
        <p className={styles.text}>AIが一生懸命作業しています...<br/>（この画面は閉じないでください）</p>
      </div>
    </div>
  );
}
