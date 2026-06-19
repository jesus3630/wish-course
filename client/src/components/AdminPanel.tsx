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

function SmBtn({ onClick, disabled, danger, children }: {
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

// ─── Time helpers ─────────────────────────────────────────────────────────────

function formatTime(seconds: number | undefined): string {
  if (seconds === undefined || seconds === null || isNaN(seconds as number)) return '';
  const m = Math.floor((seconds as number) / 60);
  const s = Math.floor((seconds as number) % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function parseTime(val: string): number | null {
  const trimmed = val.trim();
  if (!trimmed) return null;
  if (trimmed.includes(':')) {
    const [m, s] = trimmed.split(':').map(Number);
    if (!isNaN(m) && !isNaN(s)) return m * 60 + s;
  } else {
    const n = parseFloat(trimmed);
    if (!isNaN(n)) return n;
  }
  return null;
}

// ─── Module Video Upload ──────────────────────────────────────────────────────

function ModuleVideoSection({ moduleId, videoUrl, token, onVideoUpdate }: {
  moduleId: string;
  videoUrl?: string;
  token: string;
  onVideoUpdate: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);

  async function handleVideoFile(file: File) {
    setUploading(true);
    setUploadPct(0);
    const formData = new FormData();
    formData.append('video', file);
    try {
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setUploadPct(Math.round((e.loaded / e.total) * 100));
      };
      await new Promise<void>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status === 200) {
            const { url } = JSON.parse(xhr.responseText);
            onVideoUpdate(url);
            resolve();
          } else reject(new Error(xhr.statusText));
        };
        xhr.onerror = reject;
        xhr.open('POST', `/api/admin/video/${moduleId}`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(formData);
      });
    } catch (e) {
      alert('Video upload failed. Please try again.');
    }
    setUploading(false);
    setUploadPct(0);
  }

  return (
    <div style={{ background: C.white, borderRadius: '10px', border: `1px solid ${C.border}`, padding: '16px 20px', marginBottom: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: videoUrl ? '12px' : '0' }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Module Video</div>
          {videoUrl && <div style={{ fontSize: '12px', color: C.teal, marginTop: '2px', fontFamily: 'monospace' }}>{videoUrl}</div>}
          {!videoUrl && !uploading && <div style={{ fontSize: '12px', color: C.gray, marginTop: '2px' }}>No video uploaded — upload one to enable per-slide clip timestamps</div>}
        </div>
        <label style={{
          padding: '7px 14px', background: uploading ? C.lightGray : C.navy,
          color: C.white, borderRadius: '6px', fontSize: '12px', fontWeight: 600,
          cursor: uploading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          {uploading ? `Uploading ${uploadPct}%...` : videoUrl ? 'Replace Video' : 'Upload Video'}
          <input type="file" accept="video/*" style={{ display: 'none' }} disabled={uploading}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleVideoFile(f); e.target.value = ''; }} />
        </label>
      </div>
      {uploading && (
        <div style={{ height: '4px', background: C.border, borderRadius: '2px', overflow: 'hidden', marginTop: '8px' }}>
          <div style={{ height: '100%', width: `${uploadPct}%`, background: C.teal, transition: 'width 0.2s', borderRadius: '2px' }} />
        </div>
      )}
      {videoUrl && (
        <video src={videoUrl} controls muted style={{ width: '100%', borderRadius: '6px', marginTop: '4px', maxHeight: '160px', background: '#000', display: 'block' }} />
      )}
    </div>
  );
}

// ─── Interactive Demo Prompts editor ─────────────────────────────────────────
// Loads the demo's default step prompts (via a hidden "introspect" iframe that
// the mockup posts back), and lets the admin override the wording per step.
// Overrides save into the slide's demo_prompts (empty = use the built-in default).
function DemoPromptsEditor({ moduleId, simUrl, overrides, onChange }: {
  moduleId: string;
  simUrl: string;
  overrides: string[] | null | undefined;
  onChange: (val: string[] | null) => void;
}) {
  const slideParam = (simUrl.match(/slide=(\d+)/) || [])[1] || '';
  const [defaults, setDefaults] = useState<string[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onMsg(e: MessageEvent) {
      const d: any = e.data;
      if (d && d.type === 'wish-demo-prompts' && String(d.module) === moduleId && String(d.slide) === String(slideParam)) {
        setDefaults(Array.isArray(d.prompts) ? d.prompts : []);
      }
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [open, moduleId, slideParam]);

  function setAt(i: number, val: string) {
    const arr = (defaults || []).map((_, k) => (overrides && overrides[k] != null ? overrides[k] : ''));
    while (arr.length <= i) arr.push('');
    arr[i] = val;
    onChange(arr.some(x => x && x.trim() !== '') ? arr : null);
  }

  const editedCount = (overrides || []).filter(x => x && x.trim() !== '').length;

  return (
    <div style={{ marginBottom: '16px', border: `1px solid ${C.border}`, borderRadius: '8px', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', textAlign: 'left', padding: '10px 14px', background: '#F0FDF4', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, color: '#166534', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <span>🖱 Interactive Demo Prompts{editedCount ? ` — ${editedCount} edited` : ''}</span>
        <span>{open ? '▲' : '▼ Edit'}</span>
      </button>
      {open && (
        <div style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', color: C.gray, marginBottom: '10px', lineHeight: 1.5 }}>
            Edit the wording shown at each step of this demo. Leave a box empty to keep the built-in default (shown as grey placeholder). Click Save Changes at the top when done.
          </div>
          {/* Hidden introspect iframe — the mockup posts back its default prompts */}
          <iframe
            title="demo-introspect"
            src={`/mockup/mockup.html?module=${encodeURIComponent(moduleId)}&slide=${encodeURIComponent(slideParam)}&introspect=1`}
            style={{ width: 0, height: 0, border: 'none', position: 'absolute', visibility: 'hidden' }}
          />
          {defaults === null ? (
            <div style={{ fontSize: '12px', color: C.gray }}>Loading demo steps…</div>
          ) : defaults.length === 0 ? (
            <div style={{ fontSize: '12px', color: C.gray }}>This demo has no editable text steps.</div>
          ) : (
            defaults.map((d, i) => {
              const ov = overrides && overrides[i] ? overrides[i] : '';
              return (
                <div key={i} style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: C.navy }}>Step {i + 1}</label>
                    {ov && <button onClick={() => setAt(i, '')} style={{ border: 'none', background: 'transparent', color: C.orange, fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}>↺ reset to default</button>}
                  </div>
                  <textarea
                    value={ov}
                    placeholder={d || '(no text on this step)'}
                    onChange={e => setAt(i, e.target.value)}
                    style={{ width: '100%', minHeight: '52px', resize: 'vertical', borderRadius: '6px', border: `1px solid ${ov ? C.orange : C.border}`, padding: '7px 9px', fontSize: '12.5px', fontFamily: 'inherit', color: C.navy, boxSizing: 'border-box' }}
                  />
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ─── Slides Editor ────────────────────────────────────────────────────────────

function SlidesEditor({
  slides, expandedSlide, setExpandedSlide, onUpdate, onAdd, onDelete, onMove,
  moduleId, token, onScreenshotUpdate, moduleVideoUrl,
}: {
  slides: Slide[];
  expandedSlide: number | null;
  setExpandedSlide: (i: number | null) => void;
  onUpdate: (idx: number, field: keyof Slide, val: string | number | string[] | null) => void;
  onAdd: () => void;
  onDelete: (idx: number) => void;
  onMove: (idx: number, dir: -1 | 1) => void;
  moduleId: string;
  token: string;
  onScreenshotUpdate: (idx: number, url: string) => void;
  moduleVideoUrl?: string;
}) {
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);

  async function handleScreenshotUpload(slideIdx: number, file: File) {
    setUploadingIdx(slideIdx);
    const reader = new FileReader();
    reader.onload = async () => {
      const imageData = reader.result as string;
      try {
        const res = await fetch('/api/admin/screenshot', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ moduleId, slideIndex: slideIdx, imageData }),
        });
        if (res.ok) {
          const { url } = await res.json();
          onScreenshotUpdate(slideIdx, url);
        }
      } catch {}
      setUploadingIdx(null);
    };
    reader.readAsDataURL(file);
  }

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
            {slide.screenshot && (
              <span style={{ fontSize: '11px', color: C.teal, fontWeight: 600 }}>IMG</span>
            )}
            <span style={{ fontSize: '12px', color: C.gray, whiteSpace: 'nowrap' }}>
              {(slide.text ?? '').length} chars
            </span>
            <span style={{ fontSize: '16px', color: C.gray }}>{expandedSlide === idx ? '▲' : '▼'}</span>
          </div>

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

              {slide.simulation_url && (
                <DemoPromptsEditor
                  moduleId={moduleId}
                  simUrl={slide.simulation_url}
                  overrides={slide.demo_prompts}
                  onChange={(val) => onUpdate(idx, 'demo_prompts', val)}
                />
              )}

              {/* Screenshot upload */}
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Screenshot</label>
                {slide.screenshot && (
                  <div style={{ marginBottom: '8px' }}>
                    <img
                      src={slide.screenshot}
                      alt="Slide screenshot"
                      style={{ maxWidth: '100%', maxHeight: '160px', objectFit: 'contain', borderRadius: '6px', border: `1px solid ${C.border}` }}
                    />
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <label style={{
                    padding: '6px 14px',
                    background: uploadingIdx === idx ? C.lightGray : C.navy,
                    color: C.white,
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: uploadingIdx === idx ? 'not-allowed' : 'pointer',
                  }}>
                    {uploadingIdx === idx ? 'Uploading...' : slide.screenshot ? 'Replace Image' : 'Upload Image'}
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      disabled={uploadingIdx === idx}
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) handleScreenshotUpload(idx, file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  {slide.screenshot && (
                    <SmBtn onClick={() => onUpdate(idx, 'screenshot' as keyof Slide, '')} danger>Remove</SmBtn>
                  )}
                </div>
              </div>

              {/* Video clip timestamps — only shown when module has a video */}
              {moduleVideoUrl && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>Video Clip Timestamps</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '11px', color: C.gray, marginBottom: '4px' }}>Start (M:SS)</div>
                      <input
                        style={{ ...inputStyle, marginBottom: 0, fontFamily: 'monospace' }}
                        placeholder="0:00"
                        defaultValue={formatTime(slide.video_start)}
                        key={`start-${idx}-${slide.video_start}`}
                        onBlur={e => {
                          const parsed = parseTime(e.target.value);
                          if (parsed !== null) onUpdate(idx, 'video_start', parsed);
                        }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '11px', color: C.gray, marginBottom: '4px' }}>End (M:SS)</div>
                      <input
                        style={{ ...inputStyle, marginBottom: 0, fontFamily: 'monospace' }}
                        placeholder="0:00"
                        defaultValue={formatTime(slide.video_end)}
                        key={`end-${idx}-${slide.video_end}`}
                        onBlur={e => {
                          const parsed = parseTime(e.target.value);
                          if (parsed !== null) onUpdate(idx, 'video_end', parsed);
                        }}
                      />
                    </div>
                    {slide.video_start !== undefined && slide.video_end !== undefined && (
                      <div style={{ alignSelf: 'flex-end', paddingBottom: '2px' }}>
                        <a
                          href={`${moduleVideoUrl}#t=${slide.video_start},${slide.video_end}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ display: 'inline-block', padding: '10px 12px', background: C.teal, color: C.white, borderRadius: '6px', fontSize: '12px', fontWeight: 600, textDecoration: 'none' }}
                        >
                          Preview
                        </a>
                      </div>
                    )}
                  </div>
                  {slide.video_start !== undefined && slide.video_end !== undefined && (
                    <div style={{ fontSize: '11px', color: C.gray, marginTop: '6px' }}>
                      Clip: {formatTime(slide.video_start)} – {formatTime(slide.video_end)} ({((slide.video_end - slide.video_start)).toFixed(1)}s)
                    </div>
                  )}
                </div>
              )}

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

interface RosterEntry {
  email: string;
  name: string | null;
  added_at: string;
}

// ─── Main AdminPanel ──────────────────────────────────────────────────────────

export default function AdminPanel() {
  const [loginPassword, setLoginPassword] = useState('');
  const [token, setToken] = useState('');
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

  const [adminView, setAdminView] = useState<'content' | 'users' | 'roster' | 'recap' | 'analytics'>('content');
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterEmail, setRosterEmail] = useState('');
  const [rosterName, setRosterName] = useState('');
  const [rosterSaving, setRosterSaving] = useState(false);
  const [inviteSending, setInviteSending] = useState<Record<string, boolean>>({});

  const authHeaders = { 'Authorization': `Bearer ${token}` };

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

  async function loadHistory(tok: string) {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/admin/history', { headers: { 'Authorization': `Bearer ${tok}` } });
      if (res.ok) setHistory(await res.json());
    } catch {}
    setHistoryLoading(false);
  }

  async function loadUsers() {
    setUsersLoading(true);
    try {
      const res = await fetch('/api/admin/users', { headers: authHeaders });
      if (res.ok) setUsers(await res.json());
    } catch {}
    setUsersLoading(false);
  }

  async function loadAnalytics() {
    setAnalyticsLoading(true);
    try {
      const res = await fetch('/api/admin/analytics', { headers: authHeaders });
      if (res.ok) setAnalytics(await res.json());
    } catch {}
    setAnalyticsLoading(false);
  }

  async function loadRoster() {
    setRosterLoading(true);
    try {
      const res = await fetch('/api/admin/roster', { headers: authHeaders });
      if (res.ok) setRoster(await res.json());
    } catch {}
    setRosterLoading(false);
  }

  async function addToRoster() {
    if (!rosterEmail.trim()) return;
    setRosterSaving(true);
    try {
      const res = await fetch('/api/admin/roster', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: rosterEmail.trim(), name: rosterName.trim() || null }),
      });
      if (res.ok) {
        setRosterEmail('');
        setRosterName('');
        loadRoster();
      }
    } catch {}
    setRosterSaving(false);
  }

  async function sendInvite(email: string) {
    setInviteSending(s => ({ ...s, [email]: true }));
    try {
      const res = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        alert(`Invite sent to ${email}`);
      } else {
        const err = await res.json();
        alert(`Failed: ${err.error || 'Unknown error'}`);
      }
    } catch {
      alert('Network error sending invite');
    }
    setInviteSending(s => ({ ...s, [email]: false }));
  }

  async function removeFromRoster(email: string) {
    if (!window.confirm(`Remove ${email} from roster?`)) return;
    try {
      const res = await fetch(`/api/admin/roster/${encodeURIComponent(email)}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (res.ok) loadRoster();
    } catch {}
  }

  async function restoreSnapshot(id: string) {
    if (!window.confirm('Restore this version? Current content will be overwritten.')) return;
    setRestoring(id);
    try {
      const res = await fetch(`/api/admin/restore/${id}`, {
        method: 'POST',
        headers: authHeaders,
      });
      if (res.ok) {
        await loadData();
        setShowHistory(false);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    } catch {}
    setRestoring(null);
  }

  // Validate saved token on load
  useEffect(() => {
    const saved = sessionStorage.getItem('wish_admin_token');
    if (saved) {
      fetch('/api/admin/validate', { headers: { 'Authorization': `Bearer ${saved}` } })
        .then(res => {
          if (res.ok) {
            setToken(saved);
            setAuthed(true);
          } else {
            sessionStorage.removeItem('wish_admin_token');
          }
        })
        .catch(() => sessionStorage.removeItem('wish_admin_token'));
    }
  }, []);

  useEffect(() => {
    if (authed) loadData();
  }, [authed, loadData]);

  async function handleLogin() {
    if (!loginPassword.trim()) return;
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: loginPassword }),
      });
      if (res.ok) {
        const { token: newToken } = await res.json();
        sessionStorage.setItem('wish_admin_token', newToken);
        setToken(newToken);
        setAuthed(true);
      } else if (res.status === 429) {
        setLoginError('Too many login attempts. Try again in 15 minutes.');
      } else {
        setLoginError('Incorrect password');
      }
    } catch {
      setLoginError('Connection error. Please try again.');
    }
    setLoginLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    setSaveStatus('idle');
    try {
      const [cr, qr] = await Promise.all([
        fetch('/api/admin/course', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify(modules),
        }),
        fetch('/api/admin/quiz', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
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
    sessionStorage.removeItem('wish_admin_token');
    setToken('');
    setAuthed(false);
    setLoginPassword('');
  }

  // ─── Slide mutations ────────────────────────────────────────────────────────

  function updateSlide(modIdx: number, slideIdx: number, field: keyof Slide, value: string | number | string[] | null) {
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

  function updateModuleVideo(modIdx: number, url: string) {
    setModules(prev => {
      const next: Module[] = JSON.parse(JSON.stringify(prev));
      (next[modIdx] as any).video_url = url;
      return next;
    });
  }

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
            value={loginPassword}
            onChange={e => setLoginPassword(e.target.value)}
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
            onClick={() => { setShowHistory(true); loadHistory(token); }}
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
            {(['content', 'users', 'roster', 'recap', 'analytics'] as const).map(v => (
              <button
                key={v}
                onClick={() => {
                  setAdminView(v);
                  if (v === 'users') loadUsers();
                  if (v === 'roster') loadRoster();
                  if (v === 'analytics') loadAnalytics();
                }}
                style={{
                  flex: 1, padding: '10px 4px', border: 'none', fontWeight: 700, fontSize: '11px', cursor: 'pointer',
                  textTransform: 'uppercase', letterSpacing: '0.5px',
                  background: adminView === v ? C.navy : 'transparent',
                  color: adminView === v ? C.white : C.gray,
                  borderBottom: adminView === v ? `2px solid ${C.orange}` : '2px solid transparent',
                  transition: 'all 0.15s',
                }}
              >
                {v}
              </button>
            ))}
          </div>

          {/* Content tab: module list */}
          {adminView === 'content' && (
            <>
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
            </>
          )}

          {/* Users tab */}
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

          {/* Trouble Spots (analytics) tab */}
          {adminView === 'analytics' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
              <div style={{ background: '#EFF6FF', border: `1px solid #BFDBFE`, borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', fontSize: '11px', color: C.navy, lineHeight: '1.5' }}>
                Where learners struggle — quiz questions ranked by how often they're answered wrong. Use this to spot confusing questions or content gaps.
              </div>
              {analyticsLoading && <div style={{ color: C.gray, fontSize: '13px', padding: '8px' }}>Loading...</div>}
              {!analyticsLoading && analytics.filter(a => a.type === 'quiz').length === 0 && (
                <div style={{ color: C.gray, fontSize: '13px', padding: '8px' }}>No quiz attempts recorded yet. Data appears here as learners take quizzes.</div>
              )}
              {analytics.filter(a => a.type === 'quiz').map(a => {
                const total = (a.hits || 0) + (a.misses || 0);
                const rate = total ? Math.round((a.misses / total) * 100) : 0;
                const col = rate >= 50 ? C.red : rate >= 25 ? C.orange : C.green;
                return (
                  <div key={a.key} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '12px', marginBottom: '8px', borderLeft: `4px solid ${col}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'baseline' }}>
                      <span style={{ fontSize: '10px', color: C.gray, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{a.module_id || '—'}</span>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: col, whiteSpace: 'nowrap' }}>{rate}% missed</span>
                    </div>
                    <div style={{ fontSize: '12.5px', color: C.navy, margin: '5px 0 7px', lineHeight: '1.4' }}>{a.label || a.key}</div>
                    <div style={{ height: '4px', background: C.border, borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${rate}%`, background: col, borderRadius: '2px' }} />
                    </div>
                    <div style={{ fontSize: '10px', color: C.gray, marginTop: '6px' }}>{a.misses} wrong of {total} answers</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Roster tab */}
          {adminView === 'roster' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
              <div style={{ background: '#EFF6FF', border: `1px solid #BFDBFE`, borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', fontSize: '11px', color: C.navy, lineHeight: '1.5' }}>
                Enable roster enforcement by setting <strong>REQUIRE_ROSTER=true</strong> in Railway env vars. When enabled, only listed emails can log in.
              </div>
              {/* Add to roster */}
              <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Add to Roster</div>
                <input
                  value={rosterEmail}
                  onChange={e => setRosterEmail(e.target.value)}
                  placeholder="Email address"
                  style={{ ...inputStyle, marginBottom: '6px', fontSize: '13px' }}
                  onKeyDown={e => e.key === 'Enter' && addToRoster()}
                />
                <input
                  value={rosterName}
                  onChange={e => setRosterName(e.target.value)}
                  placeholder="Name (optional)"
                  style={{ ...inputStyle, marginBottom: '8px', fontSize: '13px' }}
                  onKeyDown={e => e.key === 'Enter' && addToRoster()}
                />
                <button
                  onClick={addToRoster}
                  disabled={rosterSaving || !rosterEmail.trim()}
                  style={{
                    width: '100%', padding: '8px', background: C.navy, color: C.white,
                    border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 700,
                    cursor: rosterSaving || !rosterEmail.trim() ? 'not-allowed' : 'pointer',
                    opacity: !rosterEmail.trim() ? 0.5 : 1,
                  }}
                >
                  {rosterSaving ? 'Adding...' : 'Add'}
                </button>
              </div>
              {/* Roster list */}
              {rosterLoading && <div style={{ color: C.gray, fontSize: '13px', padding: '8px' }}>Loading...</div>}
              {!rosterLoading && roster.length === 0 && (
                <div style={{ color: C.gray, fontSize: '13px', padding: '8px', textAlign: 'center' }}>
                  No emails on roster yet.
                </div>
              )}
              {roster.map(r => (
                <div key={r.email} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '10px 12px', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    {r.name && <div style={{ fontSize: '12px', fontWeight: 700, color: C.navy }}>{r.name}</div>}
                    <div style={{ fontSize: '11px', color: C.gray }}>{r.email}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => sendInvite(r.email)}
                      disabled={inviteSending[r.email]}
                      style={{ background: '#EFF6FF', color: C.navy, border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontWeight: 600, cursor: inviteSending[r.email] ? 'not-allowed' : 'pointer', opacity: inviteSending[r.email] ? 0.6 : 1 }}
                    >
                      {inviteSending[r.email] ? 'Sending...' : 'Send Invite'}
                    </button>
                    <button
                      onClick={() => removeFromRoster(r.email)}
                      style={{ background: '#FEE2E2', color: C.red, border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Editor area */}
        {adminView === 'content' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
                    <>
                      <ModuleVideoSection
                        moduleId={selectedMod.id}
                        videoUrl={selectedMod.video_url}
                        token={token}
                        onVideoUpdate={(url) => updateModuleVideo(selectedModIdx, url)}
                      />
                      <SlidesEditor
                        slides={selectedMod.slides}
                        expandedSlide={expandedSlide}
                        setExpandedSlide={setExpandedSlide}
                        onUpdate={(sIdx, field, val) => updateSlide(selectedModIdx, sIdx, field, val)}
                        onAdd={() => addSlide(selectedModIdx)}
                        onDelete={sIdx => deleteSlide(selectedModIdx, sIdx)}
                        onMove={(sIdx, dir) => moveSlide(selectedModIdx, sIdx, dir)}
                        moduleId={selectedMod.id}
                        token={token}
                        onScreenshotUpdate={(sIdx, url) => updateSlide(selectedModIdx, sIdx, 'screenshot' as keyof Slide, url)}
                        moduleVideoUrl={selectedMod.video_url}
                      />
                    </>
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
          </div>
        )}

        {/* Voice Recap area */}
        {adminView === 'recap' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <RecapPanel />
          </div>
        )}
      </div>

      {/* History drawer */}
      {showHistory && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }}>
          <div onClick={() => setShowHistory(false)} style={{ flex: 1, background: 'rgba(0,0,0,0.4)' }} />
          <div style={{ width: '480px', background: C.white, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)' }}>
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: '17px', fontWeight: 700, color: C.navy }}>Change History</div>
                <div style={{ fontSize: '12px', color: C.gray, marginTop: '2px' }}>Click Restore to roll back to any previous version</div>
              </div>
              <button onClick={() => setShowHistory(false)} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: C.gray }}>✕</button>
            </div>

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

// ─── Voice Recap panel ────────────────────────────────────────────────────────
const DEFAULT_RECAP = `Here's your recap. We've been rebuilding the Manager Self Service module, Module 20, so every interactive demo matches the real WISH screens.

We finished five interactive simulations: the MSS portal overview, Publishing Shifts on the Web Shift tab, the Auto-Schedule versus Manual Approval comparison, the Web Shift Approval tab with its full job to shift to role expand and the Web Schedule Request approve and deny popup, and the Web Shift Report tab where Produce Report opens the full status report.

Everything is deployed to the live training site and verified. Module 20 is complete. Whenever you're ready, just point me at the next module or screen.`;

function RecapPanel() {
  const C = { navy: '#1B3A6B', orange: '#D4782A', teal: '#5BBCB0', gray: '#6B7280', white: '#FFFFFF', bg: '#F4F7FA', border: '#E5E7EB', red: '#EF4444' };
  const [text, setText] = useState(DEFAULT_RECAP);
  const [loading, setLoading] = useState(false);
  const [audioSrc, setAudioSrc] = useState('');
  const [error, setError] = useState('');

  async function generate() {
    setError('');
    setAudioSrc('');
    setLoading(true);
    try {
      const res = await fetch('/api/narrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.slice(0, 5000) }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({} as any));
        throw new Error(e.error || `Request failed (${res.status})`);
      }
      const data = await res.json();
      if (!data.audio) throw new Error('No audio returned');
      setAudioSrc(`data:audio/mpeg;base64,${data.audio}`);
    } catch (e: any) {
      setError(e.message || 'Failed to generate audio');
    } finally {
      setLoading(false);
    }
  }

  function download() {
    if (!audioSrc) return;
    const a = document.createElement('a');
    a.href = audioSrc;
    a.download = `WISH_Recap_${new Date().toISOString().slice(0, 10)}.mp3`;
    a.click();
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px', maxWidth: '820px', width: '100%', margin: '0 auto' }}>
      <div style={{ fontSize: '20px', fontWeight: 800, color: C.navy }}>🔊 Voice Recap</div>
      <div style={{ fontSize: '13px', color: C.gray, marginTop: '4px', marginBottom: '20px', lineHeight: 1.5 }}>
        Type or paste anything you want read aloud — a session recap, an announcement, instructions — and hear it in the
        course's Darryl voice. Plays right here in the browser, no downloads needed.
      </div>

      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={12}
        placeholder="What should the recap say?"
        style={{
          width: '100%', fontSize: '14px', lineHeight: 1.6, color: '#1F2937', padding: '16px',
          border: `1px solid ${C.border}`, borderRadius: '10px', outline: 'none', resize: 'vertical',
          fontFamily: 'inherit', background: C.white,
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
        <span style={{ fontSize: '11px', color: text.length > 5000 ? C.red : C.gray }}>
          {text.length} / 5000 characters{text.length > 5000 ? ' — will be truncated' : ''}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: '16px', alignItems: 'center' }}>
        <button
          onClick={generate}
          disabled={loading || !text.trim()}
          style={{
            background: C.orange, color: C.white, border: 'none', borderRadius: '8px', padding: '11px 22px',
            fontSize: '14px', fontWeight: 700, cursor: loading || !text.trim() ? 'not-allowed' : 'pointer',
            opacity: loading || !text.trim() ? 0.55 : 1, display: 'flex', alignItems: 'center', gap: '8px',
          }}
        >
          {loading ? '⏳ Generating…' : '🔊 Generate & Play'}
        </button>
        {audioSrc && (
          <button
            onClick={download}
            style={{
              background: 'transparent', color: C.navy, border: `1px solid ${C.navy}`, borderRadius: '8px',
              padding: '11px 18px', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
            }}
          >
            ⬇ Download MP3
          </button>
        )}
      </div>

      {error && (
        <div style={{ marginTop: '16px', background: '#FEE2E2', color: C.red, border: '1px solid #FCA5A5', borderRadius: '8px', padding: '10px 14px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {audioSrc && (
        <div style={{ marginTop: '20px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
            Recap audio
          </div>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio src={audioSrc} controls autoPlay style={{ width: '100%' }} />
        </div>
      )}

      <div style={{ marginTop: '24px', fontSize: '12px', color: C.gray, lineHeight: 1.6, borderTop: `1px solid ${C.border}`, paddingTop: '16px' }}>
        Voice: <strong>Darryl</strong> (ElevenLabs) — the same voice used for course narration. Generated audio is cached on
        the server, so replaying the same text is instant and free.
      </div>
    </div>
  );
}
