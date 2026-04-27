import React, { useState, useEffect, useCallback } from 'react';
import { Module, QuizQuestion, Slide } from '../types';

const C = {
  teal: '#5BBCB0',
  lime: '#C8D46A',
  orange: '#D4782A',
  navy: '#1B3A6B',
  bg: '#F4F7FA',
  white: '#FFFFFF',
  border: '#E5E7EB',
  gray: '#6B7280',
  lightGray: '#F3F4F6',
  red: '#EF4444',
  green: '#10B981',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: `1px solid ${C.border}`,
  borderRadius: '6px',
  fontSize: '14px',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  outline: 'none',
  background: C.white,
  color: '#1F2937',
  lineHeight: '1.6',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 700,
  color: C.gray,
  marginBottom: '6px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function SmBtn({
  onClick, disabled, danger, children,
}: {
  onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '6px 12px',
        borderRadius: '6px',
        border: 'none',
        fontWeight: 600,
        fontSize: '12px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: danger ? '#FEE2E2' : C.lightGray,
        color: danger ? C.red : C.gray,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 16px',
        borderRadius: '6px',
        border: 'none',
        fontWeight: 600,
        fontSize: '13px',
        cursor: 'pointer',
        background: active ? C.navy : C.lightGray,
        color: active ? C.white : C.gray,
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  );
}

// ─── Slides Editor ────────────────────────────────────────────────────────────

