export const eventEntryModes = [
  { value: 'pre', label: 'Pre-event' },
  { value: 'post', label: 'Post-event' }
] as const;

export const eventTypes = [
  { value: 'secular', label: 'Secular Events' },
  { value: 'outreach', label: 'Outreach Events' },
  { value: 'fellowship', label: 'Fellowship Events' }
] as const;

export const attendeeTypes = [
  { value: 'chapter_member', label: 'Chapter Member' },
  { value: 'guest', label: 'Non-CMA Guest' },
  { value: 'chapter_member_other_chapter', label: 'Chapter Member / Officer from another CMA chapter' },
  { value: 'state_leadership_same_state', label: 'State Leadership (same state)' },
  { value: 'state_leadership_other_state', label: 'State Leadership (different state)' },
  { value: 'region_leadership_same_region', label: 'Region Leadership (same region)' },
  { value: 'region_leadership_other_region', label: 'Region Leadership (different region)' },
  { value: 'national', label: 'National' }
] as const;

export type AttendeeTypeValue = (typeof attendeeTypes)[number]['value'];
export type EventEntryModeValue = (typeof eventEntryModes)[number]['value'];
export type EventTypeValue = (typeof eventTypes)[number]['value'];

const attendeeTypeLookup = new Map(attendeeTypes.map((item) => [item.value, item.label] as const));
const entryModeLookup = new Map(eventEntryModes.map((item) => [item.value, item.label] as const));
const eventTypeLookup = new Map(eventTypes.map((item) => [item.value, item.label] as const));

export function normalizeEventEntryMode(value: unknown): EventEntryModeValue {
  return String(value ?? '').trim().toLowerCase() === 'post' ? 'post' : 'pre';
}

export function normalizeAttendeeType(value: unknown): AttendeeTypeValue | null {
  const normalized = String(value ?? '').trim().toLowerCase();
  return attendeeTypeLookup.has(normalized as AttendeeTypeValue) ? (normalized as AttendeeTypeValue) : null;
}

export function getAttendeeTypeLabel(value: string | null | undefined) {
  return attendeeTypeLookup.get(String(value ?? '').trim().toLowerCase() as AttendeeTypeValue) ?? String(value ?? '').trim() ?? 'Unknown';
}

export function getEventEntryModeLabel(value: string | null | undefined) {
  return entryModeLookup.get(String(value ?? '').trim().toLowerCase() as EventEntryModeValue) ?? 'Pre-event';
}

export function normalizeEventType(value: unknown): EventTypeValue {
  const normalized = String(value ?? '').trim().toLowerCase();
  return eventTypeLookup.has(normalized as EventTypeValue) ? (normalized as EventTypeValue) : 'fellowship';
}

export function getEventTypeLabel(value: string | null | undefined) {
  return eventTypeLookup.get(String(value ?? '').trim().toLowerCase() as EventTypeValue) ?? 'Fellowship Events';
}

export function needsChapterFollowUp(attendeeType: AttendeeTypeValue, personChapterId: string | null | undefined) {
  return attendeeType !== 'guest' && !String(personChapterId ?? '').trim();
}
