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
  chapterCount: number;
  memberCount: number;
};

export default function RegionStatesPage() {
  const router = useRouter();
  const regionParam = Array.isArray(router.query.region) ? router.query.region[0] : router.query.region;
  const regionCode = Number(regionParam);

  const [states, setStates] = useState<StateItem[]>([]);
  const [regionNames, setRegionNames] = useState<RegionNameMap>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!regionParam) return;

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

      const stateMap = new Map<string, { chapterCount: number; memberCount: number }>();

      for (const chapter of chapters) {
        const resolvedRegion = chapter.region ?? getRegionCodeFromState(chapter.state);
        if (resolvedRegion !== regionCode) continue;

        const state = chapter.state ?? 'Unknown';
        const entry = stateMap.get(state) ?? { chapterCount: 0, memberCount: 0 };
        entry.chapterCount += 1;
        entry.memberCount += chapter.people?.length ?? 0;
        stateMap.set(state, entry);
      }

      const list = Array.from(stateMap.entries())
        .map(([state, value]) => ({ state, chapterCount: value.chapterCount, memberCount: value.memberCount }))
        .sort((a, b) => a.state.localeCompare(b.state));

      setStates(list);
    }

    load();
  }, [regionParam, regionCode, router]);

  if (!regionParam) {
    return null;
  }

  return (
    <main className="page-shell">
      <h1>{formatRegionLabel(regionCode, regionNames)} States</h1>
      <p>
        <Link href="/regions">Back to Regions</Link>
      </p>
      {error ? <p style={{ color: 'red' }}>{error}</p> : null}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
        {states.map((stateItem) => (
          <li key={stateItem.state} className="card">
            <h2 style={{ marginTop: 0, marginBottom: 8 }}>
              <Link href={{ pathname: `/states/${encodeURIComponent(stateItem.state)}`, query: { region: regionCode } }} style={{ textDecoration: 'none' }}>
                {stateItem.state}
              </Link>
            </h2>
            <table className="info-table" style={{ maxWidth: 520 }}>
              <tbody>
                <tr>
                  <th>Chapters</th>
                  <td>{stateItem.chapterCount}</td>
                </tr>
                <tr>
                  <th>Members</th>
                  <td>{stateItem.memberCount}</td>
                </tr>
              </tbody>
            </table>
          </li>
        ))}
      </ul>
    </main>
  );
}
