import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { getRegionCodeFromState } from '@/lib/regions';
import { formatRegionLabel, normalizeRegionNames, type RegionNameMap } from '@/lib/regionLabels';

type Chapter = {
  id: string;
  name: string | null;
  number: string | null;
  city: string | null;
  state: string | null;
  region: number | null;
  people?: Array<{ id: string }>;
};

export default function StateChaptersPage() {
  const router = useRouter();
  const stateParam = Array.isArray(router.query.state) ? router.query.state[0] : router.query.state;
  const regionParam = Array.isArray(router.query.region) ? router.query.region[0] : router.query.region;
  const selectedState = stateParam ? decodeURIComponent(stateParam) : '';
  const regionCode = regionParam ? Number(regionParam) : null;

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [regionNames, setRegionNames] = useState<RegionNameMap>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!stateParam) return;

    async function load() {
      const res = await fetch('/api/chapters');
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/');
          return;
        }
        setError('Unable to load chapters.');
        return;
      }

      const data = (await res.json()) as Chapter[];

      const regionConfigRes = await fetch('/api/regions/config');
      if (regionConfigRes.ok) {
        const payload = await regionConfigRes.json();
        setRegionNames(normalizeRegionNames(payload.names));
      }

      const filtered = data
        .filter((chapter) => (chapter.state ?? 'Unknown') === selectedState)
        .filter((chapter) => {
          if (!regionCode) return true;
          const resolvedRegion = chapter.region ?? getRegionCodeFromState(chapter.state);
          return resolvedRegion === regionCode;
        })
        .sort((a, b) => (a.number ?? '').localeCompare(b.number ?? ''));

      setChapters(filtered);
    }

    load();
  }, [router, stateParam, selectedState, regionCode]);

  if (!stateParam) {
    return null;
  }

  return (
    <main className="page-shell">
      <h1>{selectedState} Chapters</h1>
      {regionCode ? <p>{formatRegionLabel(regionCode, regionNames)}</p> : null}
      <p>
        <Link href={regionCode ? `/regions/${regionCode}` : '/regions'}>Back</Link>
      </p>
      {error ? <p style={{ color: 'red' }}>{error}</p> : null}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
        {chapters.map((chapter) => (
          <li key={chapter.id} className="card">
            <h2 style={{ marginTop: 0, marginBottom: 8 }}>
              <Link href={`/chapter/${chapter.id}`} style={{ textDecoration: 'none' }}>
                {chapter.name ?? `Chapter ${chapter.number ?? ''}`.trim()}
              </Link>
            </h2>
            <table className="info-table" style={{ maxWidth: 520 }}>
              <tbody>
                <tr>
                  <th>Chapter Number</th>
                  <td>{chapter.number ?? '-'}</td>
                </tr>
                <tr>
                  <th>Location</th>
                  <td>{chapter.city ?? '-'}, {chapter.state ?? '-'}</td>
                </tr>
                <tr>
                  <th>Members</th>
                  <td>{chapter.people?.length ?? 0}</td>
                </tr>
              </tbody>
            </table>
          </li>
        ))}
      </ul>
    </main>
  );
}
