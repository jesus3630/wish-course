import React from 'react';

interface Props {
  onEnter: () => void;
}

export default function LoginScreen({ onEnter }: Props) {
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <img src="/wish-logo.png" alt="WISH Logo" style={styles.logo} />
        <h1 style={styles.title}>Workforce Information Systems Hosted</h1>
        <p style={styles.subtitle}>Training Portal</p>
        <div style={styles.divider} />
        <p style={styles.instructions}>
          Welcome to the WISH Training Portal. Click below to begin your training.
        </p>
        <button style={styles.button} onClick={onEnter}>
          Begin Training
        </button>
        <p style={styles.footer}>
          Powered by ProtaTECH · WISH Training Series
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #5BBCB0 0%, #C8D46A 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  },
  card: {
    background: '#FFFFFF',
    borderRadius: '16px',
    padding: '48px 40px',
    width: '100%',
    maxWidth: '480px',
    boxShadow: '0 20px 60px rgba(27,58,107,0.15)',
    textAlign: 'center',
  },
  logo: {
    width: '100%',
    maxWidth: '280px',
    marginBottom: '24px',
  },
  title: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#1B3A6B',
    marginBottom: '4px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#5BBCB0',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '24px',
  },
  divider: {
    height: '3px',
    background: 'linear-gradient(90deg, #D4782A, #1B3A6B)',
    borderRadius: '2px',
    marginBottom: '24px',
  },
  instructions: {
    fontSize: '15px',
    color: '#6B7280',
    lineHeight: '1.6',
    marginBottom: '28px',
  },
  button: {
    display: 'block',
    width: '100%',
    padding: '16px',
    background: 'linear-gradient(135deg, #D4782A, #1B3A6B)',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '8px',
    fontSize: '17px',
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.5px',
    marginBottom: '8px',
  },
  footer: {
    marginTop: '28px',
    fontSize: '12px',
    color: '#9CA3AF',
  },
};
