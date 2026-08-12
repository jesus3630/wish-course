import React, { useEffect } from 'react';

type CharacterState = 'idle' | 'talking' | 'celebrating';

interface Props {
  state: CharacterState;
  /** Which face to show. Defaults to the first entry in AVATARS. */
  avatar?: string;
}

// The trainer's face. Add more entries (Daryl, others) and pass `avatar="daryl"`
// from ModulePlayer to rotate — nothing else needs to change.
export const AVATARS: Record<string, { src: string; name: string }> = {
  jesus: { src: '/avatars/jesus.png', name: 'Jesus Gonzalez' },
};
const DEFAULT_AVATAR = 'jesus';

// Inject keyframe animations once
const STYLE_ID = 'wish-character-styles';
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes wish-float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-8px); }
    }
    @keyframes wish-talk {
      0%, 100% { transform: translateY(0px) scale(1); }
      25% { transform: translateY(-4px) scale(1.03); }
      75% { transform: translateY(2px) scale(0.98); }
    }
    @keyframes wish-celebrate {
      0%   { transform: translateY(0px) rotate(0deg) scale(1); }
      20%  { transform: translateY(-18px) rotate(-8deg) scale(1.1); }
      40%  { transform: translateY(-6px) rotate(6deg) scale(1.05); }
      60%  { transform: translateY(-14px) rotate(-5deg) scale(1.08); }
      80%  { transform: translateY(-4px) rotate(4deg) scale(1.03); }
      100% { transform: translateY(0px) rotate(0deg) scale(1); }
    }
    @keyframes wish-blink {
      0%, 90%, 100% { transform: scaleY(1); }
      95% { transform: scaleY(0.1); }
    }
    @keyframes wish-mouth-talk {
      0%, 100% { d: path('M 18 30 Q 25 36 32 30'); }
      50%       { d: path('M 18 30 Q 25 40 32 30'); }
    }
    @keyframes wish-mouth-idle {
      0%, 100% { d: path('M 18 30 Q 25 34 32 30'); }
      50%       { d: path('M 18 31 Q 25 35 32 31'); }
    }
    @keyframes wish-mouth-celebrate {
      0%, 100% { d: path('M 16 28 Q 25 40 34 28'); }
      50%       { d: path('M 16 26 Q 25 42 34 26'); }
    }
    @keyframes wish-star-pop {
      0%   { opacity: 0; transform: scale(0) rotate(0deg); }
      50%  { opacity: 1; transform: scale(1.2) rotate(180deg); }
      100% { opacity: 0; transform: scale(0.8) rotate(360deg); }
    }
    @keyframes wish-wave {
      0%, 100% { transform: rotate(0deg); transform-origin: bottom center; }
      25%  { transform: rotate(25deg); transform-origin: bottom center; }
      75%  { transform: rotate(-15deg); transform-origin: bottom center; }
    }
    @keyframes wish-soundwave {
      0%, 100% { opacity: 0.3; transform: scaleY(0.4); }
      50%       { opacity: 1;   transform: scaleY(1); }
    }
  `;
  document.head.appendChild(style);
}

export default function Character({ state, avatar }: Props) {
  useEffect(() => { injectStyles(); }, []);
  const face = AVATARS[avatar ?? DEFAULT_AVATAR] ?? AVATARS[DEFAULT_AVATAR];

  const bodyAnim =
    state === 'talking'     ? 'wish-talk 0.5s ease-in-out infinite' :
    state === 'celebrating' ? 'wish-celebrate 0.7s ease-in-out infinite' :
                              'wish-float 3s ease-in-out infinite';

  const isCelebrating = state === 'celebrating';
  const isTalking     = state === 'talking';

  return (
    <div style={{ position: 'relative', width: '90px', userSelect: 'none' }}>
      {/* Stars on celebrate */}
      {isCelebrating && (
        <>
          <div style={{ position: 'absolute', top: '-10px', left: '0px', fontSize: '16px', animation: 'wish-star-pop 0.8s ease-in-out infinite', animationDelay: '0s' }}>⭐</div>
          <div style={{ position: 'absolute', top: '-14px', right: '4px', fontSize: '13px', animation: 'wish-star-pop 0.8s ease-in-out infinite', animationDelay: '0.25s' }}>✨</div>
          <div style={{ position: 'absolute', top: '4px', right: '-10px', fontSize: '11px', animation: 'wish-star-pop 0.8s ease-in-out infinite', animationDelay: '0.5s' }}>⭐</div>
        </>
      )}

      {/* Sound waves when talking */}
      {isTalking && (
        <div style={{ position: 'absolute', right: '-18px', top: '22px', display: 'flex', gap: '2px', alignItems: 'center' }}>
          {[0, 0.12, 0.24].map((delay, i) => (
            <div key={i} style={{
              width: '3px',
              height: `${10 + i * 5}px`,
              background: '#D4782A',
              borderRadius: '2px',
              animation: `wish-soundwave 0.5s ease-in-out infinite`,
              animationDelay: `${delay}s`,
            }} />
          ))}
        </div>
      )}

      {/* Trainer's face */}
      <div style={{ animation: bodyAnim, display: 'flex', justifyContent: 'center' }}>
        <div
          title={face.name}
          style={{
            width: '78px',
            height: '78px',
            borderRadius: '50%',
            overflow: 'hidden',
            border: `3px solid ${isCelebrating ? '#F5B841' : isTalking ? '#D4782A' : '#FFFFFF'}`,
            boxShadow: isTalking
              ? '0 0 0 3px rgba(212,120,42,0.28), 0 6px 16px rgba(27,58,107,0.28)'
              : '0 6px 16px rgba(27,58,107,0.24)',
            transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
            background: '#EEF2F5',
          }}
        >
          <img
            src={face.src}
            alt={`${face.name}, your trainer`}
            width={78}
            height={78}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>
      </div>
    </div>
  );
}
