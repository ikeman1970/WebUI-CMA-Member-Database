import { GetServerSideProps } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { buildPublicDirectoryMember, normalizeMemberDirectoryConfig } from '@/lib/memberDirectory';
import { getRegionCodeFromState } from '@/lib/regions';
import { ACCESS_TOKEN_COOKIE, createSupabaseServerClient, parseCookies, setRLSContext } from '@/lib/supabaseAuth';
import { hasActiveChapterOfficerAssignment } from '@/lib/chapterDirectoryAccess';

const adminRoles = new Set([
  'root', 'superuser', 'admin',           // System
  'president', 'secretary',                // Chapter
  'ceo', 'board', 'board_advisor',        // National
  'evangelist',                            // Regional
  'state_coordinator', 'area_rep'         // State
]);

const fieldGroups: Array<{ title: string; rows: Array<{ label: string; key: string }>; showWhenEmpty?: boolean }> = [
  {
    title: 'Identity',
    rows: [
      { label: 'First Name', key: 'firstName' },
      { label: 'Last Name', key: 'lastName' },
      { label: 'CMA Number', key: 'cmaNumber' },
      { label: 'Status', key: 'status' },
      { label: 'Status Effective Date', key: 'statusEffectiveDate' },
      { label: 'Birthday', key: 'birthday' },
      { label: 'Anniversary', key: 'anniversary' }
    ]
  },
  {
    title: 'Contact',
    rows: [
      { label: 'Phone 1', key: 'phone1' },
      { label: 'Phone 2', key: 'phone2' },
      { label: 'Home Email', key: 'emailHome' },
      { label: 'Work Email', key: 'emailWork' },
      { label: 'Address 1', key: 'address1' },
      { label: 'Address 2', key: 'address2' },
      { label: 'City', key: 'city' },
      { label: 'State', key: 'state' },
      { label: 'ZIP', key: 'zipCode' },
      { label: 'Country', key: 'country' }
    ]
  },
  {
    title: 'Chapter',
    rows: [
      { label: 'Chapter Number', key: 'chapterNumber' },
      { label: 'Chapter Name', key: 'chapterName' }
    ]
  },
  {
    title: 'Spouse',
    showWhenEmpty: true,
    rows: [
      { label: 'Spouse Name', key: 'spouseName' },
      { label: 'Spouse CMA Number', key: 'spouseCmaNumber' },
      { label: 'Spouse Phone', key: 'spouseCellPhone' },
      { label: 'Spouse Email', key: 'spouseEmail' },
      { label: 'Spouse Member Since', key: 'spouseMemberSinceYear' },
      { label: 'Spouse Years in Chapter', key: 'spouseYearsInChapter' }
    ]
  },
  {
    title: 'Family',
    rows: [
      { label: 'Children', key: 'childrenNames' },
      { label: 'Grandchildren', key: 'grandchildrenNames' }
    ]
  },
  {
    title: 'Membership & Riding',
    rows: [
      { label: 'Member Since Year', key: 'memberSinceYear' },
      { label: 'Years in Chapter', key: 'yearsInChapter' },
      { label: 'Miles to Meetings', key: 'milesToMeetings' },
      { label: 'Years Riding (Self)', key: 'yearsRidingSelf' },
      { label: 'MSF Course (Self)', key: 'msfCourseSelf' },
      { label: 'Years Riding (Spouse)', key: 'yearsRidingSpouse' },
      { label: 'MSF Course (Spouse)', key: 'msfCourseSpouse' },
      { label: 'Has Motorcycle Insurance', key: 'hasMotorcycleInsurance' }
    ]
  },
  {
    title: 'Ministry',
    rows: [
      { label: 'Church Name', key: 'churchName' },
      { label: 'Active in Ministry', key: 'activeInMinistry' },
      { label: 'Ministry How', key: 'ministryHow' },
      { label: 'Wants Event Contact', key: 'wantsEventContact' },
      { label: 'Willing to Host Bible Study', key: 'willingHostBibleStudy' },
      { label: 'Willing to Host Fellowship', key: 'willingHostFellowship' },
      { label: 'Willing for Prayer Line Email', key: 'willingPrayerLineEmail' },
      { label: 'Willing to Help Run For Son', key: 'willingRunForSonHelp' },
      { label: 'Belongs to Other Motorcycle Org', key: 'belongsOtherMotoOrg' },
      { label: 'Holds Office in Other Orgs', key: 'holdsOfficeOtherOrgs' }
    ]
  },
  {
    title: 'Notes',
    rows: [
      { label: 'Comments', key: 'comments' },
      { label: 'Rescue Equipment', key: 'rescueEquipment' },
      { label: 'Lodging', key: 'lodging' }
    ]
  }
];

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return value.slice(0, 10);
  }

  return String(value);
}

