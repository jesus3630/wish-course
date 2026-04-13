import React, { useState } from 'react';

interface Props {
  onLogin: (name: string, email: string) => void;
}

export default function LoginScreen({ onLogin }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError('Please enter your full name and email address.');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    onLogin(name.trim(), email.trim().toLowerCase());
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <img src="/wish-logo.png" alt="WISH Logo" style={styles.logo} />
        <h1 style={styles.title}>Workforce Information Systems Hosted</h1>
        <p style={styles.subtitle}>Training Portal</p>
        <div style={styles.divider} />
        <p style={styles.instructions}>
          Enter your information below to begin your WISH training. Your progress will be saved automatically.
        </p>
        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>Full Name</label>
          <input
            style={styles.input}
            type="text"
            placeholder="Enter your full name"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
          />
          <label style={styles.label}>Email Address</label>
          <input
            style={styles.input}
            type="email"
            placeholder="Enter your work email"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          {error && <p style={styles.error}>{error}</p>}
          <button type="submit" style={styles.button}>
            Begin Training
          </button>
        </form>
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
    fontSize: '14px',
    color: '#6B7280',
    lineHeight: '1.6',
    marginBottom: '28px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    textAlign: 'left',
  },
  label: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#1B3A6B',
    marginBottom: '2px',
  },
  input: {
    padding: '12px 16px',
    border: '2px solid #E5E7EB',
    borderRadius: '8px',
    fontSize: '15px',
    outline: 'none',
    marginBottom: '12px',
    transition: 'border-color 0.2s',
    width: '100%',
  },
  error: {
    color: '#EF4444',
    fontSize: '13px',
    marginBottom: '8px',
  },
  button: {
    marginTop: '8px',
    padding: '14px',
    background: 'linear-gradient(135deg, #D4782A, #1B3A6B)',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.5px',
  },
  footer: {
    marginTop: '28px',
    fontSize: '12px',
    color: '#9CA3AF',
  },
};