function SlidesEditor({
  slides, expandedSlide, setExpandedSlide, onUpdate, onAdd, onDelete, onMove,
}: {
  slides: Slide[];
  expandedSlide: number | null;
  setExpandedSlide: (i: number | null) => void;
  onUpdate: (idx: number, field: keyof Slide, val: string) => void;
  onAdd: () => void;
  onDelete: (idx: number) => void;
  onMove: (idx: number, dir: -1 | 1) => void;
}) {
  return (
    <div>
      {slides.map((slide, idx) => (
        <div
          key={idx}
          style={{
            background: C.white,
            borderRadius: '10px',
            marginBottom: '8px',
            border: `1px solid ${expandedSlide === idx ? C.orange : C.border}`,
            overflow: 'hidden',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}
        >
          {/* Slide row */}
          <div
            onClick={() => setExpandedSlide(expandedSlide === idx ? null : idx)}
            style={{
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: 'pointer',
              background: expandedSlide === idx ? '#FFF7ED' : C.white,
              userSelect: 'none',
            }}
          >
            <span style={{
              background: C.navy, color: C.white, borderRadius: '50%',
              width: '26px', height: '26px', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0,
            }}>
              {idx + 1}
            </span>
            <span style={{ flex: 1, fontWeight: 600, color: C.navy, fontSize: '14px' }}>
              {slide.slide_name || 'Untitled Slide'}
            </span>
            <span style={{ fontSize: '12px', color: C.gray, whiteSpace: 'nowrap' }}>
              {(slide.text ?? '').length} chars
            </span>
            <span style={{ fontSize: '16px', color: C.gray }}>{expandedSlide === idx ? '▲' : '▼'}</span>
          </div>

          {/* Expanded editor */}
          {expandedSlide === idx && (
            <div style={{ padding: '20px', borderTop: `1px solid ${C.border}` }}>
              <Field label="Slide Name">
                <input
                  value={slide.slide_name ?? ''}
                  onChange={e => onUpdate(idx, 'slide_name', e.target.value)}
                  style={inputStyle}
                />
              </Field>
              <Field label="Instructions (for video production)">
                <input
                  value={slide.instructions ?? ''}
                  onChange={e => onUpdate(idx, 'instructions', e.target.value)}
                  style={inputStyle}
                  placeholder="e.g. Video of scheduling site entered as the URL"
                />
              </Field>
              <Field label="Narration Text">
                <textarea
                  value={slide.text ?? ''}
                  onChange={e => onUpdate(idx, 'text', e.target.value)}
                  style={{ ...inputStyle, minHeight: '160px', resize: 'vertical' }}
                />
              </Field>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <SmBtn onClick={() => onMove(idx, -1)} disabled={idx === 0}>↑ Move Up</SmBtn>
                  <SmBtn onClick={() => onMove(idx, 1)} disabled={idx === slides.length - 1}>↓ Move Down</SmBtn>
                </div>
                <SmBtn onClick={() => onDelete(idx)} danger>Delete Slide</SmBtn>
              </div>
            </div>
          )}
        </div>
      ))}
      <button
        onClick={onAdd}
        style={{
          width: '100%', padding: '14px',
          background: C.lightGray, border: `2px dashed ${C.border}`,
          borderRadius: '10px', color: C.gray, fontWeight: 600,
          fontSize: '14px', cursor: 'pointer', marginTop: '4px',
        }}
      >
        + Add Slide
      </button>
    </div>
  );
}

// ─── Quiz Editor ──────────────────────────────────────────────────────────────

function QuizEditor({
  questions, expandedQuestion, setExpandedQuestion,
  onUpdate, onUpdateOption, onAdd, onDelete,
}: {
  questions: QuizQuestion[];
  expandedQuestion: number | null;
  setExpandedQuestion: (i: number | null) => void;
  onUpdate: (idx: number, field: keyof QuizQuestion, val: any) => void;
  onUpdateOption: (idx: number, optIdx: number, val: string) => void;
  onAdd: () => void;
  onDelete: (idx: number) => void;
}) {
  return (
    <div>
      {questions.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: C.gray, background: C.white, borderRadius: '10px', border: `1px solid ${C.border}`, marginBottom: '8px' }}>
          <p style={{ fontSize: '15px', marginBottom: '16px' }}>No quiz questions for this module yet.</p>
        </div>
      )}
      {questions.map((q, idx) => (
        <div
          key={q.id || idx}
          style={{
            background: C.white, borderRadius: '10px', marginBottom: '8px',
            border: `1px solid ${expandedQuestion === idx ? C.orange : C.border}`,
            overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}
        >
          <div
            onClick={() => setExpandedQuestion(expandedQuestion === idx ? null : idx)}
            style={{
              padding: '14px 16px', display: 'flex', alignItems: 'center',
              gap: '12px', cursor: 'pointer',
              background: expandedQuestion === idx ? '#FFF7ED' : C.white,
              userSelect: 'none',
            }}
          >
            <span style={{
              background: C.teal, color: C.white, borderRadius: '50%',
              width: '26px', height: '26px', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0,
            }}>
              Q{idx + 1}
            </span>
            <span style={{ flex: 1, fontWeight: 600, color: C.navy, fontSize: '14px', lineHeight: '1.4' }}>
              {q.question}
            </span>
            <span style={{ fontSize: '16px', color: C.gray }}>{expandedQuestion === idx ? '▲' : '▼'}</span>
          </div>

          {expandedQuestion === idx && (
            <div style={{ padding: '20px', borderTop: `1px solid ${C.border}` }}>
              <Field label="Question">
                <textarea
                  value={q.question}
                  onChange={e => onUpdate(idx, 'question', e.target.value)}
                  style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }}
                />
              </Field>

              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Answer Options — click radio to set correct answer</label>
                {q.options.map((opt, oi) => {
                  const isCorrect = q.correct_index === oi;
                  return (
                    <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <input
                        type="radio"
                        checked={isCorrect}
                        onChange={() => onUpdate(idx, 'correct_index', oi)}
                        style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: C.green, flexShrink: 0 }}
                        title="Mark as correct answer"
                      />
                      <input
                        value={opt}
                        onChange={e => onUpdateOption(idx, oi, e.target.value)}
                        style={{
                          ...inputStyle,
                          flex: 1,
                          background: isCorrect ? '#F0FDF4' : C.white,
                          borderColor: isCorrect ? C.green : C.border,
                        }}
                        placeholder={`Option ${oi + 1}`}
                      />
                      {isCorrect && (
                        <span style={{ fontSize: '11px', color: C.green, fontWeight: 700, whiteSpace: 'nowrap' }}>✓ Correct</span>
                      )}
                    </div>
                  );
                })}
              </div>

              <Field label="Explanation (shown after answer)">
                <textarea
                  value={q.explanation}
                  onChange={e => onUpdate(idx, 'explanation', e.target.value)}
                  style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                />
              </Field>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <SmBtn onClick={() => onDelete(idx)} danger>Delete Question</SmBtn>
              </div>
            </div>
          )}
        </div>
      ))}
      <button
        onClick={onAdd}
        style={{
          width: '100%', padding: '14px',
          background: C.lightGray, border: `2px dashed ${C.border}`,
          borderRadius: '10px', color: C.gray, fontWeight: 600,
          fontSize: '14px', cursor: 'pointer', marginTop: '4px',
        }}
      >
        + Add Question
      </button>
    </div>
  );
}

