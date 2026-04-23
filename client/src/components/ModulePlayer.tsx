import React, { useState, useEffect, useRef } from 'react';
import { Module, CourseProgress, QuizQuestion } from '../types';
import { getModuleProgress, markSlideViewed, markModuleComplete, resetModuleProgress } from '../utils/progress';
import Quiz from './Quiz';
import Character from './Character';

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
  const [slideIndex, setSlideIndex] = useState(mp.last_slide ?? 0);
  const [view, setView] = useState<PlayerView>('slides');
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [activeWordIndex, setActiveWordIndex] = useState(-1);
  const [slideVisible, setSlideVisible] = useState(true);
  const [celebrating, setCelebrating] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  const audioRef = useRef<HTMLAudioElement>(new Audio());
  const rafRef = useRef<number | null>(null);
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoPlayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressRef = useRef(progress);
  const timingsRef = useRef<{word: string; start: number; end: number}[] | null>(null);
  const wordsRef = useRef<string[]>([]);
  useEffect(() => { progressRef.current = progress; }, [progress]);

  const slide = module.slides[slideIndex];
  const questions: QuizQuestion[] = quizData[module.id] ?? [];
  const isLastSlide = slideIndex === module.slides.length - 1;
  const slideText = slide?.text ?? '';
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
    timings: {word: string; start: number; end: number}[] | null
  ) {
    stopRaf();

    if (timings && timings.length > 0) {
      const t = timings;

      // Build timing index → display word index mapping by aligning on normalized text
      const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
      const displayNorm = words.map(norm);
      const timingToDisplay: number[] = new Array(t.length).fill(-1);
      let displayCursor = 0;
      for (let ti = 0; ti < t.length; ti++) {
        const tw = norm(t[ti].word);
        // Search forward in display words for a match
        for (let di = displayCursor; di < Math.min(displayCursor + 6, displayNorm.length); di++) {
          if (displayNorm[di] === tw || displayNorm[di].startsWith(tw) || tw.startsWith(displayNorm[di])) {
            timingToDisplay[ti] = di;
            displayCursor = di + 1;
            break;
          }
        }
        // If no match found, map to cursor position anyway
        if (timingToDisplay[ti] === -1 && displayCursor < displayNorm.length) {
          timingToDisplay[ti] = displayCursor;
        }
      }

      const tick = () => {
        const ct = audio.currentTime;
        let lo = 0, hi = t.length - 1, idx = 0;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          if (t[mid].start <= ct) { idx = mid; lo = mid + 1; }
          else hi = mid - 1;
        }
        const displayIdx = timingToDisplay[idx];
        if (displayIdx !== -1) setActiveWordIndex(displayIdx);
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
    const audio = audioRef.current;
    audio.oncanplaythrough = null;
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

  function playNarration(onEnded?: () => void) {
    if (!slideText.trim()) { onEnded?.(); return; }

    const audio = audioRef.current;
    const audioIndex = slide.original_index ?? ((slide.slide_number ?? 1) - 1);
    const audioPath = `/audio/${module.id}/slide_${audioIndex}.mp3`;

    audio.oncanplaythrough = null;
    audio.onended = null;
    audio.onerror = null;

    setAudioLoading(true);

    const words = slideText.trim().split(/\s+/);
    wordsRef.current = words;
    timingsRef.current = null;

    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const firstTextWord = norm(words[0] ?? '');
    const oi = audioIndex;

    // Try loading timing — prefer the file whose first word matches the first text word.
    // Some modules have timing files offset by -1 from the original_index.
    async function loadTimings() {
      for (const idx of [oi, oi - 1, oi + 1]) {
        if (idx < 0) continue;
        try {
          const r = await fetch(`/audio/${module.id}/slide_${idx}.json`);
          if (!r.ok) continue;
          const data: {word: string; start: number; end: number}[] = await r.json();
          if (!data?.length) continue;
          if (norm(data[0].word) === firstTextWord) { timingsRef.current = data; return; }
          // Keep as fallback if no better match found
          if (!timingsRef.current) timingsRef.current = data;
        } catch { /* skip */ }
      }
    }
    loadTimings();

    audio.oncanplaythrough = () => {
      setAudioLoading(false);
      setIsPlaying(true);
      audio.play();
      startWordHighlight(audio, words, timingsRef.current);
    };

    audio.onended = () => {
      stopRaf();
      setIsPlaying(false);
      onEnded?.();
    };

    audio.onerror = () => {
      // Try ElevenLabs API with word timestamps, fall back to browser TTS if unavailable
      setAudioLoading(true);
      fetch('/api/narrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: slideText }),
      })
        .then(res => {
          if (!res.ok) throw new Error('narrate failed');
          return res.json();
        })
        .then(({ audio: b64, timings }) => {
          // Use exact word timings from ElevenLabs
          timingsRef.current = timings ?? null;
          const binary = atob(b64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
          audio.oncanplaythrough = null;
          audio.onerror = null;
          audio.onended = () => { URL.revokeObjectURL(url); stopRaf(); setIsPlaying(false); onEnded?.(); };
          audio.oncanplaythrough = () => {
            setAudioLoading(false);
            setIsPlaying(true);
            audio.playbackRate = playbackRate;
            audio.play();
            startWordHighlight(audio, words, timingsRef.current);
          };
          audio.src = url;
          audio.load();
        })
        .catch(() => {
          setAudioLoading(false);
          speakFallback(slideText, onEnded);
        });
    };

    audio.src = audioPath;
    audio.load();
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

  // Auto-play narration 600ms after slide loads, then auto-advance 1.5s after it ends
  useEffect(() => {
    stopAudio();
    setSlideVisible(false);
    const updated = markSlideViewed(progressRef.current, module.id, slideIndex);
    onProgressUpdate(updated);

    // Fade in
    const fadeTimer = setTimeout(() => setSlideVisible(true), 50);

    // Auto-play after brief pause
    autoPlayRef.current = setTimeout(() => {
      playNarration(() => {
        // Auto-advance after narration ends (only if not last slide)
        if (!isLastSlide) {
          autoAdvanceRef.current = setTimeout(() => {
            handleNext();
          }, 1500);
        } else {
          setCelebrating(true);
        }
      });
    }, 600);

    return () => {
      clearTimeout(fadeTimer);
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideIndex]);

  useEffect(() => {
    return () => stopAudio();
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
        <div style={{ ...styles.slideCard, opacity: slideVisible ? 1 : 0, transform: slideVisible ? 'translateY(0)' : 'translateY(12px)', transition: 'opacity 0.35s ease, transform 0.35s ease' }}>
          {/* Character inline top-right */}
          <div style={{ position: 'absolute', top: '-60px', right: '24px' }}>
            <Character state={celebrating ? 'celebrating' : isPlaying ? 'talking' : 'idle'} />
          </div>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button
                style={{ ...styles.audioBtn, background: isPlaying ? '#1B3A6B' : '#D4782A' }}
                onClick={handlePlayNarration}
                disabled={audioLoading}
              >
                {audioLoading ? '⏳ Loading...' : isPlaying ? '⏸ Pause' : '▶ Resume'}
              </button>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                {[0.75, 1, 1.25, 1.5].map(rate => (
                  <button
                    key={rate}
                    onClick={() => {
                      setPlaybackRate(rate);
                      audioRef.current.playbackRate = rate;
                    }}
                    style={{
                      padding: '6px 10px',
                      fontSize: '12px',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border: '2px solid',
                      cursor: 'pointer',
                      borderColor: playbackRate === rate ? '#D4782A' : '#E5E7EB',
                      background: playbackRate === rate ? '#FFF3E8' : '#F9FAFB',
                      color: playbackRate === rate ? '#D4782A' : '#6B7280',
                      transition: 'all 0.15s',
                    }}
                  >
                    {rate === 1 ? '1×' : `${rate}×`}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom navigation */}
      <div style={styles.bottomBar}>
        <div style={styles.slideDots}>
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
                width: i === slideIndex ? '24px' : '8px',
                cursor: 'pointer',
              }}
            />
          ))}
        </div>

        <div style={styles.navBtns}>
          <button style={{ ...styles.navBtn, ...styles.navBtnRestart }} onClick={handleRestart}>
            ↺ Restart
          </button>
          <button
            style={{ ...styles.navBtn, opacity: slideIndex === 0 ? 0.4 : 1 }}
            disabled={slideIndex === 0}
            onClick={handlePrev}
          >
            ← Previous
          </button>
          {isLastSlide && questions.length > 0 && (
            <button style={{ ...styles.navBtn }} onClick={handleTakeQuiz}>
              Take Quiz
            </button>
          )}
          <button style={{ ...styles.navBtn, ...styles.navBtnPrimary }} onClick={handleNext}>
            {isLastSlide ? 'Complete Module ✓' : 'Next →'}
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
  slideName: { fontSize: '26px', fontWeight: 800, color: '#1B3A6B', marginBottom: '20px', lineHeight: '1.3' },
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
