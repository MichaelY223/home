import { useCallback, useEffect, useMemo, useState } from 'react';

import { getBCHolidays, getChineseCulturalDates } from '@/constants/holidays';
import { useFamilySession } from '@/hooks/use-family-session';
import type { FamilyMember } from '@/hooks/use-family-members';
import { supabase } from '@/lib/supabase';

export type EventVisibility = 'private' | 'shared';

export type CalendarEvent = {
  color: string;
  createdBy: string | null;
  createdByName: string;
  dateKey: string;
  id: string;
  isMine: boolean;
  readOnly: boolean;
  time: string;
  title: string;
  type: 'user' | 'holiday' | 'birthday';
  visibility: EventVisibility;
};

type EventRow = {
  color: string;
  created_by: string | null;
  created_by_name: string | null;
  date_key: string;
  id: string;
  read_only: boolean;
  time: string;
  title: string;
  type: 'user' | 'holiday' | 'birthday';
  visibility: EventVisibility | null;
};

export function getDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function systemEvent(base: Omit<CalendarEvent, 'createdBy' | 'createdByName' | 'isMine' | 'visibility'>): CalendarEvent {
  return { ...base, createdBy: null, createdByName: '', isMine: false, visibility: 'shared' };
}

function getSystemEvents(year: number, members: FamilyMember[]): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (const holiday of getBCHolidays(year)) {
    events.push(
      systemEvent({
        color: '#35597C',
        dateKey: holiday.dateKey,
        id: `holiday-${holiday.dateKey}-${holiday.title}`,
        readOnly: true,
        time: 'All day',
        title: holiday.title,
        type: 'holiday',
      })
    );
  }

  for (const cultural of getChineseCulturalDates(year)) {
    events.push(
      systemEvent({
        color: '#C79A44',
        dateKey: cultural.dateKey,
        id: `cultural-${cultural.dateKey}-${cultural.title}`,
        readOnly: true,
        time: 'All day',
        title: cultural.title,
        type: 'holiday',
      })
    );
  }

  for (const member of members) {
    if (!member.birthday) {
      continue;
    }

    const [, monthStr, dayStr] = member.birthday.split('-');
    const dateKey = `${year}-${monthStr}-${dayStr}`;

    events.push(
      systemEvent({
        color: member.avatarColor,
        dateKey,
        id: `birthday-${member.id}-${year}`,
        readOnly: true,
        time: 'All day',
        title: `🎂 ${member.displayName}'s Birthday`,
        type: 'birthday',
      })
    );
  }

  return events;
}

export function useCalendarEvents(members: FamilyMember[] = []) {
  const { familyId, hydrated: sessionHydrated, userId } = useFamilySession();
  const [rows, setRows] = useState<EventRow[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const fetchEvents = useCallback(async (fid: string) => {
    const { data, error } = await supabase.from('calendar_events').select('*').eq('family_id', fid);
    if (error) {
      console.warn('Failed to load calendar events', error.message);
      return;
    }
    setRows((data ?? []) as EventRow[]);
  }, []);

  const refresh = useCallback(async () => {
    if (familyId) await fetchEvents(familyId);
  }, [familyId, fetchEvents]);

  useEffect(() => {
    if (!sessionHydrated) return;
    if (!familyId) {
      setRows([]);
      setHydrated(true);
      return;
    }
    setHydrated(false);
    fetchEvents(familyId).finally(() => setHydrated(true));

    const channel = supabase
      .channel(`calendar-events-${familyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calendar_events', filter: `family_id=eq.${familyId}` },
        () => fetchEvents(familyId)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionHydrated, familyId, fetchEvents]);

  // Prefer the member's current display name so renames are reflected, falling
  // back to the name captured when the event was created.
  const events = useMemo(() => {
    const nameById = new Map(members.map((m) => [m.id, m.displayName]));
    return rows.map<CalendarEvent>((row) => ({
      color: row.color,
      createdBy: row.created_by,
      createdByName: (row.created_by && nameById.get(row.created_by)) || row.created_by_name || 'Someone',
      dateKey: row.date_key,
      id: row.id,
      isMine: Boolean(row.created_by && row.created_by === userId),
      readOnly: row.read_only,
      time: row.time,
      title: row.title,
      type: row.type,
      visibility: row.visibility ?? 'shared',
    }));
  }, [rows, members, userId]);

  async function addEvent(
    dateKey: string,
    title: string,
    time: string,
    color: string,
    visibility: EventVisibility = 'shared'
  ) {
    const trimmedTitle = title.trim();
    const trimmedTime = time.trim();

    if (!trimmedTitle || !trimmedTime || !familyId) {
      return;
    }

    const createdByName = members.find((m) => m.id === userId)?.displayName ?? '';

    const { data, error } = await supabase
      .from('calendar_events')
      .insert({
        color,
        created_by: userId,
        created_by_name: createdByName,
        date_key: dateKey,
        family_id: familyId,
        time: trimmedTime,
        title: trimmedTitle,
        type: 'user',
        visibility,
      })
      .select()
      .single();

    if (error) throw error;
    if (data) {
      setRows((prev) => [...prev, data as EventRow]);
    }
  }

  async function removeEvent(id: string) {
    const previous = rows;
    setRows((prev) => prev.filter((row) => row.id !== id));
    const { error } = await supabase.from('calendar_events').delete().eq('id', id);
    if (error) {
      setRows(previous);
      throw error;
    }
  }

  const allEvents = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const years = [currentYear, currentYear + 1];
    const system = years.flatMap((y) => getSystemEvents(y, members));
    return [...events, ...system];
  }, [events, members]);

  const eventsByDate = useMemo(
    () =>
      allEvents.reduce<Record<string, CalendarEvent[]>>((grouped, event) => {
        grouped[event.dateKey] = [...(grouped[event.dateKey] ?? []), event];
        return grouped;
      }, {}),
    [allEvents]
  );

  return {
    addEvent,
    events: allEvents,
    eventsByDate,
    hydrated,
    refresh,
    removeEvent,
    userEvents: events,
  };
}
