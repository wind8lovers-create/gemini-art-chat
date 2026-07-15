import React, { useRef, useState } from 'react';
import styles from './VideoPlayer.module.css';

interface VideoPlayerProps {
  src: string;
  className?: string;
}

export default function VideoPlayer({ src, className = '' }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation(); // 親要素のイベント発火を防ぐ
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation(); // 親要素のイベント発火を防ぐ
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  return (
    <div className={`${styles.videoContainer} ${className}`}>
      <video
        ref={videoRef}
        src={src}
        className={styles.videoElement}
        autoPlay
        loop
        muted={isMuted}
        playsInline
      />
      <div className={styles.controls}>
        <button 
          className={styles.controlButton} 
          onClick={togglePlay}
          title={isPlaying ? '停止する' : '再生する'}
        >
          {isPlaying ? '⏸️' : '▶️'}
        </button>
        <button 
          className={styles.controlButton} 
          onClick={toggleMute}
          title={isMuted ? '音を出す' : '音を消す'}
        >
          {isMuted ? '🔇' : '🔊'}
        </button>
      </div>
    </div>
  );
}
