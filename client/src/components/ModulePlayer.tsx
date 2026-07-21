import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Module, CourseProgress, QuizQuestion } from '../types';
import { getModuleProgress, markSlideViewed, markModuleComplete, resetModuleProgress } from '../utils/progress';
import Quiz from './Quiz';
import Character from './Character';
import TutorWidget from './TutorWidget';
import { useIsMobile } from '../utils/useIsMobile';

type Timing = { word: string; start: number; end: number };
type PrefetchEntry = { url: string; timings: Timing[] };

// ─── Audit Image with pulsing gold highlight + click-to-zoom ─────────────────
const PULSE_STYLE = `
  @keyframes audit-pulse {
    0%,100% { box-shadow: 0 0 0 2px rgba(245,158,11,0.9), 0 0 8px 5px rgba(245,158,11,0.5), 0 0 20px 10px rgba(245,158,11,0.18); }
    50%      { box-shadow: 0 0 0 2px rgba(245,158,11,1),   0 0 14px 7px rgba(245,158,11,0.75), 0 0 30px 14px rgba(245,158,11,0.32); }
  }
  @keyframes wish-complete-pulse {
    0%   { transform: scale(0.72); opacity: 0.30; }
    100% { transform: scale(1.28); opacity: 0; }
  }
`;
type HighlightBox = { x: number; y: number; w: number; h: number };
function AuditImageHighlight({ src, highlight, caption }: { src: string; highlight: HighlightBox; caption: string }) {
  const [zoomed, setZoomed] = useState(false);
  const cx = highlight.x + highlight.w / 2;
  const cy = highlight.y + highlight.h / 2;
  return (
    <div style={{ flex: '1 1 340px', maxWidth: '480px' }}>
      <style>{PULSE_STYLE}</style>
      <div
        style={{ position: 'relative', overflow: 'hidden', borderRadius: '10px 10px 0 0', cursor: zoomed ? 'zoom-out' : 'zoom-in', userSelect: 'none' }}
        onClick={() => setZoomed(z => !z)}
      >
        <img
          src={src}
          alt=""
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          style={{
            width: '100%', height: 'auto', display: 'block',
            transformOrigin: `${cx}% ${cy}%`,
            transform: zoomed ? 'scale(3.5)' : 'scale(1)',
            transition: 'transform 0.45s cubic-bezier(0.22,1,0.36,1)',
          }}
        />
        {/* Gold highlight box — fades out when zoomed */}
        <div style={{
          position: 'absolute',
          left: `${highlight.x}%`, top: `${highlight.y}%`,
          width: `${highlight.w}%`, height: `${highlight.h}%`,
          border: 'none',
          background: 'rgba(245,158,11,0.12)',
          borderRadius: '4px',
          animation: 'audit-pulse 1.8s ease-in-out infinite',
          opacity: zoomed ? 0 : 1,
          transition: 'opacity 0.2s',
          pointerEvents: 'none',
        }} />
        {/* Zoom hint badge */}
        <div style={{
          position: 'absolute', bottom: '8px', right: '8px',
          background: 'rgba(0,0,0,0.55)', color: '#fff',
          fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '20px',
          pointerEvents: 'none', opacity: 0.9,
        }}>
          {zoomed ? 'Click to zoom out' : 'Click to zoom in'}
        </div>
      </div>
      <div style={{ background: '#FFFBEB', border: '1.5px solid #F59E0B', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '10px 14px', fontSize: '13px', color: '#78350F', lineHeight: '1.55' }}>
        <span style={{ fontWeight: 700, color: '#B45309' }}>What to notice: </span>{caption}
      </div>
    </div>
  );
}

