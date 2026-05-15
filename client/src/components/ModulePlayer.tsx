import React, { useState, useEffect, useRef } from 'react';
import { Module, CourseProgress, QuizQuestion } from '../types';
import { getModuleProgress, markSlideViewed, markModuleComplete, resetModuleProgress } from '../utils/progress';
import Quiz from './Quiz';
import Character from './Character';
import { useIsMobile } from '../utils/useIsMobile';

type Timing = { word: string; start: number; end: number };
type PrefetchEntry = { url: string; timings: Timing[] };

async function textHash(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Collapse extra horizontal whitespace and multiple blank lines — used for display and word count.
// Hash still uses raw .trim() to match pre-generated audio filenames.
function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[^\S\n]+/g, ' ')   // collapse horizontal whitespace
    .replace(/\n[ \t]+\n/g, '\n') // remove whitespace-only lines
    .replace(/\n{2,}/g, '\n')     // collapse multiple blank lines
    .trim();
}

// Pure punctuation/symbol tokens (•, →, —, etc.) should not consume a timing slot.
// ElevenLabs assigns the inter-paragraph pause duration to these, causing highlight lag.
function isWordToken(w: string): boolean {
  return /[a-zA-Z0-9]/.test(w);
}

interface Props {
  module: Module;
  moduleIndex: number;
  totalModules: number;
  progress: CourseProgress;
  quizData: Record<string, QuizQuestion[]>;
  onProgressUpdate: (p: CourseProgress) => void;
  onComplete: (p: CourseProgress) => void;
  onBack: () => void;
}

type PlayerView = 'slides' | 'quiz';

