import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { authenticateAndSetRLSContext } from '@/lib/supabaseAuth';
import { toBool, toNullableString } from '@/lib/memberImport';
import { provisionAccountInvite } from '@/lib/accountInvite';
import { getMemberImportRowLimit } from '@/lib/workbookSecurity';

function toNullableInt(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

async function resolveChapter(row: Record<string, unknown>) {
  const chapterId = toNullableString(row.chapterId);
  const chapterNumber = toNullableString(row.chapterNumber);
  const chapterName = toNullableString(row.chapterName);

  if (chapterId) {
    return prisma.chapter.findUnique({ where: { id: chapterId } });
  }

  if (chapterNumber) {
    return prisma.chapter.findFirst({ where: { number: chapterNumber } });
  }

  if (chapterName) {
    return prisma.chapter.findFirst({ where: { name: chapterName } });
  }

  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const account = await authenticateAndSetRLSContext(req);
  if (!account) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  const role = (account.role ?? '').toLowerCase();
  if (!['root', 'admin', 'superuser'].includes(role)) {
    return res.status(403).json({ message: 'Insufficient permissions.' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { rows, chapterId: requestChapterId } = req.body as { rows?: Array<Record<string, unknown>>; chapterId?: string };
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ message: 'No import rows provided.' });
  }

  if (rows.length > getMemberImportRowLimit()) {
    return res.status(413).json({
      message: `Import exceeds the safe row limit of ${getMemberImportRowLimit()}.`
    });
  }

  const fallbackChapterId = toNullableString(requestChapterId);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let onboardingProvisioned = 0;
  let onboardingSkipped = 0;

  for (const row of rows) {
    const firstName = toNullableString(row.firstName);
    const lastName = toNullableString(row.lastName);
    const cmaNumber = toNullableString(row.cmaNumber);

    if (!firstName || !lastName) {
      skipped += 1;
      continue;
    }

    const resolvedChapter = await resolveChapter(row) ?? (fallbackChapterId ? await prisma.chapter.findUnique({ where: { id: fallbackChapterId } }) : null);

    const payload = {
      firstName,
      lastName,
      cmaNumber,
      phone1: toNullableString(row.phone1),
      phone2: toNullableString(row.phone2),
      emailHome: toNullableString(row.emailHome),
      emailWork: toNullableString(row.emailWork),
      address1: toNullableString(row.address1),
      address2: toNullableString(row.address2),
      city: toNullableString(row.city),
      state: toNullableString(row.state),
      zipCode: toNullableString(row.zipCode),
      country: toNullableString(row.country),
      status: toNullableString(row.status),
      spouseName: toNullableString(row.spouseName),
      spouseCmaNumber: toNullableString(row.spouseCmaNumber),
      spouseCellPhone: toNullableString(row.spouseCellPhone),
      spouseEmail: toNullableString(row.spouseEmail),
      childrenNames: toNullableString(row.childrenNames),
      grandchildrenNames: toNullableString(row.grandchildrenNames),
      memberSinceYear: toNullableInt(row.memberSinceYear),
      spouseMemberSinceYear: toNullableInt(row.spouseMemberSinceYear),
      yearsInChapter: toNullableString(row.yearsInChapter),
      spouseYearsInChapter: toNullableString(row.spouseYearsInChapter),
      milesToMeetings: toNullableString(row.milesToMeetings),
      churchName: toNullableString(row.churchName),
      activeInMinistry: toBool(row.activeInMinistry),
      ministryHow: toNullableString(row.ministryHow),
      wantsEventContact: toBool(row.wantsEventContact),
      willingHostBibleStudy: toBool(row.willingHostBibleStudy),
      willingHostFellowship: toBool(row.willingHostFellowship),
      willingPrayerLineEmail: toBool(row.willingPrayerLineEmail),
      willingRunForSonHelp: toBool(row.willingRunForSonHelp),
      belongsOtherMotoOrg: toBool(row.belongsOtherMotoOrg),
      holdsOfficeOtherOrgs: toBool(row.holdsOfficeOtherOrgs),
      yearsRidingSelf: toNullableString(row.yearsRidingSelf),
      msfCourseSelf: toBool(row.msfCourseSelf),
      yearsRidingSpouse: toNullableString(row.yearsRidingSpouse),
      msfCourseSpouse: toBool(row.msfCourseSpouse),
      comments: toNullableString(row.comments),
      rescueEquipment: toNullableString(row.rescueEquipment),
      lodging: toNullableString(row.lodging),
      directoryShareHiddenFields: [],
      chapterId: resolvedChapter?.id ?? fallbackChapterId ?? null
    };

    const existing = cmaNumber
      ? await prisma.person.findFirst({ where: { cmaNumber } })
      : await prisma.person.findFirst({
          where: {
            firstName,
            lastName,
            chapterId: resolvedChapter?.id ?? null
          }
        });

    let savedPersonId: string;

    if (existing) {
      await prisma.person.update({
        where: { id: existing.id },
        data: payload
      });
      savedPersonId = existing.id;
      updated += 1;
    } else {
      const createdPerson = await prisma.person.create({ data: payload });
      savedPersonId = createdPerson.id;
      created += 1;
    }

    const inviteEmail = payload.emailHome ?? payload.emailWork;
    if (inviteEmail) {
      try {
        await provisionAccountInvite({
          personId: savedPersonId,
          email: inviteEmail,
          chapterId: payload.chapterId,
          createdByAccountId: account.id
        });
        onboardingProvisioned += 1;
      } catch {
        onboardingSkipped += 1;
      }
    } else {
      onboardingSkipped += 1;
    }
  }

  return res.status(200).json({
    created,
    updated,
    skipped,
    onboardingProvisioned,
    onboardingSkipped
  });
}
