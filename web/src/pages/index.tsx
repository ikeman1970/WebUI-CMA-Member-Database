import { useState } from 'react';
import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [passwordSetupHint, setPasswordSetupHint] = useState<string | null>(null);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setPasswordSetupHint(null);

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        usernameOrEmail,
        password
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      if (payload.requiresPasswordSetup) {
        setPasswordSetupHint(payload.passwordSetupPath ?? '/set-password');
      }
      setMessage(payload.message ?? 'Login failed.');
      return;
    }

    router.push('/regions');
  }

  return (
    <main className="page-shell">
      <section className="card" style={{ maxWidth: 520, margin: '42px auto 0' }}>
        <h1>CMADirectoryApp</h1>
        <p style={{ marginTop: 0, marginBottom: 20 }}>
          Member directory, chapter tools, and admin controls in one secure workspace.
        </p>
        <form onSubmit={handleLogin} style={{ display: 'grid', gap: 16 }}>
          <label>
            Username or Email
            <input
              type="text"
              value={usernameOrEmail}
              onChange={(event) => setUsernameOrEmail(event.target.value)}
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          <button type="submit">
            Login
          </button>
        </form>

        {message ? <p className="message-error">{message}</p> : null}
        {passwordSetupHint ? (
          <p>
            Complete password setup at <a href={passwordSetupHint}>{passwordSetupHint}</a>.
          </p>
        ) : null}
      </section>
    </main>
  );
}