function SimFrame({ src, graded }: { src: string; graded?: boolean }) {
  const url = graded ? src + (src.includes('?') ? '&' : '?') + 'graded=1' : src;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.7);
  const [overflowing, setOverflowing] = useState(false);
  const [full, setFull] = useState(false);       // fullscreen demo mode
  const [fsScale, setFsScale] = useState(0.5);    // scale used in fullscreen
  const [small, setSmall] = useState(false);      // phone-width
  const [portrait, setPortrait] = useState(false);
  const lastWRef = useRef(0);
  const rafRef = useRef(0);
  const scheduleRef = useRef<() => void>(() => {});
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    // Scale the 1280px demo to exactly fill the container width. No jitter guard: the container
    // is aspect-ratio locked + overflow:hidden, so scaling never toggles a scrollbar (the old
    // cause of the "shake"). Re-measured on every container resize AND on browser zoom
    // (visualViewport), so the demo always fills its box and can't get stuck at a stale scale.
    const measure = () => { const w = el.offsetWidth; if (w) setScale(w / 1280); };
    const schedule = () => { cancelAnimationFrame(rafRef.current); rafRef.current = requestAnimationFrame(measure); };
    scheduleRef.current = schedule;
    schedule();
    // Re-measure as the layout settles (transition/first paint) so the scale can't get stuck.
    const timers = [setTimeout(schedule, 120), setTimeout(schedule, 400), setTimeout(schedule, 1000)];
    const obs = new ResizeObserver(schedule);
    obs.observe(el);
    window.addEventListener('resize', schedule);
    const vv = window.visualViewport;
    if (vv) vv.addEventListener('resize', schedule);
    return () => { timers.forEach(clearTimeout); cancelAnimationFrame(rafRef.current); obs.disconnect(); window.removeEventListener('resize', schedule); if (vv) vv.removeEventListener('resize', schedule); };
  }, []);
  // Track phone width + orientation for the rotate hint
  useEffect(() => {
    const check = () => { setSmall(window.innerWidth < 760); setPortrait(window.innerWidth < window.innerHeight); };
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => { window.removeEventListener('resize', check); window.removeEventListener('orientationchange', check); };
  }, []);
  // In fullscreen, fit the WHOLE 1280×720 demo to the viewport (both dimensions) + lock body scroll
  useEffect(() => {
    if (!full) return;
    const calc = () => setFsScale(Math.min(window.innerWidth / 1280, window.innerHeight / 720));
    calc();
    window.addEventListener('resize', calc);
    window.addEventListener('orientationchange', calc);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('resize', calc); window.removeEventListener('orientationchange', calc); document.body.style.overflow = ''; };
  }, [full]);

  const showBar = small;
  return (
    <div>
      {showBar && (
        <div style={{
          fontSize: '11.5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '5px 12px',
          color: '#92400E', background: '#FFF7ED', borderBottom: '1px solid #FED7AA',
        }}>
          <span>{small && portrait ? '↻ Rotate to landscape, or tap' : '↔ Swipe to explore, then tap to interact'}</span>
          <button onClick={() => setFull(true)} style={{
            background: '#D4782A', color: '#fff', border: 'none', borderRadius: 14,
            padding: '4px 11px', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
          }}>⛶ Full screen</button>
        </div>
      )}
      <div ref={wrapRef} style={{ width: '100%', aspectRatio: '1280 / 720', overflow: 'hidden', position: 'relative' } as React.CSSProperties}>
        <iframe
          src={url}
          onLoad={() => scheduleRef.current()}
          style={{ position: 'absolute', top: 0, left: 0, width: '1280px', height: '720px', border: 'none', display: 'block', transformOrigin: 'top left', transform: `scale(${scale})` } as React.CSSProperties}
          title="WISH Interactive Simulation"
        />
      </div>

      {/* Fullscreen demo — portaled to <body> so it escapes any transformed ancestor and covers the whole viewport */}
      {full && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: '#141414', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 14px', color: '#fff', fontSize: 12 }}>
            <span>{portrait ? '↻ Rotate your phone to landscape for a bigger view' : 'Interactive demo — full screen'}</span>
            <button onClick={() => setFull(false)} style={{
              background: 'rgba(255,255,255,0.18)', color: '#fff', border: 'none', borderRadius: 16,
              padding: '6px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
            }}>✕ Close</button>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <iframe
              src={url}
              style={{ width: '1280px', height: '720px', border: 'none', display: 'block', zoom: fsScale } as React.CSSProperties}
              title="WISH Interactive Simulation (full screen)"
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

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

// Only show instructions if they are plain ASCII text (no garbled multi-byte characters).
function isCleanText(s: string): boolean {
  return s.length > 0 && /^[\x20-\x7E\s]*$/.test(s);
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
  initialSlide?: number;
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
  initialSlide,
}: Props) {
  const mp = getModuleProgress(progress, module.id);
  const isMobile = useIsMobile();
  const [slideIndex, setSlideIndex] = useState(initialSlide ?? mp.last_slide ?? 0);
  const [view, setView] = useState<PlayerView>('slides');
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [activeWordIndex, setActiveWordIndex] = useState(-1);
  const [slideVisible, setSlideVisible] = useState(true);
  const [celebrating, setCelebrating] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [gradeMode, setGradeMode] = useState(false);   // "Test Yourself" (graded) demo mode
  const [gradeResult, setGradeResult] = useState<{ firstTry: number; total: number; misses: number } | null>(null);

  // Reset grading when the slide changes
  useEffect(() => { setGradeMode(false); setGradeResult(null); }, [slideIndex]);
  // Capture a graded-assessment score posted from the sim iframe + log it for admin analytics
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data;
      if (!d || d.type !== 'wish-graded-result') return;
      setGradeResult({ firstTry: d.firstTry, total: d.total, misses: d.misses });
      try {
        fetch('/api/analytics', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'graded', module_id: module.id, key: `graded:${module.id}:${slideIndex}`,
            label: `${module.name} — ${module.slides[slideIndex]?.slide_name || ''}`,
            correct: d.total > 0 && d.firstTry === d.total,
          }),
        });
      } catch { /* ignore */ }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [module, slideIndex]);
  const [simReady, setSimReady] = useState(false);
  const [narrowLayout, setNarrowLayout] = useState(false);
  const slideAreaRef = useRef<HTMLDivElement>(null);

  const audioRef = useRef<HTMLAudioElement>(new Audio());
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number | null>(null);
  const autoPlayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressRef = useRef(progress);
  const timingsRef = useRef<Timing[] | null>(null);
  const wordsRef = useRef<string[]>([]);
  // Stores Promise so in-flight prefetches are reused instead of duplicated
  const prefetchCacheRef = useRef<Map<number, Promise<PrefetchEntry | null>>>(new Map());
  const blobUrlsRef = useRef<string[]>([]);
  const narrationTokenRef = useRef<symbol | null>(null);
  useEffect(() => { progressRef.current = progress; }, [progress]);

  useEffect(() => {
    const check = () => {
      const isSplit = window.outerWidth < window.screen.width * 0.8;
      setNarrowLayout(isSplit);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const slide = module.slides[slideIndex];
  const questions: QuizQuestion[] = quizData[module.id] ?? [];
  const isLastSlide = slideIndex === module.slides.length - 1;
  const slideText = normalizeText(slide?.text ?? '');
  const slideName = slide?.slide_name ?? '';

  // A "text-only" slide has no demo, screenshot, video, card, or image — just the script.
  // These get a centered, modern layout instead of a small card stranded in empty space.
  const s_any = slide as any;
  const isTextOnly = !!slide
    && !s_any?.simulation_url
    && !slide?.screenshot
    && slide?.video_start === undefined
    && !s_any?.acronym_card
    && !s_any?.wish_logo_card
    && !s_any?.hierarchy_card
    && !s_any?.menu_card
    && !s_any?.completion_card
    && !s_any?.next_steps_card
    && !s_any?.image_below
    && !s_any?.image_below_2;

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
    audio.onerror = () => {
      if (narrationTokenRef.current !== token) return;
      setAudioLoading(false);
      speakFallback(slideText, onEnded);
    };
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
    const _s = module.slides[slideIndex] as any;
    const hasSimulation = !!_s?.simulation_url && _s?.slide_name !== 'Next Steps';
    setSimReady(hasSimulation); // show demo immediately — no narration gate
    setSlideVisible(false);
    const updated = markSlideViewed(progressRef.current, module.id, slideIndex);
    onProgressUpdate(updated);

    // Start prefetching next slide immediately so it's ready when this one ends
    prefetchSlide(slideIndex + 1);

    const fadeTimer = setTimeout(() => setSlideVisible(true), 50);

    autoPlayRef.current = setTimeout(() => {
      playNarration(() => {
        if (isLastSlide) {
          setCelebrating(true);
        }
        // narration finished — user clicks Next manually
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
      const _s = module.slides[slideIndex] as any;
    const hasSimulation = !!_s?.simulation_url && _s?.slide_name !== 'Next Steps';
      audio.onended = () => {
        stopRaf();
        setIsPlaying(false);
      };
      return;
    }
    playNarration();
  }

  function goToSlide(index: number) {
    stopAudio();
    setSlideIndex(index);
  }

  function handleRestart() {
    // Destructive (jumps to slide 1 + clears progress) and sits next to Prev — confirm so an
    // accidental click while reaching for Prev can't silently throw the learner back to the start.
    if (!window.confirm('Restart this module from the beginning? Your progress in this module will be cleared.')) return;
    stopAudio();
    const reset = resetModuleProgress(progressRef.current, module.id);
    onProgressUpdate(reset);
    setSlideIndex(0);
    setCelebrating(false);
  }

  function handlePrev() {
    // Functional update + guard: each click moves back exactly one, even on rapid double-clicks
    // (no stale-closure jump).
    stopAudio();
    setSlideIndex(i => (i > 0 ? i - 1 : i));
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
        moduleId={module.id}
        onComplete={handleQuizComplete}
      />
    );
  }

const slidesViewed = getModuleProgress(progress, module.id).slides_viewed.length;
  const totalSlides = module.slides.length;
  const slideProgress = Math.round((slidesViewed / totalSlides) * 100);

  return (
    <div style={styles.page}>
      <TutorWidget moduleId={module.id} moduleName={module.name} />
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
      <div ref={slideAreaRef} style={{ ...styles.slideArea, padding: isMobile ? '12px' : '32px 24px', justifyContent: isTextOnly && !isMobile ? 'center' : 'flex-start' }}>
        <div style={{ ...styles.slideCard, padding: isMobile ? '20px 16px' : (isTextOnly ? '48px 56px' : '40px 48px'), maxWidth: isTextOnly ? '820px' : undefined, margin: isTextOnly ? '0 auto' : undefined, textAlign: isTextOnly ? 'center' : undefined, opacity: slideVisible ? 1 : 0, transform: slideVisible ? 'translateY(0)' : 'translateY(12px)', transition: 'opacity 0.35s ease, transform 0.35s ease' }}>
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
          </div>

          {(slide as any)?.simulation_url && (slide as any)?.slide_name !== 'Next Steps' ? (
            /* ── Responsive sim layout: side-by-side on wide, stacked on narrow ── */
            <div className={narrowLayout ? 'sim-layout sim-stacked' : 'sim-layout'}>
              {/* Text / script */}
              <div className="sim-text">
                <h2 style={{ ...styles.slideName, marginTop: 0 }}>{slideName}</h2>
                {slide?.instructions && isCleanText(slide.instructions) && (
                  <div style={styles.instructionsTag}>📹 {slide.instructions}</div>
                )}
                <div style={styles.slideContent}>
                  {slideText ? (
                    <HighlightedText text={slideText} activeWordIndex={activeWordIndex} isPlaying={isPlaying} />
                  ) : (
                    <p style={styles.emptyText}>No narration text for this slide.</p>
                  )}
                </div>
                {slideText && (
                  <button
                    style={{ ...styles.audioBtn, background: isPlaying ? '#1B3A6B' : '#D4782A', alignSelf: 'flex-start' }}
                    onClick={handlePlayNarration}
                  >
                    {audioLoading ? '⏳ Loading...' : isPlaying ? '⏸ Pause' : '▶ Play'}
                  </button>
                )}
              </div>

              {/* Interactive sim */}
              <div className="sim-demo">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', background: gradeMode ? '#B45309' : '#2e7d32', color: '#fff', fontSize: '13px', fontWeight: 600, padding: '7px 10px 7px 16px', letterSpacing: '0.3px', borderRadius: '6px 6px 0 0' }}>
                  <span>{gradeMode ? '🎯 Test yourself — no hints. Do each step.' : 'Your turn — click through the steps below'}</span>
                  <div style={{ display: 'flex', background: 'rgba(255,255,255,0.18)', borderRadius: 20, padding: 2, flexShrink: 0 }}>
                    <button onClick={() => setGradeMode(false)} style={{ border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, padding: '4px 11px', borderRadius: 18, background: !gradeMode ? '#fff' : 'transparent', color: !gradeMode ? '#1B3A6B' : '#fff' }}>Practice</button>
                    <button onClick={() => setGradeMode(true)} style={{ border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, padding: '4px 11px', borderRadius: 18, background: gradeMode ? '#fff' : 'transparent', color: gradeMode ? '#B45309' : '#fff' }}>Test Yourself</button>
                  </div>
                </div>
                <div style={{ border: `2px solid ${gradeMode ? '#B45309' : '#2e7d32'}`, borderTop: 'none', borderRadius: '0 0 6px 6px', overflow: 'hidden' }}>
                  <SimFrame key={gradeMode ? 'graded' : 'guided'} src={(slide as any).simulation_url} graded={gradeMode} />
                </div>
                {gradeMode && gradeResult && (
                  <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 8, fontSize: 13, color: '#1B3A6B', background: gradeResult.firstTry === gradeResult.total ? '#ECFDF5' : '#FFF7ED', border: `1px solid ${gradeResult.firstTry === gradeResult.total ? '#10B981' : '#F59E0B'}` }}>
                    <b>Assessment:</b> {gradeResult.firstTry}/{gradeResult.total} correct on the first try{gradeResult.misses > 0 ? ` · ${gradeResult.misses} miss${gradeResult.misses === 1 ? '' : 'es'}` : ''}. {gradeResult.firstTry === gradeResult.total ? 'Perfect — you know this flow.' : 'Switch to Practice to review, then try again.'}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ── Standard stacked layout for non-sim slides ── */
            <>
              <h2 style={styles.slideName}>{slideName}</h2>

              {slide?.instructions && (
                <div style={styles.instructionsTag}>
                  📹 {slide.instructions}
                </div>
              )}

              {/* Celebration reads first, then the script — not stranded under it. */}
              {(slide as any)?.completion_card && <CompletionCard />}

              {!(slide as any)?.wish_logo_card && (
                <div style={{ ...styles.slideContent, ...(isTextOnly ? { maxWidth: '680px', margin: '0 auto 24px' } : {}) }}>
                  {slideText ? (
                    <HighlightedText
                      text={slideText}
                      activeWordIndex={activeWordIndex}
                      isPlaying={isPlaying}
                      fontSize={isTextOnly && !isMobile ? '19px' : '16px'}
                      lineHeight={isTextOnly ? '2.0' : '1.9'}
                    />
                  ) : (
                    <p style={styles.emptyText}>No narration text for this slide.</p>
                  )}
                </div>
              )}

              {(slide as any)?.acronym_card && <WishAcronymCard />}
              {(slide as any)?.wish_logo_card && <WishLogoCard />}
              {(slide as any)?.wish_logo_card && slideText && (
                <div style={{ ...styles.slideContent, marginTop: '24px' }}>
                  <HighlightedText text={slideText} activeWordIndex={activeWordIndex} isPlaying={isPlaying} />
                </div>
              )}
              {(slide as any)?.hierarchy_card && <RecordHierarchyCard />}
              {(slide as any)?.menu_card && <RecordMenuCard items={(slide as any).menu_card} />}
              {(slide as any)?.next_steps_card && <NextStepsCard />}

              {!(slide as any)?.hierarchy_card && module.video_url && slide?.video_start !== undefined ? (
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
                <div style={{ ...styles.screenshotWrap, position: 'relative', marginLeft: isMobile ? '-16px' : '-48px', marginRight: isMobile ? '-16px' : '-48px' }}>
                  <img
                    key={slide.screenshot}
                    src={slide.screenshot}
                    alt="WISH system screenshot"
                    style={styles.screenshotImg}
                  />
                </div>
              ) : null}

              {(slide as any)?.image_below && (
                <div style={{ margin: '28px 0 8px' }}>
                  {(slide as any)?.image_below_2 && (
                    <div style={{ background: '#FFF3E8', border: '1.5px solid #D4782A', borderRadius: '8px', padding: '10px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '18px' }}>🔍</span>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: '#92400E' }}>
                        WISH keeps a full audit trail — every action is recorded under the account that performed it. Click each image to zoom in.
                      </span>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    {(slide as any)?.image_below_highlight ? (
                      <AuditImageHighlight
                        src={(slide as any).image_below}
                        highlight={(slide as any).image_below_highlight}
                        caption={(slide as any).image_below_caption || ''}
                      />
                    ) : (
                      <div style={{ flex: '1 1 110px', maxWidth: '130px' }}>
                        <img src={(slide as any).image_below} alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} style={{ width: '100%', height: 'auto', borderRadius: '10px', border: '1px solid #E5E7EB', display: 'block' }} />
                        {(slide as any)?.image_below_caption && <div style={{ background: '#FFFBEB', border: '1.5px solid #F59E0B', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '10px 14px', fontSize: '13px', color: '#78350F' }}><span style={{ fontWeight: 700 }}>What to notice: </span>{(slide as any).image_below_caption}</div>}
                      </div>
                    )}
                    {(slide as any)?.image_below_2 && (
                      (slide as any)?.image_below_2_highlight ? (
                        <AuditImageHighlight
                          src={(slide as any).image_below_2}
                          highlight={(slide as any).image_below_2_highlight}
                          caption={(slide as any).image_below_2_caption || ''}
                        />
                      ) : (
                        <div style={{ flex: '1 1 340px', maxWidth: '480px' }}>
                          <img src={(slide as any).image_below_2} alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} style={{ width: '100%', height: 'auto', borderRadius: '10px', border: '1px solid #E5E7EB', display: 'block' }} />
                          {(slide as any)?.image_below_2_caption && <div style={{ background: '#FFFBEB', border: '1.5px solid #F59E0B', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '10px 14px', fontSize: '13px', color: '#78350F' }}><span style={{ fontWeight: 700 }}>What to notice: </span>{(slide as any).image_below_2_caption}</div>}
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {slideText && (
                <button
                  style={{ ...styles.audioBtn, background: isPlaying ? '#1B3A6B' : '#D4782A' }}
                  onClick={handlePlayNarration}
                >
                  {audioLoading ? '⏳ Loading...' : isPlaying ? '⏸ Pause' : '▶ Play'}
                </button>
              )}
            </>
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
            <button
              style={{ ...styles.navBtn, padding: isMobile ? '8px 12px' : '10px 20px', fontSize: isMobile ? '13px' : '14px' }}
              onClick={handleTakeQuiz}
            >
              Quiz
            </button>
          )}
          <button
            style={{ ...styles.navBtn, ...styles.navBtnPrimary, padding: isMobile ? '8px 12px' : '10px 20px', fontSize: isMobile ? '13px' : '14px' }}
            onClick={handleNext}
          >
            {isLastSlide ? 'Complete ✓' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── WISH Logo animation card ─────────────────────────────────────────────────
function WishLogoCard() {
  const [wVisible,   setWVisible]   = useState(false);
  const [iVisible,   setIVisible]   = useState(false);
  const [sVisible,   setSVisible]   = useState(false);
  const [hVisible,   setHVisible]   = useState(false);
  // Phase 2: words slide in and STAY — all accumulate
  const [orVisible,  setOrVisible]  = useState(false); // orkforce
  const [nfVisible,  setNfVisible]  = useState(false); // nformation
  const [ysVisible,  setYsVisible]  = useState(false); // ystems
  const [osVisible,  setOsVisible]  = useState(false); // osted
  const [waveActive, setWaveActive] = useState(false);

  useEffect(() => {
    setWVisible(false); setIVisible(false); setSVisible(false); setHVisible(false);
    setOrVisible(false); setNfVisible(false); setYsVisible(false); setOsVisible(false);
    setWaveActive(false);

    const timers = [
      // ── Phase 1: letters stack in one by one ──────────────────────────
      setTimeout(() => setWVisible(true),   200),
      setTimeout(() => setIVisible(true),   900),
      setTimeout(() => setSVisible(true),  1400),
      setTimeout(() => setHVisible(true),  1900),

      // ── Phase 2: words slide in and STAY (accumulate row by row) ──────
      setTimeout(() => setOrVisible(true), 2800),   // W → orkforce
      setTimeout(() => setNfVisible(true), 3900),   // I → nformation
      setTimeout(() => setYsVisible(true), 5000),   // S → ystems
      setTimeout(() => setOsVisible(true), 6100),   // H → osted

      // ── Wave after all 4 rows are shown ───────────────────────────────
      setTimeout(() => setWaveActive(true), 7600),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const LTR = 'clamp(72px, 16vw, 130px)';
  const FONT = '"Arial Black", "Arial Bold", "Helvetica Neue", sans-serif';

  // Per-letter entrance styles; wave overrides them
  const wLetterStyle: React.CSSProperties = waveActive
    ? { display: 'inline-block', animation: 'wishWaveBounce 0.6s ease-in-out 0ms 2' }
    : { display: 'inline-block', opacity: wVisible ? 1 : 0,
        transform: wVisible ? 'none' : 'translateX(-80px) rotate(-360deg)',
        transition: 'opacity 0.7s ease, transform 0.7s cubic-bezier(0.22,1,0.36,1)' };

  const iLetterStyle: React.CSSProperties = waveActive
    ? { display: 'inline-block', animation: 'wishWaveBounce 0.6s ease-in-out 120ms 2' }
    : { display: 'inline-block', opacity: iVisible ? 1 : 0,
        transform: iVisible ? 'none' : 'translateY(-80px)',
        transition: 'opacity 0.45s ease, transform 0.5s cubic-bezier(0.34,1.56,0.64,1)' };

  const sLetterStyle: React.CSSProperties = waveActive
    ? { display: 'inline-block', animation: 'wishWaveBounce 0.6s ease-in-out 240ms 2' }
    : { display: 'inline-block', opacity: sVisible ? 1 : 0,
        transform: sVisible ? 'none' : 'translateX(100px)',
        transition: 'opacity 0.45s ease, transform 0.5s cubic-bezier(0.22,1,0.36,1)' };

  const hLetterStyle: React.CSSProperties = waveActive
    ? { display: 'inline-block', animation: 'wishWaveBounce 0.6s ease-in-out 360ms 2' }
    : hVisible
      ? { display: 'inline-block', animation: 'wishSlamIn 0.45s forwards' }
      : { display: 'inline-block', opacity: 0 };

  const restWordStyle = (visible: boolean): React.CSSProperties => ({
    display: 'inline-block',
    fontSize: 'clamp(32px, 7vw, 58px)',
    fontWeight: 900,
    fontFamily: FONT,
    color: '#1B3A6B',
    lineHeight: 1,
    paddingBottom: '6px',
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateX(0)' : 'translateX(-20px)',
    transition: 'opacity 0.5s ease, transform 0.5s cubic-bezier(0.22,1,0.36,1)',
  });

  const letterBaseStyle = {
    fontSize: LTR, fontWeight: 900, fontFamily: FONT,
    color: '#D4782A', lineHeight: 1,
  };

  return (
    <>
      <style>{`
        @keyframes wishSlamIn {
          0%   { transform: scale(4.5); opacity: 0; }
          50%  { transform: scale(0.88); opacity: 1; }
          75%  { transform: scale(1.07); }
          100% { transform: scale(1); }
        }
        @keyframes wishWaveBounce {
          0%   { transform: translateY(0); }
          35%  { transform: translateY(-26px); }
          65%  { transform: translateY(-8px); }
          100% { transform: translateY(0); }
        }
      `}</style>

      <div style={{ textAlign: 'center', padding: '32px 16px 12px', userSelect: 'none' }}>
        {/* All 4 rows always in DOM — letters animate in, words slide in and stay */}
        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>

          {/* W — orkforce */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ ...letterBaseStyle, ...wLetterStyle }}>W</span>
            <span style={restWordStyle(orVisible)}>orkforce</span>
          </div>

          {/* I — nformation */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ ...letterBaseStyle, ...iLetterStyle }}>I</span>
            <span style={restWordStyle(nfVisible)}>nformation</span>
          </div>

          {/* S — ystems */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ ...letterBaseStyle, ...sLetterStyle }}>S</span>
            <span style={restWordStyle(ysVisible)}>ystems</span>
          </div>

          {/* H — osted */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ ...letterBaseStyle, ...hLetterStyle }}>H</span>
            <span style={restWordStyle(osVisible)}>osted</span>
          </div>

        </div>
      </div>
    </>
  );
}

// ─── W.I.S.H. Acronym card ────────────────────────────────────────────────────
function WishAcronymCard() {
  const [step, setStep] = useState(-1);

  useEffect(() => {
    setStep(-1);
    // Title at 200ms, then each word 500ms apart
    const delays = [200, 700, 1200, 1700, 2200];
    const timers = delays.map((ms, i) => setTimeout(() => setStep(i), ms));
    return () => timers.forEach(clearTimeout);
  }, []);

  const shown = (i: number): React.CSSProperties => ({
    opacity: step >= i ? 1 : 0,
    transform: step >= i ? 'translateY(0)' : 'translateY(18px)',
    transition: 'opacity 0.5s cubic-bezier(0.22,1,0.36,1), transform 0.5s cubic-bezier(0.22,1,0.36,1)',
  });

  const rows: { letter: string; rest: string }[] = [
    { letter: 'W', rest: 'ORKFORCE'   },
    { letter: 'I', rest: 'NFORMATION' },
    { letter: 'S', rest: 'YSTEMS'     },
    { letter: 'H', rest: 'OSTED'      },
  ];

  return (
    <div style={{ textAlign: 'center', padding: '28px 16px 16px' }}>
      {/* Big W.I.S.H. title */}
      <div style={{
        ...shown(0),
        fontSize: 'clamp(42px, 8vw, 68px)',
        fontWeight: 900,
        color: '#1B3A6B',
        letterSpacing: '6px',
        lineHeight: 1,
        marginBottom: '28px',
      }}>
        W.I.S.H.
      </div>

      {/* One row per letter */}
      {rows.map(({ letter, rest }, i) => (
        <div key={letter} style={{
          ...shown(i + 1),
          fontSize: 'clamp(22px, 4.5vw, 36px)',
          fontWeight: 800,
          lineHeight: 1.45,
          letterSpacing: '1px',
        }}>
          <span style={{ color: '#D4782A', textShadow: '0 0 22px rgba(212,120,42,0.30)' }}>{letter}</span>
          <span style={{ color: '#1B3A6B' }}>{rest}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Record Hierarchy animated card ──────────────────────────────────────────
function RecordHierarchyCard() {
  const [step, setStep] = useState(-1);

  useEffect(() => {
    setStep(-1);
    const delays = [200, 800, 1400, 2000, 2600];
    const timers = delays.map((ms, i) => setTimeout(() => setStep(i), ms));
    return () => timers.forEach(clearTimeout);
  }, []);

  const shown = (i: number): React.CSSProperties => ({
    opacity: step >= i ? 1 : 0,
    transform: step >= i ? 'translateY(0) scale(1)' : 'translateY(22px) scale(0.95)',
    transition: 'opacity 0.5s cubic-bezier(0.22,1,0.36,1), transform 0.5s cubic-bezier(0.22,1,0.36,1)',
  });

  const levels = [
    { label: 'Company & Branch', sub: 'Already in WISH (CSC + all locations)', color: '#1B3A6B', icon: '🏢', indent: 0 },
    { label: 'Event',            sub: 'Must exist first',                        color: '#2a8a3a', icon: '1️⃣', indent: 1 },
    { label: 'Job',              sub: 'Created under an Event',                  color: '#D4782A', icon: '2️⃣', indent: 2 },
    { label: 'Shift',            sub: 'Created under a Job',                     color: '#7a4aaa', icon: '3️⃣', indent: 3 },
    { label: 'Role',             sub: 'Created under a Shift',                   color: '#c83030', icon: '4️⃣', indent: 4 },
  ];

  return (
    <div style={{ padding: '24px 8px 8px', maxWidth: 520, margin: '0 auto' }}>
      {levels.map((lvl, i) => (
        <div key={lvl.label} style={{
          ...shown(i),
          marginLeft: lvl.indent * 24,
          marginBottom: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          {lvl.indent > 0 && (
            <div style={{ width: 2, height: 10, background: '#ccc', marginLeft: -13, marginRight: 3, flexShrink: 0 }} />
          )}
          <div style={{
            background: lvl.color,
            color: '#fff',
            borderRadius: 6,
            padding: '10px 16px',
            flex: 1,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}>
            <div style={{ fontWeight: 800, fontSize: 14 }}>{lvl.icon}&nbsp; {lvl.label}</div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>{lvl.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Generic animated menu/list card ─────────────────────────────────────────
// Respects the OS "reduce motion" setting — these cards autoplay with no user
// gesture, which is exactly the case that setting exists for.
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    setReduced(mq.matches);
    const on = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

// ─── Module-complete celebration ─────────────────────────────────────────────
// Shown on every "Congratulations!" slide. The checkmark strokes itself in, then
// the ring settles and the badge/text rise — timed to land under the opening line
// of the narration rather than all at once.
function CompletionCard() {
  const [ring, setRing] = useState(false);
  const [check, setCheck] = useState(false);
  const [badge, setBadge] = useState(false);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) { setRing(true); setCheck(true); setBadge(true); return; }
    setRing(false); setCheck(false); setBadge(false);
    const t = [
      setTimeout(() => setRing(true), 250),
      setTimeout(() => setCheck(true), 800),
      setTimeout(() => setBadge(true), 1600),
    ];
    return () => t.forEach(clearTimeout);
  }, [reduced]);

  const R = 54;
  const CIRC = 2 * Math.PI * R;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '18px 0 6px' }}>
      <div style={{ position: 'relative', width: 132, height: 132 }}>
        {/* Soft pulse ring. `forwards` is load-bearing: without it the animation reverts to
            opacity:1 when it ends and paints a solid disc over the checkmark. */}
        {!reduced && check && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%', background: '#2E9E6B',
            opacity: 0, zIndex: 0,
            animation: 'wish-complete-pulse 2.4s ease-out 0.2s 2 forwards',
          }} />
        )}
        <svg width="132" height="132" viewBox="0 0 132 132" style={{ position: 'relative', zIndex: 1 }}>
          {/* opaque base so the pulse never shows through behind the mark */}
          <circle cx="66" cy="66" r={R} fill="#FFFFFF" />
          <circle cx="66" cy="66" r={R} fill="none" stroke="#E4EBF2" strokeWidth="7" />
          <circle
            cx="66" cy="66" r={R} fill="none" stroke="#2E9E6B" strokeWidth="7" strokeLinecap="round"
            transform="rotate(-90 66 66)"
            style={{
              strokeDasharray: CIRC,
              strokeDashoffset: ring ? 0 : CIRC,
              transition: reduced ? 'none' : 'stroke-dashoffset 1.1s cubic-bezier(0.65,0,0.35,1)',
            }}
          />
          <path
            d="M44 67 L59 82 L89 51" fill="none" stroke="#2E9E6B" strokeWidth="8"
            strokeLinecap="round" strokeLinejoin="round"
            style={{
              strokeDasharray: 80,
              strokeDashoffset: check ? 0 : 80,
              transition: reduced ? 'none' : 'stroke-dashoffset 0.55s cubic-bezier(0.22,1,0.36,1)',
            }}
          />
        </svg>
      </div>

      <div style={{
        marginTop: 14,
        opacity: badge ? 1 : 0,
        transform: badge ? 'none' : 'translateY(12px)',
        transition: reduced ? 'none' : 'opacity 0.5s ease, transform 0.5s cubic-bezier(0.22,1,0.36,1)',
        textAlign: 'center',
      }}>
        <div style={{
          display: 'inline-block', background: '#2E9E6B', color: '#fff', fontWeight: 800,
          fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase',
          padding: '7px 18px', borderRadius: 999,
        }}>
          Module Complete
        </div>
      </div>
    </div>
  );
}

// ─── Next Steps ──────────────────────────────────────────────────────────────
// The narration reads the support contact aloud on every module's last slide, so
// put it on screen where it can actually be written down. Steps stagger in.
function NextStepsCard() {
  const [shown, setShown] = useState(-1);
  const reduced = usePrefersReducedMotion();

  const STEPS = [
    { icon: '▶', title: 'Proceed to your next module', sub: 'If more are assigned to you', color: '#1B3A6B' },
    { icon: '📄', title: 'Refer to the Quick Reference Guide', sub: 'For step-by-step reminders', color: '#D4782A' },
    { icon: '💬', title: 'Contact your WISH Administrator', sub: 'For questions or support', color: '#2E9E6B' },
  ];

  useEffect(() => {
    if (reduced) { setShown(STEPS.length - 1); return; }
    setShown(-1);
    const t = STEPS.map((_, i) => setTimeout(() => setShown(i), 400 + i * 650));
    return () => t.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  return (
    <div style={{ maxWidth: 620, margin: '10px auto 0' }}>
      {STEPS.map((s, i) => (
        <div
          key={s.title}
          style={{
            display: 'flex', alignItems: 'center', gap: 14,
            background: '#fff', border: '1px solid #E4EBF2', borderLeft: `4px solid ${s.color}`,
            borderRadius: 10, padding: '13px 16px', marginBottom: 10,
            boxShadow: '0 1px 3px rgba(16,32,56,0.06)',
            opacity: i <= shown ? 1 : 0,
            transform: i <= shown ? 'none' : 'translateX(-18px)',
            transition: reduced ? 'none' : 'opacity 0.45s ease, transform 0.45s cubic-bezier(0.22,1,0.36,1)',
          }}
        >
          <div style={{
            flexShrink: 0, width: 34, height: 34, borderRadius: 8, background: `${s.color}14`,
            color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
          }}>{s.icon}</div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 700, fontSize: 14.5, color: '#111827' }}>{s.title}</div>
            <div style={{ fontSize: 12.5, color: '#6B7280', marginTop: 1 }}>{s.sub}</div>
          </div>
        </div>
      ))}

      <div style={{
        marginTop: 14, background: '#F4F7FA', border: '1px solid #E4EBF2', borderRadius: 10,
        padding: '14px 16px', textAlign: 'center',
        opacity: shown >= STEPS.length - 1 ? 1 : 0,
        transform: shown >= STEPS.length - 1 ? 'none' : 'translateY(10px)',
        transition: reduced ? 'none' : 'opacity 0.5s ease 0.25s, transform 0.5s ease 0.25s',
      }}>
        <div style={{
          fontSize: 10.5, fontWeight: 700, color: '#6B7280', letterSpacing: 1.2,
          textTransform: 'uppercase', marginBottom: 7,
        }}>
          For advanced permissions
        </div>
        <a href="mailto:support-wish@csc-usa.com" style={{
          color: '#1B3A6B', fontWeight: 700, fontSize: 14.5, textDecoration: 'none',
        }}>support-wish@csc-usa.com</a>
        <span style={{ color: '#C7D2DE', margin: '0 10px' }}>|</span>
        <a href="tel:8887915150" style={{
          color: '#1B3A6B', fontWeight: 700, fontSize: 14.5, textDecoration: 'none',
        }}>888-791-5150</a>
      </div>
    </div>
  );
}

function RecordMenuCard({ items }: { items: { label: string; icon?: string; color?: string }[] }) {
  const [step, setStep] = useState(-1);

  useEffect(() => {
    setStep(-1);
    const timers = items.map((_, i) => setTimeout(() => setStep(i), 300 + i * 500));
    return () => timers.forEach(clearTimeout);
  }, []);

  const colors = ['#1B3A6B','#2a8a3a','#D4782A','#7a4aaa','#c83030','#1a7a8a','#8a6a1a'];
  const icons  = ['📋','👥','📄','🎪','🏟️','📊','⚙️'];

  return (
    <div style={{ padding: '24px 8px 8px', maxWidth: 480, margin: '0 auto' }}>
      {items.map((item, i) => {
        const color = item.color || colors[i % colors.length];
        const icon  = item.icon  || icons[i % icons.length];
        const visible = step >= i;
        return (
          <div key={i} style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateX(0)' : 'translateX(-28px)',
            transition: 'opacity 0.45s cubic-bezier(0.22,1,0.36,1), transform 0.45s cubic-bezier(0.22,1,0.36,1)',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            background: '#fff',
            border: `2px solid ${color}`,
            borderLeft: `6px solid ${color}`,
            borderRadius: 7,
            padding: '11px 16px',
            marginBottom: 10,
            boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
          }}>
            <span style={{ fontSize: 22 }}>{icon}</span>
            <span style={{ fontWeight: 700, fontSize: 15, color }}>{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Animated cursor overlay for screenshots ─────────────────────────────────
function AnimatedCursor({ key: _key }: { key?: number }) {
  const [pos, setPos] = useState({ x: 55, y: 45 });
  const [ripple, setRipple] = useState(false);
  const idxRef = useRef(0);

  useEffect(() => {
    if (!document.getElementById('wish-cursor-style')) {
      const s = document.createElement('style');
      s.id = 'wish-cursor-style';
      s.textContent = `@keyframes wish-ripple { 0% { transform:scale(0.3); opacity:0.9; } 100% { transform:scale(2.8); opacity:0; } }`;
      document.head.appendChild(s);
    }
  }, []);

  useEffect(() => {
    const waypoints = [
      { x: 45, y: 40, click: false },
      { x: 22, y: 28, click: false },
      { x: 50, y: 20, click: false },
      { x: 55, y: 33, click: true  },
      { x: 62, y: 50, click: false },
      { x: 22, y: 48, click: false },
      { x: 43, y: 45, click: false },
      { x: 54, y: 62, click: true  },
      { x: 40, y: 24, click: false },
      { x: 63, y: 65, click: false },
    ];
    idxRef.current = 0;
    setPos(waypoints[0]);

    const interval = setInterval(() => {
      idxRef.current = (idxRef.current + 1) % waypoints.length;
      const wp = waypoints[idxRef.current];
      setPos({ x: wp.x, y: wp.y });
      if (wp.click) {
        setTimeout(() => { setRipple(true); setTimeout(() => setRipple(false), 600); }, 750);
      }
    }, 2200);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 5 }}>
      <div style={{
        position: 'absolute',
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        transition: 'left 0.95s cubic-bezier(0.25,0.46,0.45,0.94), top 0.95s cubic-bezier(0.25,0.46,0.45,0.94)',
        filter: 'drop-shadow(1px 2px 4px rgba(0,0,0,0.55))',
      }}>
        <svg width="18" height="22" viewBox="0 0 18 22" style={{ display: 'block' }}>
          <path d="M1 1 L1 17 L5 13 L8 20 L10 19 L7 12 L13 12 Z" fill="white" stroke="#222" strokeWidth="1.2" strokeLinejoin="round"/>
        </svg>
        {ripple && (
          <div style={{
            position: 'absolute', top: '-6px', left: '-6px',
            width: '24px', height: '24px', borderRadius: '50%',
            border: '2px solid #D4782A',
            animation: 'wish-ripple 0.55s ease-out forwards',
          }} />
        )}
      </div>
    </div>
  );
}

// ─── Highlighted text renderer ────────────────────────────────────────────────
function HighlightedText({
  text,
  activeWordIndex,
  isPlaying,
  fontSize = '16px',
  lineHeight = '1.9',
}: {
  text: string;
  activeWordIndex: number;
  isPlaying: boolean;
  fontSize?: string;
  lineHeight?: string;
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
          <p key={pi} style={{ fontSize, lineHeight, marginBottom: '14px' }}>
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
    marginLeft: '-48px',
    marginRight: '-48px',
    borderRadius: '0',
    overflow: 'hidden',
    borderTop: '2px solid #E5E7EB',
    borderBottom: '2px solid #E5E7EB',
    background: '#f4f4f4',
    lineHeight: 0,
    textAlign: 'center' as const,
  },
  screenshotImg: {
    width: '100%',
    maxWidth: '900px',
    maxHeight: '420px',
    height: 'auto',
    display: 'inline-block',
    objectFit: 'contain' as const,
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
    padding: '6px 14px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
    marginBottom: '20px',
    display: 'inline-block',
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
