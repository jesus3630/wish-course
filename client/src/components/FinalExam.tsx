import React, { useState } from 'react';
import { useIsMobile } from '../utils/useIsMobile';

/**
 * The graded quiz at the end of a part of the training.
 *
 * One per part rather than a single exam at the end, so somebody who works
 * through five parts is tested on those five and nothing else.
 *
 * A sitting is one pass. Every question is answered once and there is no going
 * back, no answer revealed along the way, and no second look at a question you
 * have moved past. The paper is marked on the server; this component never sees
 * a correct answer, which is what stops the quiz being readable in the network
 * tab.
 */

type ExamQuestion = {
  number: number;
  id: string;
  module_id: string;
  question: string;
  options: string[];
};

type ExamResult = {
  attemptNo: number;
  moduleId: string;
  score: number;
  correct: number;
  total: number;
  passed: boolean;
  perfect: boolean;
  unanswered: number;
  passMark: number;
  missedCount: number;
};

interface Props {
  email: string;
  name: string;
  moduleId: string;
  moduleName: string;
  /** Called when they pass — carries on into the next part of the training. */
  onPassed: () => void;
  /** Called when they choose to go back and re-read this part. */
  onReview: () => void;
}

type Phase = 'brief' | 'sitting' | 'marking' | 'result';

const C = {
  navy: '#1B3A6B', orange: '#D4782A', green: '#10B981', red: '#EF4444',
  ink: '#1F2937', muted: '#6B7280', line: '#E5E7EB',
};

