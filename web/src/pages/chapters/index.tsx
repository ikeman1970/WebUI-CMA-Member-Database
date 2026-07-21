import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import ChapterWorkspaceTabs from '@/components/ChapterWorkspaceTabs';

type ChapterImportRow = {
  number: string;
  name: string;
  city: string;
  state: string;
  status: string;
  region: string;
  country: string;
};

type ChapterStatusCounts = {
  active: number;
  inactive: number;
  former: number;
  deceased: number;
};

type ChapterListItem = {
  id: string;
  number: string | null;
  name: string | null;
  city: string | null;
  state: string | null;
  patchImageUrl?: string | null;
  memberStatusCounts?: ChapterStatusCounts;
};

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

function parseChapterCsv(csvText: string): ChapterImportRow[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length <= 1) {
    return [];
  }

  const headerColumns = parseCsvLine(lines[0]).map((value) => value.trim().toLowerCase());
  const indexByHeader = new Map<string, number>();
  headerColumns.forEach((header, index) => {
    indexByHeader.set(header, index);
  });

  const numberIndex = indexByHeader.get('number') ?? 0;
  const nameIndex = indexByHeader.get('name') ?? 1;
  const cityIndex = indexByHeader.get('city') ?? 2;
  const stateIndex = indexByHeader.get('state') ?? 3;
  const statusIndex = indexByHeader.get('status') ?? 4;
  const regionIndex = indexByHeader.get('region');
  const countryIndex = indexByHeader.get('country');

  const rows: ChapterImportRow[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const columns = parseCsvLine(lines[i]);
    if (columns.every((value) => value.length === 0)) {
      continue;
    }

    rows.push({
      number: columns[numberIndex] ?? '',
      name: columns[nameIndex] ?? '',
      city: columns[cityIndex] ?? '',
      state: columns[stateIndex] ?? '',
      status: columns[statusIndex] ?? '',
      region: regionIndex !== undefined ? (columns[regionIndex] ?? '') : '',
      country: countryIndex !== undefined ? (columns[countryIndex] ?? '') : 'USA'
    });
  }

  return rows;
}

export default function ChaptersPage() {
  const router = useRouter();
  const [chapters, setChapters] = useState<ChapterListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  async function loadChapters() {
    const res = await fetch('/api/chapters');
    if (!res.ok) {
      if (res.status === 401) {
        router.push('/');
        return;
      }
      setError('Unable to load chapters.');
      return;
    }
    setChapters(await res.json());
  }

  useEffect(() => {
    loadChapters();
  }, [router]);

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    setImportMessage(null);
    setError(null);
    setIsImporting(true);

    try {
      const text = await file.text();
      const rows = parseChapterCsv(text);

      if (rows.length === 0) {
        setImportMessage('No chapter rows found in CSV.');
        return;
      }

      const response = await fetch('/api/chapters/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rows })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.message ?? 'Chapter import failed.');
        return;
      }

      setImportMessage(`Import complete. Created: ${payload.created}, updated: ${payload.updated}, skipped: ${payload.skipped}.`);
      await loadChapters();
    } catch {
      setError('Unable to read/import CSV file.');
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <main className="page-shell">
      <ChapterWorkspaceTabs activeTab="chapters" />
      <h1>Chapters</h1>
      <p>
        Import chapter list CSV:
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={handleImport}
          disabled={isImporting}
          style={{ marginLeft: 12 }}
        />
      </p>
      {importMessage ? <p style={{ color: 'green' }}>{importMessage}</p> : null}
      {error ? <p style={{ color: 'red' }}>{error}</p> : null}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
        {chapters.map((chapter) => (
          <li key={chapter.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 280, flex: '1 1 320px' }}>
                <h2 style={{ marginTop: 0, marginBottom: 8 }}>
                  <Link href={`/chapter/${chapter.id}`} style={{ textDecoration: 'none' }}>
                    {chapter.name ?? `Chapter ${chapter.number ?? ''}`.trim()}
                  </Link>
                </h2>
                <p style={{ marginTop: 0, marginBottom: 10 }}>
                  <strong>Chapter:</strong> {chapter.number ?? '-'}<br />
                  <strong>Location:</strong> {chapter.city ?? '-'}, {chapter.state ?? '-'}
                </p>
                <table className="info-table" style={{ maxWidth: 520 }}>
                  <tbody>
                    <tr>
                      <th>Active</th>
                      <td>{chapter.memberStatusCounts?.active ?? 0}</td>
                    </tr>
                    <tr>
                      <th>Inactive</th>
                      <td>{chapter.memberStatusCounts?.inactive ?? 0}</td>
                    </tr>
                    <tr>
                      <th>Former</th>
                      <td>{chapter.memberStatusCounts?.former ?? 0}</td>
                    </tr>
                    <tr>
                      <th>Deceased</th>
                      <td>{chapter.memberStatusCounts?.deceased ?? 0}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {chapter.patchImageUrl ? (
                <div style={{ flex: '1 1 260px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
                  <img
                    src={chapter.patchImageUrl}
                    alt={`${chapter.name ?? 'Chapter'} patch`}
                    style={{ width: '100%', maxWidth: 260, aspectRatio: '1 / 1', objectFit: 'contain', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg-soft)', padding: 10 }}
                  />
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
