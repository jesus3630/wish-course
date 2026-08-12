import React, { useRef, useState } from 'react';
import { useIsMobile } from '../utils/useIsMobile';

// Voice Q&A tutor — ask by text or voice, answered from the module's own content, spoken back.
type Msg = { role: 'you' | 'tutor'; text: string };

const C = { teal: '#5BBCB0', navy: '#1B3A6B', orange: '#D4782A', ink: '#1F2937', line: '#E5E7EB' };

export default function TutorWidget({ moduleId, moduleName }: { moduleId: string; moduleName: string }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Top-left, inside the header band next to "← Back". The old right-edge anchor floated
  // over the interactive sim and the narration column; the header strip is the one place
  // that is empty on every slide type. On mobile the header wraps, so sit just below it.
  const anchor: React.CSSProperties = isMobile
    ? { position: 'fixed', top: 'auto', bottom: 14, left: 14, transform: 'none' }
    : { position: 'fixed', top: 17, left: 116, transform: 'none' };

  const scrollDown = () => setTimeout(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, 30);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setMsgs(m => [...m, { role: 'you', text: q }]);
    setInput('');
    setBusy(true);
    scrollDown();
    try {
      const r = await fetch('/api/tutor/ask', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId, question: q }),
      });
      const data = await r.json();
      const answer = data.answer || 'Sorry, I could not answer that. Please contact your WISH administrator.';
      setMsgs(m => [...m, { role: 'tutor', text: answer }]);
      scrollDown();
    } catch {
      setMsgs(m => [...m, { role: 'tutor', text: 'Something went wrong reaching the trainer. Please try again.' }]);
      scrollDown();
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} aria-label="Ask the trainer" style={{
        ...anchor, zIndex: 900, border: 'none', cursor: 'pointer',
        background: `linear-gradient(135deg, ${C.teal}, ${C.navy})`, color: '#fff', borderRadius: 24,
        padding: isMobile ? '11px 18px' : '8px 15px', fontSize: isMobile ? 14 : 13, fontWeight: 700,
        boxShadow: '0 6px 18px rgba(0,0,0,0.22)',
        display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
      }}>
        <span style={{ fontSize: 16 }}>💬</span> Ask the Trainer
      </button>
    );
  }

  return (
    <div style={{
      ...(isMobile
        ? { position: 'fixed' as const, bottom: 14, left: 14 }
        : { position: 'fixed' as const, top: 80, left: 14 }),
      zIndex: 900, width: 340, maxWidth: 'calc(100vw - 32px)',
      height: 460, maxHeight: 'calc(100vh - 100px)', background: '#fff', borderRadius: 14,
      boxShadow: '0 14px 44px rgba(0,0,0,0.28)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      border: `1px solid ${C.line}`,
    }}>
      <div style={{ background: `linear-gradient(135deg, ${C.teal}, ${C.navy})`, color: '#fff', padding: '11px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 14 }}>Ask the Trainer</div>
          <div style={{ fontSize: 11, opacity: 0.85 }}>{moduleName}</div>
        </div>
        <button onClick={() => setOpen(false)} aria-label="Close" style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
      </div>

      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: 14, background: '#F7FAFB' }}>
        {msgs.length === 0 && (
          <div style={{ color: '#6B7280', fontSize: 13, lineHeight: 1.5 }}>
            Ask anything about <b>{moduleName}</b> and I'll answer from this module's training material.
          </div>
        )}
        {msgs.map((m, i) => {
          const bullets = m.role === 'tutor' ? m.text.split('\n').map(s => s.trim()).filter(Boolean) : null;
          return (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'you' ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
              <div style={{
                maxWidth: '82%', padding: '8px 11px', borderRadius: 12, fontSize: 13, lineHeight: 1.45,
                background: m.role === 'you' ? C.navy : '#fff', color: m.role === 'you' ? '#fff' : C.ink,
                border: m.role === 'you' ? 'none' : `1px solid ${C.line}`,
                borderBottomRightRadius: m.role === 'you' ? 3 : 12, borderBottomLeftRadius: m.role === 'you' ? 12 : 3,
              }}>
                {bullets
                  ? bullets.map((line, li) => (
                      <div key={li} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginTop: li ? 4 : 0 }}>
                        <span style={{ color: C.orange, flexShrink: 0 }}>•</span>
                        <span>{line.replace(/^[-•*]\s*/, '')}</span>
                      </div>
                    ))
                  : m.text}
              </div>
            </div>
          );
        })}
        {busy && <div style={{ color: '#9CA3AF', fontSize: 12, fontStyle: 'italic' }}>Trainer is thinking…</div>}
      </div>

      <div style={{ padding: 10, borderTop: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') ask(input); }}
          placeholder="Type your question…" disabled={busy} autoFocus
          style={{ flex: 1, border: `1px solid ${C.line}`, borderRadius: 10, padding: '9px 11px', fontSize: 13, outline: 'none' }}
        />
        <button onClick={() => ask(input)} disabled={busy || !input.trim()} style={{
          background: C.orange, color: '#fff', border: 'none', borderRadius: 10, padding: '9px 13px',
          fontWeight: 700, fontSize: 13, cursor: busy || !input.trim() ? 'default' : 'pointer', opacity: busy || !input.trim() ? 0.5 : 1, flexShrink: 0,
        }}>Send</button>
      </div>
    </div>
  );
}
