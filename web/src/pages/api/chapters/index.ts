import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { authenticateAndSetRLSContext } from '@/lib/supabaseAuth';
import { getRegionCodeFromState } from '@/lib/regions';
import { buildPublicDirectoryMember, normalizeMemberDirectoryConfig } from '@/lib/memberDirectory';
import { parseChapterStatus, normalizeChapterStatusOrDefault, recordChapterStatusTransition } from '@/lib/chapterStatus';

function normalizeStatus(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function chapterPatchSettingKey(chapterId: string) {
  return `chapterPatchImage:${chapterId}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const account = await authenticateAndSetRLSContext(req);
  if (!account) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  if (req.method === 'GET') {
    const configSetting = await prisma.appSetting.findUnique({ where: { key: 'memberDirectorySharing' } });
    const directoryConfig = normalizeMemberDirectoryConfig(configSetting?.value);
    const chapters = await prisma.chapter.findMany({
      orderBy: [
        { number: 'asc' },
        { name: 'asc' }
      ],
      include: {
        people: true
      }
    });

    const patchSettingKeys = chapters.map((chapter) => chapterPatchSettingKey(chapter.id));
    const patchSettings = patchSettingKeys.length > 0
      ? await prisma.appSetting.findMany({
          where: {
            key: {
              in: patchSettingKeys
            }
          }
        })
      : [];

    const patchByChapterId = new Map<string, string>();
    for (const setting of patchSettings) {
      const chapterId = setting.key.replace('chapterPatchImage:', '');
      if (typeof setting.value === 'string' && setting.value.trim()) {
        patchByChapterId.set(chapterId, setting.value);
      }
    }

    return res.status(200).json(
      chapters.map((chapter) => ({
        ...chapter,
        patchImageUrl: patchByChapterId.get(chapter.id) ?? null,
        memberStatusCounts: chapter.people.reduce(
          (counts, person) => {
            const status = normalizeStatus(person.status);
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
        ),
        people: chapter.people.map((person) => buildPublicDirectoryMember({ ...person, chapterName: chapter.name ?? null, chapterNumber: chapter.number ?? null }, directoryConfig))
      }))
    );
  }

  if (req.method === 'POST') {
    const { name, number, city, state, country, status } = req.body as {
      name?: string;
      number?: string;
      city?: string;
      state?: string;
      country?: string;
      status?: string;
    };

    if (!name || !number) {
      return res.status(400).json({ message: 'Name and number are required.' });
    }

    if (status !== undefined && status !== null && parseChapterStatus(status) === null) {
      return res.status(400).json({ message: 'Invalid chapter status. Use active, inactive, or dissolved.' });
    }

    const normalizedStatus = normalizeChapterStatusOrDefault(status, 'active');

    const chapter = await prisma.chapter.create({
      data: {
        name,
        number,
        city: city ?? null,
        state: state ?? null,
        country: country ?? null,
        status: normalizedStatus,
        region: getRegionCodeFromState(state ?? null)
      }
    });

    await recordChapterStatusTransition({
      chapterId: chapter.id,
      fromStatus: null,
      toStatus: normalizedStatus,
      changedByAccountId: account.id,
      reason: 'chapter-created'
    });

    return res.status(201).json(chapter);
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
