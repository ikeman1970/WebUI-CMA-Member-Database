import Link from 'next/link';

type ChapterWorkspaceTabsProps = {
  activeTab: 'chapters' | 'events' | 'reporting';
};

const tabs = [
  { href: '/chapters', label: 'Chapters', tab: 'chapters' as const },
  { href: '/chapters/events', label: 'Events', tab: 'events' as const },
  { href: '/chapters/reporting', label: 'Reporting', tab: 'reporting' as const }
];

export default function ChapterWorkspaceTabs({ activeTab }: ChapterWorkspaceTabsProps) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, margin: '0 0 18px' }}>
      {tabs.map((tab) => {
        const active = tab.tab === activeTab;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 40,
              padding: '0 16px',
              borderRadius: 999,
              border: active ? '1px solid rgba(255,255,255,0.35)' : '1px solid rgba(255,255,255,0.12)',
              background: active ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
              color: 'inherit',
              textDecoration: 'none',
              fontWeight: active ? 700 : 500
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
