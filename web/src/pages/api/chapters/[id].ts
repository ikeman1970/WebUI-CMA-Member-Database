import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { authenticateAndSetRLSContext } from '@/lib/supabaseAuth';
import { getRegionCodeFromState } from '@/lib/regions';
import { buildPublicDirectoryMember, normalizeMemberDirectoryConfig } from '@/lib/memberDirectory';
import { canManageChapter } from '@/lib/chapterDirectoryAccess';
import { parseChapterStatus, recordChapterStatusTransition } from '@/lib/chapterStatus';

function chapterPatchSettingKey(chapterId: string) {
  return `chapterPatchImage:${chapterId}`;
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

  if (req.method === 'GET') {
    const configSetting = await prisma.appSetting.findUnique({ where: { key: 'memberDirectorySharing' } });
    const directoryConfig = normalizeMemberDirectoryConfig(configSetting?.value);
    const [chapter, patchSetting] = await Promise.all([
      prisma.chapter.findUnique({
        where: { id: chapterId },
        include: { people: true }
      }),
      prisma.appSetting.findUnique({
        where: { key: chapterPatchSettingKey(chapterId) }
      })
    ]);

    if (!chapter) {
      return res.status(404).json({ message: 'Chapter not found.' });
    }

    const patchImageUrl = typeof patchSetting?.value === 'string' ? patchSetting.value : null;

    return res.status(200).json({
      ...chapter,
      patchImageUrl,
      people: chapter.people.map((person) => buildPublicDirectoryMember({ ...person, chapterName: chapter.name ?? null, chapterNumber: chapter.number ?? null }, directoryConfig))
    });
  }

  if (req.method === 'PUT') {
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

    if (!scopedAccount || !canManageChapter(scopedAccount, chapter)) {
      return res.status(403).json({ message: 'Not authorized to manage this chapter.' });
    }

    const updateData = req.body as Partial<{
      name: string;
      number: string;
      city: string;
      state: string;
      country: string;
      status: string;
      patchImageUrl: string | null;
    }>;

    let normalizedStatus: string | undefined;
    if (updateData.status !== undefined) {
      const parsed = parseChapterStatus(updateData.status);
      if (!parsed) {
        return res.status(400).json({ message: 'Invalid chapter status. Use active, inactive, or dissolved.' });
      }
      normalizedStatus = parsed;
    }

    const priorStatus = chapter.status ? String(chapter.status).trim().toLowerCase() : null;

    const updatedChapter = await prisma.chapter.update({
      where: { id: chapterId },
      data: {
        name: updateData.name ?? undefined,
        number: updateData.number ?? undefined,
        city: updateData.city ?? undefined,
        state: updateData.state ?? undefined,
        country: updateData.country ?? undefined,
        status: normalizedStatus ?? undefined,
        region: updateData.state !== undefined ? getRegionCodeFromState(updateData.state) : undefined
      }
    });

    const nextStatus = updatedChapter.status ? String(updatedChapter.status).trim().toLowerCase() : null;
    if (nextStatus && nextStatus !== priorStatus) {
      await recordChapterStatusTransition({
        chapterId,
        fromStatus: priorStatus,
        toStatus: nextStatus,
        changedByAccountId: account.id,
        reason: 'chapter-updated'
      });
    }

    if (updateData.patchImageUrl !== undefined) {
      const normalizedPatchImageUrl = typeof updateData.patchImageUrl === 'string'
        ? updateData.patchImageUrl.trim()
        : '';

      if (normalizedPatchImageUrl) {
        await prisma.appSetting.upsert({
          where: { key: chapterPatchSettingKey(chapterId) },
          create: {
            key: chapterPatchSettingKey(chapterId),
            value: normalizedPatchImageUrl
          },
          update: {
            value: normalizedPatchImageUrl
          }
        });
      } else {
        await prisma.appSetting.deleteMany({
          where: { key: chapterPatchSettingKey(chapterId) }
        });
      }
    }

    const patchSetting = await prisma.appSetting.findUnique({
      where: { key: chapterPatchSettingKey(chapterId) }
    });

    return res.status(200).json({
      ...updatedChapter,
      patchImageUrl: typeof patchSetting?.value === 'string' ? patchSetting.value : null
    });
  }

  if (req.method === 'DELETE') {
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

    if (!scopedAccount || !canManageChapter(scopedAccount, chapter)) {
      return res.status(403).json({ message: 'Not authorized to manage this chapter.' });
    }

    const priorStatus = chapter.status ? String(chapter.status).trim().toLowerCase() : null;
    const dissolved = await prisma.chapter.update({
      where: { id: chapterId },
      data: { status: 'dissolved' }
    });

    if (priorStatus !== 'dissolved') {
      await recordChapterStatusTransition({
        chapterId,
        fromStatus: priorStatus,
        toStatus: 'dissolved',
        changedByAccountId: account.id,
        reason: 'chapter-dissolved'
      });
    }

    return res.status(200).json(dissolved);
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
