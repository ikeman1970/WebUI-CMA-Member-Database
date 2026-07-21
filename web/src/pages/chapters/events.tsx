import { type FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import ChapterWorkspaceTabs from '@/components/ChapterWorkspaceTabs';
import { attendeeTypes, eventEntryModes, eventTypes, getAttendeeTypeLabel } from '@/lib/eventAttendance';

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

type SelectedEvent = EventSummary & {
  attendees: Array<{
    id: string;
    attendeeType: string;
    attendeeTypeLabel: string;
    attendeeName: string | null;
    attendeeCmaNumber: string | null;
    creditedPerson: { id: string; firstName: string | null; lastName: string | null; cmaNumber: string | null } | null;
    person: { id: string; firstName: string | null; lastName: string | null; cmaNumber: string | null } | null;
    followUps: Array<{ id: string; followUpScope: string; message: string; resolvedAt: string | null }>;
  }>;
  followUps: Array<{ id: string; followUpScope: string; message: string; resolvedAt: string | null }>;
};

type EventsResponse = {
  canEdit: boolean;
  visibleChapters: ChapterOption[];
  events: EventSummary[];
  memberOptions?: Array<{ id: string; firstName: string | null; lastName: string | null; cmaNumber: string | null; displayName: string }>;
  selectedEvent: SelectedEvent | null;
};

type EventFormState = {
  chapterId: string;
  title: string;
  eventDate: string;
  eventType: (typeof eventTypes)[number]['value'];
  entryMode: (typeof eventEntryModes)[number]['value'];
  notes: string;
};

type AttendeeFormState = {
  attendeeType: (typeof attendeeTypes)[number]['value'];
  memberId: string;
  attendeeName: string;
  attendeeCmaNumber: string;
  notes: string;
};

function formatChapterLabel(chapter: ChapterOption) {
  const prefix = [chapter.number, chapter.name].filter(Boolean).join(' - ');
  const suffix = [chapter.city, chapter.state].filter(Boolean).join(', ');
  return [prefix, suffix].filter(Boolean).join(' · ');
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function defaultDateTimeValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 16);
}

function defaultEventForm(chapterId: string | null): EventFormState {
  return {
    chapterId: chapterId ?? '',
    title: '',
    eventDate: defaultDateTimeValue(),
    eventType: 'fellowship',
    entryMode: 'pre',
    notes: ''
  };
}

function defaultAttendeeForm(): AttendeeFormState {
  return {
    attendeeType: attendeeTypes[0].value,
    memberId: '',
    attendeeName: '',
    attendeeCmaNumber: '',
    notes: ''
  };
}

