import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

const LINKS = [
  { href: '/regions', label: 'Regions' },
  { href: '/states', label: 'States' },
  { href: '/chapters', label: 'Chapters' },
  { href: '/members', label: 'Members' },
  { href: '/admin', label: 'Admin' }
];

export default function AppTopNav() {
  const router = useRouter();
  const [accountLabel, setAccountLabel] = useState('');
  const [canViewReporting, setCanViewReporting] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadAccount() {
      try {
        const response = await fetch('/api/me', { credentials: 'include' });
        if (response.status === 401 || response.status === 403) {
          if (active) {
            setAccountLabel('');
          }
          return;
        }

        if (!response.ok) {
          // Preserve previous label on transient failures.
          return;
        }

        const user = await response.json();
        if (active) {
          setAccountLabel(user?.username ?? user?.email ?? '');
        }

        const reportingAccessResponse = await fetch('/api/reporting/access', { credentials: 'include' });
        if (reportingAccessResponse.status === 401 || reportingAccessResponse.status === 403) {
          if (active) {
            setCanViewReporting(false);
          }
          return;
        }

        if (!reportingAccessResponse.ok) {
          // Preserve previous access state on transient failures.
          return;
        }

        const reportingAccess = await reportingAccessResponse.json();
        if (active) {
          setCanViewReporting(Boolean(reportingAccess?.canView));
        }
      } catch {
        // Keep nav usable even if the account lookup fails.
      }
    }

    loadAccount();

    return () => {
      active = false;
    };
  }, []);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  return (
    <header className="app-top-nav">
      <div className="app-top-nav__inner">
        <Link href="/regions" className="app-top-nav__brand">
          CMADirectoryApp
        </Link>
        <nav className="app-top-nav__links" aria-label="Primary">
          {LINKS.map((link) => {
            const active = router.pathname === link.href || router.pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`app-top-nav__link${active ? ' app-top-nav__link--active' : ''}`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="app-top-nav__actions">
          {accountLabel ? <span className="app-top-nav__account">Logged in as: {accountLabel}</span> : null}
          <button type="button" className="btn-secondary" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
