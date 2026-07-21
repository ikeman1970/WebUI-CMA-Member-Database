import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { parseMemberImportFile } from '@/lib/memberImport';

export default function MemberImportPage() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const chapterId = typeof router.query.chapterId === 'string' ? router.query.chapterId : '';

  useEffect(() => {
    if (router.isReady && chapterId) {
      setMessage(`Importing into chapter ${chapterId}.`);
    }
  }, [chapterId, router.isReady]);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    setError(null);
    setMessage(null);
    setIsUploading(true);

    try {
      const rows = await parseMemberImportFile(file);
      if (rows.length === 0) {
        setMessage('No member rows found in the file.');
        return;
      }

      const response = await fetch('/api/members/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rows, chapterId: chapterId || undefined })
      });

      if (response.status === 401) {
        setError('Your session expired or is on a different host. Please log in again.');
        router.push('/');
        return;
      }

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.message ?? 'Member import failed.');
        return;
      }

      setMessage(`Import complete. Created: ${payload.created}, updated: ${payload.updated}, skipped: ${payload.skipped}.`);
      router.replace('/members');
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : '';
      setError(message || 'Unable to read or import the file.');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <main className="page-shell">
      <h1>Import Members</h1>
      {chapterId ? <p>Bulk adding members to chapter context: {chapterId}</p> : null}
      <p><Link href="/members">Back to Members</Link></p>
      <p>
        Upload a CSV or XLSX directory file. The importer matches headers by name, so column order can vary between chapters.
      </p>
      <input type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleFileChange} disabled={isUploading} />
      {message ? <p style={{ color: 'green' }}>{message}</p> : null}
      {error ? <p style={{ color: 'red' }}>{error}</p> : null}
    </main>
  );
}
