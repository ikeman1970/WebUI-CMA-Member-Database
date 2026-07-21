import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const snapshots = await prisma.chapterReportingSnapshot.findMany({
  where: {
    reportMonth: {
      gte: new Date('2026-06-01'),
      lt: new Date('2026-07-01')
    }
  },
  include: { chapter: true },
  orderBy: { importedAt: 'desc' }
});

if (snapshots.length === 0) {
  console.log('No snapshots found for June 2026');
} else {
  for (const snap of snapshots) {
    console.log('\n=== Chapter:', snap.chapter?.name || 'Unknown');
    console.log('Month:', snap.reportMonth.toISOString().split('T')[0]);
    console.log('Source:', snap.sourceFileName);
    console.log('\nMetrics:');
    const metrics = snap.metrics || {};
    Object.keys(metrics).sort().forEach(key => {
      console.log('  ' + key + ': ' + metrics[key]);
    });
  }
}

await prisma.$disconnect();
