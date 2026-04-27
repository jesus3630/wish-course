import React, { useState, useRef } from 'react';
import { Module } from '../types';

interface Props {
  module: Module;
  moduleIndex: number;
  totalModules: number;
  onBack: () => void;
}

export default function VideoPlayer({ module, moduleIndex, totalModules, onBack }: Props) {
  const videos = module.videos ?? [];
  const [activeIdx, setActiveIdx] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  function switchClip(idx: number) {
    setActiveIdx(idx);
    // Let React re-render with the new src, then play from start
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.load();
      }
    }, 50);
  }

  const current = videos[activeIdx];

  return (
    <div style={styles.page}>
      {/* Top bar */}
      <div style={styles.topBar}>
        <button style={styles.backBtn} onClick={onBack}>
          ← Back to Slides
        </button>
        <div style={styles.topCenter}>
          <span style={styles.brandWish}>WISH</span>
          <span style={styles.moduleBadge}>Module {moduleIndex + 1} of {totalModules}</span>
          <span style={styles.moduleTitle}>{module.name}</span>
        </div>
        <div style={styles.topRight}>
          <span style={styles.recordingLabel}>Video Recording</span>
        </div>
      </div>

      <div style={styles.body}>
        {/* Playlist — shown only if more than one clip */}
        {videos.length > 1 && (
          <div style={styles.playlist}>
            <div style={styles.playlistTitle}>Clips</div>
            {videos.map((v, i) => (
              <button
                key={i}
                style={{
                  ...styles.playlistItem,
                  background: i === activeIdx ? '#D4782A' : '#F3F4F6',
                  color: i === activeIdx ? '#FFFFFF' : '#374151',
                  fontWeight: i === activeIdx ? 700 : 500,
                  borderColor: i === activeIdx ? '#D4782A' : '#E5E7EB',
                }}
                onClick={() => switchClip(i)}
              >
                <span style={styles.clipNum}>{i + 1}</span>
                {v.title}
              </button>
            ))}
          </div>
        )}

        {/* Video area */}
        <div style={styles.videoWrap}>
          {current ? (
            <>
              <div style={styles.clipHeader}>
                {videos.length > 1 && (
                  <span style={styles.clipCounter}>{activeIdx + 1} / {videos.length}</span>
                )}
                <span style={styles.clipTitle}>{current.title}</span>
              </div>
              <video
                ref={videoRef}
                key={current.src}
                controls
                style={styles.video}
                onError={() => {/* handled by browser's native error UI */}}
              >
                <source src={current.src} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
              {/* Clip nav for multi-clip modules */}
              {videos.length > 1 && (
                <div style={styles.clipNav}>
                  <button
                    style={{ ...styles.clipNavBtn, opacity: activeIdx === 0 ? 0.35 : 1 }}
                    disabled={activeIdx === 0}
                    onClick={() => switchClip(activeIdx - 1)}
                  >
                    ← Previous Clip
                  </button>
                  <button
                    style={{ ...styles.clipNavBtn, ...styles.clipNavBtnPrimary, opacity: activeIdx === videos.length - 1 ? 0.35 : 1 }}
                    disabled={activeIdx === videos.length - 1}
                    onClick={() => switchClip(activeIdx + 1)}
                  >
                    Next Clip →
                  </button>
                </div>
              )}
            </>
          ) : (
            <div style={styles.noVideo}>No video available for this module.</div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#0F172A', display: 'flex', flexDirection: 'column' },
  topBar: {
    background: 'linear-gradient(90deg, #5BBCB0 0%, #C8D46A 100%)',
    padding: '0 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    height: '72px',
    boxShadow: '0 2px 12px rgba(91,188,176,0.4)',
  },
  backBtn: {
    background: 'rgba(27,58,107,0.12)',
    border: 'none',
    color: '#1B3A6B',
    padding: '8px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  topCenter: { display: 'flex', alignItems: 'center', gap: '12px', flex: 1, justifyContent: 'center' },
  brandWish: { fontSize: '28px', fontWeight: 900, color: '#D4782A', letterSpacing: '2px', textShadow: '0 1px 3px rgba(27,58,107,0.2)' },
  moduleBadge: {
    background: '#D4782A',
    color: '#FFFFFF',
    padding: '3px 10px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  moduleTitle: { color: '#1B3A6B', fontWeight: 700, fontSize: '15px' },
  topRight: { display: 'flex', alignItems: 'center' },
  recordingLabel: {
    background: 'rgba(27,58,107,0.15)',
    color: '#1B3A6B',
    padding: '4px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 700,
  },
  body: {
    flex: 1,
    display: 'flex',
    gap: 0,
    overflow: 'hidden',
  },
  playlist: {
    width: '220px',
    flexShrink: 0,
    background: '#1E293B',
    padding: '20px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    overflowY: 'auto' as const,
  },
  playlistTitle: {
    color: '#94A3B8',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
    marginBottom: '8px',
    paddingLeft: '4px',
  },
  playlistItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '2px solid',
    cursor: 'pointer',
    fontSize: '13px',
    textAlign: 'left' as const,
    transition: 'all 0.15s',
    lineHeight: '1.4',
  },
  clipNum: {
    background: 'rgba(0,0,0,0.15)',
    borderRadius: '50%',
    width: '22px',
    height: '22px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: 700,
    flexShrink: 0,
  },
  videoWrap: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '24px',
    gap: '16px',
    overflow: 'auto' as const,
  },
  clipHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  clipCounter: {
    background: '#334155',
    color: '#94A3B8',
    padding: '3px 10px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 700,
    whiteSpace: 'nowrap' as const,
  },
  clipTitle: {
    color: '#F1F5F9',
    fontSize: '18px',
    fontWeight: 700,
  },
  video: {
    width: '100%',
    borderRadius: '12px',
    background: '#000',
    maxHeight: 'calc(100vh - 220px)',
  },
  clipNav: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
  },
  clipNavBtn: {
    padding: '10px 20px',
    background: '#1E293B',
    border: '2px solid #334155',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    color: '#CBD5E1',
    transition: 'all 0.15s',
  },
  clipNavBtnPrimary: {
    background: '#D4782A',
    borderColor: '#D4782A',
    color: '#FFFFFF',
  },
  noVideo: {
    color: '#64748B',
    fontSize: '16px',
    padding: '40px',
    textAlign: 'center' as const,
  },
};
