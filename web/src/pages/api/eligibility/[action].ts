import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { authenticateAndSetRLSContext } from '@/lib/supabaseAuth';

type ErrorResponse = { message: string };

/**
 * POST /api/eligibility/config - Set or update eligibility config for chapter
 * GET /api/eligibility/config - Get eligibility config
 * POST /api/eligibility/meeting - Record a chapter meeting
 * GET /api/eligibility/meetings - List meetings for chapter
 * POST /api/eligibility/attendance - Record meeting attendance
 * GET /api/eligibility/attendance - Get attendance records
 * POST /api/eligibility/patch-status - Record back patch status change
 * GET /api/eligibility/patch-status - Get current patch status
 * POST /api/eligibility/contribution - Record donation/purchase
 * GET /api/eligibility/contributions - List contributions
 * GET /api/eligibility/member-status - Get member's eligibility status
 */

const adminRoles = new Set([
  'root', 'superuser', 'admin',
  'president', 'secretary',
  'ceo', 'board', 'board_advisor',
  'evangelist',
  'state_coordinator', 'area_rep'
]);

function isAdmin(role: string | null): boolean {
  return adminRoles.has((role ?? '').toLowerCase());
}

function isChapterAdmin(account: any, chapterId: string): boolean {
  if (isAdmin(account?.role)) return true;
  return account?.chapter?.id === chapterId;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const account = await authenticateAndSetRLSContext(req);
  if (!account) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  const { action } = req.query;

  try {
    // ========== ELIGIBILITY CONFIG ==========
    if (action === 'config') {
      if (req.method === 'GET') {
        const { chapterId } = req.query;
        if (!chapterId) {
          return res.status(400).json({ message: 'chapterId required' });
        }

        const config = await prisma.eligibilityConfig.findUnique({
          where: { chapterId: chapterId as string }
        });

        return res.status(200).json(config || {});
      }

      if (req.method === 'POST') {
        const { chapterId, ...configData } = req.body;
        if (!chapterId || !isChapterAdmin(account, chapterId)) {
          return res.status(403).json({ message: 'Not authorized to modify this chapter' });
        }

        const updated = await prisma.eligibilityConfig.upsert({
          where: { chapterId: chapterId },
          create: { chapterId: chapterId, ...configData },
          update: configData
        });

        return res.status(200).json(updated);
      }
    }

    // ========== CHAPTER MEETINGS ==========
    if (action === 'meeting') {
      if (req.method === 'POST') {
        const { chapterId, meetingDate, meetingTitle, meetingType, notes } = req.body;
        if (!chapterId || !isChapterAdmin(account, chapterId)) {
          return res.status(403).json({ message: 'Not authorized' });
        }

        const meeting = await prisma.chapterMeeting.create({
          data: {
            chapterId: chapterId,
            meetingDate: new Date(meetingDate),
            meetingTitle: meetingTitle,
            meetingType: meetingType || 'regular',
            notes,
            recordedBy: account.id
          }
        });

        return res.status(201).json(meeting);
      }
    }

    if (action === 'meetings') {
      if (req.method === 'GET') {
        const { chapterId, from, to } = req.query;
        if (!chapterId) {
          return res.status(400).json({ message: 'chapterId required' });
        }

        const meetings = await prisma.chapterMeeting.findMany({
          where: {
            chapterId: chapterId as string,
            ...(from && to && {
              meetingDate: {
                gte: new Date(from as string),
                lte: new Date(to as string)
              }
            })
          },
          orderBy: { meetingDate: 'desc' }
        });

        return res.status(200).json(meetings);
      }
    }

    // ========== MEETING ATTENDANCE ==========
    if (action === 'attendance') {
      if (req.method === 'POST') {
        const { meetingId, personId, attended, notes } = req.body;

        // Verify chapter admin
        const meeting = await prisma.chapterMeeting.findUnique({
          where: { id: meetingId }
        });

        if (!meeting || !isChapterAdmin(account, meeting.chapterId)) {
          return res.status(403).json({ message: 'Not authorized' });
        }

        const attendance = await prisma.chapterMeetingAttendance.upsert({
          where: { meetingId_personId: { meetingId: meetingId, personId: personId } },
          create: { meetingId: meetingId, personId: personId, attended, notes },
          update: { attended, notes }
        });

        return res.status(200).json(attendance);
      }

      if (req.method === 'GET') {
        const { meetingId, personId } = req.query;

        if (meetingId) {
          const records = await prisma.chapterMeetingAttendance.findMany({
            where: { meetingId: meetingId as string },
            include: { meeting: true }
          });
          return res.status(200).json(records);
        }

        if (personId) {
          const records = await prisma.chapterMeetingAttendance.findMany({
            where: { personId: personId as string },
            include: { meeting: true }
          });
          return res.status(200).json(records);
        }

        return res.status(400).json({ message: 'meetingId or personId required' });
      }
    }

    // ========== BACK PATCH STATUS ==========
    if (action === 'patch-status') {
      if (req.method === 'POST') {
        const { personId, chapterId, patchType, startDate, endDate, notes } = req.body;

        if (!isChapterAdmin(account, chapterId)) {
          return res.status(403).json({ message: 'Not authorized' });
        }

        // End previous patch status
        if (!endDate) {
          await prisma.memberBackPatchStatus.updateMany({
            where: {
              personId: personId,
              chapterId: chapterId,
              endDate: null
            },
            data: { endDate: new Date() }
          });
        }

        const status = await prisma.memberBackPatchStatus.create({
          data: {
            personId: personId,
            chapterId: chapterId,
            patchType: patchType,
            startDate: new Date(startDate),
            endDate: endDate ? new Date(endDate) : null,
            notes,
            recordedBy: account.id
          }
        });

        return res.status(201).json(status);
      }

      if (req.method === 'GET') {
        const { personId, chapterId } = req.query;

        if (!personId || !chapterId) {
          return res.status(400).json({ message: 'personId and chapterId required' });
        }

        const records = await prisma.memberBackPatchStatus.findMany({
          where: {
            personId: personId as string,
            chapterId: chapterId as string
          },
          orderBy: { startDate: 'desc' }
        });

        return res.status(200).json(records);
      }
    }

    // ========== MEMBER CONTRIBUTIONS ==========
    if (action === 'contribution') {
      if (req.method === 'POST') {
        const {
          personId,
          chapterId,
          contributionType,
          donationCycleId,
          amount,
          contributionDate,
          description
        } = req.body;

        const chapter = await prisma.chapter.findUnique({ where: { id: chapterId } });
        if (!chapter || !isChapterAdmin(account, chapterId)) {
          return res.status(403).json({ message: 'Not authorized' });
        }

        const contribution = await prisma.memberContribution.create({
          data: {
            personId: personId,
            chapterId: chapterId,
            contributionType: contributionType,
            donationCycleId: donationCycleId,
            amount: parseFloat(amount),
            contributionDate: new Date(contributionDate),
            description,
            recordedBy: account.id
          }
        });

        return res.status(201).json(contribution);
      }

      if (req.method === 'GET') {
        const { personId, chapterId, from, to } = req.query;

        const where: any = {};
        if (personId) where.personId = personId;
        if (chapterId) where.chapterId = chapterId;
        if (from && to) {
          where.contributionDate = {
            gte: new Date(from as string),
            lte: new Date(to as string)
          };
        }

        const contributions = await prisma.memberContribution.findMany({
          where,
          orderBy: { contributionDate: 'desc' }
        });

        return res.status(200).json(contributions);
      }
    }

    // ========== MEMBER ELIGIBILITY STATUS ==========
    if (action === 'member-status') {
      if (req.method === 'GET') {
        const { personId, chapterId } = req.query;

        if (!personId || !chapterId) {
          return res.status(400).json({ message: 'personId and chapterId required' });
        }

        const status = await prisma.memberEligibilityStatus.findUnique({
          where: {
            personId_chapterId: {
              personId: personId as string,
              chapterId: chapterId as string
            }
          }
        });

        return res.status(200).json(status || null);
      }
    }

    return res.status(404).json({ message: 'Action not found' });
  } catch (error) {
    console.error('Eligibility API error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
