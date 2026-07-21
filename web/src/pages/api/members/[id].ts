import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { authenticateAndSetRLSContext } from '@/lib/supabaseAuth';
import { normalizeHiddenDirectoryFields } from '@/lib/memberDirectory';

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

function buildDisplayName(firstName: string | null, lastName: string | null) {
  const joined = [firstName ?? '', lastName ?? ''].filter(Boolean).join(' ').trim();
  return joined.length > 0 ? joined : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const account = await authenticateAndSetRLSContext(req);
  if (!account) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  const memberId = req.query.id as string;
  if (!memberId) {
    return res.status(400).json({ message: 'Missing member ID.' });
  }

  if (req.method === 'GET') {
    const member = await prisma.person.findUnique({
      where: { id: memberId }
    });
    if (!member) {
      return res.status(404).json({ message: 'Member not found.' });
    }
    return res.status(200).json(member);
  }

  if (req.method === 'PUT') {
    const body = req.body as Record<string, unknown>;
    const spouseMemberId = body.spouseMemberId !== undefined ? toNullableString(body.spouseMemberId) : undefined;

    if (spouseMemberId === memberId) {
      return res.status(400).json({ message: 'A member cannot be linked as their own spouse.' });
    }

    try {
      const member = await prisma.$transaction(async (tx) => {
        const existing = await tx.person.findUnique({
          where: { id: memberId },
          select: {
            id: true,
            spouseId: true,
            firstName: true,
            lastName: true,
            cmaNumber: true,
            phone1: true,
            phone2: true,
            emailHome: true,
            emailWork: true,
            memberSinceYear: true,
            yearsInChapter: true
          }
        });

        if (!existing) {
          throw new Error('MEMBER_NOT_FOUND');
        }

        let selectedSpouse: {
          id: string;
          spouseId: string | null;
          firstName: string | null;
          lastName: string | null;
          cmaNumber: string | null;
          phone1: string | null;
          phone2: string | null;
          emailHome: string | null;
          emailWork: string | null;
          memberSinceYear: number | null;
          yearsInChapter: string | null;
        } | null = null;

        if (spouseMemberId !== undefined && spouseMemberId !== null) {
          selectedSpouse = await tx.person.findUnique({
            where: { id: spouseMemberId },
            select: {
              id: true,
              spouseId: true,
              firstName: true,
              lastName: true,
              cmaNumber: true,
              phone1: true,
              phone2: true,
              emailHome: true,
              emailWork: true,
              memberSinceYear: true,
              yearsInChapter: true
            }
          });

          if (!selectedSpouse) {
            throw new Error('SPOUSE_NOT_FOUND');
          }

          if (selectedSpouse.spouseId && selectedSpouse.spouseId !== memberId) {
            await tx.person.update({
              where: { id: selectedSpouse.spouseId },
              data: { spouseId: null }
            });
          }
        }

        const updateData: Record<string, unknown> = {
          firstName: toNullableString(body.firstName) ?? undefined,
          lastName: toNullableString(body.lastName) ?? undefined,
          cmaNumber: toNullableString(body.cmaNumber) ?? undefined,
          phone1: toNullableString(body.phone1) ?? undefined,
          phone2: toNullableString(body.phone2) ?? undefined,
          hasMotorcycleInsurance: body.hasMotorcycleInsurance !== undefined ? toBool(body.hasMotorcycleInsurance) : undefined,
          emailHome: toNullableString(body.emailHome) ?? undefined,
          emailWork: toNullableString(body.emailWork) ?? undefined,
          address1: toNullableString(body.address1) ?? undefined,
          address2: toNullableString(body.address2) ?? undefined,
          city: toNullableString(body.city) ?? undefined,
          state: toNullableString(body.state) ?? undefined,
          zipCode: toNullableString(body.zipCode) ?? undefined,
          country: toNullableString(body.country) ?? undefined,
          status: toNullableString(body.status) ?? undefined,
          statusEffectiveDate: body.statusEffectiveDate !== undefined ? toNullableDate(body.statusEffectiveDate) : undefined,
          birthday: body.birthday !== undefined ? toNullableDate(body.birthday) : undefined,
          anniversary: body.anniversary !== undefined ? toNullableDate(body.anniversary) : undefined,
          spouseName: toNullableString(body.spouseName) ?? undefined,
          spouseCmaNumber: toNullableString(body.spouseCmaNumber) ?? undefined,
          spouseCellPhone: toNullableString(body.spouseCellPhone) ?? undefined,
          spouseEmail: toNullableString(body.spouseEmail) ?? undefined,
          childrenNames: toNullableString(body.childrenNames) ?? undefined,
          grandchildrenNames: toNullableString(body.grandchildrenNames) ?? undefined,
          memberSinceYear: toNullableInt(body.memberSinceYear) ?? undefined,
          spouseMemberSinceYear: toNullableInt(body.spouseMemberSinceYear) ?? undefined,
          yearsInChapter: toNullableString(body.yearsInChapter) ?? undefined,
          spouseYearsInChapter: toNullableString(body.spouseYearsInChapter) ?? undefined,
          milesToMeetings: toNullableString(body.milesToMeetings) ?? undefined,
          churchName: toNullableString(body.churchName) ?? undefined,
          activeInMinistry: body.activeInMinistry !== undefined ? toBool(body.activeInMinistry) : undefined,
          ministryHow: toNullableString(body.ministryHow) ?? undefined,
          wantsEventContact: body.wantsEventContact !== undefined ? toBool(body.wantsEventContact) : undefined,
          willingHostBibleStudy: body.willingHostBibleStudy !== undefined ? toBool(body.willingHostBibleStudy) : undefined,
          willingHostFellowship: body.willingHostFellowship !== undefined ? toBool(body.willingHostFellowship) : undefined,
          willingPrayerLineEmail: body.willingPrayerLineEmail !== undefined ? toBool(body.willingPrayerLineEmail) : undefined,
          willingRunForSonHelp: body.willingRunForSonHelp !== undefined ? toBool(body.willingRunForSonHelp) : undefined,
          belongsOtherMotoOrg: body.belongsOtherMotoOrg !== undefined ? toBool(body.belongsOtherMotoOrg) : undefined,
          holdsOfficeOtherOrgs: body.holdsOfficeOtherOrgs !== undefined ? toBool(body.holdsOfficeOtherOrgs) : undefined,
          yearsRidingSelf: toNullableString(body.yearsRidingSelf) ?? undefined,
          msfCourseSelf: body.msfCourseSelf !== undefined ? toBool(body.msfCourseSelf) : undefined,
          yearsRidingSpouse: toNullableString(body.yearsRidingSpouse) ?? undefined,
          msfCourseSpouse: body.msfCourseSpouse !== undefined ? toBool(body.msfCourseSpouse) : undefined,
          comments: toNullableString(body.comments) ?? undefined,
          rescueEquipment: toNullableString(body.rescueEquipment) ?? undefined,
          lodging: toNullableString(body.lodging) ?? undefined,
          directoryShareHiddenFields: body.directoryShareHiddenFields !== undefined ? normalizeHiddenDirectoryFields(body.directoryShareHiddenFields) : undefined,
          chapterId: toNullableString(body.chapterId) ?? undefined
        };

        if (spouseMemberId !== undefined) {
          updateData.spouseId = spouseMemberId;
        }

        if (selectedSpouse) {
          updateData.spouseName = buildDisplayName(selectedSpouse.firstName, selectedSpouse.lastName);
          updateData.spouseCmaNumber = selectedSpouse.cmaNumber ?? null;
          updateData.spouseCellPhone = selectedSpouse.phone1 ?? selectedSpouse.phone2 ?? null;
          updateData.spouseEmail = selectedSpouse.emailHome ?? selectedSpouse.emailWork ?? null;
          updateData.spouseMemberSinceYear = selectedSpouse.memberSinceYear ?? null;
          updateData.spouseYearsInChapter = selectedSpouse.yearsInChapter ?? null;
        }

        const saved = await tx.person.update({
          where: { id: memberId },
          data: updateData
        });

        if (spouseMemberId !== undefined && existing.spouseId && existing.spouseId !== spouseMemberId) {
          await tx.person.update({
            where: { id: existing.spouseId },
            data: {
              spouseId: null,
              spouseName: null,
              spouseCmaNumber: null,
              spouseCellPhone: null,
              spouseEmail: null,
              spouseMemberSinceYear: null,
              spouseYearsInChapter: null
            }
          });
        }

        const reciprocalSpouseId = spouseMemberId !== undefined ? spouseMemberId : saved.spouseId;
        if (reciprocalSpouseId && reciprocalSpouseId !== saved.id) {
          await tx.person.update({
            where: { id: reciprocalSpouseId },
            data: {
              spouseId: saved.id,
              spouseName: buildDisplayName(saved.firstName, saved.lastName),
              spouseCmaNumber: saved.cmaNumber ?? null,
              spouseCellPhone: saved.phone1 ?? saved.phone2 ?? null,
              spouseEmail: saved.emailHome ?? saved.emailWork ?? null,
              spouseMemberSinceYear: saved.memberSinceYear ?? null,
              spouseYearsInChapter: saved.yearsInChapter ?? null
            }
          });
        }

        return saved;
      });

      return res.status(200).json(member);
    } catch (error) {
      if (error instanceof Error && error.message === 'MEMBER_NOT_FOUND') {
        return res.status(404).json({ message: 'Member not found.' });
      }

      if (error instanceof Error && error.message === 'SPOUSE_NOT_FOUND') {
        return res.status(400).json({ message: 'Selected spouse member was not found.' });
      }

      return res.status(500).json({ message: 'Failed to update member.' });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
