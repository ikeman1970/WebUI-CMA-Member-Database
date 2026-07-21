import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { authenticateAndSetRLSContext } from '@/lib/supabaseAuth';
import { buildPublicDirectoryMember, normalizeHiddenDirectoryFields, normalizeMemberDirectoryConfig } from '@/lib/memberDirectory';
import { provisionAccountInvite } from '@/lib/accountInvite';

const adminRoles = new Set([
  'root', 'superuser', 'admin',           // System
  'president', 'secretary',                // Chapter
  'ceo', 'board', 'board_advisor',        // National
  'evangelist',                            // Regional
  'state_coordinator', 'area_rep'         // State
]);

function toNullableString(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toNullableInt(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function toBool(value: unknown) {
  if (typeof value === 'boolean') return value;
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return false;
  return ['true', '1', 'yes', 'y', 'x', 'checked'].includes(normalized);
}

function toNullableDate(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseChapterId(chapterId: unknown) {
  return toNullableString(chapterId);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const account = await authenticateAndSetRLSContext(req);
  if (!account) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  if (req.method === 'GET') {
    const normalizedRole = (account.role ?? '').trim().toLowerCase();
    const canViewFull = adminRoles.has(normalizedRole);
    const configSetting = await prisma.appSetting.findUnique({ where: { key: 'memberDirectorySharing' } });
    const directoryConfig = normalizeMemberDirectoryConfig(configSetting?.value);
    const members = await prisma.person.findMany({
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' }
      ],
      include: {
          chapter: true,
          motorcycles: {
            orderBy: { year: 'desc' }
          }
      }
    });

    if (canViewFull) {
      return res.status(200).json(
        members.map((member) => ({
          ...member,
          chapterName: member.chapter?.name ?? null,
          chapterNumber: member.chapter?.number ?? null
        }))
      );
    }

    return res.status(200).json(
      members.map((member) => buildPublicDirectoryMember(
        {
          ...member,
          chapterName: member.chapter?.name ?? null,
          chapterNumber: member.chapter?.number ?? null
        },
        directoryConfig
      ))
    );
  }

  if (req.method === 'POST') {
    const body = req.body as Record<string, unknown>;
    const firstName = toNullableString(body.firstName);
    const lastName = toNullableString(body.lastName);
    const cmaNumber = toNullableString(body.cmaNumber);

    if (!firstName || !lastName || !cmaNumber) {
      return res.status(400).json({ message: 'firstName, lastName, and cmaNumber are required.' });
    }

    const chapterId = parseChapterId(body.chapterId);
    const chapterNumber = toNullableString(body.chapterNumber);
    const chapterName = toNullableString(body.chapterName);
    const state = toNullableString(body.state);
    const resolvedChapter = chapterId
      ? await prisma.chapter.findUnique({ where: { id: chapterId } })
      : chapterNumber
        ? await prisma.chapter.findFirst({ where: { number: chapterNumber } })
        : chapterName
          ? await prisma.chapter.findFirst({ where: { name: chapterName } })
          : null;
    const resolvedChapterId = resolvedChapter?.id ?? chapterId ?? null;
    const member = await prisma.person.create({
      data: {
        firstName,
        lastName,
        cmaNumber,
        phone1: toNullableString(body.phone1),
        phone2: toNullableString(body.phone2),
        hasMotorcycleInsurance: toBool(body.hasMotorcycleInsurance),
        emailHome: toNullableString(body.emailHome),
        emailWork: toNullableString(body.emailWork),
        address1: toNullableString(body.address1),
        address2: toNullableString(body.address2),
        city: toNullableString(body.city),
        state,
        zipCode: toNullableString(body.zipCode),
        country: toNullableString(body.country),
        status: toNullableString(body.status),
        statusEffectiveDate: toNullableDate(body.statusEffectiveDate),
        birthday: toNullableDate(body.birthday),
        anniversary: toNullableDate(body.anniversary),
        spouseName: toNullableString(body.spouseName),
        spouseCmaNumber: toNullableString(body.spouseCmaNumber),
        spouseCellPhone: toNullableString(body.spouseCellPhone),
        spouseEmail: toNullableString(body.spouseEmail),
        childrenNames: toNullableString(body.childrenNames),
        grandchildrenNames: toNullableString(body.grandchildrenNames),
        memberSinceYear: toNullableInt(body.memberSinceYear),
        spouseMemberSinceYear: toNullableInt(body.spouseMemberSinceYear),
        yearsInChapter: toNullableString(body.yearsInChapter),
        spouseYearsInChapter: toNullableString(body.spouseYearsInChapter),
        milesToMeetings: toNullableString(body.milesToMeetings),
        churchName: toNullableString(body.churchName),
        activeInMinistry: toBool(body.activeInMinistry),
        ministryHow: toNullableString(body.ministryHow),
        wantsEventContact: toBool(body.wantsEventContact),
        willingHostBibleStudy: toBool(body.willingHostBibleStudy),
        willingHostFellowship: toBool(body.willingHostFellowship),
        willingPrayerLineEmail: toBool(body.willingPrayerLineEmail),
        willingRunForSonHelp: toBool(body.willingRunForSonHelp),
        belongsOtherMotoOrg: toBool(body.belongsOtherMotoOrg),
        holdsOfficeOtherOrgs: toBool(body.holdsOfficeOtherOrgs),
        yearsRidingSelf: toNullableString(body.yearsRidingSelf),
        msfCourseSelf: toBool(body.msfCourseSelf),
        yearsRidingSpouse: toNullableString(body.yearsRidingSpouse),
        msfCourseSpouse: toBool(body.msfCourseSpouse),
        comments: toNullableString(body.comments),
        rescueEquipment: toNullableString(body.rescueEquipment),
        lodging: toNullableString(body.lodging),
        directoryShareHiddenFields: normalizeHiddenDirectoryFields(body.directoryShareHiddenFields),
        chapterId: resolvedChapterId
      }
    });

    const inviteEmail = toNullableString(body.emailHome) ?? toNullableString(body.emailWork);
    let invite: {
      email: string;
      setupLink: string;
      expiresAt: string;
      dispatchMode: 'blocked-nonprod' | 'simulated' | 'sent';
    } | null = null;

    if (inviteEmail) {
      const provisioned = await provisionAccountInvite({
        personId: member.id,
        email: inviteEmail,
        chapterId: resolvedChapterId,
        createdByAccountId: account.id
      });

      invite = {
        email: provisioned.email,
        setupLink: provisioned.invite.setupLink,
        expiresAt: provisioned.invite.expiresAt,
        dispatchMode: provisioned.invite.dispatchMode
      };
    }

    return res.status(201).json({
      ...member,
      onboarding: {
        accountProvisioned: Boolean(invite),
        invite
      }
    });
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
