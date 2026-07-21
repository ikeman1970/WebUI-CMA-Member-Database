import { GetServerSideProps } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { buildPublicDirectoryMember, normalizeMemberDirectoryConfig } from '@/lib/memberDirectory';
import { ACCESS_TOKEN_COOKIE, createSupabaseServerClient, parseCookies, setRLSContext } from '@/lib/supabaseAuth';
import { canAccessChapterDirectory, canManageChapter } from '@/lib/chapterDirectoryAccess';

function formatDate(value: string | null) {
  if (!value) {
    return '';
  }
  return value.slice(0, 10);
}

function normalizeStatus(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

type ChapterPageProps = {
  chapter: any;
  officers: any[];
  members: any[];
  canPrintDirectory: boolean;
  canManageOfficers: boolean;
  memberCounts: {
    active: number;
    inactive: number;
    former: number;
    deceased: number;
  };
  officerCandidates: Array<{ id: string; displayName: string; cmaNumber: string | null }>;
};

export default function ChapterPage({ chapter, officers, members, canPrintDirectory, canManageOfficers, memberCounts, officerCandidates }: ChapterPageProps) {
  const router = useRouter();
  const [chapterMembers, setChapterMembers] = useState(members);
  const [patchImageUrl, setPatchImageUrl] = useState<string | null>(null);
  const [memberData, setMemberData] = useState({ firstName: '', lastName: '', cmaNumber: '', phone1: '', phone2: '', emailHome: '' });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [patchError, setPatchError] = useState<string | null>(null);
  const [patchSuccess, setPatchSuccess] = useState<string | null>(null);
  const [isSavingPatch, setIsSavingPatch] = useState(false);
  const [showOfficerEditor, setShowOfficerEditor] = useState(false);
  const [officerForm, setOfficerForm] = useState({ role: '', personId: '', startDate: '', endDate: '' });
  const [officerError, setOfficerError] = useState<string | null>(null);
  const [officerSuccess, setOfficerSuccess] = useState<string | null>(null);
  const [isOfficerSubmitting, setIsOfficerSubmitting] = useState(false);

  useEffect(() => {
    if (!chapter?.id) {
      return;
    }

    let cancelled = false;

    async function loadPatchImage() {
      const response = await fetch(`/api/chapters/${chapter.id}`);
      if (!response.ok) {
        return;
      }

      const payload = await response.json().catch(() => null);
      if (!cancelled) {
        setPatchImageUrl(typeof payload?.patchImageUrl === 'string' ? payload.patchImageUrl : null);
      }
    }

    void loadPatchImage();

    return () => {
      cancelled = true;
    };
  }, [chapter?.id]);

  if (!chapter) {
    return <p>Chapter not found.</p>;
  }

  async function handleAddMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const response = await fetch('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...memberData,
        chapterId: chapter.id
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.message ?? 'Failed to create member.');
      return;
    }

    setMemberData({ firstName: '', lastName: '', cmaNumber: '', phone1: '', phone2: '', emailHome: '' });
    setSuccess('Member added to chapter.');
    await router.replace(router.asPath, undefined, { scroll: false });
  }

  async function handlePatchFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    setPatchError(null);
    setPatchSuccess(null);

    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setPatchError('Please select an image file.');
      return;
    }

    if (file.size > 1_500_000) {
      setPatchError('Image is too large. Please choose an image smaller than 1.5 MB.');
      return;
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error('Unable to read image file.'));
      reader.readAsDataURL(file);
    }).catch(() => '');

    if (!dataUrl) {
      setPatchError('Unable to read image file.');
      return;
    }

    setPatchImageUrl(dataUrl);
  }

  async function handleSavePatchImage() {
    setPatchError(null);
    setPatchSuccess(null);
    setIsSavingPatch(true);

    try {
      const response = await fetch(`/api/chapters/${chapter.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patchImageUrl })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setPatchError(payload.message ?? 'Failed to save chapter patch image.');
        return;
      }

      setPatchImageUrl(payload.patchImageUrl ?? null);
      setPatchSuccess('Chapter patch image saved.');
    } finally {
      setIsSavingPatch(false);
    }
  }

  async function handleRemovePatchImage() {
    setPatchError(null);
    setPatchSuccess(null);
    setIsSavingPatch(true);

    try {
      const response = await fetch(`/api/chapters/${chapter.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patchImageUrl: null })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setPatchError(payload.message ?? 'Failed to remove chapter patch image.');
        return;
      }

      setPatchImageUrl(payload.patchImageUrl ?? null);
      setPatchSuccess('Chapter patch image removed.');
    } finally {
      setIsSavingPatch(false);
    }
  }

  async function handleAddOfficer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOfficerError(null);
    setOfficerSuccess(null);
    setIsOfficerSubmitting(true);

    try {
      const response = await fetch(`/api/chapters/${chapter.id}/officers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(officerForm)
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setOfficerError(payload.message ?? 'Failed to add officer.');
        return;
      }

      setOfficerForm({ role: '', personId: '', startDate: '', endDate: '' });
      setOfficerSuccess('Officer assignment added.');
      await router.replace(router.asPath, undefined, { scroll: false });
    } finally {
      setIsOfficerSubmitting(false);
    }
  }

  async function handleRemoveOfficer(assignmentId: string) {
    setOfficerError(null);
    setOfficerSuccess(null);

    const response = await fetch(`/api/chapters/${chapter.id}/officers?assignmentId=${encodeURIComponent(assignmentId)}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setOfficerError(payload.message ?? 'Failed to remove officer assignment.');
      return;
    }

    setOfficerSuccess('Officer assignment removed.');
    await router.replace(router.asPath, undefined, { scroll: false });
  }

  return (
    <main className="page-shell">
      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 280, flex: '1 1 360px' }}>
            <h1>{chapter.name ?? 'Chapter'}</h1>
            <p>Chapter number: {chapter.number}</p>
            <p>City: {chapter.city}</p>
            <p>State: {chapter.state}</p>
            <p>Country: {chapter.country}</p>
            <p>Status: {chapter.status}</p>
            <table className="info-table" style={{ marginTop: 10, maxWidth: 440 }}>
              <tbody>
                <tr>
                  <th>Active</th>
                  <td>{memberCounts.active}</td>
                </tr>
                <tr>
                  <th>Inactive</th>
                  <td>{memberCounts.inactive}</td>
                </tr>
                <tr>
                  <th>Former</th>
                  <td>{memberCounts.former}</td>
                </tr>
                <tr>
                  <th>Deceased</th>
                  <td>{memberCounts.deceased}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {patchImageUrl ? (
            <div style={{ marginTop: 4, flex: '0 0 auto' }}>
              <img
                src={patchImageUrl}
                alt={`${chapter.name ?? 'Chapter'} patch`}
                style={{ width: 220, height: 220, objectFit: 'contain', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg-soft)', padding: 10 }}
              />
            </div>
          ) : null}
        </div>
        {canPrintDirectory ? (
          <p className="inline-actions">
            <Link href={`/chapter/${chapter.id}/directory`}>Print Directory</Link>
          </p>
        ) : null}
      </section>

      {canManageOfficers ? (
        <section className="card" style={{ marginTop: 24 }}>
          <h2>Chapter Admin Controls</h2>
          <p>Upload and save a chapter patch image for this chapter card.</p>
          {patchError ? <p className="message-error">{patchError}</p> : null}
          {patchSuccess ? <p className="message-success">{patchSuccess}</p> : null}
          <div style={{ display: 'grid', gap: 10, maxWidth: 520 }}>
            <label>
              Chapter Patch Image
              <input type="file" accept="image/*" onChange={(event) => void handlePatchFileChange(event)} />
            </label>
            <div className="inline-actions">
              <button type="button" onClick={() => void handleSavePatchImage()} disabled={isSavingPatch}>
                {isSavingPatch ? 'Saving...' : 'Save Patch Image'}
              </button>
              <button type="button" onClick={() => void handleRemovePatchImage()} disabled={isSavingPatch || !patchImageUrl}>
                Remove Patch Image
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="card" style={{ marginTop: 24 }}>
        <h2>Officers</h2>
        {canManageOfficers ? (
          <p className="inline-actions">
            <button type="button" onClick={() => setShowOfficerEditor((value) => !value)}>
              {showOfficerEditor ? 'Close Officer Editor' : 'Edit Officers'}
            </button>
          </p>
        ) : null}
        {officerError ? <p className="message-error">{officerError}</p> : null}
        {officerSuccess ? <p className="message-success">{officerSuccess}</p> : null}
        {officers.length === 0 ? <p>No officers are currently assigned to this chapter.</p> : null}
        {officers.length > 0 ? (
          <table className="info-table info-table--grid">
            <thead>
              <tr>
                <th>Role</th>
                <th>Name</th>
                <th>CMA Number</th>
                <th>Start Date</th>
                <th>End Date</th>
                {canManageOfficers ? <th>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {officers.map((officer) => (
                <tr key={officer.id}>
                  <td>{officer.role ?? '-'}</td>
                  <td>
                    {officer.person ? (
                      <Link href={`/members/${officer.person.id}`}>
                        {[officer.person.firstName ?? '', officer.person.lastName ?? ''].filter(Boolean).join(' ') || 'Unnamed Member'}
                      </Link>
                    ) : 'Unassigned'}
                  </td>
                  <td>{officer.person?.cmaNumber ?? '-'}</td>
                  <td>{formatDate(officer.startDate) || '-'}</td>
                  <td>{formatDate(officer.endDate) || '-'}</td>
                  {canManageOfficers ? (
                    <td>
                      <button type="button" onClick={() => void handleRemoveOfficer(officer.id)}>Remove</button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {canManageOfficers && showOfficerEditor ? (
          <form onSubmit={handleAddOfficer} style={{ marginTop: 16, maxWidth: 680, display: 'grid', gap: 12 }}>
            <label>
              Role
              <input
                value={officerForm.role}
                onChange={(event) => setOfficerForm((current) => ({ ...current, role: event.target.value }))}
                placeholder="Chapter President"
                required
              />
            </label>
            <label>
              Member
              <select
                value={officerForm.personId}
                onChange={(event) => setOfficerForm((current) => ({ ...current, personId: event.target.value }))}
                required
              >
                <option value="">Select a chapter member</option>
                {officerCandidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.displayName}{candidate.cmaNumber ? ` (CMA ${candidate.cmaNumber})` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Start Date
              <input
                type="date"
                value={officerForm.startDate}
                onChange={(event) => setOfficerForm((current) => ({ ...current, startDate: event.target.value }))}
              />
            </label>
            <label>
              End Date
              <input
                type="date"
                value={officerForm.endDate}
                onChange={(event) => setOfficerForm((current) => ({ ...current, endDate: event.target.value }))}
              />
            </label>
            <button type="submit" disabled={isOfficerSubmitting}>
              {isOfficerSubmitting ? 'Saving...' : 'Add Officer Assignment'}
            </button>
          </form>
        ) : null}
      </section>

      <h2 style={{ marginTop: 24 }}>Members</h2>
      {chapterMembers.length === 0 ? <p>No members are currently assigned to this chapter.</p> : null}
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 16 }}>
        {chapterMembers.map((person) => (
          <li key={person.id} className="card">
            <div style={{ fontWeight: 600 }}>
              <Link href={`/members/${person.id}`}>{person.displayName}</Link>
            </div>
            <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
              {person.fields?.map((field: { key: string; label: string; value: string }) => (
                <div key={field.key}><strong>{field.label}:</strong> {field.value}</div>
              ))}
              {person.optionalFields?.length ? (
                <details>
                  <summary>Additional shared info</summary>
                  <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
                    {person.optionalFields.map((field: { key: string; label: string; value: string }) => (
                      <div key={field.key}><strong>{field.label}:</strong> {field.value}</div>
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <section className="card" style={{ marginTop: 24 }}>
        <h2>Add Member</h2>
        <p className="inline-actions">
          <Link href={`/members/import?chapterId=${chapter.id}`}>Bulk Add Members</Link>
        </p>
        {error ? <p className="message-error">{error}</p> : null}
        {success ? <p className="message-success">{success}</p> : null}
        <form onSubmit={handleAddMember} style={{ maxWidth: 640, display: 'grid', gap: 12 }}>
          <label>
            First Name
            <input value={memberData.firstName} onChange={(event) => setMemberData({ ...memberData, firstName: event.target.value })} required />
          </label>
          <label>
            Last Name
            <input value={memberData.lastName} onChange={(event) => setMemberData({ ...memberData, lastName: event.target.value })} required />
          </label>
          <label>
            CMA Number
            <input value={memberData.cmaNumber} onChange={(event) => setMemberData({ ...memberData, cmaNumber: event.target.value })} required />
          </label>
          <label>
            Email
            <input type="email" value={memberData.emailHome} onChange={(event) => setMemberData({ ...memberData, emailHome: event.target.value })} />
          </label>
          <button type="submit">Add to Chapter</button>
        </form>
      </section>
    </main>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const cookies = parseCookies(context.req.headers.cookie ?? null);
  const accessToken = cookies[ACCESS_TOKEN_COOKIE];
  let account = null;

  // Authenticate and set RLS context
  if (accessToken) {
    const supabase = createSupabaseServerClient();
    const { data } = await supabase.auth.getUser(accessToken);
    if (data?.user?.email) {
      account = await prisma.account.findFirst({
        where: { email: data.user.email },
        include: {
          chapter: true,
          orgUnit: true,
          person: {
            include: {
              chapter: true,
              officerAssignments: true
            }
          }
        }
      });
      // Set RLS context for subsequent queries
      if (account?.id) {
        await setRLSContext(account.id);
      }
    }
  }

  const [chapter, officers, members] = await Promise.all([
    prisma.chapter.findUnique({
      where: { id: context.params?.id as string }
    }),
    prisma.officerAssignment.findMany({
      where: { chapterId: context.params?.id as string },
      include: {
        person: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            cmaNumber: true
          }
        }
      },
      orderBy: [
        { role: 'asc' },
        { startDate: 'desc' }
      ]
    }),
    prisma.person.findMany({
      where: { chapterId: context.params?.id as string }
    })
  ]);

  const configSetting = await (prisma as typeof prisma & {
    appSetting?: { findUnique: (args: { where: { key: string } }) => Promise<{ value: unknown } | null> };
  }).appSetting?.findUnique({ where: { key: 'memberDirectorySharing' } });

  const directoryConfig = normalizeMemberDirectoryConfig(configSetting?.value);

  const publicMembers = members.map((member) => buildPublicDirectoryMember({
    ...member,
    chapterName: chapter?.name ?? null,
    chapterNumber: chapter?.number ?? null
  }, directoryConfig));

  let canPrintDirectory = false;
  let canManageOfficers = false;

  if (account && chapter) {
    canPrintDirectory = canAccessChapterDirectory(account, chapter);
    canManageOfficers = canManageChapter(account, chapter);
  }

  const officerCandidates = members
    .map((member) => {
      const firstName = String(member.firstName ?? '').trim();
      const lastName = String(member.lastName ?? '').trim();
      const displayName = [firstName, lastName].filter(Boolean).join(' ') || 'Unnamed Member';
      return {
        id: member.id,
        displayName,
        cmaNumber: member.cmaNumber ?? null
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  const memberCounts = members.reduce(
    (counts, member) => {
      const status = normalizeStatus(member.status);
      if (status === 'active') {
        counts.active += 1;
      } else if (status === 'inactive') {
        counts.inactive += 1;
      } else if (status === 'former') {
        counts.former += 1;
      } else if (status === 'deceased') {
        counts.deceased += 1;
      }
      return counts;
    },
    { active: 0, inactive: 0, former: 0, deceased: 0 }
  );

  return {
    props: {
      chapter: chapter ? JSON.parse(JSON.stringify(chapter)) : null,
      officers: JSON.parse(JSON.stringify(officers)),
      members: JSON.parse(JSON.stringify(publicMembers)),
      canPrintDirectory,
      canManageOfficers,
      memberCounts,
      officerCandidates
    }
  };
};
