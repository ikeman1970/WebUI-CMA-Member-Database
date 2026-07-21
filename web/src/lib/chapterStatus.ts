import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export const CHAPTER_STATUSES = ['active', 'inactive', 'dissolved'] as const;

export type ChapterStatus = typeof CHAPTER_STATUSES[number];

export function parseChapterStatus(value: unknown): ChapterStatus | null {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (CHAPTER_STATUSES.includes(normalized as ChapterStatus)) {
    return normalized as ChapterStatus;
  }
  return null;
}

export function normalizeChapterStatusOrDefault(value: unknown, fallback: ChapterStatus = 'active') {
  const parsed = parseChapterStatus(value);
  return parsed ?? fallback;
}

export async function recordChapterStatusTransition(args: {
  chapterId: string;
  fromStatus: string | null;
  toStatus: string;
  changedByAccountId?: string | null;
  reason?: string | null;
}) {
  const { chapterId, fromStatus, toStatus, changedByAccountId = null, reason = null } = args;

  try {
    await prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO chapter_status_transitions (chapter_id, from_status, to_status, changed_at, changed_by_account_id, reason)
        VALUES (${chapterId}, ${fromStatus}, ${toStatus}, NOW(), ${changedByAccountId}, ${reason})
      `
    );
  } catch {
    // Keep chapter operations functional even before DB migration is applied.
  }
}