export default function ChapterEventsPage() {
  const router = useRouter();
  const [visibleChapters, setVisibleChapters] = useState<ChapterOption[]>([]);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<SelectedEvent | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingEvent, setLoadingEvent] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [savingAttendee, setSavingAttendee] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [eventForm, setEventForm] = useState<EventFormState>(defaultEventForm(null));
  const [attendeeForm, setAttendeeForm] = useState<AttendeeFormState>(defaultAttendeeForm());
  const [memberOptions, setMemberOptions] = useState<Array<{ id: string; firstName: string | null; lastName: string | null; cmaNumber: string | null; displayName: string }>>([]);

  const isMemberLocked = attendeeForm.memberId.length > 0;

  async function loadEvents(preferredEventId?: string | null) {
    setLoadingEvents(true);
    try {
      const response = await fetch('/api/reporting/events', { credentials: 'include' });
      if (response.status === 401 || response.status === 403) {
        setError('You do not have permission to view events.');
        setVisibleChapters([]);
        setEvents([]);
        setSelectedEvent(null);
        setCanEdit(false);
        return;
      }

      if (!response.ok) {
        setError('Unable to load event reporting.');
        return;
      }

      const payload = (await response.json()) as EventsResponse;
      setVisibleChapters(payload.visibleChapters);
      setEvents(payload.events);
      setCanEdit(payload.canEdit);
      setError(null);

      const nextSelectedId = preferredEventId && payload.events.some((event) => event.id === preferredEventId)
        ? preferredEventId
        : selectedEventId && payload.events.some((event) => event.id === selectedEventId)
          ? selectedEventId
          : payload.events[0]?.id ?? null;

      if (nextSelectedId !== selectedEventId) {
        setSelectedEventId(nextSelectedId);
      }

      if (!nextSelectedId) {
        setSelectedEvent(null);
      }
    } finally {
      setLoadingEvents(false);
    }
  }

  async function loadSelectedEvent(eventId: string) {
    setLoadingEvent(true);
    try {
      const response = await fetch(`/api/reporting/events?eventId=${encodeURIComponent(eventId)}`, { credentials: 'include' });
      if (response.status === 401 || response.status === 403) {
        setError('You do not have permission to view events.');
        setSelectedEvent(null);
        return;
      }

      if (!response.ok) {
        setError('Unable to load the selected event.');
        return;
      }

      const payload = (await response.json()) as EventsResponse;
      setSelectedEvent(payload.selectedEvent);
      setMemberOptions(payload.memberOptions ?? []);
      setError(null);
    } finally {
      setLoadingEvent(false);
    }
  }

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    const preferredEventId = typeof router.query.eventId === 'string' ? router.query.eventId : null;
    void loadEvents(preferredEventId);
  }, [router.isReady]);

  useEffect(() => {
    if (!selectedEventId) {
      setSelectedEvent(null);
      return;
    }

    void loadSelectedEvent(selectedEventId);
  }, [selectedEventId]);

  useEffect(() => {
    if (!eventForm.chapterId && visibleChapters.length > 0) {
      setEventForm((current) => ({ ...current, chapterId: visibleChapters[0].id }));
    }
  }, [visibleChapters, eventForm.chapterId]);

  const attendeeTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const attendee of selectedEvent?.attendees ?? []) {
      totals.set(attendee.attendeeType, (totals.get(attendee.attendeeType) ?? 0) + 1);
    }
    return totals;
  }, [selectedEvent]);

  async function handleCreateEvent(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    setSavingEvent(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch('/api/reporting/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'create-event',
          chapterId: eventForm.chapterId,
          title: eventForm.title,
          eventDate: eventForm.eventDate,
          eventType: eventForm.eventType,
          entryMode: eventForm.entryMode,
          notes: eventForm.notes
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.message ?? 'Unable to create event.');
        return;
      }

      setMessage(payload?.message ?? 'Event created.');
      setEventForm(defaultEventForm(visibleChapters[0]?.id ?? null));
      await loadEvents(payload?.event?.id ?? null);
    } catch {
      setError('Unable to create event.');
    } finally {
      setSavingEvent(false);
    }
  }

  async function handleAddAttendee(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    if (!selectedEventId) {
      return;
    }

    setSavingAttendee(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch('/api/reporting/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'add-attendee',
          eventId: selectedEventId,
          attendeeType: attendeeForm.attendeeType,
          memberId: attendeeForm.memberId,
          attendeeName: attendeeForm.attendeeName,
          attendeeCmaNumber: attendeeForm.attendeeCmaNumber,
          notes: attendeeForm.notes
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.message ?? 'Unable to add attendee.');
        return;
      }

      setMessage(payload?.message ?? 'Attendee added.');
      setAttendeeForm(defaultAttendeeForm());
      await loadEvents(selectedEventId);
    } catch {
      setError('Unable to add attendee.');
    } finally {
      setSavingAttendee(false);
    }
  }

  useEffect(() => {
    if (!attendeeForm.memberId) {
      return;
    }

    const selected = memberOptions.find((option) => option.id === attendeeForm.memberId);
    if (!selected) {
      return;
    }

    const selectedName = selected.displayName;
    setAttendeeForm((current) => ({
      ...current,
      attendeeName: selectedName,
      attendeeCmaNumber: selected.cmaNumber ?? ''
    }));
  }, [attendeeForm.memberId, memberOptions]);

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    const queryEventId = typeof router.query.eventId === 'string' ? router.query.eventId : null;
    const queryMemberId = typeof router.query.memberId === 'string' ? router.query.memberId : null;

    if (!queryEventId || !queryMemberId) {
      return;
    }

    if (selectedEventId !== queryEventId || memberOptions.length === 0) {
      return;
    }

    const exists = memberOptions.some((option) => option.id === queryMemberId);
    if (!exists) {
      return;
    }

    setAttendeeForm((current) => ({ ...current, memberId: queryMemberId }));
    setMessage('Member created and preselected for attendee entry.');
    setError(null);

    void router.replace(
      {
        pathname: router.pathname,
        query: { eventId: queryEventId }
      },
      undefined,
      { shallow: true }
    );
  }, [router, selectedEventId, memberOptions]);

  const selectedEventChapterId = selectedEvent?.chapterId ?? '';
  const addMemberHref = selectedEventChapterId
    ? `/members/new?chapterId=${encodeURIComponent(selectedEventChapterId)}&returnTo=${encodeURIComponent(`/chapters/events?eventId=${selectedEventId ?? ''}`)}`
    : null;

  return (
    <main className="page-shell">
      <ChapterWorkspaceTabs activeTab="events" />
      <header className="reporting-header">
        <div>
          <h1>Events</h1>
          <p className="reporting-subtitle">Chapter admins create events first, then add attendees before or after the event happens.</p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => window.print()}>
          Print Report
        </button>
      </header>

      {error ? <p className="message-error">{error}</p> : null}
      {message ? <p className="message-success">{message}</p> : null}

      {canEdit ? (
        <details className="card" style={{ marginTop: 16 }}>
          <summary style={{ cursor: 'pointer', listStyle: 'none' }}>
            <h2 style={{ display: 'inline', marginRight: 12 }}>Create New Event</h2>
            <span className="badge">Expand to add event details</span>
          </summary>
          <div style={{ marginTop: 16 }}>
            <form onSubmit={handleCreateEvent} style={{ display: 'grid', gap: 12 }}>
              <div className="reporting-toolbar" style={{ alignItems: 'end' }}>
                <label>
                  Chapter
                  <select className="input" value={eventForm.chapterId} onChange={(event) => setEventForm((current) => ({ ...current, chapterId: event.target.value }))}>
                    <option value="">Select a chapter</option>
                    {visibleChapters.map((chapter) => (
                      <option key={chapter.id} value={chapter.id}>{formatChapterLabel(chapter)}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Type Classification
                  <select className="input" value={eventForm.eventType} onChange={(event) => setEventForm((current) => ({ ...current, eventType: event.target.value as EventFormState['eventType'] }))}>
                    {eventTypes.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Entry Mode
                  <select className="input" value={eventForm.entryMode} onChange={(event) => setEventForm((current) => ({ ...current, entryMode: event.target.value as EventFormState['entryMode'] }))}>
                    {eventEntryModes.map((mode) => (
                      <option key={mode.value} value={mode.value}>{mode.label}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Event Date
                  <input type="datetime-local" className="input" value={eventForm.eventDate} onChange={(event) => setEventForm((current) => ({ ...current, eventDate: event.target.value }))} />
                </label>
              </div>

              <label>
                Title
                <input className="input" value={eventForm.title} onChange={(event) => setEventForm((current) => ({ ...current, title: event.target.value }))} placeholder="Chapter meeting, ride, dinner, or other event" />
              </label>

              <label>
                Notes
                <textarea className="input" rows={3} value={eventForm.notes} onChange={(event) => setEventForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Optional context or follow-up notes" />
              </label>

              <div>
                <button type="submit" className="btn-secondary" disabled={savingEvent || !eventForm.chapterId || !eventForm.title.trim()}>
                  {savingEvent ? 'Creating...' : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </details>
      ) : null}

      <section className="card" style={{ marginTop: 16 }}>
        <div className="reporting-toolbar">
          <h2>Event List</h2>
          <span>{loadingEvents ? 'Loading events...' : `${events.length} event(s)`}</span>
        </div>

        {events.length === 0 && !loadingEvents ? <p>No events have been created yet.</p> : null}

        {events.length > 0 ? (
          <div style={{ display: 'grid', gap: 12 }}>
            {events.map((event) => {
              const isSelected = event.id === selectedEventId;
              return (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => setSelectedEventId(event.id)}
                  style={{
                    textAlign: 'left',
                    border: isSelected ? '2px solid var(--color-accent, #8b6cff)' : '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 14,
                    padding: 14,
                    background: isSelected ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                    color: 'inherit',
                    cursor: 'pointer'
                  }}
                >
                  <div className="reporting-toolbar" style={{ alignItems: 'start' }}>
                    <div>
                      <strong>{event.title}</strong>
                      <div style={{ opacity: 0.8, marginTop: 4 }}>{formatChapterLabel(event.chapter)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div>{formatDateTime(event.eventDate)}</div>
                      <div style={{ opacity: 0.8 }}>{event.eventType}</div>
                      <div style={{ opacity: 0.8 }}>{event.entryMode}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                    <span className="badge">{event.attendeeCount} attendee(s)</span>
                    <span className="badge">{event.creditedCount} credited</span>
                    <span className="badge">{event.unresolvedFollowUpCount} follow-up(s)</span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : null}
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="reporting-toolbar">
          <h2>Selected Event</h2>
          {selectedEvent ? <span>{selectedEvent.eventType}</span> : null}
        </div>

        {loadingEvent ? <p>Loading selected event...</p> : null}

        {!loadingEvent && selectedEvent ? (
          <div style={{ display: 'grid', gap: 16 }}>
            <div className="info-table info-table--grid" style={{ display: 'grid', gap: 8, padding: 0, border: 'none', background: 'transparent' }}>
              <div><strong>{selectedEvent.title}</strong></div>
              <div>{formatChapterLabel(selectedEvent.chapter)}</div>
              <div>{formatDateTime(selectedEvent.eventDate)}</div>
              <div>{selectedEvent.notes ?? 'No notes added.'}</div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <span className="badge">{selectedEvent.eventType}</span>
              <span className="badge">{selectedEvent.entryMode}</span>
              <span className="badge">{selectedEvent.attendeeCount} attendee(s)</span>
              <span className="badge">{selectedEvent.creditedCount} credited</span>
              <span className="badge">{selectedEvent.unresolvedFollowUpCount} follow-up(s)</span>
            </div>

            {canEdit ? (
              <form onSubmit={handleAddAttendee} style={{ display: 'grid', gap: 12 }}>
                <h3>Add Attendee</h3>
                <div className="reporting-toolbar" style={{ alignItems: 'center' }}>
                  <span className="badge">Chapter member selection</span>
                  {addMemberHref ? (
                    <Link href={addMemberHref} className="btn-secondary" style={{ textDecoration: 'none' }}>
                      Add New Member
                    </Link>
                  ) : null}
                  {isMemberLocked ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setAttendeeForm((current) => ({
                        ...current,
                        memberId: '',
                        attendeeName: '',
                        attendeeCmaNumber: ''
                      }))}
                    >
                      Unlock
                    </button>
                  ) : null}
                </div>
                <div className="reporting-toolbar" style={{ alignItems: 'end' }}>
                  <label>
                    Type
                    <select className="input" value={attendeeForm.attendeeType} onChange={(event) => setAttendeeForm((current) => ({ ...current, attendeeType: event.target.value as AttendeeFormState['attendeeType'] }))}>
                      {attendeeTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                    </select>
                  </label>
                  <label>
                    Chapter Member
                    <select
                      className="input"
                      value={attendeeForm.memberId}
                      onChange={(event) => setAttendeeForm((current) => ({ ...current, memberId: event.target.value }))}
                    >
                      <option value="">Select a chapter member (optional)</option>
                      {memberOptions.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.displayName}{member.cmaNumber ? ` (${member.cmaNumber})` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Attendee Name
                    {isMemberLocked ? <span className="badge" style={{ marginLeft: 8 }}>Synced from chapter member</span> : null}
                    <input
                      className="input"
                      value={attendeeForm.attendeeName}
                      onChange={(event) => setAttendeeForm((current) => ({ ...current, attendeeName: event.target.value }))}
                      placeholder="Guest or member name"
                      disabled={isMemberLocked}
                    />
                  </label>
                  <label>
                    CMA Number
                    {isMemberLocked ? <span className="badge" style={{ marginLeft: 8 }}>Synced from chapter member</span> : null}
                    <input
                      className="input"
                      value={attendeeForm.attendeeCmaNumber}
                      onChange={(event) => setAttendeeForm((current) => ({ ...current, attendeeCmaNumber: event.target.value }))}
                      placeholder="Optional if known"
                      disabled={isMemberLocked}
                    />
                  </label>
                </div>
                {isMemberLocked ? (
                  <p style={{ margin: 0, opacity: 0.85 }}>Name and CMA Number are locked to the selected chapter member.</p>
                ) : null}
                <label>
                  Notes
                  <textarea className="input" rows={3} value={attendeeForm.notes} onChange={(event) => setAttendeeForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Optional follow-up note" />
                </label>
                <div>
                  <button type="submit" className="btn-secondary" disabled={savingAttendee}>{savingAttendee ? 'Saving...' : 'Add Attendee'}</button>
                </div>
              </form>
            ) : null}

            <div>
              <h3>Attendees</h3>
              {selectedEvent.attendees.length === 0 ? (
                <p>No attendees have been added yet.</p>
              ) : (
                <div className="reporting-table-wrap">
                  <table className="info-table info-table--grid">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Name</th>
                        <th>CMA #</th>
                        <th>Credit</th>
                        <th>Follow-up</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedEvent.attendees.map((attendee) => {
                        const followUpText = attendee.followUps.filter((followUp) => !followUp.resolvedAt).map((followUp) => followUp.message);
                        return (
                          <tr key={attendee.id}>
                            <td>{attendee.attendeeTypeLabel || getAttendeeTypeLabel(attendee.attendeeType)}</td>
                            <td>{attendee.attendeeName ?? '—'}</td>
                            <td>{attendee.attendeeCmaNumber ?? attendee.person?.cmaNumber ?? '—'}</td>
                            <td>{attendee.creditedPerson ? [attendee.creditedPerson.firstName, attendee.creditedPerson.lastName].filter(Boolean).join(' ') : 'Guest / uncredited'}</td>
                            <td>{followUpText.length > 0 ? followUpText.join(' ') : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <h3>Attendee Mix</h3>
              {selectedEvent.attendees.length === 0 ? (
                <p>No breakdown available yet.</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {attendeeTypes.map((type) => {
                    const count = attendeeTotals.get(type.value) ?? 0;
                    if (count === 0) return null;
                    return <span key={type.value} className="badge">{type.label}: {count}</span>;
                  })}
                </div>
              )}
            </div>

            {selectedEvent.followUps.length > 0 ? (
              <div>
                <h3>Follow-ups</h3>
                <ul>
                  {selectedEvent.followUps.map((followUp) => (
                    <li key={followUp.id}>[{followUp.followUpScope}] {followUp.message}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {!loadingEvent && !selectedEvent ? <p>Select an event to view and add attendees.</p> : null}
      </section>
    </main>
  );
}
