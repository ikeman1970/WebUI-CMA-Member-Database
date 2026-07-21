import { getRegionCodeFromState } from '@/lib/regions';
import { isAdminRole } from '@/lib/nationalPositions';

// adminRoles used for permission checks - role must be in this set to access admin functions
const adminRolesSet = new Set([
  'root', 'superuser', 'admin',           // System
  'president', 'secretary',                // Chapter
  'ceo', 'board', 'evangelist',           // National
  'state_coordinator', 'area_rep'         // State
]);

function normalizeScope(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeStateCode(value: unknown) {
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

function resolveAccountChapterId(account: any) {
  return account?.chapterId ?? account?.person?.chapterId ?? null;
}

function resolveAccountState(account: any) {
  return normalizeStateCode(account?.orgUnit?.code)
    ?? normalizeStateCode(account?.chapter?.state)
    ?? normalizeStateCode(account?.person?.chapter?.state);
}

function resolveAccountRegion(account: any) {
  return parseRegionNumber(account?.orgUnit?.code)
    ?? parseRegionNumber(account?.orgUnit?.name)
    ?? parseRegionNumber(account?.chapter?.region)
    ?? getRegionCodeFromState(account?.chapter?.state ?? null)
    ?? parseRegionNumber(account?.person?.chapter?.region)
    ?? getRegionCodeFromState(account?.person?.chapter?.state ?? null);
}

function resolveChapterState(chapter: any) {
  return normalizeStateCode(chapter?.state);
}

function resolveChapterRegion(chapter: any) {
  return parseRegionNumber(chapter?.region) ?? getRegionCodeFromState(chapter?.state ?? null);
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

export function hasActiveChapterOfficerAssignment(account: any, chapterId: string | null | undefined) {
  if (!account || !chapterId) {
    return false;
  }

  const assignments = account?.person?.officerAssignments;
  if (!Array.isArray(assignments) || assignments.length === 0) {
    return false;
  }

  const now = new Date();
  return assignments.some((assignment: any) => {
    if (assignment?.chapterId !== chapterId) {
      return false;
    }

    return isActiveDateRange(assignment?.startDate, assignment?.endDate, now);
  });
}

function canAdminAccessChapter(account: any, chapter: any) {
  const role = normalizeScope(account?.role);
  if (!adminRolesSet.has(role)) {
    return false;
  }

  const scopeType = normalizeScope(account?.scopeType);
  if (!scopeType || scopeType === 'global' || scopeType === 'all' || scopeType === 'national') {
    return true;
  }

  if (scopeType === 'chapter' || scopeType === 'chapter_admin' || scopeType === 'local') {
    return Boolean(account?.chapterId && chapter?.id && account.chapterId === chapter.id);
  }

  if (scopeType === 'state' || scopeType === 'state_admin') {
    const accountState = resolveAccountState(account);
    const chapterState = resolveChapterState(chapter);
    return Boolean(accountState && chapterState && accountState === chapterState);
  }

  if (scopeType === 'region' || scopeType === 'regional' || scopeType === 'region_admin') {
    const accountRegion = resolveAccountRegion(account);
    const chapterRegion = resolveChapterRegion(chapter);
    return Boolean(accountRegion && chapterRegion && accountRegion === chapterRegion);
  }

  return false;
}

export function canManageChapter(account: any, chapter: any) {
  if (!account || !chapter) {
    return false;
  }

  if (hasActiveChapterOfficerAssignment(account, chapter.id)) {
    return true;
  }

  return canAdminAccessChapter(account, chapter);
}

export function canAccessChapterDirectory(account: any, chapter: any) {
  if (!account || !chapter) {
    return false;
  }

  const accountChapterId = resolveAccountChapterId(account);
  if (accountChapterId && chapter.id && accountChapterId === chapter.id) {
    return true;
  }

  if (hasActiveChapterOfficerAssignment(account, chapter.id)) {
    return true;
  }

  return canAdminAccessChapter(account, chapter);
}
