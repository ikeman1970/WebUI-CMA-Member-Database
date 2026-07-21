import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { authenticateAndSetRLSContext } from '@/lib/supabaseAuth';
import { canImportReporting, canViewReporting, getReportingChapterWhere } from '@/lib/reportingAccess';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const account = await authenticateAndSetRLSContext(req);
  if (!account) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  const scopedAccount = await prisma.account.findUnique({
    where: { id: account.id },
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

  if (!scopedAccount) {
    return res.status(404).json({ message: 'Account not found.' });
  }

  const canView = canViewReporting(scopedAccount);
  const canImport = canImportReporting(scopedAccount);

  const visibleChapterCount = canView
    ? await prisma.chapter.count({ where: getReportingChapterWhere(scopedAccount) })
    : 0;

  return res.status(200).json({
    canView,
    canImport,
    visibleChapterCount
  });
}
