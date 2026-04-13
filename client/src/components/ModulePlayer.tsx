import React, { useState, useEffect, useRef } from 'react';
import { Module, CourseProgress, QuizQuestion } from '../types';
import { getModuleProgress, markSlideViewed, markModuleComplete } from '../utils/progress';
import quizData from '../utils/quizData';
import Quiz from './Quiz';

interface Props {
  module: Module;
  moduleIndex: number;
  totalModules: number;
  progress: CourseProgress;
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
  onProgressUpdate,
  onComplete,
  onBack,
}: Props) {
  const mp = getModuleProgress(progress, module.id);
  const [slideIndex, setSlideIndex] = useState(mp.last_slide ?? 0);
  const [view, setView] = useState<PlayerView>('slides');
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [activeWordIndex, setActiveWordIndex] = useState(-1);

  // Single persistent audio element — created once, never recreated
  const audioRef = useRef<HTMLAudioElement>(new Audio());
  const rafRef = useRef<number | null>(null);
  // Keep latest progress in a ref to avoid stale closures in effects
  const progressRef = useRef(progress);
  useEffect(() => { progressRef.current = progress; }, [progress]);

  const slide = module.slides[slideIndex];
  const questions: QuizQuestion[] = quizData[module.id] ?? [];
  const isLastSlide = slideIndex === module.slides.length - 1;
  const slideText = slide?.text ?? '';
  const slideName = slide?.slide_name ?? '';

  // Stop word highlight loop
  function stopRaf() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setActiveWordIndex(-1);
  }

  // Kick off word highlight using exact Whisper timestamps
  // Falls back to character-weight estimation if timing file not available
  function startWordHighlight(
    audio: HTMLAudioElement,
    words: string[],
    timings: {word: string; start: number; end: number}[] | null
  ) {
    stopRaf();

    if (timings && timings.length > 0) {
      const t = timings; // narrow type for closure
      const tick = () => {
        const ct = audio.currentTime;
        let lo = 0, hi = t.length - 1, idx = 0;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          if (t[mid].start <= ct) { idx = mid; lo = mid + 1; }
          else hi = mid - 1;
        }
        setActiveWordIndex(idx);
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

  // Stop audio completely
  function stopAudio() {
    const audio = audioRef.current;
    audio.oncanplaythrough = null;
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    audio.currentTime = 0;
    audio.src = '';
    window.speechSynthesis?.cancel();
    stopRaf();
    setIsPlaying(false);
    setAudioLoading(false);
  }

  // Stop audio and mark slide viewed whenever slide changes
  useEffect(() => {
    stopAudio();
    const updated = markSlideViewed(progressRef.current, module.id, slideIndex);
    onProgressUpdate(updated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideIndex]);

  // Stop everything when component unmounts (Back button, quiz, etc.)
  useEffect(() => {
    return () => stopAudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handlePlayNarration() {
    if (isPlaying) {
      stopAudio();
      return;
    }
    if (!slideText.trim()) return;

    const audio = audioRef.current;
    const audioPath = `/audio/${module.id}/slide_${slide.original_index}.mp3`;

    // Clear any previous listeners before setting new ones
    audio.oncanplaythrough = null;
    audio.onended = null;
    audio.onerror = null;

    setAudioLoading(true);

    const words = slideText.trim().split(/\s+/);
    const timingPath = `/audio/${module.id}/slide_${slide.original_index}.json`;

    // Fetch timing data and audio in parallel
    let timings: {word: string; start: number; end: number}[] | null = null;
    fetch(timingPath)
      .then(r => r.ok ? r.json() : null)
      .then(data => { timings = data; })
      .catch(() => { timings = null; });

    audio.oncanplaythrough = () => {
      setAudioLoading(false);
      setIsPlaying(true);
      audio.play();
      startWordHighlight(audio, words, timings);
    };

    audio.onended = () => {
      stopRaf();
      setIsPlaying(false);
    };

    audio.onerror = () => {
      setAudioLoading(false);
      speakFallback(slideText);
    };

    audio.src = audioPath;
    audio.load();
  }

  function speakFallback(text: string) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Alex')
    );
    if (preferred) utterance.voice = preferred;
    utterance.onend = () => setIsPlaying(false);
    setIsPlaying(true);
    window.speechSynthesis.speak(utterance);
  }

  function handlePrev() {
    if (slideIndex > 0) setSlideIndex(slideIndex - 1);
  }

  function handleNext() {
    if (isLastSlide) {
      stopAudio();
      if (questions.length > 0) {
        setView('quiz');
      } else {
        const updated = markModuleComplete(progressRef.current, module.id, 100, true);
        onComplete(updated);
      }
    } else {
      setSlideIndex(slideIndex + 1);
    }
  }

  function handleQuizComplete(score: number, passed: boolean) {
    const updated = markModuleComplete(progressRef.current, module.id, score, passed);
    if (passed) {
      onComplete(updated);
    } else {
      onProgressUpdate(updated);
      setSlideIndex(0);
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
      <div style={styles.topBar}>
        <button style={styles.backBtn} onClick={() => { stopAudio(); onBack(); }}>
          ← Back
        </button>
        <div style={styles.topCenter}>
          <div style={styles.brandMark}>
            <span style={styles.brandWish}>WISH</span>
          </div>
          <span style={styles.moduleBadge}>Module {moduleIndex + 1} of {totalModules}</span>
          <span style={styles.moduleTitle}>{module.name}</span>
        </div>
        <div style={styles.topRight}>
          <div style={styles.miniProgress}>
            <div style={{ ...styles.miniProgressFill, width: `${slideProgress}%` }} />
          </div>
          <span style={styles.miniProgressLabel}>{slidesViewed}/{totalSlides}</span>
        </div>
      </div>

      {/* Slide area */}
      <div style={styles.slideArea}>
        <div style={styles.slideCard}>
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
              {audioLoading ? '⏳ Loading...' : isPlaying ? '⏸ Pause Narration' : '▶ Play Narration'}
            </button>
          )}
        </div>
      </div>

      {/* Bottom navigation */}
      <div style={styles.bottomBar}>
        <div style={styles.slideDots}>
          {module.slides.map((_, i) => (
            <div
              key={i}
              style={{
                ...styles.dot,
                background: i === slideIndex
                  ? '#D4782A'
                  : getModuleProgress(progress, module.id).slides_viewed.includes(i)
                  ? '#5BBCB0'
                  : '#E5E7EB',
                width: i === slideIndex ? '24px' : '8px',
              }}
            />
          ))}
        </div>

        <div style={styles.navBtns}>
          <button
            style={{ ...styles.navBtn, opacity: slideIndex === 0 ? 0.4 : 1 }}
            disabled={slideIndex === 0}
            onClick={handlePrev}
          >
            ← Previous
          </button>
          <button style={{ ...styles.navBtn, ...styles.navBtnPrimary }} onClick={handleNext}>
            {isLastSlide
              ? questions.length > 0 ? 'Take Knowledge Check →' : 'Complete Module ✓'
              : 'Next →'}
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
  // Split into paragraphs, then track global word index across paragraphs
  const paragraphs = text.split('\n').filter(Boolean);
  let globalIndex = 0;

  return (
    <>
      {paragraphs.map((para, pi) => {
        const words = para.split(/(\s+)/); // keep whitespace tokens
        const elements: React.ReactNode[] = [];

        for (let i = 0; i < words.length; i++) {
          const token = words[i];
          if (/^\s+$/.test(token)) {
            elements.push(token);
            continue;
          }
          const wordIdx = globalIndex;
          const isActive = isPlaying && wordIdx === activeWordIndex;
          const isPast = isPlaying && wordIdx < activeWordIndex;
          elements.push(
            <span
              key={`${pi}-${i}`}
              style={{
                backgroundColor: isActive ? '#D4782A' : 'transparent',
                color: isActive ? '#FFFFFF' : isPast ? '#9CA3AF' : '#374151',
                borderRadius: isActive ? '3px' : '0',
                padding: isActive ? '1px 3px' : '1px 0',
                transition: 'background-color 0.1s, color 0.1s',
                display: 'inline',
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
  slideArea: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 24px' },
  slideCard: {
    background: '#FFFFFF',
    borderRadius: '16px',
    padding: '40px 48px',
    width: '100%',
    maxWidth: '820px',
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
  slideName: { fontSize: '26px', fontWeight: 800, color: '#1B3A6B', marginBottom: '20px', lineHeight: '1.3' },
  slideContent: { marginBottom: '24px' },
  slidePara: { fontSize: '16px', color: '#374151', lineHeight: '1.8', marginBottom: '14px' },
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
  slideDots: { display: 'flex', gap: '4px', alignItems: 'center', flex: 1, flexWrap: 'wrap', maxWidth: '60%' },
  dot: { height: '8px', borderRadius: '4px', transition: 'all 0.25s' },
  navBtns: { display: 'flex', gap: '12px' },
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
};
