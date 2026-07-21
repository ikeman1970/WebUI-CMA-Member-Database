import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { authenticateAndSetRLSContext } from '@/lib/supabaseAuth';
import { canEditReportingForChapter, canViewReporting, getReportingChapterWhere } from '@/lib/reportingAccess';
import {
  getAttendeeTypeLabel,
  getEventEntryModeLabel,
  getEventTypeLabel,
  needsChapterFollowUp,
  normalizeAttendeeType,
  normalizeEventEntryMode,
  normalizeEventType
} from '@/lib/eventAttendance';

type ChapterOption = {
  id: string;
  number: string | null;
  name: string | null;
  city: string | null;
  state: string | null;
  region: number | null;
};

type EventSummary = {
  id: string;
  chapterId: string;
  title: string;
  eventDate: string;
  eventType: string;
  entryMode: string;
  notes: string | null;
  chapter: ChapterOption;
  attendeeCount: number;
  creditedCount: number;
  unresolvedFollowUpCount: number;
};

type ChapterMemberOption = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  cmaNumber: string | null;
};

function parseDateInput(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) {
    return null;
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeText(value: unknown) {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text : null;
}

function toChapterOption(chapter: {
  id: string;
  number: string | null;
  name: string | null;
  city: string | null;
  state: string | null;
  region: number | null;
}): ChapterOption {
  return {
    id: chapter.id,
    number: chapter.number,
    name: chapter.name,
    city: chapter.city,
    state: chapter.state,
    region: chapter.region
  };
}

function buildEventSummary(event: {
  id: string;
  chapterId: string;
  title: string;
  eventDate: Date;
  eventType: string;
  entryMode: string;
  notes: string | null;
  chapter: ChapterOption;
  _count?: { attendees: number; followUps: number };
  attendees?: Array<{ creditedPersonId: string | null }>;
  followUps?: Array<{ resolvedAt: Date | null }>;
}): EventSummary {
  const attendeeCount = event.attendees?.length ?? event._count?.attendees ?? 0;
  const creditedCount = event.attendees?.filter((attendee) => Boolean(attendee.creditedPersonId)).length ?? attendeeCount;
  const unresolvedFollowUpCount = event.followUps
    ? event.followUps.filter((followUp) => !followUp.resolvedAt).length
    : event._count?.followUps ?? 0;

  return {
    id: event.id,
    chapterId: event.chapterId,
    title: event.title,
    eventDate: event.eventDate.toISOString(),
    eventType: getEventTypeLabel(event.eventType),
    entryMode: getEventEntryModeLabel(event.entryMode),
    notes: event.notes,
    chapter: toChapterOption(event.chapter),
    attendeeCount,
    creditedCount,
    unresolvedFollowUpCount
  };
}

function formatMemberDisplayName(member: ChapterMemberOption) {
  const fullName = [member.firstName, member.lastName].filter(Boolean).join(' ').trim();
  if (!fullName && member.cmaNumber) {
    return `CMA #${member.cmaNumber}`;
  }
  return fullName || 'Unnamed member';
}

async function loadScopedAccount(req: NextApiRequest) {
  const account = await authenticateAndSetRLSContext(req);
  if (!account) {
    return null;
  }

  return prisma.account.findUnique({
    where: { id: account.id },
    include: {
      chapter: true,
      orgUnit: true,
      person: {
        include: {
          chapter: true,
          officerAssignments: true
        }
      }
    }
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const scopedAccount = await loadScopedAccount(req);
  if (!scopedAccount) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  if (!canViewReporting(scopedAccount)) {
    return res.status(403).json({ message: 'Not authorized to view reporting.' });
  }

  const visibleChapters = await prisma.chapter.findMany({
    where: getReportingChapterWhere(scopedAccount),
    select: {
      id: true,
      number: true,
      name: true,
      city: true,
      state: true,
      region: true
    },
    orderBy: [{ number: 'asc' }, { name: 'asc' }]
  });

  const visibleChapterIds = visibleChapters.map((chapter) => chapter.id);
  const editableChapterIds = visibleChapterIds.filter((chapterId) => canEditReportingForChapter(scopedAccount, chapterId));
  const canEdit = editableChapterIds.length > 0;
  const requestedChapterId = normalizeText(req.query.chapterId);

  if (requestedChapterId && !visibleChapterIds.includes(requestedChapterId)) {
    return res.status(403).json({ message: 'Not authorized to access this chapter scope.' });
  }

  if (req.method === 'GET') {
    const scopedChapterIds = requestedChapterId ? [requestedChapterId] : visibleChapterIds;
    const eventId = normalizeText(req.query.eventId);

    const events = await prisma.chapterEvent.findMany({
      where: {
        chapterId: { in: scopedChapterIds }
      },
      include: {
        chapter: {
          select: {
            id: true,
            number: true,
            name: true,
            city: true,
            state: true,
            region: true
          }
        },
        attendees: {
          select: {
            creditedPersonId: true
          }
        },
        followUps: {
          select: {
            resolvedAt: true
          }
        },
        _count: {
          select: {
            attendees: true,
            followUps: true
          }
        }
      },
      orderBy: [{ eventDate: 'desc' }, { createdAt: 'desc' }]
    });

    const eventSummaries = events.map((event) => buildEventSummary(event));

    if (eventId) {
      const detail = await prisma.chapterEvent.findFirst({
        where: {
          id: eventId,
          chapterId: { in: scopedChapterIds }
        },
        include: {
          chapter: {
            select: {
              id: true,
              number: true,
              name: true,
              city: true,
              state: true,
              region: true
            }
          },
          attendees: {
            orderBy: [{ createdAt: 'asc' }],
            include: {
              person: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  cmaNumber: true,
                  chapterId: true
                }
              },
              creditedPerson: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  cmaNumber: true,
                  chapterId: true
                }
              },
              followUps: {
                orderBy: [{ createdAt: 'asc' }]
              }
            }
          },
          followUps: {
            orderBy: [{ createdAt: 'asc' }]
          }
        }
      });

      if (!detail) {
        return res.status(404).json({ message: 'Event not found.' });
      }

      const chapterMembers = await prisma.person.findMany({
        where: {
          chapterId: detail.chapterId
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          cmaNumber: true
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
      });

      return res.status(200).json({
        canEdit,
        visibleChapters: visibleChapters.map(toChapterOption),
        events: eventSummaries,
        memberOptions: chapterMembers.map((member) => ({
          id: member.id,
          firstName: member.firstName,
          lastName: member.lastName,
          cmaNumber: member.cmaNumber,
          displayName: formatMemberDisplayName(member)
        })),
        selectedEvent: {
          ...buildEventSummary({
            id: detail.id,
            chapterId: detail.chapterId,
            title: detail.title,
            eventDate: detail.eventDate,
            eventType: detail.eventType,
            entryMode: detail.entryMode,
            notes: detail.notes,
            chapter: detail.chapter,
            attendees: detail.attendees.map((attendee) => ({
              creditedPersonId: attendee.creditedPersonId
            })),
            followUps: detail.followUps.map((followUp) => ({
              resolvedAt: followUp.resolvedAt
            })),
            _count: {
              attendees: detail.attendees.length,
              followUps: detail.followUps.filter((followUp) => !followUp.resolvedAt).length
            }
          }),
          attendees: detail.attendees.map((attendee) => ({
            id: attendee.id,
            attendeeType: attendee.attendeeType,
            attendeeTypeLabel: getAttendeeTypeLabel(attendee.attendeeType),
            attendeeName: attendee.attendeeName,
            attendeeCmaNumber: attendee.attendeeCmaNumber,
            creditedPerson: attendee.creditedPerson
              ? {
                  id: attendee.creditedPerson.id,
                  firstName: attendee.creditedPerson.firstName,
                  lastName: attendee.creditedPerson.lastName,
                  cmaNumber: attendee.creditedPerson.cmaNumber
                }
              : null,
            person: attendee.person
              ? {
                  id: attendee.person.id,
                  firstName: attendee.person.firstName,
                  lastName: attendee.person.lastName,
                  cmaNumber: attendee.person.cmaNumber
                }
              : null,
            followUps: attendee.followUps.map((followUp) => ({
              id: followUp.id,
              followUpScope: followUp.followUpScope,
              message: followUp.message,
              resolvedAt: followUp.resolvedAt
            }))
          })),
          followUps: detail.followUps.map((followUp) => ({
            id: followUp.id,
            followUpScope: followUp.followUpScope,
            message: followUp.message,
            resolvedAt: followUp.resolvedAt
          }))
        }
      });
    }

    return res.status(200).json({
      canEdit,
      visibleChapters: visibleChapters.map(toChapterOption),
      events: eventSummaries,
      selectedEvent: null
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  if (!canEdit) {
    return res.status(403).json({ message: 'Not authorized to edit reporting.' });
  }

  const body = req.body as Record<string, unknown>;
  const action = String(body.action ?? 'create-event').trim();

  if (action === 'create-event') {
    const chapterId = normalizeText(body.chapterId);
    const title = normalizeText(body.title);
    const notes = normalizeText(body.notes);
    const eventType = normalizeEventType(body.eventType);
    const entryMode = normalizeEventEntryMode(body.entryMode);
    const eventDate = parseDateInput(body.eventDate);

    if (!chapterId || !visibleChapterIds.includes(chapterId)) {
      return res.status(400).json({ message: 'A valid chapter is required.' });
    }

    if (!title) {
      return res.status(400).json({ message: 'Event title is required.' });
    }

    if (!eventDate) {
      return res.status(400).json({ message: 'Event date is required.' });
    }

    if (!canEditReportingForChapter(scopedAccount, chapterId)) {
      return res.status(403).json({ message: 'Not authorized to create events for this chapter.' });
    }

    const created = await prisma.chapterEvent.create({
      data: {
        chapterId,
        title,
        eventDate,
        eventType,
        entryMode,
        notes,
        createdByAccountId: scopedAccount.id
      },
      include: {
        chapter: {
          select: {
            id: true,
            number: true,
            name: true,
            city: true,
            state: true,
            region: true
          }
        },
        attendees: {
          select: {
            creditedPersonId: true
          }
        },
        followUps: {
          select: {
            resolvedAt: true
          }
        },
        _count: {
          select: {
            attendees: true,
            followUps: true
          }
        }
      }
    });

    return res.status(201).json({
      message: 'Event created.',
      event: buildEventSummary(created)
    });
  }

  if (action === 'add-attendee') {
    const eventId = normalizeText(body.eventId);
    const memberId = normalizeText(body.memberId);
    const attendeeType = normalizeAttendeeType(body.attendeeType);
    const attendeeName = normalizeText(body.attendeeName);
    const attendeeCmaNumber = normalizeText(body.attendeeCmaNumber);
    const notes = normalizeText(body.notes);

    if (!eventId) {
      return res.status(400).json({ message: 'Event is required.' });
    }

    if (!attendeeType) {
      return res.status(400).json({ message: 'Attendee type is required.' });
    }

    const event = await prisma.chapterEvent.findFirst({
      where: {
        id: eventId,
        chapterId: { in: visibleChapterIds }
      },
      include: {
        chapter: true
      }
    });

    if (!event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    if (!canEditReportingForChapter(scopedAccount, event.chapterId)) {
      return res.status(403).json({ message: 'Not authorized to edit this event.' });
    }

    let matchedPerson = null as null | {
      id: string;
      firstName: string | null;
      lastName: string | null;
      cmaNumber: string | null;
      chapterId: string | null;
    };

    if (memberId) {
      matchedPerson = await prisma.person.findFirst({
        where: {
          id: memberId,
          chapterId: event.chapterId
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          cmaNumber: true,
          chapterId: true
        }
      });

      if (!matchedPerson) {
        return res.status(400).json({ message: 'Selected member must belong to the event chapter.' });
      }
    } else if (attendeeCmaNumber) {
      matchedPerson = await prisma.person.findFirst({
        where: {
          cmaNumber: attendeeCmaNumber,
          chapterId: event.chapterId
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          cmaNumber: true,
          chapterId: true
        }
      });
    }

    const derivedName = matchedPerson
      ? [matchedPerson.firstName, matchedPerson.lastName].filter(Boolean).join(' ').trim() || null
      : null;
    const resolvedAttendeeName = attendeeName ?? derivedName;
    const resolvedAttendeeCmaNumber = attendeeCmaNumber ?? matchedPerson?.cmaNumber ?? null;

    if (!resolvedAttendeeName && !resolvedAttendeeCmaNumber) {
      return res.status(400).json({ message: 'Attendee name or CMA number is required.' });
    }

    const attendee = await prisma.chapterEventAttendee.create({
      data: {
        eventId,
        attendeeType,
        attendeeName: resolvedAttendeeName,
        attendeeCmaNumber: resolvedAttendeeCmaNumber,
        personId: matchedPerson?.id ?? null,
        creditedPersonId: matchedPerson?.id ?? null
      }
    });

    const followUps = [] as Array<{ id: string; message: string; followUpScope: string }>;

    if (attendeeType !== 'guest') {
      const shouldRaiseChapterFollowUp = needsChapterFollowUp(attendeeType, matchedPerson?.chapterId);
      if (shouldRaiseChapterFollowUp) {
        const followUp = await prisma.chapterEventFollowUp.create({
          data: {
            eventId,
            attendeeId: attendee.id,
            personId: matchedPerson?.id ?? null,
            followUpScope: 'state',
            message: matchedPerson
              ? `Confirm chapter assignment for ${[matchedPerson.firstName, matchedPerson.lastName].filter(Boolean).join(' ') || matchedPerson.cmaNumber || 'this attendee'}.`
              : `Add chapter information for ${resolvedAttendeeName ?? resolvedAttendeeCmaNumber ?? 'this attendee'}.`
          }
        });
        followUps.push({ id: followUp.id, message: followUp.message, followUpScope: followUp.followUpScope });
      }
    }

    if (notes) {
      await prisma.chapterEventFollowUp.create({
        data: {
          eventId,
          attendeeId: attendee.id,
          personId: matchedPerson?.id ?? null,
          followUpScope: 'chapter',
          message: notes
        }
      });
    }

    return res.status(201).json({
      message: 'Attendee added.',
      attendee: {
        id: attendee.id,
        attendeeType,
        attendeeTypeLabel: getAttendeeTypeLabel(attendeeType),
        attendeeName: resolvedAttendeeName,
        attendeeCmaNumber: resolvedAttendeeCmaNumber,
        creditedPersonId: matchedPerson?.id ?? null,
        personId: matchedPerson?.id ?? null,
        followUps
      }
    });
  }

  return res.status(400).json({ message: 'Unknown action.' });
}
