import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setIsSuccess(false);
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || 'Failed to process request');
        return;
      }

      setIsSuccess(true);
      setMessage(data.message || 'If an account exists with this email, a password reset link has been sent.');
      setEmail('');
    } catch (error) {
      setMessage('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="card" style={{ maxWidth: 520, margin: '42px auto 0' }}>
        <h1>Reset Your Password</h1>
        <p>Enter your email address and we&apos;ll send you a password reset link.</p>

        {isSuccess ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: 'green', fontWeight: 'bold' }}>{message}</p>
            <Link href="/" style={{ marginTop: 16, display: 'inline-block' }}>Back to Login</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
            <label>
              Email Address
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>

            <button type="submit" disabled={isLoading}>
              {isLoading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )}

        {message && !isSuccess ? <p className="message-error">{message}</p> : null}

        <p style={{ marginTop: 24, textAlign: 'center', fontSize: 14 }}>
          <Link href="/">Back to Login</Link>
        </p>
      </section>
    </main>
  );
}
