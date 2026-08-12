import React, { useEffect, useState } from 'react';
import { QuizQuestion, QuizSession, shuffledOrder } from '../types';
import { useIsMobile } from '../utils/useIsMobile';

interface Props {
  questions: QuizQuestion[];
  moduleName: string;
  moduleId?: string;
  session: QuizSession;
  onSessionChange: (next: QuizSession) => void;
  /** Send the learner back to a slide to re-read the material. null = no match found. */
  onReview: (questionIndex: number) => void;
  /** True when the matcher found a slide for the current question. */
  canReview: boolean;
  onComplete: (score: number, passed: boolean) => void;
}

const PASS_SCORE = 80;
const MAX_WRONG_PER_ROUND = 2; // two misses and you go back to the material

// Fire-and-forget: record each quiz answer so admins can see which questions trip people up
function recordQuizAnswer(moduleId: string | undefined, q: QuizQuestion, idx: number, correct: boolean) {
  try {
    fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'quiz',
        module_id: moduleId,
        key: `${moduleId || 'mod'}:q${idx}`,
        label: q.question?.slice(0, 200),
        correct,
      }),
    }).catch(() => {});
  } catch { /* never block the quiz */ }
}

export default function Quiz({
  questions, moduleName, moduleId, session, onSessionChange, onReview, canReview, onComplete,
}: Props) {
  const isMobile = useIsMobile();
  const [selected, setSelected] = useState<number | null>(null);

  const { currentQ, answers, locked, wrongThisRound, reviewCount, solved, showResults } = session;
  const question = questions[currentQ];
  const isLast = currentQ === questions.length - 1;

  // A fresh question (or a return from review) always starts with nothing selected
  useEffect(() => { setSelected(null); }, [currentQ, wrongThisRound, reviewCount]);

  // Build the display order once per question. `order` maps display position →
  // original option index, so `locked` (original indices) survives a reshuffle.
  const optionsLength = question?.options?.length ?? 0;
  useEffect(() => {
    if (session.order.length === optionsLength) return;
    onSessionChange({
      ...session,
      order: session.shuffle ? shuffledOrder(optionsLength) : Array.from({ length: optionsLength }, (_, i) => i),
    });
  }); // runs after every render until the order matches the current question
  const order = session.order.length === optionsLength
    ? session.order
    : Array.from({ length: optionsLength }, (_, i) => i);

  // Locked out: two misses this round, or every wrong option has been ruled out
  const optionCount = question?.options?.length ?? 0;
  const needsReview = !solved && (
    wrongThisRound >= MAX_WRONG_PER_ROUND || (optionCount > 0 && locked.length >= optionCount - 1)
  );

  function handleSelect(index: number) {
    if (solved || needsReview || locked.includes(index)) return;
    setSelected(index);
  }

  function handleSubmit() {
    if (selected === null || solved || needsReview) return;

    if (selected === question.correct_index) {
      onSessionChange({ ...session, solved: true });
      return;
    }
    // Wrong: rule that option out. We never reveal which one is right.
    onSessionChange({
      ...session,
      locked: [...locked, selected],
      wrongThisRound: wrongThisRound + 1,
    });
    setSelected(null);
  }

  function handleNext() {
    // Score on first-try mastery: no misses and no review trips on this question
    const firstTry = locked.length === 0 && reviewCount === 0;
    recordQuizAnswer(moduleId, question, currentQ, firstTry);
    const newAnswers = [...answers, firstTry];

    if (isLast) {
      onSessionChange({ ...session, answers: newAnswers, showResults: true });
      return;
    }
    onSessionChange({
      ...session,
      answers: newAnswers,
      currentQ: currentQ + 1,
      locked: [],
      wrongThisRound: 0,
      reviewCount: 0,
      solved: false,
      order: [], // rebuilt for the next question on render
    });
  }

  if (showResults) {
    const score = Math.round((answers.filter(Boolean).length / questions.length) * 100);
    const passed = score >= PASS_SCORE;
    return (
      <div style={styles.page}>
        <div style={{ ...styles.resultsCard, padding: isMobile ? '32px 20px' : '48px 40px' }}>
          <div style={{ ...styles.scoreCircle, borderColor: passed ? '#10B981' : '#EF4444' }}>
            <span style={{ ...styles.scoreNumber, color: passed ? '#10B981' : '#EF4444' }}>{score}%</span>
            <span style={styles.scoreLabel}>Score</span>
          </div>
          <h2 style={styles.resultTitle}>{passed ? 'Module Passed!' : 'Review Needed'}</h2>
          <p style={styles.resultSub}>
            {passed
              ? `You answered ${answers.filter(Boolean).length} of ${questions.length} questions correctly on the first try. Great work!`
              : `You answered ${answers.filter(Boolean).length} of ${questions.length} questions correctly on the first try. A score of ${PASS_SCORE}% or higher is required to pass ${moduleName}.`}
          </p>
          <button
            style={{ ...styles.btn, background: passed ? '#10B981' : '#D4782A' }}
            onClick={() => onComplete(score, passed)}
          >
            {passed ? 'Continue to Dashboard' : 'Retake Module'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={{ ...styles.card, padding: isMobile ? '24px 16px' : '40px' }}>
        {/* Header */}
        <div style={styles.quizHeader}>
          <span style={styles.quizTag}>Knowledge Check</span>
          <span style={styles.quizProgress}>{currentQ + 1} / {questions.length}</span>
        </div>
        <div style={styles.progressBar}>
          <div style={{ ...styles.progressFill, width: `${((currentQ + 1) / questions.length) * 100}%` }} />
        </div>

        <h2 style={{ ...styles.question, fontSize: isMobile ? '17px' : '20px' }}>{question.question}</h2>

        {reviewCount > 0 && !solved && !needsReview && (
          <div style={styles.retryNote}>
            You reviewed the material — try again. Options you already ruled out stay locked.
          </div>
        )}

        <div style={styles.options}>
          {order.map((i, pos) => {
            const opt = question.options[i];
            const isLocked = locked.includes(i);
            const isRight = solved && i === question.correct_index;
            let optStyle = { ...styles.option };
            if (isRight) optStyle = { ...optStyle, ...styles.optionCorrect };
            else if (isLocked) optStyle = { ...optStyle, ...styles.optionLocked };
            else if (solved || needsReview) optStyle = { ...optStyle, ...styles.optionMuted };
            else if (i === selected) optStyle = { ...optStyle, ...styles.optionSelected };
            return (
              <button
                key={i}
                style={optStyle}
                disabled={isLocked || solved || needsReview}
                onClick={() => handleSelect(i)}
              >
                <span style={{ ...styles.optionLetter, ...(isLocked ? styles.optionLetterLocked : {}) }}>
                  {String.fromCharCode(65 + pos)}
                </span>
                <span style={styles.optionText}>{opt}</span>
                {isRight && <span style={styles.checkmark}>✓</span>}
                {isLocked && <span style={styles.xmark}>✗</span>}
              </button>
            );
          })}
        </div>

        {/* Wrong, but still has attempts left — no answer revealed, no explanation */}
        {!solved && !needsReview && locked.length > 0 && (
          <div style={{ ...styles.explanation, background: '#FEF2F2', borderColor: '#EF4444' }}>
            <strong style={{ color: '#DC2626' }}>Not correct. </strong>
            That option is now ruled out. You have {MAX_WRONG_PER_ROUND - wrongThisRound} attempt
            {MAX_WRONG_PER_ROUND - wrongThisRound === 1 ? '' : 's'} left before you go back to the material.
          </div>
        )}

        {/* Two misses — locked out until the material is re-read */}
        {needsReview && (
          <div style={{ ...styles.explanation, background: '#FFF7ED', borderColor: '#D4782A' }}>
            <strong style={{ color: '#B45309' }}>Review required. </strong>
            {canReview
              ? 'Go back to the section that covers this question. Once you have re-read it you can try again.'
              : 'Go back through the module material, then return to try this question again.'}
          </div>
        )}

        {/* Correct — now the explanation is worth showing */}
        {solved && (
          <div style={{ ...styles.explanation, background: '#ECFDF5', borderColor: '#10B981' }}>
            <strong style={{ color: '#059669' }}>Correct! </strong>
            {question.explanation}
          </div>
        )}

        <div style={styles.footer}>
          {needsReview ? (
            <button style={{ ...styles.btn, background: '#D4782A' }} onClick={() => onReview(currentQ)}>
              Review the material →
            </button>
          ) : solved ? (
            <button style={styles.btn} onClick={handleNext}>
              {isLast ? 'See Results' : 'Next Question'} →
            </button>
          ) : (
            <button
              style={{ ...styles.btn, opacity: selected === null ? 0.5 : 1 }}
              disabled={selected === null}
              onClick={handleSubmit}
            >
              Submit Answer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #1B3A6B 0%, #2B5AA0 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  },
  card: {
    background: '#FFFFFF',
    borderRadius: '16px',
    padding: '40px',
    width: '100%',
    maxWidth: '680px',
    boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
  },
  quizHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
  quizTag: {
    background: '#D4782A',
    color: '#FFFFFF',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  quizProgress: { fontSize: '13px', color: '#6B7280', fontWeight: 600 },
  progressBar: { height: '4px', background: '#E5E7EB', borderRadius: '2px', marginBottom: '28px', overflow: 'hidden' },
  progressFill: { height: '100%', background: '#D4782A', borderRadius: '2px', transition: 'width 0.3s' },
  question: { fontSize: '20px', fontWeight: 700, color: '#1B3A6B', lineHeight: '1.4', marginBottom: '24px' },
  retryNote: {
    background: '#EFF6FF',
    border: '1px solid #BFDBFE',
    borderRadius: '8px',
    padding: '10px 14px',
    fontSize: '13px',
    color: '#1E40AF',
    marginBottom: '16px',
  },
  options: { display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' },
  option: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 16px',
    border: '2px solid #E5E7EB',
    borderRadius: '8px',
    background: '#F9FAFB',
    cursor: 'pointer',
    textAlign: 'left',
    fontSize: '15px',
    transition: 'all 0.15s',
    width: '100%',
  },
  optionSelected: { border: '2px solid #1B3A6B', background: '#EFF6FF' },
  optionCorrect: { border: '2px solid #10B981', background: '#ECFDF5' },
  optionLocked: {
    border: '2px solid #E5E7EB',
    background: '#F3F4F6',
    opacity: 0.55,
    cursor: 'not-allowed',
    textDecoration: 'line-through',
  },
  optionMuted: { opacity: 0.65, cursor: 'default' },
  optionLetter: {
    minWidth: '28px',
    height: '28px',
    background: '#1B3A6B',
    color: '#FFFFFF',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 700,
  },
  optionLetterLocked: { background: '#9CA3AF' },
  optionText: { flex: 1, color: '#1F2937', lineHeight: '1.4' },
  checkmark: { color: '#10B981', fontWeight: 700, fontSize: '18px' },
  xmark: { color: '#EF4444', fontWeight: 700, fontSize: '18px' },
  explanation: {
    padding: '14px 16px',
    borderRadius: '8px',
    border: '1px solid',
    fontSize: '14px',
    lineHeight: '1.6',
    color: '#374151',
    marginBottom: '20px',
  },
  footer: { display: 'flex', justifyContent: 'flex-end' },
  btn: {
    padding: '12px 28px',
    background: '#1B3A6B',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  resultsCard: {
    background: '#FFFFFF',
    borderRadius: '16px',
    padding: '48px 40px',
    width: '100%',
    maxWidth: '480px',
    textAlign: 'center',
    boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
  },
  scoreCircle: {
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    border: '6px solid',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 24px',
  },
  scoreNumber: { fontSize: '36px', fontWeight: 800, lineHeight: 1 },
  scoreLabel: { fontSize: '12px', color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase' },
  resultTitle: { fontSize: '24px', fontWeight: 700, color: '#1B3A6B', marginBottom: '12px' },
  resultSub: { fontSize: '15px', color: '#6B7280', lineHeight: '1.6', marginBottom: '28px' },
};
