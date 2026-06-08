import React from 'react';
import { jsPDF } from 'jspdf';
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

  function downloadPDF() {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();

    // Background
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, W, H, 'F');

    // Outer border — navy
    doc.setDrawColor(27, 58, 107);
    doc.setLineWidth(4);
    doc.rect(8, 8, W - 16, H - 16);

    // Inner border — orange
    doc.setDrawColor(212, 120, 42);
    doc.setLineWidth(1.5);
    doc.rect(13, 13, W - 26, H - 26);

    // Logo image
    const img = new Image();
    img.src = '/wish-logo.png';
    try {
      doc.addImage(img, 'PNG', W / 2 - 28, 20, 56, 22);
    } catch {
      // fallback if image fails to load — just use text
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(32);
      doc.setTextColor(212, 120, 42);
      doc.text('WISH', W / 2, 36, { align: 'center' });
    }

    // Subtitle under logo
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('Workforce Information Systems Hosted  •  ProtaTECH Training Portal', W / 2, 48, { align: 'center' });

    // Divider
    doc.setDrawColor(212, 120, 42);
    doc.setLineWidth(0.8);
    doc.line(W / 2 - 50, 52, W / 2 + 50, 52);

    // "Certificate of Completion"
    doc.setFont('helvetica', 'bolditalic');
    doc.setFontSize(22);
    doc.setTextColor(27, 58, 107);
    doc.text('Certificate of Completion', W / 2, 64, { align: 'center' });

    // "This certifies that"
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(107, 114, 128);
    doc.text('This certifies that', W / 2, 76, { align: 'center' });

    // Employee name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.setTextColor(27, 58, 107);
    doc.text(progress.user_name, W / 2, 90, { align: 'center' });

    // Underline name
    const nameWidth = doc.getTextWidth(progress.user_name);
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.5);
    doc.line(W / 2 - nameWidth / 2, 93, W / 2 + nameWidth / 2, 93);

    // Body text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(55, 65, 81);
    doc.text(
      `has successfully completed the WISH Training Program consisting of ${modules.length} training modules.`,
      W / 2, 103, { align: 'center' }
    );

    // Module list — two columns
    const boxX = 28, boxY = 112, boxW = W - 56, boxH = H - 145;
    doc.setFillColor(244, 247, 250);
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.4);
    doc.roundedRect(boxX, boxY, boxW, boxH, 3, 3, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text('MODULES COMPLETED', boxX + 10, boxY + 8);

    const colW = boxW / 2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(55, 65, 81);
    modules.forEach((mod, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = boxX + 10 + col * colW;
      const y = boxY + 15 + row * 7;
      doc.setTextColor(16, 185, 129);
      doc.text('✓', x, y);
      doc.setTextColor(55, 65, 81);
      doc.text(`Module ${i + 1}: ${mod.name}`, x + 6, y);
    });

    // Footer — left: ProtaTECH, right: date
    const footerY = H - 18;
    doc.setDrawColor(27, 58, 107);
    doc.setLineWidth(0.8);

    doc.line(28, footerY - 6, 90, footerY - 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(27, 58, 107);
    doc.text('ProtaTECH', 28, footerY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text('Program Administrator', 28, footerY + 5);

    doc.line(W - 90, footerY - 6, W - 28, footerY - 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(27, 58, 107);
    doc.text(completedDate, W - 28, footerY, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text('Date of Completion', W - 28, footerY + 5, { align: 'right' });

    doc.save(`WISH_Certificate_${progress.user_name.replace(/\s+/g, '_')}.pdf`);
  }

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .cert-printable, .cert-printable * { visibility: visible; }
          .cert-printable { position: absolute; left: 0; top: 0; width: 100%; padding: 40px; box-sizing: border-box; }
          .cert-chrome { display: none !important; }
        }
      `}</style>

      <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', overflowY: 'auto' }}>

        <div className="cert-chrome" style={{ position: 'fixed', top: '16px', right: '16px', display: 'flex', gap: '12px', zIndex: 101 }}>
          <button onClick={downloadPDF} style={{ padding: '10px 20px', background: '#D4782A', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>
            Download PDF
          </button>
          <button onClick={onClose} style={{ padding: '10px 16px', background: '#1B3A6B', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>
            ✕ Close
          </button>
        </div>

        <div className="cert-printable" style={{ background: '#FFFFFF', width: '100%', maxWidth: '800px', borderRadius: '4px', padding: '60px 64px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', border: '12px solid #1B3A6B', outline: '4px solid #D4782A', outlineOffset: '-20px' }}>

          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <img src="/wish-logo.png" alt="WISH" style={{ height: '64px', width: 'auto' }} />
            <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '6px', letterSpacing: '1px' }}>
              ProtaTECH Training Portal
            </div>
          </div>

          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{ fontSize: '26px', fontWeight: 300, color: '#1B3A6B', letterSpacing: '2px', fontStyle: 'italic' as const }}>
              Certificate of Completion
            </div>
            <div style={{ height: '3px', background: 'linear-gradient(90deg, #D4782A, #1B3A6B)', margin: '14px auto', maxWidth: '280px', borderRadius: '2px' }} />
          </div>

          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ fontSize: '13px', color: '#6B7280', marginBottom: '10px' }}>This certifies that</div>
            <div style={{ fontSize: '34px', fontWeight: 800, color: '#1B3A6B', borderBottom: '2px solid #E5E7EB', paddingBottom: '12px', marginBottom: '14px', lineHeight: 1.2 }}>
              {progress.user_name}
            </div>
            <div style={{ fontSize: '15px', color: '#374151', lineHeight: 1.7 }}>
              has successfully completed the <strong>WISH Training Program</strong><br />
              consisting of all <strong>{modules.length} training modules</strong>.
            </div>
          </div>

          <div style={{ background: '#F4F7FA', borderRadius: '8px', padding: '20px 24px', marginBottom: '32px', border: '1px solid #E5E7EB' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#6B7280', letterSpacing: '1.5px', textTransform: 'uppercase' as const, marginBottom: '12px' }}>Modules Completed</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 32px' }}>
              {modules.map((mod, i) => (
                <div key={mod.id} style={{ fontSize: '12px', color: '#374151', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                  <span style={{ color: '#10B981', fontWeight: 700, fontSize: '11px', marginTop: '1px', flexShrink: 0 }}>✓</span>
                  <span><strong>Module {i + 1}:</strong> {mod.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#1B3A6B', borderTop: '2px solid #1B3A6B', paddingTop: '8px', paddingRight: '48px', paddingLeft: '8px' }}>ProtaTECH</div>
              <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '3px' }}>Program Administrator</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#1B3A6B', borderTop: '2px solid #1B3A6B', paddingTop: '8px', paddingLeft: '48px', paddingRight: '8px' }}>{completedDate}</div>
              <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '3px' }}>Date of Completion</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
