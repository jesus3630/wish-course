import React, { useEffect, useRef } from 'react';

type CharacterState = 'idle' | 'talking' | 'celebrating';

interface Props {
  state: CharacterState;
}

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

export default function Character({ state }: Props) {
  useEffect(() => { injectStyles(); }, []);

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

      {/* Character SVG */}
      <div style={{ animation: bodyAnim }}>
        <svg width="90" height="110" viewBox="0 0 50 70" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Body */}
          <ellipse cx="25" cy="52" rx="13" ry="16" fill="#D4782A" />

          {/* Arms */}
          <rect
            x="7" y="44" width="6" height="14" rx="3"
            fill="#D4782A"
            style={isCelebrating ? { animation: 'wish-wave 0.5s ease-in-out infinite', animationDelay: '0s' } : undefined}
          />
          <rect
            x="37" y="44" width="6" height="14" rx="3"
            fill="#D4782A"
            style={isCelebrating ? { animation: 'wish-wave 0.5s ease-in-out infinite', animationDelay: '0.15s' } : undefined}
          />

          {/* Shirt accent */}
          <ellipse cx="25" cy="48" rx="6" ry="4" fill="#B8621F" opacity="0.5" />

          {/* Neck */}
          <rect x="21" y="34" width="8" height="6" rx="2" fill="#F5CBA7" />

          {/* Head */}
          <ellipse cx="25" cy="26" rx="16" ry="16" fill="#F5CBA7" />

          {/* Hair */}
          <ellipse cx="25" cy="11" rx="16" ry="6" fill="#1B3A6B" />
          <rect x="9" y="11" width="32" height="8" rx="0" fill="#1B3A6B" />

          {/* Eyes */}
          <g style={{ animation: 'wish-blink 4s ease-in-out infinite', transformOrigin: '18px 24px' }}>
            <ellipse cx="18" cy="24" rx="3" ry="3.5" fill="white" />
            <circle cx="18.5" cy="24.5" r="1.8" fill="#1B3A6B" />
            <circle cx="19.2" cy="23.5" r="0.6" fill="white" />
          </g>
          <g style={{ animation: 'wish-blink 4s ease-in-out infinite', animationDelay: '0.05s', transformOrigin: '32px 24px' }}>
            <ellipse cx="32" cy="24" rx="3" ry="3.5" fill="white" />
            <circle cx="32.5" cy="24.5" r="1.8" fill="#1B3A6B" />
            <circle cx="33.2" cy="23.5" r="0.6" fill="white" />
          </g>

          {/* Eyebrows */}
          <path
            d={isCelebrating ? 'M 14 19 Q 18 16 22 19' : 'M 14 20 Q 18 18 22 20'}
            stroke="#1B3A6B" strokeWidth="1.5" strokeLinecap="round" fill="none"
            style={{ transition: 'd 0.3s ease' }}
          />
          <path
            d={isCelebrating ? 'M 28 19 Q 32 16 36 19' : 'M 28 20 Q 32 18 36 20'}
            stroke="#1B3A6B" strokeWidth="1.5" strokeLinecap="round" fill="none"
            style={{ transition: 'd 0.3s ease' }}
          />

          {/* Mouth */}
          <path
            d={
              isCelebrating ? 'M 16 30 Q 25 40 34 30' :
              isTalking     ? 'M 18 30 Q 25 38 32 30' :
                              'M 18 30 Q 25 34 32 30'
            }
            stroke="#1B3A6B" strokeWidth="1.8" strokeLinecap="round" fill={isCelebrating ? '#FF6B6B' : isTalking ? '#FF9999' : 'none'}
            style={{ transition: 'd 0.2s ease' }}
          />

          {/* Cheek blush */}
          <ellipse cx="12" cy="28" rx="3.5" ry="2" fill="#FFB3C1" opacity="0.5" />
          <ellipse cx="38" cy="28" rx="3.5" ry="2" fill="#FFB3C1" opacity="0.5" />

          {/* Legs */}
          <rect x="17" y="66" width="6" height="4" rx="2" fill="#1B3A6B" />
          <rect x="27" y="66" width="6" height="4" rx="2" fill="#1B3A6B" />
        </svg>
      </div>
    </div>
  );
}