export default function FinalExam({ email, name, moduleId, moduleName, onPassed, onReview }: Props) {
  const isMobile = useIsMobile();
  const [phase, setPhase] = useState<Phase>('brief');
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [attemptNo, setAttemptNo] = useState<number>(1);
  const [passMark, setPassMark] = useState(70);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const question = questions[index];
  const isLast = index === questions.length - 1;

  async function startExam() {
    setError(null);
    try {
      const r = await fetch('/api/exam/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, moduleId }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'Could not start the exam.'); return; }
      setAttemptId(d.attemptId);
      setAttemptNo(d.attemptNo);
      setPassMark(d.passMark);
      setQuestions(d.questions);
      setIndex(0);
      setAnswers({});
      setSelected(null);
      setResult(null);
      setPhase('sitting');
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    }
  }

  // Locks the answer in and moves on. There is no way back to it.
  function lockInAndAdvance() {
    if (selected === null || !question) return;
    const next = { ...answers, [question.id]: selected };
    setAnswers(next);
    setSelected(null);
    if (isLast) submitExam(next);
    else setIndex(i => i + 1);
  }

  async function submitExam(finalAnswers: Record<string, number>) {
    setPhase('marking');
    try {
      const r = await fetch('/api/exam/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId,
          answers: Object.entries(finalAnswers).map(([id, chosen]) => ({ id, chosen })),
        }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'Could not submit the exam.'); setPhase('result'); return; }
      setResult(d);
      setPhase('result');
    } catch {
      setError('Could not reach the server to submit your exam.');
      setPhase('result');
    }
  }

  // ── Before you start ───────────────────────────────────────────────────────
  if (phase === 'brief') {
    return (
      <Page>
        <Card isMobile={isMobile}>
          <Tag>Knowledge Check</Tag>
          <h1 style={{ ...s.h1, fontSize: isMobile ? 22 : 27 }}>{moduleName}</h1>
          <p style={s.lede}>
            A short quiz on this part before you move on. Read each question carefully — this is
            a single attempt, and you cannot change an answer once you move on.
          </p>
          <ul style={s.rules}>
            <li>Questions cover <b>this part only</b> — nothing you have not worked through yet.</li>
            <li><b>One chance per question.</b> Once you press Next, that answer is final.</li>
            <li><b>No answers are shown</b> while you work. You get your result at the end.</li>
            <li><b>{passMark}% or higher passes.</b> Your score and the number of attempts you take are recorded.</li>
          </ul>
          {attemptNo > 1 && (
            <p style={s.note}>This will be attempt {attemptNo}.</p>
          )}
          {error && <p style={s.error}>{error}</p>}
          <div style={s.actions}>
            <button style={s.ghost} onClick={onReview}>Re-read this part first</button>
            <button style={s.primary} onClick={startExam}>Start the quiz</button>
          </div>
        </Card>
      </Page>
    );
  }

  // ── Marking ────────────────────────────────────────────────────────────────
  if (phase === 'marking') {
    return (
      <Page>
        <Card isMobile={isMobile}>
          <h1 style={{ ...s.h1, fontSize: 24 }}>Marking your quiz…</h1>
          <p style={s.lede}>One moment.</p>
        </Card>
      </Page>
    );
  }

  // ── Result ─────────────────────────────────────────────────────────────────
  if (phase === 'result') {
    if (error || !result) {
      return (
        <Page>
          <Card isMobile={isMobile}>
            <h1 style={{ ...s.h1, fontSize: 24 }}>Something went wrong</h1>
            <p style={s.error}>{error}</p>
            <div style={s.actions}><button style={s.primary} onClick={onReview}>Back to the training</button></div>
          </Card>
        </Page>
      );
    }
    const good = result.passed;
    return (
      <Page>
        <Card isMobile={isMobile}>
          <Tag>Attempt {result.attemptNo}</Tag>
          <div style={{ ...s.scoreRing, borderColor: good ? C.green : C.red }}>
            <span style={{ ...s.scoreNum, color: good ? C.green : C.red }}>{result.score}%</span>
            <span style={s.scoreLbl}>Score</span>
          </div>
          <h1 style={{ ...s.h1, fontSize: isMobile ? 22 : 26, textAlign: 'center' }}>
            {result.perfect ? 'Perfect score' : good ? 'Passed' : 'Not passed'}
          </h1>
          <p style={{ ...s.lede, textAlign: 'center', marginBottom: 6, fontWeight: 700, color: C.navy }}>
            {moduleName}
          </p>
          <p style={{ ...s.lede, textAlign: 'center' }}>
            {result.correct} of {result.total} correct
            {result.unanswered > 0 ? ` · ${result.unanswered} left blank` : ''}.
            {good
              ? result.perfect
                ? ' Every question right on this attempt.'
                : ` ${result.passMark}% was needed to pass.`
              : ` ${result.passMark}% is needed to pass.`}
          </p>

          {!result.perfect && (
            <div style={s.weak}>
              <b style={{ color: C.navy }}>
                {result.passed
                  ? `You missed ${result.missedCount} — worth another look before you carry on.`
                  : `You missed ${result.missedCount}. Re-read this part, then try again.`}
              </b>
              <div style={{ marginTop: 6, fontSize: 13, color: '#92400E' }}>
                We do not show which ones, so a second attempt still means something.
              </div>
            </div>
          )}

          <div style={s.actions}>
            <button style={s.ghost} onClick={onReview}>Re-read this part</button>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {!result.perfect && (
                <button
                  style={good ? s.ghost : s.primary}
                  onClick={() => { setPhase('brief'); setAttemptNo(result.attemptNo + 1); }}
                >
                  {good ? 'Try for 100%' : 'Try again'}
                </button>
              )}
              {good && (
                <button style={s.primary} onClick={onPassed}>Continue the training →</button>
              )}
            </div>
          </div>
        </Card>
      </Page>
    );
  }

  // ── Sitting the exam ───────────────────────────────────────────────────────
  return (
    <Page>
      <Card isMobile={isMobile}>
        <div style={s.header}>
          <Tag>Final Exam</Tag>
          <span style={s.counter}>Question {index + 1} of {questions.length}</span>
        </div>
        <div style={s.bar}>
          <div style={{ ...s.barFill, width: `${((index + 1) / questions.length) * 100}%` }} />
        </div>

        <h2 style={{ ...s.q, fontSize: isMobile ? 17 : 20 }}>{question?.question}</h2>

        <div style={s.options}>
          {question?.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              style={{ ...s.option, ...(selected === i ? s.optionOn : {}) }}
            >
              <span style={s.letter}>{String.fromCharCode(65 + i)}</span>
              <span style={s.optText}>{opt}</span>
            </button>
          ))}
        </div>

        <p style={s.warn}>
          Once you press {isLast ? 'Submit' : 'Next'}, this answer is final.
        </p>

        <div style={{ ...s.actions, justifyContent: 'flex-end' }}>
          <button
            style={{ ...s.primary, opacity: selected === null ? 0.5 : 1, cursor: selected === null ? 'not-allowed' : 'pointer' }}
            disabled={selected === null}
            onClick={lockInAndAdvance}
          >
            {isLast ? 'Submit exam' : 'Next question →'}
          </button>
        </div>
      </Card>
    </Page>
  );
}

