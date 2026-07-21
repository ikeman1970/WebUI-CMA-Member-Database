import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

const fieldGroups: Array<{ title: string; rows: Array<{ label: string; key: string }>; showWhenEmpty?: boolean }> = [
  {
    title: 'Identity',
    rows: [
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

function hasDirectoryFields(member: any): member is { fields: Array<{ key: string; label: string; value: string }>; optionalFields?: Array<{ key: string; label: string; value: string }> } {
  return Array.isArray(member?.fields);
}

export default function MembersPage() {
  const router = useRouter();
  const [members, setMembers] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/members');
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/');
          return;
        }
        setError('Failed to load members.');
        return;
      }
      setMembers(await res.json());
    }
    load();
  }, [router]);

  return (
    <main className="page-shell">
      <h1>Members</h1>
      <p className="inline-actions">
        <Link href="/members/new">Add Member</Link>
        <Link href="/members/import">Import Members</Link>
      </p>
      {error ? <p className="message-error">{error}</p> : null}
      <ul style={{ display: 'grid', gap: 16, listStyle: 'none', padding: 0, marginTop: 18 }}>
        {members.map((member) => (
          <li key={member.id} className="card">
            <Link href={`/members/${member.id}`}>
              <strong>{member.displayName ?? `${member.firstName ?? ''} ${member.lastName ?? ''}`.trim()}</strong>
            </Link>

            {hasDirectoryFields(member) ? (
              <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
                {member.fields.map((field: { key: string; label: string; value: string }) => (
                  <div key={field.key}><strong>{field.label}:</strong> {field.value}</div>
                ))}
                {member.optionalFields?.length ? (
                  <details>
                    <summary>Additional shared info</summary>
                    <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
                      {member.optionalFields.map((field: { key: string; label: string; value: string }) => (
                        <div key={field.key}><strong>{field.label}:</strong> {field.value}</div>
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>
            ) : (
              <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                {fieldGroups.map((group) => {
                  const rows = group.rows
                    .map((row) => ({ label: row.label, value: formatValue(member[row.key]) }))
                    .filter((entry) => entry.value);

                  if (rows.length === 0 && !group.showWhenEmpty) {
                    return null;
                  }

                  return (
                    <details key={group.title}>
                      <summary>{group.title}</summary>
                      <table className="info-table" style={{ marginTop: 8 }}>
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
                    </details>
                  );
                })}

                  <details>
                    <summary>Motorcycles</summary>
                    <table className="info-table info-table--grid" style={{ marginTop: 8 }}>
                      <thead>
                        <tr>
                          <th>Year</th>
                          <th>Make</th>
                          <th>Model</th>
                          <th>Color</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.isArray(member.motorcycles) && member.motorcycles.length ? member.motorcycles.map((motorcycle: any) => (
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
                  </details>
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
