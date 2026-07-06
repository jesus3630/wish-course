import React, { useRef, useState } from 'react';

// Voice Q&A tutor — ask by text or voice, answered from the module's own content, spoken back.
type Msg = { role: 'you' | 'tutor'; text: string };

const C = { teal: '#5BBCB0', navy: '#1B3A6B', orange: '#D4782A', ink: '#1F2937', line: '#E5E7EB' };

export default function TutorWidget({ moduleId, moduleName }: { moduleId: string; moduleName: string }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speak, setSpeak] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recogRef = useRef<any>(null);

  const scrollDown = () => setTimeout(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, 30);

  async function speakAnswer(text: string) {
    if (!speak) return;
    try {
      const r = await fetch('/api/narrate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
      if (r.ok) {
        const { audio } = await r.json();
        if (audio) {
          if (audioRef.current) audioRef.current.pause();
          const a = new Audio('data:audio/mpeg;base64,' + audio);
          audioRef.current = a;
          a.play().catch(() => {});
          return;
        }
      }
    } catch { /* fall through */ }
    // Fallback: browser speech
    try { const u = new SpeechSynthesisUtterance(text); window.speechSynthesis.speak(u); } catch { /* ignore */ }
  }

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
      speakAnswer(answer);
    } catch {
      setMsgs(m => [...m, { role: 'tutor', text: 'Something went wrong reaching the trainer. Please try again.' }]);
      scrollDown();
    } finally {
      setBusy(false);
    }
  }

  function toggleMic() {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Voice input is not supported in this browser — please type your question.'); return; }
    if (listening) { recogRef.current?.stop(); setListening(false); return; }
    const rec = new SR();
    rec.lang = 'en-US'; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onresult = (e: any) => { const t = e.results[0][0].transcript; setInput(''); ask(t); };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recogRef.current = rec; setListening(true); rec.start();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} aria-label="Ask the trainer" style={{
        position: 'fixed', bottom: 20, right: 20, zIndex: 900, border: 'none', cursor: 'pointer',
        background: `linear-gradient(135deg, ${C.teal}, ${C.navy})`, color: '#fff', borderRadius: 24,
        padding: '11px 18px', fontSize: 14, fontWeight: 700, boxShadow: '0 6px 18px rgba(0,0,0,0.22)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 16 }}>💬</span> Ask the Trainer
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20, zIndex: 900, width: 340, maxWidth: 'calc(100vw - 32px)',
      height: 460, maxHeight: 'calc(100vh - 40px)', background: '#fff', borderRadius: 14,
      boxShadow: '0 14px 44px rgba(0,0,0,0.28)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      border: `1px solid ${C.line}`,
    }}>
      <div style={{ background: `linear-gradient(135deg, ${C.teal}, ${C.navy})`, color: '#fff', padding: '11px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 14 }}>Ask the Trainer</div>
          <div style={{ fontSize: 11, opacity: 0.85 }}>{moduleName}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => setSpeak(s => !s)} title={speak ? 'Voice on' : 'Voice off'} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, opacity: speak ? 1 : 0.45 }}>🔊</button>
          <button onClick={() => setOpen(false)} aria-label="Close" style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
      </div>

      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: 14, background: '#F7FAFB' }}>
        {msgs.length === 0 && (
          <div style={{ color: '#6B7280', fontSize: 13, lineHeight: 1.5 }}>
            Ask anything about <b>{moduleName}</b> — type it or tap the mic. Answers come from this module's training material.
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'you' ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
            <div style={{
              maxWidth: '82%', padding: '8px 11px', borderRadius: 12, fontSize: 13, lineHeight: 1.45,
              background: m.role === 'you' ? C.navy : '#fff', color: m.role === 'you' ? '#fff' : C.ink,
              border: m.role === 'you' ? 'none' : `1px solid ${C.line}`,
              borderBottomRightRadius: m.role === 'you' ? 3 : 12, borderBottomLeftRadius: m.role === 'you' ? 12 : 3,
            }}>{m.text}</div>
          </div>
        ))}
        {busy && <div style={{ color: '#9CA3AF', fontSize: 12, fontStyle: 'italic' }}>Trainer is thinking…</div>}
      </div>

      <div style={{ padding: 10, borderTop: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={toggleMic} title="Speak your question" style={{
          width: 38, height: 38, borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0,
          background: listening ? C.orange : '#EEF2F4', color: listening ? '#fff' : C.navy, fontSize: 17,
        }}>🎤</button>
        <input
          value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') ask(input); }}
          placeholder={listening ? 'Listening…' : 'Type your question…'} disabled={busy}
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
