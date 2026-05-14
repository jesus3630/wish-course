import React, { useState } from 'react';

interface Props {
  onLogin: (username: string, password: string) => Promise<string | null>;
}

export default function LoginScreen({ onLogin }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter your username and password.');
      return;
    }
    setLoading(true);
    setError('');
    const result = await onLogin(username.trim(), password.trim());
    setLoading(false);
    if (result === 'invalid_credentials') {
      setError('Invalid username or password. Please check your invite email.');
    } else if (result !== null) {
      setError('Unable to connect to the server. Please try again.');
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <img src="/wish-logo.png" alt="WISH Logo" style={styles.logo} />
        <h1 style={styles.title}>Workforce Information Systems Hosted</h1>
        <p style={styles.subtitle}>Training Portal</p>
        <div style={styles.divider} />
        <p style={styles.instructions}>
          Enter the username and password from your enrollment email to begin training.
        </p>
        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>Username</label>
          <input
            style={styles.input}
            type="text"
            placeholder="e.g. JGonzalez"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoFocus
            autoComplete="username"
          />
          <label style={styles.label}>Password</label>
          <input
            style={styles.input}
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {error && <p style={styles.error}>{error}</p>}
          <button type="submit" style={{ ...styles.button, opacity: loading ? 0.7 : 1 }} disabled={loading}>
            {loading ? 'Signing in...' : 'Begin Training'}
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
