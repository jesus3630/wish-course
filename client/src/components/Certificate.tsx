import React from 'react';
import { Module, CourseProgress } from '../types';

interface Props {
  progress: CourseProgress;
  modules: Module[];
  onClose: () => void;
}

export default function Certificate({ progress, modules, onClose }: Props) {
  const completedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .cert-printable, .cert-printable * { visibility: visible; }
          .cert-printable {
            position: absolute; left: 0; top: 0;
            width: 100%; padding: 40px; box-sizing: border-box;
          }
          .cert-chrome { display: none !important; }
        }
      `}</style>

      <div style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px', overflowY: 'auto',
      }}>
        <div className="cert-chrome" style={{
          position: 'fixed', top: '16px', right: '16px',
          display: 'flex', gap: '12px', zIndex: 101,
        }}>
          <button
            onClick={() => window.print()}
            style={{
              padding: '10px 20px', background: '#D4782A', color: '#fff',
              border: 'none', borderRadius: '8px', fontWeight: 700,
              fontSize: '14px', cursor: 'pointer',
            }}
          >
            Print / Save PDF
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '10px 16px', background: '#1B3A6B', color: '#fff',
              border: 'none', borderRadius: '8px', fontWeight: 700,
              fontSize: '14px', cursor: 'pointer',
            }}
          >
            X Close
          </button>
        </div>

        <div className="cert-printable" style={{
          background: '#FFFFFF',
          width: '100%', maxWidth: '800px',
          borderRadius: '4px',
          padding: '60px 64px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          border: '12px solid #1B3A6B',
          outline: '4px solid #D4782A',
          outlineOffset: '-20px',
        }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <div style={{ fontSize: '52px', fontWeight: 900, color: '#D4782A', letterSpacing: '6px', lineHeight: 1 }}>
              WISH
            </div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#1B3A6B', letterSpacing: '3px', textTransform: 'uppercase' as const, marginTop: '6px' }}>
              Workforce Information Systems Hosted
            </div>
            <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px', letterSpacing: '1px' }}>
              ProtaTECH Training Portal
            </div>
          </div>

          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ fontSize: '26px', fontWeight: 300, color: '#1B3A6B', letterSpacing: '2px', fontStyle: 'italic' as const }}>
              Certificate of Completion
            </div>
            <div style={{ height: '3px', background: 'linear-gradient(90deg, #D4782A, #1B3A6B)', margin: '16px auto', maxWidth: '280px', borderRadius: '2px' }} />
          </div>

          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <div style={{ fontSize: '13px', color: '#6B7280', marginBottom: '12px', letterSpacing: '0.5px' }}>This certifies that</div>
            <div style={{
              fontSize: '34px', fontWeight: 800, color: '#1B3A6B',
              borderBottom: '2px solid #E5E7EB', paddingBottom: '14px',
              marginBottom: '16px', lineHeight: 1.2,
            }}>
              {progress.user_name}
            </div>
            <div style={{ fontSize: '15px', color: '#374151', lineHeight: 1.7 }}>
              has successfully completed the <strong>WISH Training Program</strong><br />
              consisting of all <strong>{modules.length} training modules</strong>.
            </div>
          </div>

          {/* Module list */}
          <div style={{
            background: '#F4F7FA', borderRadius: '8px',
            padding: '20px 24px', marginBottom: '36px',
            border: '1px solid #E5E7EB',
          }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#6B7280', letterSpacing: '1.5px', textTransform: 'uppercase' as const, marginBottom: '14px' }}>
              Modules Completed
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 32px' }}>
              {modules.map((mod, i) => (
                <div key={mod.id} style={{ fontSize: '12px', color: '#374151', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                  <span style={{ color: '#10B981', fontWeight: 700, fontSize: '11px', marginTop: '1px', flexShrink: 0 }}>✓</span>
                  <span><strong>Module {i + 1}:</strong> {mod.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '8px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: '13px', fontWeight: 700, color: '#1B3A6B',
                borderTop: '2px solid #1B3A6B', paddingTop: '8px',
                paddingRight: '48px', paddingLeft: '8px',
              }}>
                ProtaTECH
              </div>
              <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '3px' }}>Program Administrator</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: '13px', fontWeight: 700, color: '#1B3A6B',
                borderTop: '2px solid #1B3A6B', paddingTop: '8px',
                paddingLeft: '48px', paddingRight: '8px',
              }}>
                {completedDate}
              </div>
              <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '3px' }}>Date of Completion</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
