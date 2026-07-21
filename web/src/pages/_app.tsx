import type { AppProps } from 'next/app';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import AppTopNav from '@/components/AppTopNav';
import ThemeToggle from '@/components/ThemeToggle';
import '@/styles/globals.css';

type ThemeMode = 'light' | 'dark';

const THEME_KEY = 'cma-theme-mode';

function preferredTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(mode: ThemeMode) {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', mode);
  }
}

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [mode, setMode] = useState<ThemeMode>('dark');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const initial = preferredTheme();
    setMode(initial);
    applyTheme(initial);
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    applyTheme(mode);
    window.localStorage.setItem(THEME_KEY, mode);
  }, [isLoaded, mode]);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    let cancelled = false;

    async function syncFromServer() {
      const response = await fetch('/api/me', { credentials: 'include' });
      if (!response.ok) {
        return;
      }

      const payload = await response.json();
      const serverTheme = payload?.themePreference;
      if (!cancelled && (serverTheme === 'light' || serverTheme === 'dark')) {
        setMode(serverTheme);
      }
    }

    syncFromServer();

    return () => {
      cancelled = true;
    };
  }, [isLoaded]);

  async function persistThemePreference(nextMode: ThemeMode) {
    setMode(nextMode);

    const response = await fetch('/api/me/theme', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ themePreference: nextMode })
    });

    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    if (payload?.themePreference === 'light' || payload?.themePreference === 'dark') {
      setMode(payload.themePreference);
    }
  }

  const toggleLabel = useMemo(() => (mode === 'dark' ? 'dark' : 'light'), [mode]);

  async function handleToggleTheme() {
    const nextMode: ThemeMode = mode === 'dark' ? 'light' : 'dark';
    await persistThemePreference(nextMode);
  }

  const showTopNav = router.pathname !== '/' && router.pathname !== '/404';

  return (
    <>
      {showTopNav ? <AppTopNav /> : null}
      <Component {...pageProps} currentThemeMode={mode} onThemeModeChange={persistThemePreference} />
      <div className="theme-toggle-wrapper" data-theme-label={toggleLabel}>
        <ThemeToggle mode={mode} onToggle={handleToggleTheme} />
      </div>
    </>
  );
}
