import { GetServerSideProps } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { buildPublicDirectoryMember, normalizeMemberDirectoryConfig } from '@/lib/memberDirectory';
import { ACCESS_TOKEN_COOKIE, createSupabaseServerClient, parseCookies, setRLSContext } from '@/lib/supabaseAuth';
import { canAccessChapterDirectory } from '@/lib/chapterDirectoryAccess';

type DirectoryField = {
  key: string;
  label: string;
  value: string;
};

type DirectoryMember = {
  id: string;
  displayName: string;
  fields: DirectoryField[];
};

function readField(member: DirectoryMember, label: string) {
  return member.fields.find((field) => field.label === label)?.value ?? '';
}

export default function ChapterDirectoryPrintPage({ chapter, members }: { chapter: any; members: DirectoryMember[] }) {
  return (
    <main className="page-shell">
      <header className="print-header">
        <div>
          <h1>Chapter Directory</h1>
          <p style={{ margin: 0 }}>
            {chapter.number ? `Chapter ${chapter.number}` : 'Chapter'}{chapter.name ? ` - ${chapter.name}` : ''}
          </p>
          <p style={{ margin: '4px 0 0' }}>{chapter.city ?? ''}{chapter.city && chapter.state ? ', ' : ''}{chapter.state ?? ''}</p>
        </div>
        <div className="print-actions print-hide">
          <button type="button" onClick={() => window.print()}>Print Directory</button>
          <Link href={`/chapter/${chapter.id}`} className="btn-secondary" style={{ textDecoration: 'none' }}>Back to Chapter</Link>
        </div>
      </header>

      <section className="card" style={{ marginTop: 14 }}>
        <table className="directory-print-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Street Address</th>
              <th>City, State ZIP</th>
              <th>Phone1</th>
              <th>Phone2</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id}>
                <td>{readField(member, 'Name')}</td>
                <td>{readField(member, 'Address')}</td>
                <td>{readField(member, 'City, State Zip')}</td>
                <td>{readField(member, 'Phone1')}</td>
                <td>{readField(member, 'Phone2')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <style jsx global>{`
        .print-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 14px;
          flex-wrap: wrap;
        }

        .print-actions {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .directory-print-table {
          width: 100%;
          border-collapse: collapse;
        }

        .directory-print-table th,
        .directory-print-table td {
          border: 1px solid var(--border);
          padding: 0.45rem 0.5rem;
          text-align: left;
          vertical-align: top;
          font-size: 0.9rem;
        }

        .directory-print-table th {
          background: color-mix(in srgb, var(--bg-soft) 65%, transparent);
          color: var(--text-muted);
        }

        @media print {
          .print-hide,
          .app-top-nav,
          .theme-toggle-wrapper {
            display: none !important;
          }

          body {
            background: #fff !important;
            color: #111 !important;
          }

          main {
            max-width: 100%;
            padding: 0;
          }

          .card {
            border: 0;
            box-shadow: none;
            padding: 0;
            background: #fff;
          }

          .directory-print-table th,
          .directory-print-table td {
            border-color: #aaa;
            color: #111;
          }
        }
      `}</style>
    </main>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const chapterId = context.params?.id as string;

  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId }
  });

  if (!chapter) {
    return {
      notFound: true
    };
  }

  const cookies = parseCookies(context.req.headers.cookie ?? null);
  const accessToken = cookies[ACCESS_TOKEN_COOKIE];

  if (!accessToken) {
    return {
      redirect: {
        destination: '/',
        permanent: false
      }
    };
  }

  const supabase = createSupabaseServerClient();
  const { data } = await supabase.auth.getUser(accessToken);

  if (!data?.user?.email) {
    return {
      redirect: {
        destination: '/',
        permanent: false
      }
    };
  }

  const account = await prisma.account.findFirst({
    where: { email: data.user.email },
    include: {
      chapter: true,
      orgUnit: true,
      person: {
        include: {
          chapter: true,
          officerAssignments: {
            where: {
              chapterId
            }
          }
        }
      }
    }
  });

  // Set RLS context for subsequent queries
  if (account?.id) {
    await setRLSContext(account.id);
  }

  if (!account || !canAccessChapterDirectory(account, chapter)) {
    return {
      redirect: {
        destination: '/regions',
        permanent: false
      }
    };
  }

  const people = await prisma.person.findMany({
    where: { chapterId },
    orderBy: [
      { lastName: 'asc' },
      { firstName: 'asc' }
    ]
  });

  const configSetting = await (prisma as typeof prisma & {
    appSetting?: { findUnique: (args: { where: { key: string } }) => Promise<{ value: unknown } | null> };
  }).appSetting?.findUnique({ where: { key: 'memberDirectorySharing' } });

  const directoryConfig = normalizeMemberDirectoryConfig(configSetting?.value);

  const members = people.map((person) => buildPublicDirectoryMember(
    {
      ...person,
      chapterName: chapter.name ?? null,
      chapterNumber: chapter.number ?? null
    },
    directoryConfig
  ));

  return {
    props: {
      chapter: JSON.parse(JSON.stringify(chapter)),
      members: JSON.parse(JSON.stringify(members))
    }
  };
};
