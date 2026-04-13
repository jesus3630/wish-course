import React, { useState } from 'react';
import { QuizQuestion } from '../types';

interface Props {
  questions: QuizQuestion[];
  moduleName: string;
  onComplete: (score: number, passed: boolean) => void;
}

const PASS_SCORE = 80;

export default function Quiz({ questions, moduleName, onComplete }: Props) {
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [showResults, setShowResults] = useState(false);

  const question = questions[currentQ];
  const isLast = currentQ === questions.length - 1;

  function handleSelect(index: number) {
    if (confirmed) return;
    setSelected(index);
  }

  function handleConfirm() {
    if (selected === null) return;
    setConfirmed(true);
  }

  function handleNext() {
    const correct = selected === question.correct_index;
    const newAnswers = [...answers, correct];
    setAnswers(newAnswers);

    if (isLast) {
      setAnswers(newAnswers);
      setShowResults(true);
      return;
    }

    setCurrentQ(currentQ + 1);
    setSelected(null);
    setConfirmed(false);
  }

  if (showResults) {
    const score = Math.round((answers.filter(Boolean).length / questions.length) * 100);
    const passed = score >= PASS_SCORE;
    return (
      <div style={styles.page}>
        <div style={styles.resultsCard}>
          <div style={{ ...styles.scoreCircle, borderColor: passed ? '#10B981' : '#EF4444' }}>
            <span style={{ ...styles.scoreNumber, color: passed ? '#10B981' : '#EF4444' }}>{score}%</span>
            <span style={styles.scoreLabel}>Score</span>
          </div>
          <h2 style={styles.resultTitle}>{passed ? 'Module Passed!' : 'Review Needed'}</h2>
          <p style={styles.resultSub}>
            {passed
              ? `You answered ${answers.filter(Boolean).length} of ${questions.length} questions correctly. Great work!`
              : `You answered ${answers.filter(Boolean).length} of ${questions.length} questions correctly. A score of ${PASS_SCORE}% or higher is required to pass.`}
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

  const isCorrect = selected === question.correct_index;

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.quizHeader}>
          <span style={styles.quizTag}>Knowledge Check</span>
          <span style={styles.quizProgress}>{currentQ + 1} / {questions.length}</span>
        </div>
        <div style={styles.progressBar}>
          <div style={{ ...styles.progressFill, width: `${((currentQ + 1) / questions.length) * 100}%` }} />
        </div>

        <h2 style={styles.question}>{question.question}</h2>

        <div style={styles.options}>
          {question.options.map((opt, i) => {
            let optStyle = { ...styles.option };
            if (confirmed) {
              if (i === question.correct_index) optStyle = { ...optStyle, ...styles.optionCorrect };
              else if (i === selected) optStyle = { ...optStyle, ...styles.optionWrong };
            } else if (i === selected) {
              optStyle = { ...optStyle, ...styles.optionSelected };
            }
            return (
              <button key={i} style={optStyle} onClick={() => handleSelect(i)}>
                <span style={styles.optionLetter}>{String.fromCharCode(65 + i)}</span>
                <span style={styles.optionText}>{opt}</span>
                {confirmed && i === question.correct_index && <span style={styles.checkmark}>✓</span>}
                {confirmed && i === selected && i !== question.correct_index && <span style={styles.xmark}>✗</span>}
              </button>
            );
          })}
        </div>

        {confirmed && (
          <div style={{ ...styles.explanation, background: isCorrect ? '#ECFDF5' : '#FEF2F2', borderColor: isCorrect ? '#10B981' : '#EF4444' }}>
            <strong style={{ color: isCorrect ? '#059669' : '#DC2626' }}>
              {isCorrect ? 'Correct! ' : 'Not quite. '}
            </strong>
            {question.explanation}
          </div>
        )}

        <div style={styles.footer}>
          {!confirmed ? (
            <button
              style={{ ...styles.btn, opacity: selected === null ? 0.5 : 1 }}
              disabled={selected === null}
              onClick={handleConfirm}
            >
              Submit Answer
            </button>
          ) : (
            <button style={styles.btn} onClick={handleNext}>
              {isLast ? 'See Results' : 'Next Question'} →
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
  optionWrong: { border: '2px solid #EF4444', background: '#FEF2F2' },
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
