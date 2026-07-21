import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { getRegionCodeFromState } from '@/lib/regions';
import { formatRegionLabel, normalizeRegionNames, type RegionNameMap } from '@/lib/regionLabels';

type Chapter = {
  id: string;
  state: string | null;
  region: number | null;
  people?: Array<{ id: string }>;
};

type StateItem = {
  state: string;
  region: number | null;
  chapterCount: number;
  memberCount: number;
};

export default function StatesPage() {
  const router = useRouter();
  const [states, setStates] = useState<StateItem[]>([]);
  const [regionNames, setRegionNames] = useState<RegionNameMap>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/chapters');
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/');
          return;
        }
        setError('Unable to load states.');
        return;
      }

      const chapters = (await res.json()) as Chapter[];

      const regionConfigRes = await fetch('/api/regions/config');
      if (regionConfigRes.ok) {
        const payload = await regionConfigRes.json();
        setRegionNames(normalizeRegionNames(payload.names));
      }

      const stateMap = new Map<string, { region: number | null; chapterCount: number; memberCount: number }>();

      for (const chapter of chapters) {
        const state = chapter.state?.trim() || 'Unknown';
        const resolvedRegion = chapter.region ?? getRegionCodeFromState(chapter.state);
        const existing = stateMap.get(state) ?? { region: resolvedRegion, chapterCount: 0, memberCount: 0 };
        existing.chapterCount += 1;
        existing.region = existing.region ?? resolvedRegion;
        existing.memberCount += chapter.people?.length ?? 0;
        stateMap.set(state, existing);
      }

      const list = Array.from(stateMap.entries())
        .map(([state, value]) => ({ state, region: value.region, chapterCount: value.chapterCount, memberCount: value.memberCount }))
        .sort((a, b) => a.state.localeCompare(b.state));

      setStates(list);
    }

    load();
  }, [router]);

  return (
    <main className="page-shell">
      <h1>States</h1>
      <p>
        <Link href="/regions">Back to Regions</Link>
      </p>
      {error ? <p style={{ color: 'red' }}>{error}</p> : null}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
        {states.map((state) => (
          <li key={state.state} className="card">
            <h2 style={{ marginTop: 0, marginBottom: 8 }}>
              <Link href={{ pathname: `/states/${encodeURIComponent(state.state)}`, query: state.region ? { region: state.region } : {} }} style={{ textDecoration: 'none' }}>
                {state.state}
              </Link>
            </h2>
            <table className="info-table" style={{ maxWidth: 520 }}>
              <tbody>
                <tr>
                  <th>Region</th>
                  <td>{state.region ? formatRegionLabel(state.region, regionNames) : '-'}</td>
                </tr>
                <tr>
                  <th>Chapters</th>
                  <td>{state.chapterCount}</td>
                </tr>
                <tr>
                  <th>Members</th>
                  <td>{state.memberCount}</td>
                </tr>
              </tbody>
            </table>
          </li>
        ))}
      </ul>
    </main>
  );
}
