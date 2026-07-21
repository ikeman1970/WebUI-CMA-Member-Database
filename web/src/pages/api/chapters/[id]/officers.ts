import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { canManageChapter } from '@/lib/chapterDirectoryAccess';
import { authenticateAndSetRLSContext } from '@/lib/supabaseAuth';

function parseOptionalDate(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const account = await authenticateAndSetRLSContext(req);
  if (!account) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  const chapterId = req.query.id as string;
  if (!chapterId) {
    return res.status(400).json({ message: 'Missing chapter ID.' });
  }

  const chapter = await prisma.chapter.findUnique({ where: { id: chapterId } });
  if (!chapter) {
    return res.status(404).json({ message: 'Chapter not found.' });
  }

  const scopedAccount = await prisma.account.findUnique({
    where: { id: account.id },
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

  if (!scopedAccount) {
    return res.status(401).json({ message: 'Account not found.' });
  }

  if (!canManageChapter(scopedAccount, chapter)) {
    return res.status(403).json({ message: 'Not authorized to manage officers for this chapter.' });
  }

  if (req.method === 'POST') {
    const body = req.body as Partial<{ role: string; personId: string; startDate: string; endDate: string }>;
    const role = String(body.role ?? '').trim();
    const personId = String(body.personId ?? '').trim();

    if (!role || !personId) {
      return res.status(400).json({ message: 'Role and member are required.' });
    }

    const person = await prisma.person.findUnique({ where: { id: personId } });
    if (!person || person.chapterId !== chapterId) {
      return res.status(400).json({ message: 'Selected member is not in this chapter.' });
    }

    const startDate = parseOptionalDate(body.startDate);
    const endDate = parseOptionalDate(body.endDate);
    if (body.startDate && !startDate) {
      return res.status(400).json({ message: 'Invalid start date.' });
    }
    if (body.endDate && !endDate) {
      return res.status(400).json({ message: 'Invalid end date.' });
    }

    const assignment = await prisma.officerAssignment.create({
      data: {
        chapterId,
        personId,
        role,
        startDate,
        endDate
      },
      include: {
        person: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            cmaNumber: true
          }
        }
      }
    });

    return res.status(201).json(assignment);
  }

  if (req.method === 'DELETE') {
    const assignmentId = String(req.query.assignmentId ?? '').trim();
    if (!assignmentId) {
      return res.status(400).json({ message: 'Missing assignment ID.' });
    }

    const existing = await prisma.officerAssignment.findUnique({ where: { id: assignmentId } });
    if (!existing || existing.chapterId !== chapterId) {
      return res.status(404).json({ message: 'Officer assignment not found.' });
    }

    await prisma.officerAssignment.delete({ where: { id: assignmentId } });
    return res.status(204).end();
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
