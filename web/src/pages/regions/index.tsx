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

type RegionItem = {
  code: number;
  chapterCount: number;
  stateCount: number;
  memberCount: number;
};

export default function RegionsPage() {
  const router = useRouter();
  const [regions, setRegions] = useState<RegionItem[]>([]);
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
        setError('Unable to load regions.');
        return;
      }

      const chapters = (await res.json()) as Chapter[];

      const regionConfigRes = await fetch('/api/regions/config');
      if (regionConfigRes.ok) {
        const payload = await regionConfigRes.json();
        setRegionNames(normalizeRegionNames(payload.names));
      }

      const regionMap = new Map<number, { chapterCount: number; states: Set<string>; memberCount: number }>();

      for (const chapter of chapters) {
        const resolvedRegion = chapter.region ?? getRegionCodeFromState(chapter.state);
        if (!resolvedRegion) continue;

        if (!regionMap.has(resolvedRegion)) {
          regionMap.set(resolvedRegion, { chapterCount: 0, states: new Set<string>(), memberCount: 0 });
        }

        const entry = regionMap.get(resolvedRegion)!;
        entry.chapterCount += 1;
        entry.memberCount += chapter.people?.length ?? 0;
        if (chapter.state) {
          entry.states.add(chapter.state);
        }
      }

      const list = Array.from(regionMap.entries())
        .map(([code, value]) => ({
          code,
          chapterCount: value.chapterCount,
          stateCount: value.states.size,
          memberCount: value.memberCount
        }))
        .sort((a, b) => a.code - b.code);

      setRegions(list);
    }

    load();
  }, [router]);

  return (
    <main className="page-shell">
      <h1>Regions</h1>
      {error ? <p style={{ color: 'red' }}>{error}</p> : null}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
        {regions.map((region) => (
          <li key={region.code} className="card">
            <h2 style={{ marginTop: 0, marginBottom: 8 }}>
              <Link href={`/regions/${region.code}`} style={{ textDecoration: 'none' }}>
                {formatRegionLabel(region.code, regionNames)}
              </Link>
            </h2>
            <table className="info-table" style={{ maxWidth: 520 }}>
              <tbody>
                <tr>
                  <th>States</th>
                  <td>{region.stateCount}</td>
                </tr>
                <tr>
                  <th>Chapters</th>
                  <td>{region.chapterCount}</td>
                </tr>
                <tr>
                  <th>Members</th>
                  <td>{region.memberCount}</td>
                </tr>
              </tbody>
            </table>
          </li>
        ))}
      </ul>
    </main>
  );
}
