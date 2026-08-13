import React from 'react';
import { useIsMobile } from '../utils/useIsMobile';

/**
 * "What you see depends on your access."
 *
 * One course for everyone means a learner will meet screens they cannot fully
 * use yet. Rather than splitting the training by permission — which leaves people
 * blind to what exists — every screen that behaves differently by access level
 * says so, side by side, at the moment the screen is on show.
 *
 * The point is that when someone is later granted higher access, nothing is new
 * to them: they were told what would change and where.
 */

export type AccessVariant = {
  /** Name of the permission that unlocks the fuller view, e.g. "HR Admin". */
  requires: string;
  /** What someone WITHOUT that permission sees. */
  base: string;
  /** What someone WITH it sees. */
  elevated: string;
  /** Optional: the field or area this is about, e.g. "Social Security Number". */
  field?: string;
};

const C = {
  navy: '#1B3A6B', orange: '#D4782A', teal: '#2F8C7F',
  ink: '#334155', muted: '#64748B', line: '#E2E8F0',
};

export default function AccessNote({ variant }: { variant: AccessVariant }) {
  const isMobile = useIsMobile();
  return (
    <div style={{
      border: `2px solid ${C.orange}`, borderRadius: 12, overflow: 'hidden',
      margin: '22px 0', background: '#fff',
    }}>
      <div style={{
        background: '#FFF7ED', padding: '10px 16px', borderBottom: `1px solid ${C.line}`,
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 16 }} aria-hidden>🔑</span>
        <strong style={{ fontSize: 13.5, color: '#92400E', letterSpacing: 0.2 }}>
          What you see here depends on your access
        </strong>
        {variant.field && (
          <span style={{
            fontSize: 11.5, fontWeight: 700, color: C.navy, background: '#fff',
            border: `1px solid ${C.line}`, borderRadius: 20, padding: '2px 10px',
          }}>{variant.field}</span>
        )}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap: 1, background: C.line,
      }}>
        <Pane
          tag="Standard access"
          tagColor={C.muted}
          body={variant.base}
        />
        <Pane
          tag={`With ${variant.requires}`}
          tagColor={C.teal}
          body={variant.elevated}
        />
      </div>

      <div style={{
        padding: '10px 16px', borderTop: `1px solid ${C.line}`,
        fontSize: 12.5, color: C.muted, lineHeight: 1.5, background: '#FCFDFE',
      }}>
        Learn both. If your access changes later, you will already know what
        appears and what you become responsible for — nobody has to retrain you.
      </div>
    </div>
  );
}

function Pane({ tag, tagColor, body }: { tag: string; tagColor: string; body: string }) {
  return (
    <div style={{ background: '#fff', padding: '14px 16px' }}>
      <div style={{
        fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em',
        color: tagColor, marginBottom: 7,
      }}>{tag}</div>
      <div style={{ fontSize: 14, color: C.ink, lineHeight: 1.55 }}>{body}</div>
    </div>
  );
}