function getMemberValue(member: any, key: string) {
  if (key === 'chapterName') {
    return member.chapter?.name ?? '';
  }

  if (key === 'chapterNumber') {
    return member.chapter?.number ?? '';
  }

  return member[key];
}

function normalizeScope(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function parseRegionNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const match = value.match(/\d+/);
  if (!match) {
    return null;
  }

  const parsed = Number.parseInt(match[0], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveMemberState(member: any) {
  const chapterState = String(member?.chapter?.state ?? '').trim();
  if (chapterState) {
    return chapterState.toUpperCase();
  }

  const directState = String(member?.state ?? '').trim();
  return directState ? directState.toUpperCase() : null;
}

function resolveMemberRegion(member: any) {
  const chapterRegion = parseRegionNumber(member?.chapter?.region);
  if (chapterRegion) {
    return chapterRegion;
  }

  return getRegionCodeFromState(resolveMemberState(member));
}

function resolveAdminState(account: any) {
  const orgCode = String(account?.orgUnit?.code ?? '').trim();
  if (orgCode) {
    return orgCode.toUpperCase();
  }

  const chapterState = String(account?.chapter?.state ?? '').trim();
  if (chapterState) {
    return chapterState.toUpperCase();
  }

  return null;
}

function resolveAdminRegion(account: any) {
  const fromOrgCode = parseRegionNumber(account?.orgUnit?.code);
  if (fromOrgCode) {
    return fromOrgCode;
  }

  const fromOrgName = parseRegionNumber(account?.orgUnit?.name);
  if (fromOrgName) {
    return fromOrgName;
  }

  const fromChapterRegion = parseRegionNumber(account?.chapter?.region);
  if (fromChapterRegion) {
    return fromChapterRegion;
  }

  return getRegionCodeFromState(account?.chapter?.state ?? null);
}

function canEditMemberInScope(account: any, member: any) {
  if (hasActiveChapterOfficerAssignment(account, member?.chapterId)) {
    return true;
  }

  const role = normalizeScope(account?.role);
  if (!adminRoles.has(role)) {
    return false;
  }

  const scopeType = normalizeScope(account?.scopeType);
  if (!scopeType || scopeType === 'global' || scopeType === 'all' || scopeType === 'national') {
    return true;
  }

  if (scopeType === 'chapter' || scopeType === 'chapter_admin' || scopeType === 'local') {
    return Boolean(account?.chapterId && member?.chapterId && account.chapterId === member.chapterId);
  }

  if (scopeType === 'state' || scopeType === 'state_admin') {
    const adminState = resolveAdminState(account);
    const memberState = resolveMemberState(member);
    return Boolean(adminState && memberState && adminState === memberState);
  }

  if (scopeType === 'region' || scopeType === 'regional' || scopeType === 'region_admin') {
    const adminRegion = resolveAdminRegion(account);
    const memberRegion = resolveMemberRegion(member);
    return Boolean(adminRegion && memberRegion && adminRegion === memberRegion);
  }

  return true;
}

export default function MemberPage({ member, canViewFull, canEdit }: { member: any | null; canViewFull: boolean; canEdit: boolean }) {
  if (!member) {
    return <p>Member not found.</p>;
  }

  if (canViewFull) {
    return (
      <main className="page-shell">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h1>{member.firstName} {member.lastName}</h1>
          {canEdit ? (
            <Link href={`/members/edit/${member.id}`} className="btn-secondary" style={{ textDecoration: 'none' }}>
              Edit Member
            </Link>
          ) : null}
        </header>
        <section className="split-panels" style={{ marginTop: 16 }}>
          {fieldGroups.map((group) => {
            const rows = group.rows
              .map((row) => ({ label: row.label, value: formatValue(getMemberValue(member, row.key)) }))
              .filter((entry) => entry.value);

            if (rows.length === 0 && !group.showWhenEmpty) {
              return null;
            }

            return (
              <div key={group.title} className="card">
                <h2>{group.title}</h2>
                <table className="info-table">
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.label}>
                        <th>{row.label}</th>
                        <td>{row.value}</td>
                      </tr>
                    ))}
                    {rows.length === 0 ? (
                      <tr>
                        <th colSpan={2}>No data entered yet.</th>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            );
          })}

          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <h2>Motorcycles</h2>
            <table className="info-table info-table--grid">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Make</th>
                  <th>Model</th>
                  <th>Color</th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(member.motorcycles) && member.motorcycles.length > 0 ? member.motorcycles.map((motorcycle: any) => (
                  <tr key={motorcycle.id}>
                    <td>{formatValue(motorcycle.year) || '-'}</td>
                    <td>{formatValue(motorcycle.make) || '-'}</td>
                    <td>{formatValue(motorcycle.model) || '-'}</td>
                    <td>{formatValue(motorcycle.color) || '-'}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4}>No motorcycles entered yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h1>{member.displayName}</h1>
        {canEdit ? (
          <Link href={`/members/edit/${member.id}`} className="btn-secondary" style={{ textDecoration: 'none' }}>
            Edit Member
          </Link>
        ) : null}
      </header>
      <section style={{ marginTop: 16, display: 'grid', gap: 6 }}>
        {member.fields?.map((field: { key: string; label: string; value: string }) => (
          <p key={field.key}><strong>{field.label}:</strong> {field.value}</p>
        ))}
        {member.optionalFields?.length ? (
          <>
            <h2>Additional shared info</h2>
            {member.optionalFields.map((field: { key: string; label: string; value: string }) => (
              <p key={field.key}><strong>{field.label}:</strong> {field.value}</p>
            ))}
          </>
        ) : null}
      </section>
    </main>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const cookies = parseCookies(context.req.headers.cookie ?? null);
  const accessToken = cookies[ACCESS_TOKEN_COOKIE];
  let account = null;

  // Authenticate and set RLS context for protected queries
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

  const member = await prisma.person.findUnique({
    where: { id: context.params?.id as string },
    include: {
      chapter: true,
      motorcycles: {
        orderBy: { year: 'desc' }
      }
    }
  });

  let canViewFull = false;
  let canEdit = false;

  if (account) {
    canViewFull = adminRoles.has((account.role ?? '').trim().toLowerCase()) || hasActiveChapterOfficerAssignment(account, member?.chapterId);
    canEdit = canEditMemberInScope(account, member);
  }

  if (canViewFull) {
    return {
      props: {
        member: member ? JSON.parse(JSON.stringify(member)) : null,
        canViewFull: true,
        canEdit
      }
    };
  }

  const configSetting = await (prisma.appSetting as any)?.findUnique({ where: { key: 'memberDirectorySharing' } }) || null;

  const publicMember = member
    ? buildPublicDirectoryMember(member as Record<string, unknown>, normalizeMemberDirectoryConfig(configSetting?.value))
    : null;

  return {
    props: {
      member: publicMember,
      canViewFull: false,
      canEdit
    }
  };
};
