import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Module, CourseProgress } from '../types';
import { getModuleProgress, getOverallCompletion } from '../utils/progress';

interface Props {
  modules: Module[];
  progress: CourseProgress;
  onStartModule: (index: number) => void;
}

export default function Dashboard({ modules, progress, onStartModule }: Props) {
  const overall = getOverallCompletion(progress, modules.length);
  const [animatedPct, setAnimatedPct] = useState(0);
  const confettiFiredRef = useRef(false);

  // Animate progress ring on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedPct(overall);
    }, 150);
    return () => clearTimeout(timer);
  }, [overall]);

  // Fire confetti once when 100%
  useEffect(() => {
    if (overall === 100 && !confettiFiredRef.current) {
      confettiFiredRef.current = true;
      setTimeout(() => {
        confetti({ particleCount: 180, spread: 90, origin: { y: 0.5 }, colors: ['#D4782A', '#5BBCB0', '#C8D46A', '#1B3A6B'] });
      }, 400);
    }
  }, [overall]);

  function getModuleStatus(index: number): 'locked' | 'available' | 'in_progress' | 'completed' {
    const mod = modules[index];
    const mp = getModuleProgress(progress, mod.id);
    if (mp.completed) return 'completed';
    if (mp.started) return 'in_progress';
    if (index === 0) return 'available';
    const prevMod = modules[index - 1];
    const prevMp = getModuleProgress(progress, prevMod.id);
    if (prevMp.completed) return 'available';
    return 'locked';
  }

  const statusConfig = {
    completed: { color: '#10B981', bg: '#ECFDF5', border: '#10B981', icon: '✓', label: 'Completed' },
    in_progress: { color: '#D4782A', bg: '#FFF7ED', border: '#D4782A', icon: '▶', label: 'In Progress' },
    available: { color: '#1B3A6B', bg: '#EFF6FF', border: '#1B3A6B', icon: '○', label: 'Start' },
    locked: { color: '#9CA3AF', bg: '#F9FAFB', border: '#E5E7EB', icon: '🔒', label: 'Locked' },
  };

  const circumference = 2 * Math.PI * 34;

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.brandMark}>
          <span style={styles.brandWish}>WISH</span>
          <span style={styles.brandSub}>Training Portal</span>
        </div>
        <div style={styles.userInfo}>
          <span style={styles.userName}>{progress.user_name}</span>
          <span style={styles.userEmail}>{progress.user_email}</span>
        </div>
      </div>

      <div style={styles.content}>
        {/* Progress overview */}
        <div style={styles.overviewCard}>
          <div style={styles.overviewLeft}>
            <h2 style={styles.overviewTitle}>Training Progress</h2>
            <p style={styles.overviewSub}>
              {Object.values(progress.modules).filter(m => m.completed).length} of {modules.length} modules completed
            </p>
          </div>
          <div style={styles.overviewRight}>
            <svg width="80" height="80" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="34" fill="none" stroke="#E5E7EB" strokeWidth="8" />
              <circle
                cx="40" cy="40" r="34"
                fill="none"
                stroke="#D4782A"
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - animatedPct / 100)}
                strokeLinecap="round"
                transform="rotate(-90 40 40)"
                style={{ transition: 'stroke-dashoffset 1s ease' }}
              />
              <text x="40" y="46" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#1B3A6B">
                {overall}%
              </text>
            </svg>
          </div>
        </div>

        {/* Module grid */}
        <h3 style={styles.sectionTitle}>Training Modules</h3>
        <div style={styles.grid}>
          {modules.map((mod, index) => {
            const status = getModuleStatus(index);
            const cfg = statusConfig[status];
            const mp = getModuleProgress(progress, mod.id);

            return (
              <div
                key={mod.id}
                style={{
                  ...styles.moduleCard,
                  borderColor: cfg.border,
                  background: cfg.bg,
                  cursor: status === 'locked' ? 'not-allowed' : 'pointer',
                  opacity: status === 'locked' ? 0.6 : 1,
                }}
                onClick={() => status !== 'locked' && onStartModule(index)}
              >
                <div style={styles.moduleHeader}>
                  <span style={{ ...styles.moduleNumber, color: cfg.color }}>
                    Module {index + 1}
                  </span>
                  <span style={{ ...styles.statusBadge, color: cfg.color, borderColor: cfg.color }}>
                    {cfg.icon} {cfg.label}
                  </span>
                </div>
                <h4 style={{ ...styles.moduleName, color: cfg.color === '#9CA3AF' ? '#9CA3AF' : '#1B3A6B' }}>
                  {mod.name}
                </h4>
                <p style={styles.moduleSlides}>{mod.slides.length} slides</p>

                {mp.quiz_score !== null && (
                  <div style={styles.quizScore}>
                    Quiz: {mp.quiz_score}% {mp.quiz_passed ? '✓' : '✗'}
                  </div>
                )}

                {status === 'in_progress' && (
                  <div style={styles.progressBar}>
                    <div
                      style={{
                        ...styles.progressFill,
                        width: `${Math.round((mp.slides_viewed.length / mod.slides.length) * 100)}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {overall === 100 && (
          <div style={styles.completionBanner}>
            🎉 Congratulations, {progress.user_name}! You have completed all WISH training modules.
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#F4F7FA', display: 'flex', flexDirection: 'column' },
  header: {
    background: 'linear-gradient(90deg, #5BBCB0 0%, #C8D46A 100%)',
    padding: '0 32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: '0 2px 12px rgba(91,188,176,0.4)',
    height: '72px',
    overflow: 'hidden',
  },
  brandMark: { display: 'flex', flexDirection: 'column', lineHeight: 1 },
  brandWish: { fontSize: '32px', fontWeight: 900, color: '#D4782A', letterSpacing: '2px', textShadow: '0 1px 3px rgba(27,58,107,0.2)' },
  brandSub: { fontSize: '11px', fontWeight: 700, color: '#1B3A6B', letterSpacing: '2px', textTransform: 'uppercase' as const, opacity: 0.8 },
  userInfo: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end' },
  userName: { color: '#1B3A6B', fontWeight: 700, fontSize: '15px' },
  userEmail: { color: '#1B3A6B', fontSize: '12px', opacity: 0.7 },
  content: { maxWidth: '1100px', margin: '0 auto', padding: '32px 24px', width: '100%' },
  overviewCard: {
    background: '#FFFFFF',
    borderRadius: '12px',
    padding: '28px 32px',
    marginBottom: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    borderLeft: '5px solid #D4782A',
  },
  overviewLeft: {},
  overviewTitle: { fontSize: '22px', fontWeight: 700, color: '#1B3A6B', marginBottom: '6px' },
  overviewSub: { fontSize: '14px', color: '#6B7280' },
  overviewRight: {},
  sectionTitle: { fontSize: '16px', fontWeight: 700, color: '#1B3A6B', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', marginBottom: '32px' },
  moduleCard: {
    background: '#FFFFFF',
    border: '2px solid',
    borderRadius: '10px',
    padding: '20px',
    transition: 'transform 0.15s, box-shadow 0.15s',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  },
  moduleHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
  moduleNumber: { fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' },
  statusBadge: { fontSize: '11px', fontWeight: 600, border: '1px solid', borderRadius: '20px', padding: '2px 10px' },
  moduleName: { fontSize: '15px', fontWeight: 700, marginBottom: '6px', lineHeight: '1.3' },
  moduleSlides: { fontSize: '12px', color: '#9CA3AF', marginBottom: '8px' },
  quizScore: { fontSize: '12px', fontWeight: 600, color: '#5BBCB0', marginTop: '8px' },
  progressBar: { height: '4px', background: '#E5E7EB', borderRadius: '2px', marginTop: '12px', overflow: 'hidden' },
  progressFill: { height: '100%', background: '#D4782A', borderRadius: '2px', transition: 'width 0.4s' },
  completionBanner: {
    background: 'linear-gradient(135deg, #10B981, #059669)',
    color: '#FFFFFF',
    padding: '20px 28px',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: 600,
    textAlign: 'center',
    boxShadow: '0 4px 16px rgba(16,185,129,0.3)',
  },
};