// ── small presentational helpers ─────────────────────────────────────────────
const Page = ({ children }: { children: React.ReactNode }) => <div style={s.page}>{children}</div>;
const Card = ({ children, isMobile }: { children: React.ReactNode; isMobile: boolean }) => (
  <div style={{ ...s.card, padding: isMobile ? '26px 18px' : '40px' }}>{children}</div>
);
const Tag = ({ children }: { children: React.ReactNode }) => <span style={s.tag}>{children}</span>;

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh', background: `linear-gradient(135deg, ${C.navy} 0%, #2B5AA0 100%)`,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  card: {
    background: '#fff', borderRadius: 16, width: '100%', maxWidth: 680,
    boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  tag: {
    display: 'inline-block', background: C.orange, color: '#fff', padding: '4px 12px',
    borderRadius: 20, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
  },
  counter: { fontSize: 13, color: C.muted, fontWeight: 600 },
  bar: { height: 4, background: C.line, borderRadius: 2, margin: '12px 0 26px', overflow: 'hidden' },
  barFill: { height: '100%', background: C.orange, borderRadius: 2, transition: 'width 0.3s' },
  h1: { fontWeight: 800, color: C.navy, margin: '16px 0 10px', lineHeight: 1.2 },
  lede: { fontSize: 15, color: C.muted, lineHeight: 1.6, margin: '0 0 18px' },
  rules: { margin: '0 0 18px', paddingLeft: 20, color: C.ink, fontSize: 14.5, lineHeight: 1.85 },
  note: { fontSize: 14, color: C.orange, fontWeight: 700, margin: '0 0 14px' },
  error: { fontSize: 14, color: C.red, fontWeight: 600, margin: '0 0 14px' },
  q: { fontWeight: 700, color: C.navy, lineHeight: 1.4, margin: '0 0 22px' },
  options: { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 },
  option: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
    border: `2px solid ${C.line}`, borderRadius: 8, background: '#F9FAFB',
    cursor: 'pointer', textAlign: 'left', fontSize: 15, width: '100%', transition: 'all 0.15s',
  },
  optionOn: { border: `2px solid ${C.navy}`, background: '#EFF6FF' },
  letter: {
    minWidth: 28, height: 28, background: C.navy, color: '#fff', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
  },
  optText: { flex: 1, color: C.ink, lineHeight: 1.4 },
  warn: { fontSize: 12.5, color: C.muted, fontStyle: 'italic', margin: '0 0 18px' },
  actions: { display: 'flex', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' },
  primary: {
    padding: '12px 26px', background: C.navy, color: '#fff', border: 'none',
    borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer',
  },
  ghost: {
    padding: '12px 22px', background: 'none', color: C.muted, border: `1px solid ${C.line}`,
    borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  scoreRing: {
    width: 118, height: 118, borderRadius: '50%', border: '6px solid',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    margin: '8px auto 18px',
  },
  scoreNum: { fontSize: 34, fontWeight: 800, lineHeight: 1 },
  scoreLbl: { fontSize: 11, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase' },
  weak: {
    background: '#FFF7ED', border: `1px solid ${C.orange}`, borderRadius: 8,
    padding: '14px 16px', margin: '0 0 20px', fontSize: 14,
  },
  chip: {
    background: '#fff', border: `1px solid ${C.orange}`, color: '#92400E',
    borderRadius: 6, padding: '3px 9px', fontSize: 12.5, fontWeight: 600,
  },
};
