import type { Prisma } from '@prisma/client';
import { getRegionCodeFromState } from '@/lib/regions';
import { isAdminRole as isNationalAdminRole } from '@/lib/nationalPositions';

const adminRolesSet = new Set([
  'root', 'superuser', 'admin',           // System
  'president', 'secretary',                // Chapter
  'ceo', 'board', 'evangelist',           // National
  'state_coordinator', 'area_rep'         // State
]);
const localScopeTypes = new Set(['chapter', 'chapter_admin', 'local']);

function normalize(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeState(value: unknown) {
  const state = String(value ?? '').trim();
  return state ? state.toUpperCase() : null;
}

function parseRegionNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const match = value.match(/\d+/);
  if (!match) {
    return null;
  }

  const parsed = Number.parseInt(match[0], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function isActiveDateRange(startDate: unknown, endDate: unknown, now: Date) {
  const start = startDate ? new Date(String(startDate)) : null;
  const end = endDate ? new Date(String(endDate)) : null;

  if (start && Number.isNaN(start.getTime())) {
    return false;
  }
  if (end && Number.isNaN(end.getTime())) {
    return false;
  }

  if (start && start > now) {
    return false;
  }
  if (end && end < now) {
    return false;
  }

  return true;
}

export function isAdminRole(role: unknown) {
  return adminRolesSet.has(normalize(role));
}

export function getActiveOfficerChapterIds(account: any) {
  const assignments = account?.person?.officerAssignments;
  if (!Array.isArray(assignments) || assignments.length === 0) {
    return [] as string[];
  }

  const now = new Date();
  const chapterIds = new Set<string>();

  for (const assignment of assignments) {
    if (!assignment?.chapterId) {
      continue;
    }

    if (isActiveDateRange(assignment?.startDate, assignment?.endDate, now)) {
      chapterIds.add(String(assignment.chapterId));
    }
  }

  return Array.from(chapterIds);
}

function resolveAccountChapterIds(account: any) {
  const ids = new Set<string>();

  if (account?.chapterId) {
    ids.add(String(account.chapterId));
  }
  if (account?.person?.chapterId) {
    ids.add(String(account.person.chapterId));
  }

  for (const officerChapterId of getActiveOfficerChapterIds(account)) {
    ids.add(officerChapterId);
  }

  return Array.from(ids);
}

function resolveAccountState(account: any) {
  return normalizeState(account?.orgUnit?.code)
    ?? normalizeState(account?.chapter?.state)
    ?? normalizeState(account?.person?.chapter?.state);
}

function resolveAccountRegion(account: any) {
  return parseRegionNumber(account?.orgUnit?.code)
    ?? parseRegionNumber(account?.orgUnit?.name)
    ?? parseRegionNumber(account?.chapter?.region)
    ?? getRegionCodeFromState(account?.chapter?.state ?? null)
    ?? parseRegionNumber(account?.person?.chapter?.region)
    ?? getRegionCodeFromState(account?.person?.chapter?.state ?? null);
}

export function canViewReporting(account: any) {
  if (!account) {
    return false;
  }

  if (isAdminRole(account?.role)) {
    return true;
  }

  return getActiveOfficerChapterIds(account).length > 0;
}

export function canImportReporting(account: any) {
  if (!account) {
    return false;
  }

  if (getActiveOfficerChapterIds(account).length > 0) {
    return true;
  }

  if (!isAdminRole(account?.role)) {
    return false;
  }

  return localScopeTypes.has(normalize(account?.scopeType));
}

export function canEditReportingForChapter(account: any, chapterId: string) {
  if (!account || !chapterId) {
    return false;
  }

  const chapterIdsFromOfficerAssignments = getActiveOfficerChapterIds(account);
  if (chapterIdsFromOfficerAssignments.includes(chapterId)) {
    return true;
  }

  if (!isAdminRole(account?.role)) {
    return false;
  }

  if (!localScopeTypes.has(normalize(account?.scopeType))) {
    return false;
  }

  return resolveAccountChapterIds(account).includes(chapterId);
}

export function getReportingChapterWhere(account: any): Prisma.ChapterWhereInput {
  const chapterIds = resolveAccountChapterIds(account);
  const roleIsAdmin = isAdminRole(account?.role);
  const scopeType = normalize(account?.scopeType);

  if (!roleIsAdmin) {
    return chapterIds.length > 0 ? { id: { in: chapterIds } } : { id: { in: [''] } };
  }

  if (!scopeType || scopeType === 'global' || scopeType === 'all' || scopeType === 'national') {
    return {};
  }

  if (localScopeTypes.has(scopeType)) {
    return chapterIds.length > 0 ? { id: { in: chapterIds } } : { id: { in: [''] } };
  }

  if (scopeType === 'state' || scopeType === 'state_admin') {
    const state = resolveAccountState(account);
    if (!state) {
      return { id: { in: [''] } };
    }
    return { state: { equals: state, mode: 'insensitive' } };
  }

  if (scopeType === 'region' || scopeType === 'regional' || scopeType === 'region_admin') {
    const region = resolveAccountRegion(account);
    if (!region) {
      return { id: { in: [''] } };
    }
    return { region };
  }

  return chapterIds.length > 0 ? { id: { in: chapterIds } } : { id: { in: [''] } };
}