interface HistoryEntry {
  id: string;
  timestamp: string;
  type: 'course' | 'quiz';
  changes: string[];
}

interface UserEntry {
  email: string;
  name: string;
  started_at: string;
  last_synced: string;
  modules_completed: number;
  modules_started: number;
}

// ─── Main AdminPanel ──────────────────────────────────────────────────────────

export default function AdminPanel() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [modules, setModules] = useState<Module[]>([]);
  const [quizData, setQuizData] = useState<Record<string, QuizQuestion[]>>({});
  const [dataLoading, setDataLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  const [selectedModIdx, setSelectedModIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<'slides' | 'quiz'>('slides');
  const [expandedSlide, setExpandedSlide] = useState<number | null>(null);
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);

  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  const [adminView, setAdminView] = useState<'content' | 'users'>('content');
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const loadData = useCallback(async () => {
    setDataLoading(true);
    try {
      const [courseRes, quizRes] = await Promise.all([
        fetch('/api/course'),
        fetch('/api/quiz'),
      ]);
      setModules(await courseRes.json());
      setQuizData(await quizRes.json());
    } catch (e) {
      console.error('Failed to load data', e);
    }
    setDataLoading(false);
  }, []);

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/admin/history', { headers: { 'x-admin-password': password } });
      if (res.ok) setHistory(await res.json());
    } catch (e) {}
    setHistoryLoading(false);
  }

  async function loadUsers() {
    setUsersLoading(true);
    try {
      const res = await fetch('/api/admin/users', { headers: { 'x-admin-password': password } });
      if (res.ok) setUsers(await res.json());
    } catch (e) {}
    setUsersLoading(false);
  }

  async function restoreSnapshot(id: string) {
    if (!window.confirm('Restore this version? Current content will be overwritten.')) return;
    setRestoring(id);
    try {
      const res = await fetch(`/api/admin/restore/${id}`, {
        method: 'POST',
        headers: { 'x-admin-password': password },
      });
      if (res.ok) {
        await loadData();
        setShowHistory(false);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    } catch (e) {}
    setRestoring(null);
  }

  // Check for saved session
  useEffect(() => {
    const saved = sessionStorage.getItem('wish_admin_pw');
    if (saved) {
      setPassword(saved);
      (async () => {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: saved }),
        });
        if (res.ok) {
          setAuthed(true);
        } else {
          sessionStorage.removeItem('wish_admin_pw');
        }
      })();
    }
  }, []);

  useEffect(() => {
    if (authed) loadData();
  }, [authed, loadData]);

  async function handleLogin() {
    if (!password.trim()) return;
    setLoginLoading(true);
    setLoginError('');
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    setLoginLoading(false);
    if (res.ok) {
      sessionStorage.setItem('wish_admin_pw', password);
      setAuthed(true);
    } else {
      setLoginError('Incorrect password');
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveStatus('idle');
    try {
      const [cr, qr] = await Promise.all([
        fetch('/api/admin/course', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
          body: JSON.stringify(modules),
        }),
        fetch('/api/admin/quiz', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
          body: JSON.stringify(quizData),
        }),
      ]);
      setSaveStatus(cr.ok && qr.ok ? 'saved' : 'error');
    } catch {
      setSaveStatus('error');
    }
    setSaving(false);
    setTimeout(() => setSaveStatus('idle'), 3000);
  }

  function handleLogout() {
    sessionStorage.removeItem('wish_admin_pw');
    setAuthed(false);
    setPassword('');
  }

  // ─── Slide mutations ────────────────────────────────────────────────────────

  function updateSlide(modIdx: number, slideIdx: number, field: keyof Slide, value: string) {
    setModules(prev => {
      const next: Module[] = JSON.parse(JSON.stringify(prev));
      (next[modIdx].slides[slideIdx] as any)[field] = value;
      return next;
    });
  }

  function addSlide(modIdx: number) {
    setModules(prev => {
      const next: Module[] = JSON.parse(JSON.stringify(prev));
      const slides = next[modIdx].slides;
      slides.push({
        slide_number: slides.length + 1,
        slide_name: 'New Slide',
        instructions: null,
        text: '',
        original_index: slides.length,
      });
      return next;
    });
    setExpandedSlide(null);
  }

  function deleteSlide(modIdx: number, slideIdx: number) {
    if (!window.confirm('Delete this slide?')) return;
    setModules(prev => {
      const next: Module[] = JSON.parse(JSON.stringify(prev));
      next[modIdx].slides.splice(slideIdx, 1);
      next[modIdx].slides.forEach((s, i) => { s.original_index = i; });
      return next;
    });
    setExpandedSlide(null);
  }

  function moveSlide(modIdx: number, slideIdx: number, dir: -1 | 1) {
    const target = slideIdx + dir;
    if (target < 0 || target >= modules[modIdx].slides.length) return;
    setModules(prev => {
      const next: Module[] = JSON.parse(JSON.stringify(prev));
      const arr = next[modIdx].slides;
      [arr[slideIdx], arr[target]] = [arr[target], arr[slideIdx]];
      arr.forEach((s, i) => { s.original_index = i; });
      return next;
    });
    setExpandedSlide(target);
  }

  // ─── Quiz mutations ─────────────────────────────────────────────────────────

  function getModuleId(modIdx: number) {
    return modules[modIdx]?.id ?? '';
  }

  function updateQuestion(modIdx: number, qIdx: number, field: keyof QuizQuestion, value: any) {
    const modId = getModuleId(modIdx);
    setQuizData(prev => {
      const next = { ...prev };
      const qs: QuizQuestion[] = JSON.parse(JSON.stringify(next[modId] || []));
      (qs[qIdx] as any)[field] = value;
      next[modId] = qs;
      return next;
    });
  }

  function updateQuestionOption(modIdx: number, qIdx: number, optIdx: number, value: string) {
    const modId = getModuleId(modIdx);
    setQuizData(prev => {
      const next = { ...prev };
      const qs: QuizQuestion[] = JSON.parse(JSON.stringify(next[modId] || []));
      qs[qIdx].options[optIdx] = value;
      next[modId] = qs;
      return next;
    });
  }

  function addQuestion(modIdx: number) {
    const modId = getModuleId(modIdx);
    setQuizData(prev => {
      const next = { ...prev };
      const qs: QuizQuestion[] = JSON.parse(JSON.stringify(next[modId] || []));
      qs.push({
        id: `${modId}_${Date.now()}`,
        question: 'New question?',
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correct_index: 0,
        explanation: 'Explanation here.',
      });
      next[modId] = qs;
      return next;
    });
    setExpandedQuestion(null);
  }

  function deleteQuestion(modIdx: number, qIdx: number) {
    if (!window.confirm('Delete this question?')) return;
    const modId = getModuleId(modIdx);
    setQuizData(prev => {
      const next = { ...prev };
      const qs: QuizQuestion[] = JSON.parse(JSON.stringify(next[modId] || []));
      qs.splice(qIdx, 1);
      next[modId] = qs;
      return next;
    });
    setExpandedQuestion(null);
  }

  // ─── Module mutations ───────────────────────────────────────────────────────

  function updateModuleName(modIdx: number, name: string) {
    setModules(prev => {
      const next: Module[] = JSON.parse(JSON.stringify(prev));
      next[modIdx].name = name;
      return next;
    });
  }

  function addModule() {
    const id = `module_${Date.now()}`;
    const newMod: Module = {
      id,
      name: 'New Module',
      slides: [{
        slide_number: 1,
        slide_name: 'Slide 1',
        instructions: null,
        text: '',
        original_index: 0,
      }],
    };
    setModules(prev => [...prev, newMod]);
    setQuizData(prev => ({ ...prev, [id]: [] }));
    setSelectedModIdx(modules.length);
    setActiveTab('slides');
    setExpandedSlide(null);
  }

  function deleteModule(modIdx: number) {
    if (!window.confirm(`Delete module "${modules[modIdx].name}"? This cannot be undone.`)) return;
    const modId = modules[modIdx].id;
    setModules(prev => prev.filter((_, i) => i !== modIdx));
    setQuizData(prev => {
      const next = { ...prev };
      delete next[modId];
      return next;
    });
    setSelectedModIdx(Math.max(0, modIdx - 1));
  }

  // ─── Login screen ───────────────────────────────────────────────────────────

  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ background: C.white, borderRadius: '16px', padding: '48px', width: '380px', boxShadow: '0 8px 32px rgba(0,0,0,0.1)', borderTop: `5px solid ${C.orange}` }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ fontSize: '36px', fontWeight: 900, color: C.orange, letterSpacing: '3px' }}>WISH</div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: C.navy, letterSpacing: '3px', textTransform: 'uppercase', opacity: 0.7, marginTop: '4px' }}>Admin Panel</div>
          </div>
          <label style={labelStyle}>Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="Enter admin password"
            style={{ ...inputStyle, borderColor: loginError ? C.red : C.border }}
            autoFocus
          />
          {loginError && <p style={{ color: C.red, fontSize: '13px', marginTop: '8px', marginBottom: 0 }}>{loginError}</p>}
          <button
            onClick={handleLogin}
            disabled={loginLoading}
            style={{ width: '100%', marginTop: '20px', padding: '13px', background: C.orange, color: C.white, border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 700, cursor: loginLoading ? 'not-allowed' : 'pointer' }}
          >
            {loginLoading ? 'Checking...' : 'Enter Admin Panel'}
          </button>
        </div>
      </div>
    );
  }

  if (dataLoading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ fontSize: '18px', color: C.navy, fontWeight: 600 }}>Loading course data...</div>
      </div>
    );
  }

  const selectedMod = modules[selectedModIdx];
  const selectedQuiz = selectedMod ? (quizData[selectedMod.id] ?? []) : [];

  // ─── Main editor ─────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(90deg, ${C.teal} 0%, ${C.lime} 100%)`,
        height: '64px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 24px',
        boxShadow: '0 2px 12px rgba(91,188,176,0.4)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '26px', fontWeight: 900, color: C.orange, letterSpacing: '2px' }}>WISH</span>
          <span style={{ fontSize: '12px', fontWeight: 700, color: C.navy, letterSpacing: '2px', textTransform: 'uppercase', opacity: 0.8 }}>Admin Panel</span>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {saveStatus === 'saved' && <span style={{ color: '#166534', fontWeight: 700, fontSize: '14px', background: '#DCFCE7', padding: '4px 12px', borderRadius: '6px' }}>Saved!</span>}
          {saveStatus === 'error' && <span style={{ color: '#991B1B', fontWeight: 700, fontSize: '14px', background: '#FEE2E2', padding: '4px 12px', borderRadius: '6px' }}>Save failed</span>}
          <button
            onClick={() => { setShowHistory(true); loadHistory(); }}
            style={{ background: 'rgba(27,58,107,0.12)', color: C.navy, border: 'none', borderRadius: '8px', padding: '8px 16px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
          >
            History
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ background: C.orange, color: C.white, border: 'none', borderRadius: '8px', padding: '8px 20px', fontWeight: 700, fontSize: '14px', cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            onClick={handleLogout}
            style={{ background: 'rgba(27,58,107,0.12)', color: C.navy, border: 'none', borderRadius: '8px', padding: '8px 16px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
          >
            Log Out
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Sidebar */}
        <div style={{ width: '260px', background: C.white, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          {/* Top-level nav */}
          <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}` }}>
            {(['content', 'users'] as const).map(v => (
              <button
                key={v}
                onClick={() => { setAdminView(v); if (v === 'users') loadUsers(); }}
                style={{
                  flex: 1, padding: '12px', border: 'none', fontWeight: 700, fontSize: '12px', cursor: 'pointer',
                  textTransform: 'uppercase', letterSpacing: '0.5px',
                  background: adminView === v ? C.navy : 'transparent',
                  color: adminView === v ? C.white : C.gray,
                  borderBottom: adminView === v ? `2px solid ${C.orange}` : '2px solid transparent',
                  transition: 'all 0.15s',
                }}
              >
                {v === 'content' ? 'Content' : 'Users'}
              </button>
            ))}
          </div>
          {adminView === 'content' && (
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Modules ({modules.length})
            </span>
            <button
              onClick={addModule}
              style={{ background: C.navy, color: C.white, border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
            >
              + Add
            </button>
          </div>
          )}
          {adminView === 'content' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {modules.map((mod, idx) => (
              <div
                key={mod.id}
                onClick={() => { setSelectedModIdx(idx); setExpandedSlide(null); setExpandedQuestion(null); }}
                style={{
                  padding: '12px 16px', cursor: 'pointer',
                  borderBottom: `1px solid ${C.border}`,
                  background: selectedModIdx === idx ? '#EFF6FF' : 'transparent',
                  borderLeft: `4px solid ${selectedModIdx === idx ? C.orange : 'transparent'}`,
                  transition: 'background 0.1s',
                }}
              >
                <div style={{ fontSize: '10px', color: C.gray, marginBottom: '2px', fontWeight: 600 }}>Module {idx + 1}</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: C.navy, lineHeight: '1.3' }}>{mod.name}</div>
                <div style={{ fontSize: '11px', color: C.gray, marginTop: '4px' }}>
                  {mod.slides.length} slides · {(quizData[mod.id] || []).length} questions
                </div>
              </div>
            ))}
          </div>
          )}
          {adminView === 'users' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
            {usersLoading && <div style={{ color: C.gray, fontSize: '13px', padding: '8px' }}>Loading...</div>}
            {!usersLoading && users.length === 0 && (
              <div style={{ color: C.gray, fontSize: '13px', padding: '8px' }}>No users yet.</div>
            )}
            {users.map(u => {
              const pct = modules.length ? Math.round((u.modules_completed / modules.length) * 100) : 0;
              const done = u.modules_completed === modules.length && modules.length > 0;
              return (
                <div key={u.email} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '12px', marginBottom: '8px', borderLeft: `4px solid ${done ? C.green : u.modules_started > 0 ? C.orange : C.border}` }}>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: C.navy }}>{u.name}</div>
                  <div style={{ fontSize: '11px', color: C.gray, marginBottom: '6px' }}>{u.email}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', color: done ? C.green : C.gray, fontWeight: 600 }}>
                      {done ? 'Completed' : `${u.modules_completed}/${modules.length} modules`}
                    </span>
                    <span style={{ fontSize: '11px', color: C.gray }}>{pct}%</span>
                  </div>
                  <div style={{ height: '4px', background: C.border, borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: done ? C.green : C.orange, borderRadius: '2px', transition: 'width 0.3s' }} />
                  </div>
                  <div style={{ fontSize: '10px', color: C.gray, marginTop: '6px' }}>
                    Last active: {new Date(u.last_synced).toLocaleDateString()}
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>

        {/* Editor area */}
        {adminView === 'content' && <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {selectedMod ? (
            <>
              {/* Module toolbar */}
              <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: '14px 24px', display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...labelStyle, marginBottom: '4px' }}>Module Name</div>
                  <input
                    value={selectedMod.name}
                    onChange={e => updateModuleName(selectedModIdx, e.target.value)}
                    style={{ fontSize: '17px', fontWeight: 700, color: C.navy, border: 'none', borderBottom: `2px solid ${C.border}`, outline: 'none', padding: '4px 0', width: '100%', background: 'transparent', fontFamily: 'inherit' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                  <TabBtn active={activeTab === 'slides'} onClick={() => { setActiveTab('slides'); setExpandedSlide(null); }}>
                    Slides ({selectedMod.slides.length})
                  </TabBtn>
                  <TabBtn active={activeTab === 'quiz'} onClick={() => { setActiveTab('quiz'); setExpandedQuestion(null); }}>
                    Quiz ({selectedQuiz.length})
                  </TabBtn>
                  <button
                    onClick={() => deleteModule(selectedModIdx)}
                    style={{ background: '#FEE2E2', color: C.red, border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Delete Module
                  </button>
                </div>
              </div>

              {/* Scrollable content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                {activeTab === 'slides' ? (
                  <SlidesEditor
                    slides={selectedMod.slides}
                    expandedSlide={expandedSlide}
                    setExpandedSlide={setExpandedSlide}
                    onUpdate={(sIdx, field, val) => updateSlide(selectedModIdx, sIdx, field, val)}
                    onAdd={() => addSlide(selectedModIdx)}
                    onDelete={sIdx => deleteSlide(selectedModIdx, sIdx)}
                    onMove={(sIdx, dir) => moveSlide(selectedModIdx, sIdx, dir)}
                  />
                ) : (
                  <QuizEditor
                    questions={selectedQuiz}
                    expandedQuestion={expandedQuestion}
                    setExpandedQuestion={setExpandedQuestion}
                    onUpdate={(qIdx, field, val) => updateQuestion(selectedModIdx, qIdx, field, val)}
                    onUpdateOption={(qIdx, optIdx, val) => updateQuestionOption(selectedModIdx, qIdx, optIdx, val)}
                    onAdd={() => addQuestion(selectedModIdx)}
                    onDelete={qIdx => deleteQuestion(selectedModIdx, qIdx)}
                  />
                )}
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.gray, fontSize: '16px' }}>
              Select a module from the sidebar to begin editing
            </div>
          )}
        </div>}
      </div>

      {/* History drawer */}
      {showHistory && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }}>
          <div onClick={() => setShowHistory(false)} style={{ flex: 1, background: 'rgba(0,0,0,0.4)' }} />
          <div style={{ width: '480px', background: C.white, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)' }}>
            {/* Drawer header */}
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: '17px', fontWeight: 700, color: C.navy }}>Change History</div>
                <div style={{ fontSize: '12px', color: C.gray, marginTop: '2px' }}>Click Restore to roll back to any previous version</div>
              </div>
              <button onClick={() => setShowHistory(false)} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: C.gray }}>✕</button>
            </div>

            {/* Entries */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              {historyLoading && <div style={{ textAlign: 'center', padding: '48px', color: C.gray }}>Loading...</div>}
              {!historyLoading && history.length === 0 && (
                <div style={{ textAlign: 'center', padding: '48px', color: C.gray }}>No history yet. Save changes to start tracking.</div>
              )}
              {!historyLoading && history.map(entry => {
                const date = new Date(entry.timestamp);
                const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                return (
                  <div key={entry.id} style={{ background: C.bg, borderRadius: '10px', padding: '16px', marginBottom: '10px', border: `1px solid ${C.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: C.navy }}>{dateStr} · {timeStr}</div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: entry.type === 'course' ? C.teal : C.orange, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>
                          {entry.type === 'course' ? 'Course Edit' : 'Quiz Edit'}
                        </div>
                      </div>
                      <button
                        onClick={() => restoreSnapshot(entry.id)}
                        disabled={restoring === entry.id}
                        style={{ background: C.navy, color: C.white, border: 'none', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', fontWeight: 700, cursor: restoring === entry.id ? 'not-allowed' : 'pointer', opacity: restoring === entry.id ? 0.5 : 1, flexShrink: 0 }}
                      >
                        {restoring === entry.id ? 'Restoring...' : 'Restore'}
                      </button>
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '16px' }}>
                      {entry.changes.map((c, i) => (
                        <li key={i} style={{ fontSize: '13px', color: '#374151', lineHeight: '1.6' }}>{c}</li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