export default function ModulePlayer({
  module,
  moduleIndex,
  totalModules,
  progress,
  quizData,
  onProgressUpdate,
  onComplete,
  onBack,
}: Props) {
  const mp = getModuleProgress(progress, module.id);
  const isMobile = useIsMobile();
  const [slideIndex, setSlideIndex] = useState(mp.last_slide ?? 0);
  const [view, setView] = useState<PlayerView>('slides');
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [activeWordIndex, setActiveWordIndex] = useState(-1);
  const [slideVisible, setSlideVisible] = useState(true);
  const [celebrating, setCelebrating] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  const audioRef = useRef<HTMLAudioElement>(new Audio());
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number | null>(null);
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoPlayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressRef = useRef(progress);
  const timingsRef = useRef<Timing[] | null>(null);
  const wordsRef = useRef<string[]>([]);
  // Stores Promise so in-flight prefetches are reused instead of duplicated
  const prefetchCacheRef = useRef<Map<number, Promise<PrefetchEntry | null>>>(new Map());
  const blobUrlsRef = useRef<string[]>([]);
  const narrationTokenRef = useRef<symbol | null>(null);
  useEffect(() => { progressRef.current = progress; }, [progress]);

  const slide = module.slides[slideIndex];
  const questions: QuizQuestion[] = quizData[module.id] ?? [];
  const isLastSlide = slideIndex === module.slides.length - 1;
  const slideText = normalizeText(slide?.text ?? '');
  const slideName = slide?.slide_name ?? '';

  function stopRaf(keepIndex = false) {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (!keepIndex) setActiveWordIndex(-1);
  }

  function pauseAudio() {
    audioRef.current.pause();
    window.speechSynthesis?.cancel();
    stopRaf(true); // keep word highlight on current word
    clearTimers();
    setIsPlaying(false);
  }

  function clearTimers() {
    if (autoAdvanceRef.current) { clearTimeout(autoAdvanceRef.current); autoAdvanceRef.current = null; }
    if (autoPlayRef.current) { clearTimeout(autoPlayRef.current); autoPlayRef.current = null; }
  }

  function startWordHighlight(
    audio: HTMLAudioElement,
    words: string[],
    timings: Timing[] | null
  ) {
    stopRaf();

    if (timings && timings.length > 0) {
      const t = timings;
      // timings[i] was built from the same text split on whitespace, so index maps 1:1 to words[i]
      const tick = () => {
        const ct = audio.currentTime;
        let lo = 0, hi = t.length - 1, idx = 0;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          if (t[mid].start <= ct) { idx = mid; lo = mid + 1; }
          else hi = mid - 1;
        }
        // Clear highlight during long inter-word pauses (e.g. after bullet characters)
        if (ct > t[idx].end + 0.35) {
          setActiveWordIndex(-1);
        } else {
          setActiveWordIndex(Math.min(idx, words.length - 1));
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } else {
      const weights = words.map(w => {
        let wt = Math.max(w.replace(/[^a-zA-Z0-9]/g, '').length, 1);
        if (/[.!?]$/.test(w)) wt += 6;
        else if (/[,;:\-—]$/.test(w)) wt += 3;
        return wt;
      });
      const cumulative: number[] = [];
      let total = 0;
      for (const wt of weights) { total += wt; cumulative.push(total); }

      const tick = () => {
        if (!audio.paused && audio.duration > 0) {
          const target = (audio.currentTime / audio.duration) * total;
          let lo = 0, hi = cumulative.length - 1;
          while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (cumulative[mid] < target) lo = mid + 1;
            else hi = mid;
          }
          setActiveWordIndex(lo);
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }
  }

  function stopAudio() {
    narrationTokenRef.current = null; // cancel any in-flight playNarration
    const audio = audioRef.current;
    audio.oncanplaythrough = null;
    audio.onplaying = null;
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    audio.currentTime = 0;
    audio.src = '';
    window.speechSynthesis?.cancel();
    stopRaf();
    clearTimers();
    setIsPlaying(false);
    setAudioLoading(false);
  }

  function b64ToBlob(b64: string): string {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
    blobUrlsRef.current.push(url);
    return url;
  }

  // Returns (and caches) a Promise — in-flight fetches are reused, never duplicated
  function prefetchSlide(idx: number): Promise<PrefetchEntry | null> {
    if (idx < 0 || idx >= module.slides.length) return Promise.resolve(null);
    const existing = prefetchCacheRef.current.get(idx);
    if (existing) return existing;
    const text = module.slides[idx]?.text?.trim() ?? '';
    if (!text) return Promise.resolve(null);

    const promise = (async (): Promise<PrefetchEntry | null> => {
      // Try pre-generated static file first (named by text hash — auto-invalidates on edit)
      try {
        const hash = await textHash(text);
        const tr   = await fetch(`/audio/${hash}.json`);
        if (tr.ok) {
          return { url: `/audio/${hash}.mp3`, timings: await tr.json() };
        }
      } catch {}

      // Fall back to ElevenLabs API
      try {
        const r = await fetch('/api/narrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        if (!r.ok) throw new Error();
        const { audio: b64, timings } = await r.json();
        return { url: b64ToBlob(b64), timings: timings ?? [] };
      } catch {
        prefetchCacheRef.current.delete(idx);
        return null;
      }
    })();

    prefetchCacheRef.current.set(idx, promise);
    return promise;
  }

  function playFromEntry(
    entry: PrefetchEntry,
    words: string[],
    audio: HTMLAudioElement,
    token: symbol,
    onEnded?: () => void
  ) {
    if (narrationTokenRef.current !== token) return;
    timingsRef.current = entry.timings.length ? entry.timings.filter(t => isWordToken(t.word)) : null;
    audio.oncanplaythrough = null;
    audio.onplaying = null;
    audio.onended = null;
    audio.onerror = null;
    audio.onended = () => { stopRaf(); setIsPlaying(false); onEnded?.(); };
    audio.oncanplaythrough = () => {
      if (narrationTokenRef.current !== token) return;
      setAudioLoading(false);
      setIsPlaying(true);
      audio.playbackRate = playbackRate;
      audio.play();
    };
    audio.onplaying = () => {
      if (narrationTokenRef.current !== token) return;
      startWordHighlight(audio, words, timingsRef.current);
    };
    audio.src = entry.url;
    audio.load();
  }

  function playNarration(onEnded?: () => void) {
    if (!slideText.trim()) { onEnded?.(); return; }

    const token = Symbol();
    narrationTokenRef.current = token;

    const audio = audioRef.current;
    audio.oncanplaythrough = null;
    audio.onplaying = null;
    audio.onended = null;
    audio.onerror = null;
    setAudioLoading(true);

    const words = slideText.trim().split(/\s+/).filter(isWordToken);
    wordsRef.current = words;
    timingsRef.current = null;

    // Wait on the prefetch promise — reuses in-flight request if prefetch already started
    prefetchSlide(slideIndex).then(entry => {
      if (narrationTokenRef.current !== token) return;
      if (entry) {
        playFromEntry(entry, words, audio, token, onEnded);
      } else {
        setAudioLoading(false);
        speakFallback(slideText, onEnded);
      }
    });
  }

  function speakFallback(text: string, onEnded?: () => void) {
    if (!window.speechSynthesis) { onEnded?.(); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.92;
    utterance.pitch = 1.05;

    const voices = window.speechSynthesis.getVoices();
    // Priority: Google US English female > Samantha > Google UK > any Google > any en-US > any English
    const pick =
      voices.find(v => v.name === 'Google US English') ||
      voices.find(v => v.name === 'Samantha') ||
      voices.find(v => v.name.includes('Google') && v.lang === 'en-US') ||
      voices.find(v => v.name.includes('Google') && v.lang.startsWith('en')) ||
      voices.find(v => v.lang === 'en-US') ||
      voices.find(v => v.lang.startsWith('en'));
    if (pick) utterance.voice = pick;

    // Track word position via boundary events
    utterance.onboundary = (e) => {
      if (e.name === 'word') {
        const before = text.substring(0, e.charIndex).trim();
        const idx = before === '' ? 0 : before.split(/\s+/).length;
        setActiveWordIndex(idx);
      }
    };

    utterance.onend = () => { stopRaf(); setActiveWordIndex(-1); setIsPlaying(false); onEnded?.(); };
    setIsPlaying(true);
    window.speechSynthesis.speak(utterance);
  }

  // Seek module video to this slide's clip when slide changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !module.video_url) return;
    const start = slide?.video_start;
    if (start !== undefined) {
      video.currentTime = start;
      video.play().catch(() => {});
    }
  }, [slideIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleVideoTimeUpdate() {
    const video = videoRef.current;
    if (!video || !slide) return;
    const end = slide.video_end;
    const start = slide.video_start ?? 0;
    if (end !== undefined && video.currentTime >= end) {
      video.currentTime = start;
      video.play().catch(() => {});
    }
  }

  useEffect(() => {
    stopAudio();
    setSlideVisible(false);
    const updated = markSlideViewed(progressRef.current, module.id, slideIndex);
    onProgressUpdate(updated);

    // Start prefetching next slide immediately so it's ready when this one ends
    prefetchSlide(slideIndex + 1);

    const fadeTimer = setTimeout(() => setSlideVisible(true), 50);

    autoPlayRef.current = setTimeout(() => {
      playNarration(() => {
        if (!isLastSlide) {
          autoAdvanceRef.current = setTimeout(() => handleNext(), 350);
        } else {
          setCelebrating(true);
        }
      });
    }, 150);

    return () => {
      clearTimeout(fadeTimer);
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideIndex]);

  useEffect(() => {
    return () => {
      stopAudio();
      blobUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      blobUrlsRef.current = [];
      prefetchCacheRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handlePlayNarration() {
    if (isPlaying) {
      pauseAudio();
      return;
    }
    clearTimers();
    const audio = audioRef.current;
    // Resume from paused position if audio is loaded and mid-way
    if (audio.src && audio.currentTime > 0 && !audio.ended) {
      audio.play();
      setIsPlaying(true);
      startWordHighlight(audio, wordsRef.current, timingsRef.current);
      audio.onended = () => {
        stopRaf();
        setIsPlaying(false);
        autoAdvanceRef.current = setTimeout(() => handleNext(), 1500);
      };
      return;
    }
    playNarration(() => {
      autoAdvanceRef.current = setTimeout(() => handleNext(), 1500);
    });
  }

  function goToSlide(index: number) {
    stopAudio();
    setSlideIndex(index);
  }

  function handleRestart() {
    stopAudio();
    const reset = resetModuleProgress(progressRef.current, module.id);
    onProgressUpdate(reset);
    setSlideIndex(0);
    setCelebrating(false);
  }

  function handlePrev() {
    if (slideIndex > 0) goToSlide(slideIndex - 1);
  }

  function handleNext() {
    if (isLastSlide) {
      stopAudio();
      const updated = markModuleComplete(progressRef.current, module.id, 100, true);
      onComplete(updated);
    } else {
      goToSlide(slideIndex + 1);
    }
  }

  function handleTakeQuiz() {
    stopAudio();
    setView('quiz');
  }

  function handleQuizComplete(score: number, passed: boolean) {
    const updated = markModuleComplete(progressRef.current, module.id, score, passed);
    if (passed) {
      onComplete(updated);
    } else {
      onProgressUpdate(updated);
      goToSlide(0);
      setView('slides');
    }
  }

  if (view === 'quiz') {
    return (
      <Quiz
        questions={questions}
        moduleName={module.name}
        onComplete={handleQuizComplete}
      />
    );
  }

const slidesViewed = getModuleProgress(progress, module.id).slides_viewed.length;
  const totalSlides = module.slides.length;
  const slideProgress = Math.round((slidesViewed / totalSlides) * 100);

  return (
    <div style={styles.page}>
      {/* Top bar */}
      <div style={{ ...styles.topBar, height: isMobile ? 'auto' : '72px', padding: isMobile ? '10px 12px' : '0 24px', flexWrap: 'wrap' as const, gap: '8px' }}>
        <button style={styles.backBtn} onClick={() => { stopAudio(); onBack(); }}>
          ← Back
        </button>
        <div style={{ ...styles.topCenter, gap: isMobile ? '8px' : '12px' }}>
          <div style={styles.brandMark}>
            <span style={{ ...styles.brandWish, fontSize: isMobile ? '20px' : '28px' }}>WISH</span>
          </div>
          <span style={{ ...styles.moduleBadge, fontSize: '10px', padding: '2px 8px' }}>M{moduleIndex + 1}/{totalModules}</span>
          {!isMobile && <span style={styles.moduleTitle}>{module.name}</span>}
        </div>
        <div style={styles.topRight}>
          <div style={styles.miniProgress}>
            <div style={{ ...styles.miniProgressFill, width: `${slideProgress}%` }} />
          </div>
          <span style={styles.miniProgressLabel}>{slidesViewed}/{totalSlides}</span>
        </div>
      </div>

      {/* Slide area */}
      <div style={{ ...styles.slideArea, padding: isMobile ? '12px' : '32px 24px' }}>
        <div style={{ ...styles.slideCard, padding: isMobile ? '20px 16px' : '40px 48px', opacity: slideVisible ? 1 : 0, transform: slideVisible ? 'translateY(0)' : 'translateY(12px)', transition: 'opacity 0.35s ease, transform 0.35s ease' }}>
          {/* Character inline top-right — hidden on mobile to avoid clipping */}
          {!isMobile && (
            <div style={{ position: 'absolute', top: '-60px', right: '24px' }}>
              <Character state={celebrating ? 'celebrating' : isPlaying ? 'talking' : 'idle'} />
            </div>
          )}
          <div style={styles.slideHeader}>
            <div style={styles.slideNumBadge}>
              Slide {slideIndex + 1} / {totalSlides}
            </div>
            {slide?.instructions && (
              <div style={styles.instructionsTag}>
                📹 {slide.instructions}
              </div>
            )}
          </div>

          <h2 style={styles.slideName}>{slideName}</h2>

          {/* Video clip — shown when module has a video and this slide has timestamps */}
          {module.video_url && slide?.video_start !== undefined ? (
            <div style={styles.screenshotWrap}>
              <video
                ref={videoRef}
                src={module.video_url}
                muted
                playsInline
                onTimeUpdate={handleVideoTimeUpdate}
                style={{ ...styles.screenshotImg, background: '#000' }}
              />
            </div>
          ) : slide?.screenshot ? (
            <div style={styles.screenshotWrap}>
              <img
                src={slide.screenshot}
                alt="WISH system screenshot"
                style={styles.screenshotImg}
              />
            </div>
          ) : null}

          <div style={styles.slideContent}>
            {slideText ? (
              <HighlightedText text={slideText} activeWordIndex={activeWordIndex} isPlaying={isPlaying} />
            ) : (
              <p style={styles.emptyText}>No narration text for this slide.</p>
            )}
          </div>

          {slideText && (
            <button
              style={{ ...styles.audioBtn, background: isPlaying ? '#1B3A6B' : '#D4782A' }}
              onClick={handlePlayNarration}
              disabled={audioLoading}
            >
              {audioLoading ? '⏳ Loading...' : isPlaying ? '⏸ Pause' : '▶ Resume'}
            </button>
          )}
        </div>
      </div>

      {/* Bottom navigation */}
      <div style={{ ...styles.bottomBar, flexWrap: 'wrap' as const, padding: isMobile ? '10px 12px' : '16px 32px', gap: isMobile ? '8px' : '16px' }}>
        {/* Speed selector — persists across all slides */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
          {[0.75, 1, 1.25, 1.5].map(rate => (
            <button
              key={rate}
              onClick={() => {
                setPlaybackRate(rate);
                audioRef.current.playbackRate = rate;
              }}
              style={{
                padding: '5px 9px',
                fontSize: '11px',
                fontWeight: 600,
                borderRadius: '6px',
                border: '2px solid',
                cursor: 'pointer',
                borderColor: playbackRate === rate ? '#D4782A' : '#E5E7EB',
                background: playbackRate === rate ? '#FFF3E8' : '#F9FAFB',
                color: playbackRate === rate ? '#D4782A' : '#9CA3AF',
                transition: 'all 0.15s',
              }}
            >
              {rate === 1 ? '1×' : `${rate}×`}
            </button>
          ))}
        </div>

        <div style={{ ...styles.slideDots, overflowX: 'auto', maxWidth: isMobile ? '160px' : '100%', flexShrink: 1 }}>
          {module.slides.map((_, i) => (
            <div
              key={i}
              onClick={() => goToSlide(i)}
              title={`Slide ${i + 1}`}
              style={{
                ...styles.dot,
                background: i === slideIndex
                  ? '#D4782A'
                  : getModuleProgress(progress, module.id).slides_viewed.includes(i)
                  ? '#5BBCB0'
                  : '#E5E7EB',
                width: i === slideIndex ? (isMobile ? '16px' : '24px') : (isMobile ? '6px' : '8px'),
                height: isMobile ? '6px' : '8px',
                flexShrink: 0,
                cursor: 'pointer',
              }}
            />
          ))}
        </div>

        <div style={{ ...styles.navBtns, flexWrap: 'wrap' as const }}>
          {!isMobile && (
            <button style={{ ...styles.navBtn, ...styles.navBtnRestart }} onClick={handleRestart}>
              ↺ Restart
            </button>
          )}
          <button
            style={{ ...styles.navBtn, opacity: slideIndex === 0 ? 0.4 : 1, padding: isMobile ? '8px 12px' : '10px 20px', fontSize: isMobile ? '13px' : '14px' }}
            disabled={slideIndex === 0}
            onClick={handlePrev}
          >
            ← Prev
          </button>
          {isLastSlide && questions.length > 0 && (
            <button style={{ ...styles.navBtn, padding: isMobile ? '8px 12px' : '10px 20px', fontSize: isMobile ? '13px' : '14px' }} onClick={handleTakeQuiz}>
              Quiz
            </button>
          )}
          <button style={{ ...styles.navBtn, ...styles.navBtnPrimary, padding: isMobile ? '8px 12px' : '10px 20px', fontSize: isMobile ? '13px' : '14px' }} onClick={handleNext}>
            {isLastSlide ? 'Complete ✓' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Highlighted text renderer ────────────────────────────────────────────────
function HighlightedText({
  text,
  activeWordIndex,
  isPlaying,
}: {
  text: string;
  activeWordIndex: number;
  isPlaying: boolean;
}) {
  const paragraphs = text.split('\n').filter(Boolean);
  let globalIndex = 0;

  return (
    <>
      {paragraphs.map((para, pi) => {
        const words = para.split(/(\s+)/);
        const elements: React.ReactNode[] = [];

        for (let i = 0; i < words.length; i++) {
          const token = words[i];
          if (/^\s+$/.test(token)) {
            elements.push(token);
            continue;
          }
          // Non-word tokens (•, →, —, etc.) render as plain text — no timing slot, no highlight
          if (!isWordToken(token)) {
            elements.push(<span key={`${pi}-${i}`} style={{ color: '#374151' }}>{token}</span>);
            continue;
          }
          const wordIdx = globalIndex;
          const isActive = activeWordIndex >= 0 && wordIdx === activeWordIndex;
          const isPast = activeWordIndex >= 0 && wordIdx < activeWordIndex;
          elements.push(
            <span
              key={`${pi}-${i}`}
              style={{
                backgroundColor: isActive ? '#D4782A' : 'transparent',
                color: isActive ? '#FFFFFF' : isPast ? '#9CA3AF' : '#374151',
                borderRadius: '3px',
                padding: '2px 3px',
                fontWeight: 400,
                display: 'inline',
                transition: 'background-color 0.08s ease, color 0.08s ease',
              }}
            >
              {token}
            </span>
          );
          globalIndex++;
        }

        return (
          <p key={pi} style={{ fontSize: '16px', lineHeight: '1.9', marginBottom: '14px' }}>
            {elements}
          </p>
        );
      })}
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#F4F7FA', display: 'flex', flexDirection: 'column' },
  topBar: {
    background: 'linear-gradient(90deg, #5BBCB0 0%, #C8D46A 100%)',
    padding: '0 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    height: '72px',
    overflow: 'hidden',
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
  brandMark: { display: 'flex', alignItems: 'center' },
  brandWish: { fontSize: '28px', fontWeight: 900, color: '#D4782A', letterSpacing: '2px', textShadow: '0 1px 3px rgba(27,58,107,0.2)' },
  moduleBadge: {
    background: '#D4782A',
    color: '#FFFFFF',
    padding: '3px 10px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  moduleTitle: { color: '#1B3A6B', fontWeight: 700, fontSize: '15px' },
  topRight: { display: 'flex', alignItems: 'center', gap: '8px' },
  miniProgress: { width: '80px', height: '6px', background: 'rgba(255,255,255,0.2)', borderRadius: '3px', overflow: 'hidden' },
  miniProgressFill: { height: '100%', background: '#5BBCB0', borderRadius: '3px', transition: 'width 0.3s' },
  miniProgressLabel: { color: '#1B3A6B', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap' },
  slideArea: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start', padding: '32px 24px' },
  screenshotWrap: {
    marginBottom: '24px',
    borderRadius: '10px',
    overflow: 'hidden',
    border: '2px solid #E5E7EB',
    background: '#F8FAFC',
    lineHeight: 0,
  },
  screenshotImg: {
    width: '100%',
    height: 'auto',
    maxHeight: '360px',
    objectFit: 'contain',
    display: 'block',
  },
  slideCard: {
    background: '#FFFFFF',
    borderRadius: '16px',
    padding: '40px 48px',
    width: '100%',
    position: 'relative',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    borderTop: '5px solid #D4782A',
  },
  slideHeader: { display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' },
  slideNumBadge: {
    background: '#1B3A6B',
    color: '#FFFFFF',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  },
  instructionsTag: {
    background: '#F0FDF4',
    border: '1px solid #BBF7D0',
    color: '#166534',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: 500,
    flex: 1,
  },
  slideName: { fontSize: 'clamp(18px, 4vw, 26px)', fontWeight: 800, color: '#1B3A6B', marginBottom: '20px', lineHeight: '1.3' },
  slideContent: { marginBottom: '24px' },
  emptyText: { color: '#9CA3AF', fontStyle: 'italic' },
  audioBtn: {
    padding: '10px 24px',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  bottomBar: {
    background: '#FFFFFF',
    borderTop: '1px solid #E5E7EB',
    padding: '16px 32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    boxShadow: '0 -2px 8px rgba(0,0,0,0.04)',
  },
  slideDots: { display: 'flex', gap: '4px', alignItems: 'center', flex: 1, flexWrap: 'wrap', minWidth: 0, overflow: 'hidden' },
  dot: { height: '8px', borderRadius: '4px', transition: 'all 0.25s', flexShrink: 0 },
  navBtns: { display: 'flex', gap: '8px', flexShrink: 0 },
  navBtn: {
    padding: '10px 20px',
    background: '#F3F4F6',
    border: '2px solid #E5E7EB',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    color: '#374151',
  },
  navBtnPrimary: {
    background: 'linear-gradient(135deg, #D4782A, #B8621F)',
    color: '#FFFFFF',
    border: 'none',
  },
  navBtnRestart: {
    color: '#6B7280',
    borderColor: '#D1D5DB',
  },
};
