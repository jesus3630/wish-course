import React, { useState } from 'react';

interface Props {
  onLogin: (username: string) => Promise<string | null>;
}

export default function LoginScreen({ onLogin }: Props) {
  const [tab, setTab] = useState<'signin' | 'request'>('signin');

  // Sign-in state
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Request training state
  const [reqName, setReqName] = useState('');
  const [reqEmail, setReqEmail] = useState('');
  const [reqDept, setReqDept] = useState('');
  const [reqMessage, setReqMessage] = useState('');
  const [reqLoading, setReqLoading] = useState(false);
  const [reqError, setReqError] = useState('');
  const [reqSuccess, setReqSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) {
      setError('Please enter your username.');
      return;
    }
    setLoading(true);
    setError('');
    const result = await onLogin(username.trim());
    setLoading(false);
    if (result === 'invalid_credentials') {
      setError('Username not found. Please check your invite email or request access below.');
    } else if (result !== null) {
      setError('Unable to connect to the server. Please try again.');
    }
  }

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!reqName.trim() || !reqEmail.trim()) {
      setReqError('Name and email are required.');
      return;
    }
    setReqLoading(true);
    setReqError('');
    try {
      const res = await fetch('/api/request-training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: reqName.trim(), email: reqEmail.trim(), department: reqDept.trim(), message: reqMessage.trim() }),
      });
      if (!res.ok) throw new Error('Server error');
      setReqSuccess(true);
    } catch {
      setReqError('Unable to send request. Please try again.');
    }
    setReqLoading(false);
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <img src="/wish-logo.png" alt="WISH Logo" style={styles.logo} />
        <h1 style={styles.title}>Workforce Information Systems Hosted</h1>
        <p style={styles.subtitle}>Training Portal</p>
        <div style={styles.divider} />

        {/* Tabs */}
        <div style={styles.tabs}>
          <button
            type="button"
            style={{ ...styles.tab, ...(tab === 'signin' ? styles.tabActive : {}) }}
            onClick={() => setTab('signin')}
          >
            Sign In
          </button>
          <button
            type="button"
            style={{ ...styles.tab, ...(tab === 'request' ? styles.tabActive : {}) }}
            onClick={() => setTab('request')}
          >
            Request Training
          </button>
        </div>

        {tab === 'signin' ? (
          <>
            <p style={styles.instructions}>
              Enter the username from your enrollment email to begin training.
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
              {error && <p style={styles.error}>{error}</p>}
              <button type="submit" style={{ ...styles.button, opacity: loading ? 0.7 : 1 }} disabled={loading}>
                {loading ? 'Signing in...' : 'Begin Training'}
              </button>
            </form>
          </>
        ) : (
          <>
            {reqSuccess ? (
              <div style={styles.successBox}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>✓</div>
                <p style={{ color: '#1B3A6B', fontWeight: 700, fontSize: '16px', margin: '0 0 8px' }}>Request Submitted</p>
                <p style={{ color: '#6B7280', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>
                  Your request has been sent to the training administrator. You will receive your login credentials by email once your access is approved.
                </p>
              </div>
            ) : (
              <>
                <p style={styles.instructions}>
                  Don't have credentials yet? Submit your information and a training administrator will set up your account.
                </p>
                <form onSubmit={handleRequest} style={styles.form}>
                  <label style={styles.label}>Full Name <span style={{ color: '#EF4444' }}>*</span></label>
                  <input
                    style={styles.input}
                    type="text"
                    placeholder="e.g. Maria Garcia"
                    value={reqName}
                    onChange={e => setReqName(e.target.value)}
                    autoFocus
                  />
                  <label style={styles.label}>Email Address <span style={{ color: '#EF4444' }}>*</span></label>
                  <input
                    style={styles.input}
                    type="email"
                    placeholder="your.email@lacounty.gov"
                    value={reqEmail}
                    onChange={e => setReqEmail(e.target.value)}
                  />
                  <label style={styles.label}>Department</label>
                  <input
                    style={styles.input}
                    type="text"
                    placeholder="e.g. Workforce Development"
                    value={reqDept}
                    onChange={e => setReqDept(e.target.value)}
                  />
                  <label style={styles.label}>Message (optional)</label>
                  <textarea
                    style={{ ...styles.input, resize: 'vertical', minHeight: '72px', fontFamily: 'inherit' }}
                    placeholder="Any additional notes for the administrator..."
                    value={reqMessage}
                    onChange={e => setReqMessage(e.target.value)}
                  />
                  {reqError && <p style={styles.error}>{reqError}</p>}
                  <button type="submit" style={{ ...styles.button, opacity: reqLoading ? 0.7 : 1 }} disabled={reqLoading}>
                    {reqLoading ? 'Sending...' : 'Submit Request'}
                  </button>
                </form>
              </>
            )}
          </>
        )}

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
    marginBottom: '20px',
  },
  tabs: {
    display: 'flex',
    border: '1px solid #E5E7EB',
    borderRadius: '8px',
    overflow: 'hidden',
    marginBottom: '20px',
  },
  tab: {
    flex: 1,
    padding: '10px',
    border: 'none',
    background: '#F9FAFB',
    color: '#6B7280',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  tabActive: {
    background: '#1B3A6B',
    color: '#FFFFFF',
  },
  instructions: {
    fontSize: '14px',
    color: '#6B7280',
    lineHeight: '1.6',
    marginBottom: '20px',
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
    boxSizing: 'border-box' as const,
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
  successBox: {
    background: '#F0FDF4',
    border: '1px solid #BBF7D0',
    borderRadius: '12px',
    padding: '32px 24px',
    textAlign: 'center',
    margin: '8px 0 20px',
  },
  footer: {
    marginTop: '28px',
    fontSize: '12px',
    color: '#9CA3AF',
  },
};
