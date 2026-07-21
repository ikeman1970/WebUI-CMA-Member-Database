import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { OPTIONAL_DIRECTORY_FIELD_DEFINITIONS, type DirectoryOptionalFieldKey, type MemberDirectoryConfig } from '@/lib/memberDirectory';
import { normalizeStateCode, resolveStateLabel } from '@/lib/stateLabels';
import { normalizeRegionNames, type RegionNameMap } from '@/lib/regionLabels';

const adminRoles = [
  'root', 'superuser', 'admin',           // System
  'president', 'secretary',                // Chapter
  'ceo', 'board', 'board_advisor',        // National
  'evangelist',                            // Regional
  'state_coordinator', 'area_rep'         // State
];
const DEFAULT_DIRECTORY_FIELDS = [
  'Name',
  'Street Address',
  'City, State ZIP',
  'Phone1',
  'Phone2'
];

type ChapterStateGroup = {
  stateCode: string;
  stateName: string;
  chapterCount: number;
  memberCount: number;
};

type SavedChapterGroup = {
  stateCode: string;
  label?: string;
};

type ChapterImportRow = {
  number: string;
  name: string;
  city: string;
  state: string;
  status: string;
  region: string;
  country: string;
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

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [chapters, setChapters] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'shared-info'>('overview');
  const [sharedConfig, setSharedConfig] = useState<MemberDirectoryConfig>({ optionalFields: [] });
  const [savedChapterGroups, setSavedChapterGroups] = useState<SavedChapterGroup[]>([]);
  const [newChapterGroup, setNewChapterGroup] = useState({ stateCode: '', label: '' });
  const [regionNames, setRegionNames] = useState<RegionNameMap>({});
  const [chapterData, setChapterData] = useState({ name: '', number: '', city: '', state: '', country: '' });
  const [memberData, setMemberData] = useState({ firstName: '', lastName: '', cmaNumber: '', phone1: '', phone2: '', emailHome: '', chapterId: '' });
  const [isImportingChapters, setIsImportingChapters] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refreshChapters() {
    const chapterRes = await fetch('/api/chapters');
    if (chapterRes.ok) {
      setChapters(await chapterRes.json());
    }
  }

  const chapterGroups = useMemo<ChapterStateGroup[]>(() => {
    const groupMap = new Map<string, { chapterCount: number; memberCount: number }>();
    const customLabelByCode = new Map<string, string>();

    for (const savedGroup of savedChapterGroups) {
      const stateCode = normalizeStateCode(savedGroup.stateCode);
      if (!stateCode) {
        continue;
      }

      groupMap.set(stateCode, groupMap.get(stateCode) ?? { chapterCount: 0, memberCount: 0 });
      const customLabel = String(savedGroup.label ?? '').trim();
      if (customLabel) {
        customLabelByCode.set(stateCode, customLabel);
      }
    }

    for (const chapter of chapters) {
      const stateCode = normalizeStateCode(chapter.state) || 'UNKNOWN';
      const entry = groupMap.get(stateCode) ?? { chapterCount: 0, memberCount: 0 };
      entry.chapterCount += 1;
      entry.memberCount += Array.isArray(chapter.people) ? chapter.people.length : 0;
      groupMap.set(stateCode, entry);
    }

    return Array.from(groupMap.entries())
      .map(([stateCode, value]) => ({
        stateCode,
        stateName: resolveStateLabel(stateCode, customLabelByCode.get(stateCode)),
        chapterCount: value.chapterCount,
        memberCount: value.memberCount
      }))
      .sort((a, b) => a.stateCode.localeCompare(b.stateCode));
  }, [chapters, savedChapterGroups]);

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/me');
      if (!res.ok) {
        router.push('/');
        return;
      }
      const data = await res.json();
      setUser(data);

      await refreshChapters();

      const sharedRes = await fetch('/api/member-directory/config');
      if (sharedRes.ok) {
        setSharedConfig(await sharedRes.json());
      }

      const chapterGroupRes = await fetch('/api/chapter-groups');
      if (chapterGroupRes.ok) {
        const payload = await chapterGroupRes.json();
        setSavedChapterGroups(Array.isArray(payload.groups) ? payload.groups : []);
      }

      const regionConfigRes = await fetch('/api/regions/config');
      if (regionConfigRes.ok) {
        const payload = await regionConfigRes.json();
        setRegionNames(normalizeRegionNames(payload.names));
      }
    }
    load();
  }, [router]);

  if (!user) {
    return <p>Loading admin tools…</p>;
  }

  const isAdmin = adminRoles.includes((user.role ?? '').toLowerCase());
  if (!isAdmin) {
    return <p>You do not have permission to view the admin dashboard.</p>;
  }

  async function createChapter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    const res = await fetch('/api/chapters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chapterData)
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.message || 'Failed to create chapter.');
      return;
    }

    setMessage('Chapter created successfully.');
    setChapterData({ name: '', number: '', city: '', state: '', country: '' });
    await refreshChapters();
  }

  async function handleChapterImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    setMessage(null);
    setError(null);
    setIsImportingChapters(true);

    try {
      const text = await file.text();
      const rows = parseChapterCsv(text);

      if (rows.length === 0) {
        setMessage('No chapter rows found in CSV.');
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

      setMessage(`Import complete. Created: ${payload.created}, updated: ${payload.updated}, skipped: ${payload.skipped}.`);
      await refreshChapters();
    } catch {
      setError('Unable to read/import CSV file.');
    } finally {
      setIsImportingChapters(false);
    }
  }

  async function createMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    const res = await fetch('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(memberData)
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.message || 'Failed to create member.');
      return;
    }

    setMessage('Member created successfully.');
    setMemberData({ firstName: '', lastName: '', cmaNumber: '', phone1: '', phone2: '', emailHome: '', chapterId: '' });
  }

  async function saveSharedConfig(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    const res = await fetch('/api/member-directory/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sharedConfig)
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.message || 'Failed to save shared information settings.');
      return;
    }

    setSharedConfig(await res.json());
    setMessage('Shared information settings saved.');
  }

  async function createChapterGroup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    const stateCode = normalizeStateCode(newChapterGroup.stateCode);
    if (!stateCode) {
      setError('State code is required.');
      return;
    }

    const res = await fetch('/api/chapter-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stateCode,
        label: newChapterGroup.label
      })
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(payload.message || 'Failed to create chapter group.');
      return;
    }

    setSavedChapterGroups(Array.isArray(payload.groups) ? payload.groups : []);
    setNewChapterGroup({ stateCode: '', label: '' });
    setMessage(`Chapter group ${stateCode} saved.`);
  }

  async function saveRegionNames(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    const res = await fetch('/api/regions/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ names: regionNames })
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(payload.message || 'Failed to save region names.');
      return;
    }

    setRegionNames(normalizeRegionNames(payload.names));
    setMessage('Region name settings saved.');
  }

  return (
    <main className="page-shell">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h1>Admin Dashboard</h1>
        <p>Logged in as {user.username ?? user.email}</p>
      </header>

      {message && <p className="message-success">{message}</p>}
      {error && <p className="message-error">{error}</p>}

      <nav className="pill-nav" style={{ marginTop: 16 }}>
        <button type="button" onClick={() => setActiveTab('overview')} style={{ padding: '8px 12px', fontWeight: activeTab === 'overview' ? 700 : 400 }}>
          Overview
        </button>
        <button type="button" onClick={() => setActiveTab('shared-info')} style={{ padding: '8px 12px', fontWeight: activeTab === 'shared-info' ? 700 : 400 }}>
          Shared Info
        </button>
      </nav>

      {activeTab === 'overview' ? (
        <div className="split-panels" style={{ marginTop: 24 }}>
          <section className="card">
            <h2>Create Chapter</h2>
            <p>
              Import chapter list CSV:
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleChapterImport}
                disabled={isImportingChapters}
                style={{ marginLeft: 12 }}
              />
            </p>
            <form onSubmit={createChapter} style={{ display: 'grid', gap: 12 }}>
              <label>
                Name
                <input value={chapterData.name} onChange={(e) => setChapterData({ ...chapterData, name: e.target.value })} required />
              </label>
              <label>
                Number
                <input value={chapterData.number} onChange={(e) => setChapterData({ ...chapterData, number: e.target.value })} required />
              </label>
              <label>
                City
                <input value={chapterData.city} onChange={(e) => setChapterData({ ...chapterData, city: e.target.value })} />
              </label>
              <label>
                State
                <input value={chapterData.state} onChange={(e) => setChapterData({ ...chapterData, state: e.target.value })} />
              </label>
              <label>
                Country
                <input value={chapterData.country} onChange={(e) => setChapterData({ ...chapterData, country: e.target.value })} />
              </label>
              <button type="submit">Create Chapter</button>
            </form>
          </section>

          <section className="card">
            <h2>Chapter Groups (By State)</h2>
            <p>Groups are generated automatically from chapter state values.</p>
            <form onSubmit={createChapterGroup} style={{ display: 'grid', gap: 10, maxWidth: 520, marginBottom: 14 }}>
              <label>
                State Code
                <input
                  value={newChapterGroup.stateCode}
                  onChange={(e) => setNewChapterGroup((current) => ({ ...current, stateCode: e.target.value }))}
                  placeholder="IN"
                  maxLength={10}
                  required
                />
              </label>
              <label>
                Label (optional)
                <input
                  value={newChapterGroup.label}
                  onChange={(e) => setNewChapterGroup((current) => ({ ...current, label: e.target.value }))}
                  placeholder="Indiana"
                />
              </label>
              <button type="submit" style={{ width: 'fit-content' }}>Add Chapter Group</button>
            </form>
            <table className="info-table info-table--grid">
              <thead>
                <tr>
                  <th>State</th>
                  <th>State Name</th>
                  <th>Chapters</th>
                  <th>Members</th>
                </tr>
              </thead>
              <tbody>
                {chapterGroups.map((group) => (
                  <tr key={group.stateCode}>
                    <td>{group.stateCode}</td>
                    <td>{group.stateName}</td>
                    <td>{group.chapterCount}</td>
                    <td>{group.memberCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="card">
            <h2>Create Member</h2>
            <form onSubmit={createMember} style={{ display: 'grid', gap: 12 }}>
              <label>
                First Name
                <input value={memberData.firstName} onChange={(e) => setMemberData({ ...memberData, firstName: e.target.value })} required />
              </label>
              <label>
                Last Name
                <input value={memberData.lastName} onChange={(e) => setMemberData({ ...memberData, lastName: e.target.value })} required />
              </label>
              <label>
                CMA Number
                <input value={memberData.cmaNumber} onChange={(e) => setMemberData({ ...memberData, cmaNumber: e.target.value })} required />
              </label>
              <label>
                Phone 1
                <input value={memberData.phone1} onChange={(e) => setMemberData({ ...memberData, phone1: e.target.value })} />
              </label>
              <label>
                Phone 2
                <input value={memberData.phone2} onChange={(e) => setMemberData({ ...memberData, phone2: e.target.value })} />
              </label>
              <label>
                Email
                <input value={memberData.emailHome} onChange={(e) => setMemberData({ ...memberData, emailHome: e.target.value })} type="email" />
              </label>
              <label>
                Chapter
                <select value={memberData.chapterId} onChange={(e) => setMemberData({ ...memberData, chapterId: e.target.value })} required>
                  <option value="">Select chapter</option>
                  {chapters.map((chapter) => (
                    <option key={chapter.id} value={chapter.id}>{chapter.number ?? chapter.name}</option>
                  ))}
                </select>
              </label>
              <button type="submit">Create Member</button>
            </form>
          </section>
        </div>
      ) : null}

      {activeTab === 'shared-info' ? (
        <section className="card" style={{ marginTop: 24, maxWidth: 760 }}>
          <h2>Member Directory Sharing</h2>
          <p>These fields are always shared: {DEFAULT_DIRECTORY_FIELDS.join(', ')}.</p>
          <p>Members can hide any field you allow below, but they cannot add fields beyond this list.</p>
          <form onSubmit={saveSharedConfig} style={{ display: 'grid', gap: 12 }}>
            {OPTIONAL_DIRECTORY_FIELD_DEFINITIONS.map((field) => (
              <label key={field.key} className="checkbox-row">
                <input
                  type="checkbox"
                  checked={sharedConfig.optionalFields.includes(field.key)}
                  onChange={(e) => {
                    setSharedConfig((current) => {
                      const next = new Set(current.optionalFields);
                      if (e.target.checked) {
                        next.add(field.key);
                      } else {
                        next.delete(field.key);
                      }
                      return { optionalFields: Array.from(next) as DirectoryOptionalFieldKey[] };
                    });
                  }}
                />
                <span>{field.label}</span>
              </label>
            ))}
            <button type="submit" style={{ width: 'fit-content' }}>Save Shared Info</button>
          </form>

          <hr style={{ margin: '20px 0' }} />
          <h2>Region Names (Optional)</h2>
          <p>Regions are shown by number. Add names here if needed later.</p>
          <form onSubmit={saveRegionNames} style={{ display: 'grid', gap: 12, maxWidth: 520 }}>
            {[1, 2, 3, 4, 5].map((regionCode) => (
              <label key={regionCode}>
                Region {regionCode} Name
                <input
                  value={regionNames[String(regionCode)] ?? ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setRegionNames((current) => {
                      const next = { ...current };
                      if (value.trim()) {
                        next[String(regionCode)] = value;
                      } else {
                        delete next[String(regionCode)];
                      }
                      return next;
                    });
                  }}
                  placeholder={`Region ${regionCode}`}
                />
              </label>
            ))}
            <button type="submit" style={{ width: 'fit-content' }}>Save Region Names</button>
          </form>
        </section>
      ) : null}
    </main>
  );
}
