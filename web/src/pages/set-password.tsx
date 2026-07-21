import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

function normalize(value: unknown) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

export default function SetPasswordPage() {
  const router = useRouter();
  const tokenFromQuery = normalize(router.query.invite);
  const [inviteToken, setInviteToken] = useState(tokenFromQuery);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (tokenFromQuery) {
      setInviteToken(tokenFromQuery);
    }
  }, [tokenFromQuery]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const token = normalize(inviteToken);
    if (!token) {
      setError('Invite token is required.');
      return;
    }

    if (password.length < 12) {
      setError('Password must be at least 12 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteToken: token,
          password
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.message ?? 'Failed to set password.');
        return;
      }

      setMessage(payload.message ?? 'Password set successfully.');
      setTimeout(() => {
        router.push('/');
      }, 1000);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="card" style={{ maxWidth: 560, margin: '42px auto 0' }}>
        <h1>Set Password</h1>
        <p>Use your invite token to set a new password. This token can only be used once.</p>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
          <label>
            Invite Token
            <input
              type="text"
              value={inviteToken}
              onChange={(event) => setInviteToken(event.target.value)}
              required
            />
          </label>

          <label>
            New Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={12}
            />
          </label>

          <label>
            Confirm Password
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              minLength={12}
            />
          </label>

          <button type="submit" disabled={submitting}>
            {submitting ? 'Setting Password...' : 'Set Password'}
          </button>
        </form>

        {message ? <p className="message-success">{message}</p> : null}
        {error ? <p className="message-error">{error}</p> : null}
      </section>
    </main>
  );
}
